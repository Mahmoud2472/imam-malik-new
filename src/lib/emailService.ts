import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';
import { supabase, isSupabaseConfigured } from './supabase';
import { addDebugLog } from './debug';

export interface EmailResult {
  success: boolean;
  message: string;
  isSimulated: boolean;
  messageId?: string;
  error?: any;
}

export interface EmailServiceStatus {
  success: boolean;
  isConfigured: boolean;
  senderEmail: string;
  senderName: string;
  adminEmail: string;
  totalRecentLogs: number;
  mode: 'live_brevo' | 'simulation';
}

export interface EmailLogItem {
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

/**
 * Universal safe helper to POST to backend /api/email/* routes
 */
async function postEmailApi<T = any>(endpoint: string, payload: Record<string, any>): Promise<{ ok: boolean; data: T }> {
  try {
    const res = await fetch(`/api/email/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err: any) {
    console.warn(`[Client Email Service] Network error calling /api/email/${endpoint}:`, err);
    return {
      ok: false,
      data: {
        success: false,
        error: { code: 'CLIENT_NETWORK_ERROR', message: err?.message || 'Failed to connect to email API' }
      } as any
    };
  }
}

/**
 * Helper to record logs into client databases (Firestore & Supabase) for redundant tracking
 */
async function recordClientEmailLog(entry: {
  userId?: string;
  to: string;
  recipientName?: string;
  subject: string;
  type: string;
  status: 'sent' | 'simulated' | 'failed';
  provider?: string;
  messageId?: string;
  details?: string;
}) {
  const logPayload = {
    userId: entry.userId || 'guest',
    to: entry.to,
    recipientName: entry.recipientName || '',
    subject: entry.subject,
    type: entry.type,
    status: entry.status,
    provider: entry.provider || 'brevo',
    messageId: entry.messageId || '',
    details: entry.details || '',
    sentAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "email_logs"), logPayload);
  } catch (fsErr) {
    console.warn("Firestore email log write skipped/warn:", fsErr);
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('email_logs').insert([logPayload]);
    } catch (sbErr) {
      console.warn("Supabase email log write skipped/warn:", sbErr);
    }
  }
}

/**
 * 1. User Registration Confirmation Email
 */
export async function sendRegistrationEmail(data: {
  name: string;
  email: string;
  phone?: string;
  role?: string;
  userId?: string;
  loginUrl?: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Dispatching registration confirmation for: ${data.email}`, 'info');

  const { ok, data: resData } = await postEmailApi('registration', data);

  const isSimulated = resData?.userEmailResult?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;
  const message = success
    ? (isSimulated 
        ? `Registration email simulated for ${data.email} (Brevo API key not active yet)` 
        : `Registration confirmation delivered to ${data.email}`)
    : (resData?.error?.message || 'Failed to send registration email');

  await recordClientEmailLog({
    userId: data.userId,
    to: data.email,
    recipientName: data.name,
    subject: 'Registration Successful - Imam Malik Science & Tahfiz College',
    type: 'registration_user',
    status: success ? (isSimulated ? 'simulated' : 'sent') : 'failed',
    messageId: resData?.userEmailResult?.messageId
  });

  return {
    success,
    message,
    isSimulated,
    messageId: resData?.userEmailResult?.messageId,
    error: resData?.error
  };
}

/**
 * 2. Application Submitted Notification
 */
export async function sendApplicationSubmittedEmail(data: {
  applicantName: string;
  email: string;
  phone?: string;
  referenceNumber: string;
  targetClass: string;
  status?: string;
  nextSteps?: string;
  userId?: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Dispatching application submission email for: ${data.email} (${data.referenceNumber})`, 'info');

  const { ok, data: resData } = await postEmailApi('application-submitted', data);

  const isSimulated = resData?.userEmailResult?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;
  const message = success
    ? (isSimulated 
        ? `Application acknowledgement simulated for ${data.email}` 
        : `Application acknowledgement sent to ${data.email}`)
    : (resData?.error?.message || 'Failed to send application confirmation');

  await recordClientEmailLog({
    userId: data.userId,
    to: data.email,
    recipientName: data.applicantName,
    subject: `Application Submitted Successfully (${data.referenceNumber})`,
    type: 'application_submitted',
    status: success ? (isSimulated ? 'simulated' : 'sent') : 'failed',
    messageId: resData?.userEmailResult?.messageId
  });

  return {
    success,
    message,
    isSimulated,
    messageId: resData?.userEmailResult?.messageId,
    error: resData?.error
  };
}

/**
 * 3. Payment Verified Success Notification
 */
export async function sendPaymentSuccessEmail(data: {
  customerName: string;
  email: string;
  amount: number | string;
  reference: string;
  description: string;
  receiptNumber?: string;
  receiptUrl?: string;
  userId?: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Dispatching payment confirmation for: ${data.email} (₦${data.amount})`, 'info');

  const { ok, data: resData } = await postEmailApi('payment-success', data);

  const isSimulated = resData?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;
  const message = success
    ? (isSimulated 
        ? `Payment receipt email simulated for ${data.email}` 
        : `Payment receipt delivered to ${data.email}`)
    : (resData?.error?.message || 'Failed to dispatch payment receipt');

  await recordClientEmailLog({
    userId: data.userId,
    to: data.email,
    recipientName: data.customerName,
    subject: `Payment Successful: ₦${Number(data.amount).toLocaleString()} - ${data.description}`,
    type: 'payment_success',
    status: success ? (isSimulated ? 'simulated' : 'sent') : 'failed',
    messageId: resData?.messageId
  });

  return {
    success,
    message,
    isSimulated,
    messageId: resData?.messageId,
    error: resData?.error
  };
}

/**
 * 4. Payment Failed Notification
 */
export async function sendPaymentFailedEmail(data: {
  customerName: string;
  email: string;
  amount?: number | string;
  reference?: string;
  description?: string;
  reason?: string;
  userId?: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Dispatching payment failed notification for: ${data.email}`, 'info');

  const { ok, data: resData } = await postEmailApi('payment-failed', data);

  const isSimulated = resData?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;

  return {
    success,
    message: success ? `Payment alert dispatched to ${data.email}` : 'Failed to send payment failure notice',
    isSimulated,
    messageId: resData?.messageId,
    error: resData?.error
  };
}

/**
 * 5. Application / Student Status Change Notification
 */
export async function sendApplicationStatusEmail(data: {
  applicantName: string;
  email: string;
  referenceNumber: string;
  newStatus: string;
  previousStatus?: string;
  targetClass?: string;
  studentId?: string;
  adminInstructions?: string;
  userId?: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Dispatching status update (${data.newStatus}) for: ${data.email}`, 'info');

  const { ok, data: resData } = await postEmailApi('status-change', data);

  const isSimulated = resData?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;
  const message = success
    ? (isSimulated 
        ? `Status update email simulated for ${data.email}` 
        : `Status notification delivered to ${data.email}`)
    : (resData?.error?.message || 'Failed to dispatch status email');

  await recordClientEmailLog({
    userId: data.userId,
    to: data.email,
    recipientName: data.applicantName,
    subject: `Application Status Update: ${data.newStatus.toUpperCase()}`,
    type: 'status_change',
    status: success ? (isSimulated ? 'simulated' : 'sent') : 'failed',
    messageId: resData?.messageId,
    details: `Status changed to ${data.newStatus}`
  });

  return {
    success,
    message,
    isSimulated,
    messageId: resData?.messageId,
    error: resData?.error
  };
}

/**
 * Backwards compatibility for existing code calling sendAdmissionApprovedEmail
 */
export async function sendAdmissionApprovedEmail(payload: {
  toEmail: string;
  toName: string;
  className: string;
  studentId: string;
  subject?: string;
  body?: string;
}): Promise<EmailResult> {
  return sendApplicationStatusEmail({
    applicantName: payload.toName,
    email: payload.toEmail,
    referenceNumber: payload.studentId,
    newStatus: 'Approved',
    targetClass: payload.className,
    studentId: payload.studentId,
    adminInstructions: payload.body
  });
}

/**
 * 6. Contact Form Email Dispatch
 */
export async function sendContactFormEmail(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}): Promise<EmailResult> {
  addDebugLog('Email Service', `Submitting contact form message from: ${data.email}`, 'info');

  const { ok, data: resData } = await postEmailApi('contact', data);

  const isSimulated = resData?.acknowledgementResult?.status === 'simulated' || !ok;
  const success = resData?.success ?? ok;

  return {
    success,
    message: success 
      ? 'Your message has been sent successfully. An acknowledgement email has been dispatched to your address.' 
      : (resData?.error?.message || 'Failed to send contact message.'),
    isSimulated,
    error: resData?.error
  };
}

/**
 * 7. Password Reset / OTP Request
 */
export async function requestPasswordResetOTP(email: string, name?: string): Promise<{ success: boolean; message: string; error?: any }> {
  addDebugLog('Email Service', `Requesting OTP code for: ${email}`, 'info');

  const { ok, data } = await postEmailApi('password-reset', { email, name });

  return {
    success: data?.success ?? ok,
    message: data?.message || (ok ? 'OTP dispatched successfully' : 'Failed to send OTP'),
    error: data?.error
  };
}

/**
 * 8. Verify OTP Code
 */
export async function verifyPasswordResetOTP(email: string, code: string): Promise<{ success: boolean; verified: boolean; message: string; error?: any }> {
  const { ok, data } = await postEmailApi('verify-otp', { email, code });

  return {
    success: data?.success ?? ok,
    verified: data?.verified ?? false,
    message: data?.message || (ok ? 'OTP verified' : 'Invalid code'),
    error: data?.error
  };
}

/**
 * 9. Get Brevo Service Status (Without exposing secret keys)
 */
export async function getEmailServiceStatus(): Promise<EmailServiceStatus> {
  try {
    const res = await fetch('/api/email/status');
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      success: false,
      isConfigured: false,
      senderEmail: 'noreply@imsc.edu.ng',
      senderName: 'Imam Malik Science & Tahfiz College',
      adminEmail: 'maitechitservices6@gmail.com',
      totalRecentLogs: 0,
      mode: 'simulation'
    };
  }
}

