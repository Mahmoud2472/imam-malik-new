import { Request, Response } from 'express';
import { 
  sendEmail, 
  getBrevoConfig, 
  getEmailLogs, 
  findEmailLogById, 
  isValidEmail,
  recordEmailLog
} from './brevo';
import {
  getRegistrationUserTemplate,
  getRegistrationAdminTemplate,
  getApplicationSubmittedUserTemplate,
  getApplicationSubmittedAdminTemplate,
  getPaymentSuccessTemplate,
  getPaymentFailedTemplate,
  getStatusChangeTemplate,
  getContactFormAdminTemplate,
  getContactFormUserAcknowledgementTemplate,
  getPasswordResetOTPTemplate,
  getTestEmailTemplate
} from './templates';

// In-memory OTP cache for password reset / email verification
interface OTPEntry {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}
const otpStore = new Map<string, OTPEntry>();

/**
 * 1. General Send Email Endpoint
 * POST /api/email/send
 */
export async function sendEmailDirect(req: Request, res: Response) {
  try {
    const { to, subject, htmlContent, textContent, replyTo, notificationType, metadata } = req.body;

    if (!to || !subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_VALIDATION_ERROR',
          message: 'Missing required parameters: "to", "subject", or "htmlContent".'
        }
      });
    }

    const result = await sendEmail({
      to,
      subject,
      htmlContent,
      textContent,
      replyTo,
      notificationType: notificationType || 'custom',
      metadata
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('Error in sendEmailDirect handler:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'EMAIL_SEND_FAILED',
        message: error.message || 'Internal server error while sending email.'
      }
    });
  }
}

/**
 * 2. User Registration Notification (User + Admin Alert)
 * POST /api/email/registration
 */
export async function handleRegistrationEmail(req: Request, res: Response) {
  try {
    const { name, email, phone, role, userId, loginUrl } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid user email is required.' }
      });
    }

    const userName = name || 'New User';
    const config = getBrevoConfig();

    // 1. User confirmation email
    const userTpl = getRegistrationUserTemplate({
      name: userName,
      email,
      role: role || 'Applicant',
      loginUrl
    });

    const userResult = await sendEmail({
      to: { email, name: userName },
      subject: userTpl.subject,
      htmlContent: userTpl.html,
      textContent: userTpl.text,
      notificationType: 'registration_user',
      metadata: { userId, role }
    });

    // 2. Admin notification email
    let adminResult = null;
    if (config.adminEmail && isValidEmail(config.adminEmail)) {
      const adminTpl = getRegistrationAdminTemplate({
        name: userName,
        email,
        phone,
        userId,
        role: role || 'Applicant'
      });

      adminResult = await sendEmail({
        to: { email: config.adminEmail, name: 'Admissions Administrator' },
        subject: adminTpl.subject,
        htmlContent: adminTpl.html,
        textContent: adminTpl.text,
        notificationType: 'registration_admin',
        metadata: { userId, registeredUser: email }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Registration emails dispatched successfully.',
      userEmailResult: userResult,
      adminEmailResult: adminResult
    });
  } catch (error: any) {
    console.error('Error in handleRegistrationEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to dispatch registration emails.' }
    });
  }
}

/**
 * 3. Application Submission Notification (User + Admin Alert)
 * POST /api/email/application-submitted
 */
export async function handleApplicationSubmittedEmail(req: Request, res: Response) {
  try {
    const { applicantName, email, phone, referenceNumber, targetClass, status, nextSteps } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid applicant email is required.' }
      });
    }

    const name = applicantName || 'Applicant';
    const ref = referenceNumber || `REF-${Date.now().toString().slice(-6)}`;
    const cls = targetClass || 'Standard Admission';
    const config = getBrevoConfig();

    // 1. User confirmation
    const userTpl = getApplicationSubmittedUserTemplate({
      applicantName: name,
      referenceNumber: ref,
      targetClass: cls,
      status: status || 'Pending Review',
      nextSteps
    });

    const userResult = await sendEmail({
      to: { email, name },
      subject: userTpl.subject,
      htmlContent: userTpl.html,
      textContent: userTpl.text,
      notificationType: 'application_submitted_user',
      metadata: { referenceNumber: ref, targetClass: cls }
    });

    // 2. Admin alert
    let adminResult = null;
    if (config.adminEmail && isValidEmail(config.adminEmail)) {
      const adminTpl = getApplicationSubmittedAdminTemplate({
        applicantName: name,
        referenceNumber: ref,
        targetClass: cls,
        email,
        phone
      });

      adminResult = await sendEmail({
        to: { email: config.adminEmail, name: 'Admissions Office' },
        subject: adminTpl.subject,
        htmlContent: adminTpl.html,
        textContent: adminTpl.text,
        notificationType: 'application_submitted_admin',
        metadata: { referenceNumber: ref, candidateEmail: email }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Application notifications dispatched successfully.',
      userEmailResult: userResult,
      adminEmailResult: adminResult
    });
  } catch (error: any) {
    console.error('Error in handleApplicationSubmittedEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to dispatch application notifications.' }
    });
  }
}

