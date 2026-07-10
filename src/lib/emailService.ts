import emailjs from '@emailjs/browser';
import { addDebugLog } from './debug';

export interface EmailPayload {
  toEmail: string;
  toName: string;
  className: string;
  studentId: string;
  subject?: string;
  body?: string;
}

export interface EmailResult {
  success: boolean;
  message: string;
  isSimulated: boolean;
}

/**
 * Dispatches an automated admission notification email to an applicant.
 * Uses EmailJS if keys are present in environment variables; falls back to simulated dispatch.
 */
export async function sendAdmissionApprovedEmail(payload: EmailPayload): Promise<EmailResult> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  const defaultSubject = "Imam Malik Science & Tahfiz College - Admission Approved! 🎉";
  const defaultBody = `Dear ${payload.toName},

We are extremely pleased to inform you that your application for admission to Imam Malik Science & Tahfiz College has been APPROVED for class: ${payload.className}.

Your assigned Admission Number (Student ID) is: ${payload.studentId}

You have been promoted to the Student role in our system. You can now log back into the portal using your registered credentials to print your official Admission Letter and view student schedules.

Best regards,
Admission Office
Imam Malik Science & Tahfiz College`;

  const finalSubject = payload.subject || defaultSubject;
  const finalBody = payload.body || defaultBody;

  // Real EmailJS Dispatch
  if (serviceId && templateId && publicKey) {
    try {
      addDebugLog('Email Service', `Attempting to send real email via EmailJS to: ${payload.toEmail}`, 'info');
      
      const templateParams = {
        to_email: payload.toEmail,
        to_name: payload.toName,
        from_name: "Imam Malik Science & Tahfiz College",
        class_name: payload.className,
        student_id: payload.studentId,
        subject: finalSubject,
        message: finalBody,
      };

      await emailjs.send(serviceId, templateId, templateParams, publicKey);
      
      addDebugLog('Email Service', `Real email successfully sent to: ${payload.toEmail}`, 'success');
      return {
        success: true,
        message: `Real email successfully delivered to ${payload.toEmail} via EmailJS.`,
        isSimulated: false
      };
    } catch (error: any) {
      const errMsg = error?.text || error?.message || String(error);
      addDebugLog('Email Service', `EmailJS send error: ${errMsg}. Falling back to simulation...`, 'error');
      return {
        success: true,
        message: `EmailJS sending failed (${errMsg}). Simulated delivery was successful as a fallback.`,
        isSimulated: true
      };
    }
  }

  // Simulation mode
  addDebugLog('Email Service', `EmailJS keys not configured. Simulating delivery to: ${payload.toEmail}`, 'info');
  return new Promise((resolve) => {
    setTimeout(() => {
      addDebugLog('Email Service', `Simulated email successfully sent to: ${payload.toEmail}`, 'success');
      resolve({
        success: true,
        message: `Simulated email successfully delivered to ${payload.toEmail}. To configure real email notifications, add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY in your settings.`,
        isSimulated: true
      });
    }, 1200);
  });
}
