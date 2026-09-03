/**
 * Server-Side Brevo Transactional Email Service
 * 
 * Securely communicates with Brevo API v3 (https://api.brevo.com/v3/smtp/email).
 * The BREVO_API_KEY is kept strictly server-side and never exposed to the frontend.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: EmailRecipient[] | EmailRecipient | string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: EmailRecipient | string;
  sender?: EmailRecipient;
  notificationType?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'failed' | 'simulated' | 'queued';
  provider: 'brevo' | 'simulation';
  error?: {
    code: 'EMAIL_CONFIGURATION_ERROR' | 'EMAIL_VALIDATION_ERROR' | 'EMAIL_PROVIDER_ERROR' | 'EMAIL_RATE_LIMITED' | 'EMAIL_SEND_FAILED';
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface EmailLogEntry {
  id: string;
  recipient: string;
  recipientName?: string;
  notificationType: string;
  subject: string;
  status: 'sent' | 'failed' | 'simulated' | 'queued';
  provider: 'brevo' | 'simulation';
  providerMessageId?: string;
  createdAt: string;
  errorMessage?: string;
  htmlPreview?: string;
  metadata?: Record<string, any>;
}

// In-memory log store with circular buffer (up to 200 recent emails)
const inMemoryLogs: EmailLogEntry[] = [];

// Rate limiting table: IP/Identifier -> timestamp array
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_EMAILS_PER_MINUTE = 30;

/**
 * Validates email format using standard RFC 5322 regex pattern
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Standard RFC 5322 email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Checks in-memory rate limiting for incoming dispatch requests
 */
export function checkRateLimit(identifier: string = 'global'): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(identifier) || [];
  
  // Filter out timestamps outside window
  const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= MAX_EMAILS_PER_MINUTE) {
    return false;
  }
  
  recent.push(now);
  rateLimitMap.set(identifier, recent);
  return true;
}

/**
 * Get Brevo configuration values from environment
 */
export function getBrevoConfig() {
  const apiKey = (process.env.BREVO_API_KEY || '').trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'noreply@imsc.edu.ng').trim();
  const senderName = (process.env.BREVO_SENDER_NAME || 'Imam Malik Science & Tahfiz College').trim();
  const adminEmail = (process.env.ADMIN_EMAIL || 'maitechitservices6@gmail.com').trim();

  return {
    isConfigured: !!apiKey && apiKey.length > 10 && !apiKey.includes('placeholder'),
    apiKey,
    senderEmail,
    senderName,
    adminEmail
  };
}

/**
 * Records an email entry to the in-memory log buffer
 */
export function recordEmailLog(entry: Omit<EmailLogEntry, 'id' | 'createdAt'>): EmailLogEntry {
  const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const log: EmailLogEntry = {
    id,
    createdAt: new Date().toISOString(),
    ...entry
  };

  inMemoryLogs.unshift(log);
  if (inMemoryLogs.length > 200) {
    inMemoryLogs.pop();
  }

  return log;
}

/**
 * Retrieves all stored email logs
 */
export function getEmailLogs(limit: number = 50): EmailLogEntry[] {
  return inMemoryLogs.slice(0, limit);
}

/**
 * Finds a specific email log by ID
 */
export function findEmailLogById(id: string): EmailLogEntry | undefined {
  return inMemoryLogs.find(l => l.id === id);
}