/**
 * 4. Verified Payment Successful Notification
 * POST /api/email/payment-success
 */
export async function handlePaymentSuccessEmail(req: Request, res: Response) {
  try {
    const { customerName, email, amount, reference, description, receiptNumber, receiptUrl } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid customer email is required.' }
      });
    }

    const name = customerName || 'Valued Student / Guardian';
    const tpl = getPaymentSuccessTemplate({
      customerName: name,
      amount: amount || 0,
      reference: reference || `REF-${Date.now()}`,
      description: description || 'School Admission & Assessment Fee',
      receiptNumber,
      receiptUrl
    });

    const result = await sendEmail({
      to: { email, name },
      subject: tpl.subject,
      htmlContent: tpl.html,
      textContent: tpl.text,
      notificationType: 'payment_success',
      metadata: { reference, amount, description }
    });

    // Also notify admin of successful payment if configured
    const config = getBrevoConfig();
    if (config.adminEmail && isValidEmail(config.adminEmail) && config.adminEmail !== email) {
      sendEmail({
        to: { email: config.adminEmail, name: 'Bursary Admin' },
        subject: `Payment Alert: ₦${Number(amount).toLocaleString()} from ${name}`,
        htmlContent: tpl.html,
        textContent: tpl.text,
        notificationType: 'payment_alert_admin',
        metadata: { reference, amount, customerEmail: email }
      }).catch(err => console.warn('Background admin payment email error:', err));
    }

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in handlePaymentSuccessEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to dispatch payment success email.' }
    });
  }
}

/**
 * 5. Payment Failed / Cancelled Notification
 * POST /api/email/payment-failed
 */
export async function handlePaymentFailedEmail(req: Request, res: Response) {
  try {
    const { customerName, email, amount, reference, description, reason } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid customer email is required.' }
      });
    }

    const name = customerName || 'Valued Student / Guardian';
    const tpl = getPaymentFailedTemplate({
      customerName: name,
      amount,
      reference,
      description,
      reason
    });

    const result = await sendEmail({
      to: { email, name },
      subject: tpl.subject,
      htmlContent: tpl.html,
      textContent: tpl.text,
      notificationType: 'payment_failed',
      metadata: { reference, amount, reason }
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in handlePaymentFailedEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to dispatch payment failed email.' }
    });
  }
}

/**
 * 6. Application / Student Status Change Notification
 * POST /api/email/status-change
 */
export async function handleStatusChangeEmail(req: Request, res: Response) {
  try {
    const { applicantName, email, referenceNumber, newStatus, previousStatus, targetClass, studentId, adminInstructions } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid recipient email is required.' }
      });
    }

    if (!newStatus) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'newStatus is required.' }
      });
    }

    const name = applicantName || 'Student / Applicant';
    const tpl = getStatusChangeTemplate({
      applicantName: name,
      referenceNumber: referenceNumber || 'N/A',
      newStatus,
      previousStatus,
      targetClass,
      studentId,
      adminInstructions
    });

    const result = await sendEmail({
      to: { email, name },
      subject: tpl.subject,
      htmlContent: tpl.html,
      textContent: tpl.text,
      notificationType: 'status_change',
      metadata: { newStatus, previousStatus, referenceNumber, studentId }
    });

    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Error in handleStatusChangeEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to dispatch status change email.' }
    });
  }
}

/**
 * 7. Contact Form Message (Admin notification + User acknowledgement)
 * POST /api/email/contact
 */