/**
 * 10. Fetch Central Email Logs
 */
export async function getEmailLogs(limit: number = 50): Promise<EmailLogItem[]> {
  try {
    const res = await fetch(`/api/email/logs?limit=${limit}`);
    const data = await res.json();
    return data?.logs || [];
  } catch (err) {
    console.warn("Failed to fetch central email logs:", err);
    return [];
  }
}

/**
 * 11. Retry Email
 */
export async function retryEmailLog(logId: string, overrideRecipient?: string): Promise<EmailResult> {
  const { ok, data } = await postEmailApi('retry', { logId, overrideRecipient });

  return {
    success: data?.success ?? ok,
    message: data?.message || (ok ? 'Email retried' : 'Retry failed'),
    isSimulated: data?.result?.status === 'simulated',
    messageId: data?.result?.messageId,
    error: data?.error
  };
}

/**
 * 12. Send Test Email
 */
export async function sendTestEmail(testEmail: string, type: string): Promise<EmailResult> {
  const { ok, data } = await postEmailApi('test', { testEmail, type });

  return {
    success: data?.success ?? ok,
    message: data?.message || (ok ? 'Test email dispatched' : 'Test failed'),
    isSimulated: data?.result?.status === 'simulated',
    messageId: data?.result?.messageId,
    error: data?.error
  };
}