/**
 * Core sendEmail function
 * Dispatches via Brevo API v3 or simulates delivery if API key is not yet configured.
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const timestamp = new Date().toISOString();
  const config = getBrevoConfig();

  // 1. Normalize recipients
  let recipients: EmailRecipient[] = [];
  if (typeof options.to === 'string') {
    recipients = [{ email: options.to.trim() }];
  } else if (Array.isArray(options.to)) {
    recipients = options.to.map(r => typeof r === 'string' ? { email: r } : r);
  } else if (options.to && typeof options.to === 'object' && 'email' in options.to) {
    recipients = [options.to as EmailRecipient];
  }

  if (recipients.length === 0) {
    const errorResult: EmailSendResult = {
      success: false,
      status: 'failed',
      provider: 'brevo',
      error: {
        code: 'EMAIL_VALIDATION_ERROR',
        message: 'No recipient email addresses provided.'
      },
      timestamp
    };
    recordEmailLog({
      recipient: 'unknown',
      notificationType: options.notificationType || 'general',
      subject: options.subject,
      status: 'failed',
      provider: 'brevo',
      errorMessage: 'No recipient email addresses provided.',
      htmlPreview: options.htmlContent,
      metadata: options.metadata
    });
    return errorResult;
  }

  // 2. Validate recipient emails
  for (const r of recipients) {
    if (!isValidEmail(r.email)) {
      const errorResult: EmailSendResult = {
        success: false,
        status: 'failed',
        provider: 'brevo',
        error: {
          code: 'EMAIL_VALIDATION_ERROR',
          message: `Invalid recipient email address format: "${r.email}"`
        },
        timestamp
      };
      recordEmailLog({
        recipient: r.email,
        recipientName: r.name,
        notificationType: options.notificationType || 'general',
        subject: options.subject,
        status: 'failed',
        provider: 'brevo',
        errorMessage: `Invalid recipient email address format: "${r.email}"`,
        htmlPreview: options.htmlContent,
        metadata: options.metadata
      });
      return errorResult;
    }
  }

  const primaryRecipient = recipients[0];

  // 3. Check rate limiting
  if (!checkRateLimit(primaryRecipient.email)) {
    const errorResult: EmailSendResult = {
      success: false,
      status: 'failed',
      provider: 'brevo',
      error: {
        code: 'EMAIL_RATE_LIMITED',
        message: 'Too many email requests sent to this address in a short period. Please wait a moment.'
      },
      timestamp
    };
    recordEmailLog({
      recipient: primaryRecipient.email,
      recipientName: primaryRecipient.name,
      notificationType: options.notificationType || 'general',
      subject: options.subject,
      status: 'failed',
      provider: 'brevo',
      errorMessage: 'Rate limit exceeded.',
      htmlPreview: options.htmlContent,
      metadata: options.metadata
    });
    return errorResult;
  }

  // 4. Determine Sender
  const senderObj = options.sender || {
    name: config.senderName,
    email: config.senderEmail
  };

  // 5. If Brevo is NOT configured, run in safe simulation mode
  if (!config.isConfigured) {
    console.info(`[Email Service - Simulated] To: ${primaryRecipient.email} | Subject: "${options.subject}" | Type: ${options.notificationType || 'general'}`);
    
    const simulatedResult: EmailSendResult = {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'simulated',
      provider: 'simulation',
      timestamp
    };

    recordEmailLog({
      recipient: primaryRecipient.email,
      recipientName: primaryRecipient.name,
      notificationType: options.notificationType || 'general',
      subject: options.subject,
      status: 'simulated',
      provider: 'simulation',
      providerMessageId: simulatedResult.messageId,
      htmlPreview: options.htmlContent,
      metadata: options.metadata
    });

    return simulatedResult;
  }

  // 6. Real Brevo API v3 Request
  try {
    const brevoPayload: Record<string, any> = {
      sender: senderObj,
      to: recipients.map(r => ({ email: r.email.trim(), name: r.name?.trim() || undefined })),
      subject: options.subject.trim(),
      htmlContent: options.htmlContent,
      textContent: options.textContent || undefined,
      tags: options.tags || (options.notificationType ? [options.notificationType] : ['transactional'])
    };

    if (options.replyTo) {
      if (typeof options.replyTo === 'string') {
        brevoPayload.replyTo = { email: options.replyTo.trim() };
      } else {
        brevoPayload.replyTo = { email: options.replyTo.email.trim(), name: options.replyTo.name?.trim() };
      }
    }

    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': config.apiKey
      },
      body: JSON.stringify(brevoPayload)
    });

    const responseData: any = await brevoResponse.json().catch(() => ({}));

    if (!brevoResponse.ok) {
      const errorMsg = responseData?.message || `Brevo API returned status ${brevoResponse.status}`;
      console.error(`[Email Service - Brevo Error ${brevoResponse.status}]:`, errorMsg);

      const errorResult: EmailSendResult = {
        success: false,
        status: 'failed',
        provider: 'brevo',
        error: {
          code: 'EMAIL_PROVIDER_ERROR',
          message: errorMsg,
          details: responseData
        },
        timestamp
      };

      recordEmailLog({
        recipient: primaryRecipient.email,
        recipientName: primaryRecipient.name,
        notificationType: options.notificationType || 'general',
        subject: options.subject,
        status: 'failed',
        provider: 'brevo',
        errorMessage: errorMsg,
        htmlPreview: options.htmlContent,
        metadata: options.metadata
      });

      return errorResult;
    }

    const messageId = responseData?.messageId || `msg_${Date.now()}`;
    console.info(`[Email Service - Sent via Brevo] MessageId: ${messageId} | To: ${primaryRecipient.email}`);

    const successResult: EmailSendResult = {
      success: true,
      messageId,
      status: 'sent',
      provider: 'brevo',
      timestamp
    };

    recordEmailLog({
      recipient: primaryRecipient.email,
      recipientName: primaryRecipient.name,
      notificationType: options.notificationType || 'general',
      subject: options.subject,
      status: 'sent',
      provider: 'brevo',
      providerMessageId: messageId,
      htmlPreview: options.htmlContent,
      metadata: options.metadata
    });

    return successResult;
  } catch (err: any) {
    const errorMsg = err?.message || 'Network exception connecting to Brevo API';
    console.error('[Email Service - Network Exception]:', errorMsg);

    const errorResult: EmailSendResult = {
      success: false,
      status: 'failed',
      provider: 'brevo',
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: errorMsg
      },
      timestamp
    };

    recordEmailLog({
      recipient: primaryRecipient.email,
      recipientName: primaryRecipient.name,
      notificationType: options.notificationType || 'general',
      subject: options.subject,
      status: 'failed',
      provider: 'brevo',
      errorMessage: errorMsg,
      htmlPreview: options.htmlContent,
      metadata: options.metadata
    });

    return errorResult;
  }
}