export async function handleContactFormEmail(req: Request, res: Response) {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!email || !isValidEmail(email) || !message) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Sender email and message are required.' }
      });
    }

    const senderName = name || 'Website Visitor';
    const config = getBrevoConfig();

    // 1. Send to Admin
    let adminResult = null;
    if (config.adminEmail && isValidEmail(config.adminEmail)) {
      const adminTpl = getContactFormAdminTemplate({
        name: senderName,
        email,
        phone,
        subject,
        message
      });

      adminResult = await sendEmail({
        to: { email: config.adminEmail, name: 'Imam Malik Administration' },
        replyTo: { email, name: senderName },
        subject: adminTpl.subject,
        htmlContent: adminTpl.html,
        textContent: adminTpl.text,
        notificationType: 'contact_form_admin',
        metadata: { senderEmail: email, senderPhone: phone }
      });
    }

    // 2. Send acknowledgement to visitor
    const ackTpl = getContactFormUserAcknowledgementTemplate({
      name: senderName,
      subject
    });

    const ackResult = await sendEmail({
      to: { email, name: senderName },
      subject: ackTpl.subject,
      htmlContent: ackTpl.html,
      textContent: ackTpl.text,
      notificationType: 'contact_form_ack',
      metadata: { senderEmail: email }
    });

    return res.status(200).json({
      success: true,
      message: 'Contact form message processed and acknowledged.',
      adminEmailResult: adminResult,
      acknowledgementResult: ackResult
    });
  } catch (error: any) {
    console.error('Error in handleContactFormEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to process contact form.' }
    });
  }
}

/**
 * 8. Password Reset / Verification OTP Code Request
 * POST /api/email/password-reset
 */
