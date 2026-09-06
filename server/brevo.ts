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
  forceSimulation?: boolean;
  allowSimulationFallback?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  status: 'sent' | 'failed' | 'simulated' | 'queued';
  provider: 'brevo' | 'simulation';
  warning?: string;
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

export interface BrevoConfigInfo {
  isConfigured: boolean;
  apiKey: string;
  senderEmail: string;
  senderName: string;
  adminEmail: string;
  status: 'active' | 'simulation' | 'invalid_key_format';
  keyWarning?: string;
  maskedKey?: string;
}

/**
 * Get Brevo configuration values from environment with pattern inspection
 */
export function getBrevoConfig(): BrevoConfigInfo {
  let apiKey = (process.env.BREVO_API_KEY || '').trim();
  apiKey = apiKey.replace(/^["']|["']$/g, '').trim();

  // Use configured sender email or school admin email
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || 'maitechitservices6@gmail.com').trim();
  let senderName = (process.env.BREVO_SENDER_NAME || 'Imam Malik Science & Tahfiz College').trim();
  if (senderName.includes('Thfiz')) {
    senderName = senderName.replace('Thfiz', 'Tahfiz');
  }
  const adminEmail = (process.env.ADMIN_EMAIL || 'maitechitservices6@gmail.com').trim();

  // Inspect key format
  const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(apiKey);
  const isPlaceholder = !apiKey || apiKey.toLowerCase().includes('placeholder') || apiKey.toLowerCase().includes('your_');
  const startsWithBrevoPrefix = apiKey.startsWith('xkeysib-');
  const hasValidLength = apiKey.length >= 25;

  let isConfigured = false;
  let status: 'active' | 'simulation' | 'invalid_key_format' = 'simulation';
  let keyWarning: string | undefined;

  if (isIPv4) {
    status = 'invalid_key_format';
    keyWarning = `Configured BREVO_API_KEY is an IP address ("${apiKey}") rather than a Brevo v3 API key. Brevo API keys start with "xkeysib-". Safe simulation mode has been automatically activated.`;
  } else if (isPlaceholder) {
    status = 'simulation';
    keyWarning = 'BREVO_API_KEY is not configured yet. Running in safe simulation mode.';
  } else if (!startsWithBrevoPrefix && !hasValidLength) {
    status = 'invalid_key_format';
    keyWarning = `BREVO_API_KEY format unrecognized (Brevo v3 keys start with "xkeysib-"). Safe simulation mode active.`;
  } else {
    // Valid key signature
    isConfigured = true;
    status = 'active';
  }

  const maskedKey = apiKey
    ? (apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : '****')
    : undefined;

  return {
    isConfigured,
    apiKey,
    senderEmail,
    senderName,
    adminEmail,
    status,
    keyWarning,
    maskedKey
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

  // 5. If Simulation is forced OR Brevo is NOT configured, run in safe simulation mode
  if (options.forceSimulation || !config.isConfigured) {
    const reason = options.forceSimulation ? 'Forced Simulation' : (config.keyWarning || 'Safe Simulation Mode Active');
    console.info(`[Email Service - Simulated] To: ${primaryRecipient.email} | Subject: "${options.subject}" | Reason: ${reason}`);
    
    const simulatedResult: EmailSendResult = {
      success: true,
      messageId: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: 'simulated',
      provider: 'simulation',
      warning: config.keyWarning,
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
      errorMessage: config.keyWarning,
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
      const rawError = responseData?.message || responseData?.error || `HTTP status ${brevoResponse.status}`;
      let detailedMsg = `Brevo API error (${brevoResponse.status}): ${rawError}`;

      if (brevoResponse.status === 401) {
        detailedMsg = `Brevo API Key Unauthorized (${rawError}). Please verify that your BREVO_API_KEY is active in your Brevo account (app.brevo.com -> SMTP & API).`;
      } else if (brevoResponse.status === 400 && String(rawError).toLowerCase().includes('sender')) {
        detailedMsg = `Brevo Sender Email Unverified (${rawError}). The sender "${senderObj.email}" must be verified in Brevo Senders & IP.`;
      }

      console.error(`[Email Service - Brevo Error ${brevoResponse.status}]:`, detailedMsg);

      // If fallback to simulation is allowed (e.g. for test runs or graceful degradation)
      if (options.allowSimulationFallback) {
        console.warn(`[Email Service] Falling back to simulation mode due to Brevo provider error: ${detailedMsg}`);
        const fallbackId = `sim_fallback_${Date.now()}`;
        recordEmailLog({
          recipient: primaryRecipient.email,
          recipientName: primaryRecipient.name,
          notificationType: options.notificationType || 'general',
          subject: options.subject,
          status: 'simulated',
          provider: 'simulation',
          providerMessageId: fallbackId,
          errorMessage: `Live dispatch failed (${detailedMsg}). Logged via simulation fallback.`,
          htmlPreview: options.htmlContent,
          metadata: options.metadata
        });

        return {
          success: true,
          messageId: fallbackId,
          status: 'simulated',
          provider: 'simulation',
          warning: detailedMsg,
          timestamp
        };
      }

      const errorResult: EmailSendResult = {
        success: false,
        status: 'failed',
        provider: 'brevo',
        error: {
          code: 'EMAIL_PROVIDER_ERROR',
          message: detailedMsg,
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
        errorMessage: detailedMsg,
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

    if (options.allowSimulationFallback) {
      const fallbackId = `sim_neterr_${Date.now()}`;
      recordEmailLog({
        recipient: primaryRecipient.email,
        recipientName: primaryRecipient.name,
        notificationType: options.notificationType || 'general',
        subject: options.subject,
        status: 'simulated',
        provider: 'simulation',
        providerMessageId: fallbackId,
        errorMessage: `Network error (${errorMsg}). Logged via simulation fallback.`,
        htmlPreview: options.htmlContent,
        metadata: options.metadata
      });

      return {
        success: true,
        messageId: fallbackId,
        status: 'simulated',
        provider: 'simulation',
        warning: `Network exception connecting to Brevo (${errorMsg}). Safe simulation mode delivered preview.`,
        timestamp
      };
    }

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