export async function handlePasswordResetOTP(req: Request, res: Response) {
  try {
    const { email, name } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Valid email is required.' }
      });
    }

    // Generate secure 6-digit numeric OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresInMinutes = 15;
    const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

    // Store in-memory
    otpStore.set(email.toLowerCase().trim(), {
      email: email.toLowerCase().trim(),
      code: otpCode,
      expiresAt,
      attempts: 0
    });

    const userName = name || 'Student / Staff';
    const tpl = getPasswordResetOTPTemplate({
      name: userName,
      otpCode,
      expiresInMinutes
    });

    const result = await sendEmail({
      to: { email, name: userName },
      subject: tpl.subject,
      htmlContent: tpl.html,
      textContent: tpl.text,
      notificationType: 'password_reset_otp',
      metadata: { email }
    });

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}. Valid for ${expiresInMinutes} minutes.`,
      result
    });
  } catch (error: any) {
    console.error('Error in handlePasswordResetOTP:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'EMAIL_SEND_FAILED', message: error.message || 'Failed to generate OTP code.' }
    });
  }
}

/**
 * 9. Verify OTP Code
 * POST /api/email/verify-otp
 */
export async function handleVerifyOTP(req: Request, res: Response) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'Email and 6-digit verification code are required.' }
      });
    }

    const key = email.toLowerCase().trim();
    const entry = otpStore.get(key);

    if (!entry) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_CODE', message: 'No active verification code found for this email. Please request a new one.' }
      });
    }

    if (Date.now() > entry.expiresAt) {
      otpStore.delete(key);
      return res.status(400).json({
        success: false,
        error: { code: 'EXPIRED_CODE', message: 'The verification code has expired. Please request a new code.' }
      });
    }

    entry.attempts += 1;
    if (entry.attempts > 5) {
      otpStore.delete(key);
      return res.status(400).json({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many incorrect attempts. Please request a new verification code.' }
      });
    }

    if (entry.code !== code.trim()) {
      return res.status(400).json({
        success: false,
        error: { code: 'INCORRECT_CODE', message: `Incorrect verification code. (${5 - entry.attempts} attempts remaining)` }
      });
    }

    // OTP Verified! Clear it
    otpStore.delete(key);

    return res.status(200).json({
      success: true,
      verified: true,
      message: 'Verification code confirmed successfully.'
    });
  } catch (error: any) {
    console.error('Error in handleVerifyOTP:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'VERIFICATION_ERROR', message: error.message || 'OTP verification failed.' }
    });
  }
}

/**
 * 10. Get Brevo Service Status (Without exposing secret key)
 * GET /api/email/status
 */
export async function getEmailStatus(req: Request, res: Response) {
  try {
    const config = getBrevoConfig();
    const logs = getEmailLogs(10);
    
    return res.status(200).json({
      success: true,
      isConfigured: config.isConfigured,
      status: config.status,
      keyWarning: config.keyWarning,
      maskedKey: config.maskedKey,
      senderEmail: config.senderEmail,
      senderName: config.senderName,
      adminEmail: config.adminEmail,
      totalRecentLogs: logs.length,
      mode: config.isConfigured ? 'live_brevo' : 'simulation'
    });
  } catch (error: any) {
    console.error('Error in getEmailStatus:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'STATUS_ERROR', message: error.message }
    });
  }
}

/**
 * 11. Retrieve Email Logs List
 * GET /api/email/logs
 */
export async function getEmailLogsList(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const logs = getEmailLogs(limit);
    return res.status(200).json({
      success: true,
      logs
    });
  } catch (error: any) {
    console.error('Error in getEmailLogsList:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'LOGS_ERROR', message: error.message }
    });
  }
}

/**
 * 12. Retry a Failed or Simulated Email
 * POST /api/email/retry
 */
export async function handleRetryEmail(req: Request, res: Response) {
  try {
    const { logId, overrideRecipient } = req.body;

    if (!logId) {
      return res.status(400).json({
        success: false,
        error: { code: 'LOG_ID_REQUIRED', message: 'logId is required for retrying an email.' }
      });
    }

    const log = findEmailLogById(logId);
    if (!log) {
      return res.status(404).json({
        success: false,
        error: { code: 'LOG_NOT_FOUND', message: 'Email log not found.' }
      });
    }

    const targetEmail = overrideRecipient || log.recipient;
    if (!isValidEmail(targetEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_EMAIL', message: `Invalid target email: ${targetEmail}` }
      });
    }

    const result = await sendEmail({
      to: { email: targetEmail, name: log.recipientName },
      subject: log.subject,
      htmlContent: log.htmlPreview || `<p>${log.subject}</p>`,
      notificationType: `${log.notificationType}_retry`,
      metadata: { ...log.metadata, retriedFromId: logId }
    });

    return res.status(result.success ? 200 : 400).json({
      success: result.success,
      message: result.success ? `Email retry dispatched to ${targetEmail}` : 'Retry attempt failed',
      result
    });
  } catch (error: any) {
    console.error('Error in handleRetryEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'RETRY_ERROR', message: error.message }
    });
  }
}

/**
 * Helper to render any test notification template with realistic preview data
 */
export function renderTestNotification(notificationType: string, testEmail: string, config: ReturnType<typeof getBrevoConfig>) {
  let subject = 'Brevo Integration Test - Imam Malik College';
  let htmlContent = '';
  let textContent = '';

  switch (notificationType) {
    case 'registration_user': {
      const tpl = getRegistrationUserTemplate({
        name: 'Test Student (Ahmad Al-Mansur)',
        email: testEmail,
        role: 'Student'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'registration_admin': {
      const tpl = getRegistrationAdminTemplate({
        name: 'Test Student (Ahmad Al-Mansur)',
        email: testEmail,
        phone: '+234 801 234 5678',
        role: 'Student'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'application_submitted': {
      const tpl = getApplicationSubmittedUserTemplate({
        applicantName: 'Test Applicant (Fatima Ibrahim)',
        referenceNumber: 'IMSC-2026-9042',
        targetClass: 'JSS 1 (Tahfiz Science)'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'payment_success': {
      const tpl = getPaymentSuccessTemplate({
        customerName: 'Test Guardian / Candidate',
        amount: 5000,
        reference: `PAY-TEST-${Date.now().toString().slice(-6)}`,
        description: 'Admission Processing & Screening Application Form',
        receiptNumber: 'REC-ADM-2026-88'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'payment_failed': {
      const tpl = getPaymentFailedTemplate({
        customerName: 'Test Candidate',
        amount: 5000,
        reference: `FAIL-TEST-${Date.now().toString().slice(-6)}`,
        description: 'Admission Processing Fee'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'status_approved': {
      const tpl = getStatusChangeTemplate({
        applicantName: 'Test Admitted Candidate',
        referenceNumber: 'IMSC-2026-9042',
        newStatus: 'Approved',
        targetClass: 'JSS 1 Tahfiz Science',
        studentId: 'IMC20260140',
        adminInstructions: 'Congratulations! Resumption date is September 14, 2026. Please bring original birth certificate, 4 colored passport photographs, and your screening receipt.'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'contact_form': {
      const tpl = getContactFormAdminTemplate({
        name: 'Prospective Parent (Mallam Musa)',
        email: testEmail,
        phone: '+234 803 111 2233',
        subject: 'Boarding Facilities and Tahfiz Curriculum Inquiry',
        message: 'Assalamu Alaikum. We would like to inquire about the boarding accommodation facilities and daily Quran memorization timetable for new JSS 1 intakes.'
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    case 'password_reset': {
      const tpl = getPasswordResetOTPTemplate({
        name: 'Test Account',
        otpCode: '528914',
        expiresInMinutes: 15
      });
      subject = `[TEST] ${tpl.subject}`;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
    default: {
      const tpl = getTestEmailTemplate({
        testRecipient: testEmail,
        senderName: config.senderName,
        senderEmail: config.senderEmail,
        provider: config.isConfigured ? 'Brevo Transactional API' : 'Simulation Mode'
      });
      subject = tpl.subject;
      htmlContent = tpl.html;
      textContent = tpl.text;
      break;
    }
  }

  return { subject, htmlContent, textContent };
}

/**
 * 13. Test Email Runner for Admins (Single Template)
 * POST /api/email/test
 */
export async function handleTestEmail(req: Request, res: Response) {
  try {
    const { testEmail, type, mode } = req.body;

    if (!testEmail || !isValidEmail(testEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'A valid test recipient email is required.' }
      });
    }

    const config = getBrevoConfig();
    const notificationType = type || 'system_test';
    const isSimulationMode = mode === 'simulation';
    const isStrictLive = mode === 'live';

    const { subject, htmlContent, textContent } = renderTestNotification(notificationType, testEmail, config);

    const result = await sendEmail({
      to: { email: testEmail, name: 'Admin Tester' },
      subject,
      htmlContent,
      textContent,
      notificationType: `test_${notificationType}`,
      metadata: { isTestRun: true, requestedMode: mode, triggeredAt: new Date().toISOString() },
      forceSimulation: isSimulationMode,
      allowSimulationFallback: !isStrictLive
    });

    let message = `Test notification [${notificationType}] dispatched to ${testEmail}`;
    if (result.status === 'simulated') {
      message = `Test notification [${notificationType}] generated in Simulation Mode. (${result.warning || 'Safe simulation active'}).`;
    } else if (result.status === 'sent') {
      message = `Live Brevo test notification [${notificationType}] sent successfully to ${testEmail}!`;
    }

    return res.status(200).json({
      success: result.success,
      status: result.status,
      provider: result.provider,
      message,
      warning: result.warning || config.keyWarning,
      result,
      htmlPreview: htmlContent
    });
  } catch (error: any) {
    console.error('Error in handleTestEmail:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'TEST_ERROR', message: error.message }
    });
  }
}

/**
 * 14. Batch Test All 9 Email Notifications
 * POST /api/email/test-all
 */
export async function handleTestAllEmails(req: Request, res: Response) {
  try {
    const { testEmail, mode } = req.body;

    if (!testEmail || !isValidEmail(testEmail)) {
      return res.status(400).json({
        success: false,
        error: { code: 'EMAIL_VALIDATION_ERROR', message: 'A valid test recipient email is required.' }
      });
    }

    const config = getBrevoConfig();
    const isSimulationMode = mode === 'simulation';
    const isStrictLive = mode === 'live';

    const testList = [
      { type: 'registration_user', title: '1. Student Registration Confirmation' },
      { type: 'registration_admin', title: '2. Admin Registration Alert' },
      { type: 'application_submitted', title: '3. Admission Application Submitted' },
      { type: 'payment_success', title: '4. Bursary Payment Receipt' },
      { type: 'payment_failed', title: '5. Payment Failed Notice' },
      { type: 'status_approved', title: '6. Admission Approved & Offer Letter' },
      { type: 'contact_form', title: '7. Website Contact Form Message' },
      { type: 'password_reset', title: '8. Password Reset OTP Code' },
      { type: 'system_test', title: '9. System Connectivity Diagnostic' }
    ];

    const results = [];
    let successfulCount = 0;
    let failedCount = 0;

    for (const item of testList) {
      const { subject, htmlContent, textContent } = renderTestNotification(item.type, testEmail, config);

      const result = await sendEmail({
        to: { email: testEmail, name: 'Admin Tester' },
        subject,
        htmlContent,
        textContent,
        notificationType: `test_${item.type}`,
        metadata: { isTestRun: true, isBatchTest: true, templateType: item.type, triggeredAt: new Date().toISOString() },
        forceSimulation: isSimulationMode,
        allowSimulationFallback: !isStrictLive
      });

      if (result.success) {
        successfulCount++;
      } else {
        failedCount++;
      }

      results.push({
        type: item.type,
        title: item.title,
        subject,
        status: result.status,
        provider: result.provider,
        messageId: result.messageId,
        warning: result.warning,
        error: result.error?.message,
        htmlPreview: htmlContent
      });
    }

    const overallMode = isSimulationMode || !config.isConfigured ? 'simulation' : (failedCount === 0 ? 'live_brevo' : 'mixed');

    return res.status(200).json({
      success: true,
      total: testList.length,
      successful: successfulCount,
      failed: failedCount,
      mode: overallMode,
      results,
      keyWarning: config.keyWarning,
      message: `Batch test completed: ${successfulCount} of ${testList.length} notification templates verified and processed successfully.`
    });
  } catch (error: any) {
    console.error('Error in handleTestAllEmails:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'BATCH_TEST_ERROR', message: error.message }
    });
  }
}
