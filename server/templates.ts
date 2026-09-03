/**
 * HTML Email Templates with School Branding
 * Imam Malik Science & Tahfiz College, Kano State
 * 
 * Fully responsive, accessible, mobile-optimized email templates.
 */

const SCHOOL_NAME = "Imam Malik Science & Tahfiz College";
const SCHOOL_TAGLINE = "Excellence in Islamic Tahfiz, Science & Modern Education";
const SCHOOL_LOCATION = "Karefa Road, Tudun Wada Dankadai, Kano State, Nigeria";
const SCHOOL_PHONE = "+234 701 174 8311";
const SCHOOL_EMAIL = "maitechitservices6@gmail.com";
const PORTAL_URL = process.env.APP_URL || "https://ais-dev-soxajy6xorbq2bfiujxmci-462479283857.europe-west2.run.app";

/**
 * Shared base email layout providing header branding, responsive styles, and footer.
 */
export function renderEmailBase(contentHtml: string, previewText: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${SCHOOL_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    table { border-collapse: collapse !important; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-p-20 { padding: 20px !important; }
      .mobile-stack { display: block !important; width: 100% !important; }
      .mobile-text-center { text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; color: #1e293b;">
  <!-- Preview text -->
  <div style="display: none; font-size: 1px; color: #fefefe; line-height: 1px; font-family: Open Sans, Helvetica, Arial, sans-serif; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${previewText}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 24px 0;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); padding: 32px 36px; text-align: center; border-bottom: 4px solid #f59e0b;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 12px; padding: 8px 16px; margin-bottom: 12px;">
                      <span style="color: #f59e0b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">Official Notification</span>
                    </div>
                    <h1 style="color: #ffffff; font-size: 22px; font-weight: 900; margin: 0 0 6px 0; text-transform: uppercase; letter-spacing: 0.5px;">${SCHOOL_NAME}</h1>
                    <p style="color: #a7f3d0; font-size: 12px; margin: 0; font-weight: 500; letter-spacing: 0.5px;">${SCHOOL_TAGLINE}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dynamic Body Content -->
          <tr>
            <td style="padding: 36px;" class="mobile-p-20">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 28px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;" class="mobile-p-20">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding-bottom: 16px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">${SCHOOL_NAME}</p>
                    <p style="margin: 0 0 4px 0;">📍 ${SCHOOL_LOCATION}</p>
                    <p style="margin: 0;">📞 ${SCHOOL_PHONE} &nbsp;|&nbsp; ✉️ <a href="mailto:${SCHOOL_EMAIL}" style="color: #059669; text-decoration: none;">${SCHOOL_EMAIL}</a></p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #cbd5e1; padding-top: 16px; text-align: center; font-size: 11px; color: #94a3b8;">
                    <p style="margin: 0 0 6px 0;">This is an automated transactional notification sent by the Imam Malik College Management System.</p>
                    <p style="margin: 0;">Please do not reply directly to this message if it was sent from an unmonitored address.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * 1. User Registration Confirmation Email
 */
export function getRegistrationUserTemplate(data: {
  name: string;
  email: string;
  role?: string;
  loginUrl?: string;
}): { subject: string; html: string; text: string } {
  const loginLink = data.loginUrl || `${PORTAL_URL}/login`;
  const subject = "Registration Successful - Imam Malik Science & Tahfiz College";

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        ✓
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 8px 0;">Welcome to Imam Malik College!</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">Your user registration was completed successfully.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.name}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      We are delighted to confirm that your account has been established on our official portal. You can now access student admissions, examination slips, payment receipts, and academic schedules.
    </p>

    <!-- Account Details Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
      <h3 style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #064e3b; margin: 0 0 12px 0;">Account Summary</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 40%;">Registered Name:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Registered Email:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Assigned Role:</td>
          <td style="padding: 6px 0; color: #059669; font-weight: 700; text-transform: uppercase;">${data.role || 'Applicant'}</td>
        </tr>
      </table>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 28px;">
      <a href="${loginLink}" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(6, 78, 59, 0.2);">
        Log In to Your Portal →
      </a>
    </div>

    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 0;">
      If you did not create this account or have any questions, please contact our ICT support team immediately at <a href="mailto:${SCHOOL_EMAIL}" style="color: #059669; text-decoration: none; font-weight: 600;">${SCHOOL_EMAIL}</a>.
    </p>
  `, "Welcome! Your registration at Imam Malik College was successful.");

  const text = `Welcome to ${SCHOOL_NAME}!\n\nDear ${data.name},\nYour account registration was successful.\nEmail: ${data.email}\nRole: ${data.role || 'Applicant'}\n\nLogin to portal: ${loginLink}\n\nContact support: ${SCHOOL_EMAIL} / ${SCHOOL_PHONE}`;

  return { subject, html, text };
}

/**
 * 2. Admin New User Notification
 */
export function getRegistrationAdminTemplate(data: {
  name: string;
  email: string;
  phone?: string;
  userId?: string;
  role?: string;
  registeredAt?: string;
}): { subject: string; html: string; text: string } {
  const subject = `New User Registration: ${data.name}`;
  const timestamp = data.registeredAt || new Date().toLocaleString('en-GB');

  const html = renderEmailBase(`
    <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin-bottom: 24px;">
      <h2 style="color: #064e3b; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">New User Registered</h2>
      <p style="color: #64748b; font-size: 13px; margin: 0;">Administrative alert for system user onboarding</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 35%;">User Name:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Email Address:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.email}</td>
        </tr>
        ${data.phone ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Phone Number:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.phone}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Account Role:</td>
          <td style="padding: 6px 0; color: #059669; font-weight: 700; text-transform: uppercase;">${data.role || 'Applicant'}</td>
        </tr>
        ${data.userId ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">User ID / Ref:</td>
          <td style="padding: 6px 0; color: #475569; font-family: monospace; font-size: 12px;">${data.userId}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Timestamp:</td>
          <td style="padding: 6px 0; color: #475569;">${timestamp}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${PORTAL_URL}/admin/applications" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px;">
        Open Admin Management Suite →
      </a>
    </div>
  `, `New user registered: ${data.name} (${data.email})`);

  const text = `New User Registered\nName: ${data.name}\nEmail: ${data.email}\nPhone: ${data.phone || 'N/A'}\nRole: ${data.role || 'Applicant'}\nTime: ${timestamp}`;

  return { subject, html, text };
}

/**
 * 3. Application Submission Confirmation (User)
 */
export function getApplicationSubmittedUserTemplate(data: {
  applicantName: string;
  referenceNumber: string;
  targetClass: string;
  submissionDate?: string;
  status?: string;
  nextSteps?: string;
}): { subject: string; html: string; text: string } {
  const subject = "Application Submitted Successfully - Imam Malik Science & Tahfiz College";
  const date = data.submissionDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        📝
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 8px 0;">Application Submitted Successfully</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">We have received your admission application for the 2026/2027 Academic Session.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.applicantName}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      Thank you for choosing <strong>${SCHOOL_NAME}</strong>. Your application has been logged in our central database and is currently under administrative evaluation.
    </p>

    <!-- Submission Details Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 45%;">Application Reference:</td>
          <td style="padding: 6px 0; color: #064e3b; font-weight: 800; font-family: monospace; font-size: 15px;">${data.referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Class:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.targetClass}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Submission Date:</td>
          <td style="padding: 6px 0; color: #1e293b;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Current Status:</td>
          <td style="padding: 6px 0;">
            <span style="background-color: #fef3c7; color: #92400e; font-weight: 700; font-size: 12px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
              ${data.status || 'Pending Review'}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Next Steps Box -->
    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
      <h4 style="color: #064e3b; font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 0 0 8px 0;">📌 What Happens Next?</h4>
      <p style="font-size: 13px; line-height: 1.6; color: #047857; margin: 0;">
        ${data.nextSteps || '1. The Admissions Board will review your uploaded academic documents.\n2. You will be scheduled for the Entrance & Tahfiz placement assessment.\n3. Keep your reference number safe to track progress and print your examination slip on the portal.'}
      </p>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${PORTAL_URL}/login" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">
        Track Application on Portal →
      </a>
    </div>
  `, `Application Submitted: Reference ${data.referenceNumber} for ${data.applicantName}`);

  const text = `Application Submitted Successfully\nDear ${data.applicantName},\nReference: ${data.referenceNumber}\nClass: ${data.targetClass}\nStatus: ${data.status || 'Pending'}\nTrack on portal: ${PORTAL_URL}/login`;

  return { subject, html, text };
}

/**
 * 4. Application Submission Admin Notification
 */
export function getApplicationSubmittedAdminTemplate(data: {
  applicantName: string;
  referenceNumber: string;
  targetClass: string;
  email?: string;
  phone?: string;
}): { subject: string; html: string; text: string } {
  const subject = `New Application Submitted: ${data.applicantName} (${data.targetClass})`;

  const html = renderEmailBase(`
    <div style="border-left: 4px solid #059669; padding-left: 16px; margin-bottom: 24px;">
      <h2 style="color: #064e3b; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">New Admission Application</h2>
      <p style="color: #64748b; font-size: 13px; margin: 0;">An applicant has completed the online registration form</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 40%;">Candidate Name:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.applicantName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Reference No:</td>
          <td style="padding: 6px 0; color: #064e3b; font-family: monospace; font-weight: 700;">${data.referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Target Class:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.targetClass}</td>
        </tr>
        ${data.email ? `<tr><td style="padding: 6px 0; color: #64748b;">Contact Email:</td><td style="padding: 6px 0; color: #1e293b;">${data.email}</td></tr>` : ''}
        ${data.phone ? `<tr><td style="padding: 6px 0; color: #64748b;">Contact Phone:</td><td style="padding: 6px 0; color: #1e293b;">${data.phone}</td></tr>` : ''}
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${PORTAL_URL}/admin/applications" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px;">
        Review & Approve in Admin Suite →
      </a>
    </div>
  `, `New Application: ${data.applicantName} (${data.referenceNumber})`);

  const text = `New Application Submitted\nApplicant: ${data.applicantName}\nReference: ${data.referenceNumber}\nClass: ${data.targetClass}\nEmail: ${data.email || 'N/A'}`;

  return { subject, html, text };
}

/**
 * 5. Payment Successful Confirmation
 */
export function getPaymentSuccessTemplate(data: {
  customerName: string;
  amount: number | string;
  reference: string;
  description: string;
  receiptNumber?: string;
  paymentDate?: string;
  receiptUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Payment Successful: ₦${Number(data.amount).toLocaleString()} - ${data.description}`;
  const date = data.paymentDate || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        💳
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Official Payment Receipt</h2>
      <p style="color: #059669; font-size: 15px; font-weight: 700; margin: 0;">Payment Verified & Recorded</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.customerName}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      We confirm receipt of your official payment to <strong>${SCHOOL_NAME}</strong>. Below are the verified transaction specifics:
    </p>

    <!-- Payment Receipt Box -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
      <div style="text-align: center; border-bottom: 1px dashed #cbd5e1; padding-bottom: 16px; margin-bottom: 16px;">
        <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase;">Amount Paid</span>
        <h3 style="color: #064e3b; font-size: 28px; font-weight: 900; margin: 6px 0 0 0;">₦${Number(data.amount).toLocaleString()}</h3>
      </div>

      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 45%;">Payment Purpose:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.description}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Transaction Reference:</td>
          <td style="padding: 6px 0; color: #064e3b; font-family: monospace; font-weight: 700;">${data.reference}</td>
        </tr>
        ${data.receiptNumber ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Receipt Number:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.receiptNumber}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Date & Time:</td>
          <td style="padding: 6px 0; color: #475569;">${date}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Status:</td>
          <td style="padding: 6px 0; color: #059669; font-weight: 800; text-transform: uppercase;">VERIFIED (PAID)</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.receiptUrl || `${PORTAL_URL}/student`}" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">
        View & Download Receipt in Portal →
      </a>
    </div>
  `, `Payment Successful: ₦${Number(data.amount).toLocaleString()} for ${data.description}`);

  const text = `Payment Successful!\nDear ${data.customerName},\nAmount: ₦${Number(data.amount).toLocaleString()}\nPurpose: ${data.description}\nReference: ${data.reference}\nReceipt: ${data.receiptNumber || 'N/A'}\nDate: ${date}`;

  return { subject, html, text };
}

/**
 * 6. Payment Failed / Cancelled Notification
 */
export function getPaymentFailedTemplate(data: {
  customerName: string;
  amount?: number | string;
  reference?: string;
  description?: string;
  reason?: string;
}): { subject: string; html: string; text: string } {
  const subject = "Payment Unsuccessful - Imam Malik Science & Tahfiz College";

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        ⚠️
      </div>
      <h2 style="color: #991b1b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Payment Not Completed</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">We noticed an incomplete or cancelled payment attempt.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.customerName}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      Your recent payment attempt for <strong>${data.description || 'School Fees / Admission'}</strong> was not completed. No funds have been deducted from your account by our school system.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        ${data.amount ? `<tr><td style="padding: 6px 0; color: #64748b; width: 45%;">Attempted Amount:</td><td style="padding: 6px 0; color: #1e293b; font-weight: 700;">₦${Number(data.amount).toLocaleString()}</td></tr>` : ''}
        ${data.reference ? `<tr><td style="padding: 6px 0; color: #64748b;">Transaction Reference:</td><td style="padding: 6px 0; color: #475569; font-family: monospace;">${data.reference}</td></tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Status:</td>
          <td style="padding: 6px 0; color: #dc2626; font-weight: 700; text-transform: uppercase;">FAILED / INCOMPLETE</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <h4 style="color: #92400e; font-size: 13px; font-weight: 800; margin: 0 0 6px 0;">💡 How to complete your payment:</h4>
      <p style="font-size: 13px; color: #b45309; line-height: 1.5; margin: 0;">
        1. Ensure your bank card has sufficient funds and is enabled for online transactions.<br>
        2. Log back into your student or applicant portal.<br>
        3. Click "Retry Payment" to generate a fresh payment gateway link.
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${PORTAL_URL}/admission" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">
        Retry Payment on Portal →
      </a>
    </div>
  `, "Your payment attempt was not completed.");

  const text = `Payment Unsuccessful\nDear ${data.customerName},\nYour payment for ${data.description || 'School Registration'} was not completed.\nPlease retry via the portal: ${PORTAL_URL}`;

  return { subject, html, text };
}

/**
 * 7. Status Change Notification (Approved, Rejected, Under Review, etc.)
 */
export function getStatusChangeTemplate(data: {
  applicantName: string;
  referenceNumber: string;
  newStatus: string;
  previousStatus?: string;
  targetClass?: string;
  studentId?: string;
  adminInstructions?: string;
}): { subject: string; html: string; text: string } {
  const isApproved = data.newStatus.toLowerCase().includes('approved') || data.newStatus.toLowerCase().includes('admitted');
  const isRejected = data.newStatus.toLowerCase().includes('rejected') || data.newStatus.toLowerCase().includes('declined');

  const statusColor = isApproved ? '#059669' : (isRejected ? '#dc2626' : '#d97706');
  const statusBg = isApproved ? '#ecfdf5' : (isRejected ? '#fef2f2' : '#fffbeb');
  const statusBorder = isApproved ? '#a7f3d0' : (isRejected ? '#fecaca' : '#fef3c7');

  const subject = isApproved 
    ? "Imam Malik Science & Tahfiz College - Admission Approved! 🎉" 
    : `Application Status Update: ${data.newStatus.toUpperCase()}`;

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        ${isApproved ? '🎉' : (isRejected ? '⚠️' : '📋')}
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Application Status Update</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">Official update regarding your admission application</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.applicantName}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      ${isApproved 
        ? `Congratulations! We are delighted to inform you that your application for admission to <strong>${SCHOOL_NAME}</strong> has been officially <strong>APPROVED</strong>.` 
        : `This is an official communication regarding your application at <strong>${SCHOOL_NAME}</strong>.`}
    </p>

    <!-- Status Details Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 45%;">Application Ref:</td>
          <td style="padding: 6px 0; color: #064e3b; font-family: monospace; font-weight: 700;">${data.referenceNumber}</td>
        </tr>
        ${data.targetClass ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Assigned Class:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.targetClass}</td>
        </tr>` : ''}
        ${data.studentId ? `
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Student ID / Adm No:</td>
          <td style="padding: 6px 0; color: #059669; font-weight: 800;">${data.studentId}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Updated Status:</td>
          <td style="padding: 6px 0;">
            <span style="background-color: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusBorder}; font-weight: 800; font-size: 12px; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
              ${data.newStatus}
            </span>
          </td>
        </tr>
      </table>
    </div>

    ${data.adminInstructions ? `
    <div style="background-color: #f8fafc; border-left: 4px solid #064e3b; border-radius: 0 8px 8px 0; padding: 16px 20px; margin-bottom: 24px;">
      <h4 style="color: #064e3b; font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 0 0 6px 0;">Administrative Notes</h4>
      <p style="font-size: 13px; color: #334155; line-height: 1.6; margin: 0; white-space: pre-line;">${data.adminInstructions}</p>
    </div>` : ''}

    <div style="text-align: center;">
      <a href="${PORTAL_URL}/login" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 700; font-size: 14px;">
        ${isApproved ? 'Print Official Admission Offer Letter →' : 'Access Your Student Portal →'}
      </a>
    </div>
  `, `Status Update: ${data.applicantName} - ${data.newStatus}`);

  const text = `Application Status Update\nDear ${data.applicantName},\nReference: ${data.referenceNumber}\nStatus: ${data.newStatus}\n${data.studentId ? `Student ID: ${data.studentId}\n` : ''}${data.adminInstructions ? `Notes: ${data.adminInstructions}\n` : ''}Login: ${PORTAL_URL}/login`;

  return { subject, html, text };
}

/**
 * 8. Contact Form Notification (Admin & Acknowledgement to User)
 */
export function getContactFormAdminTemplate(data: {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  submittedAt?: string;
}): { subject: string; html: string; text: string } {
  const subject = `New Contact Form Message: ${data.subject || data.name}`;
  const timestamp = data.submittedAt || new Date().toLocaleString('en-GB');

  const html = renderEmailBase(`
    <div style="border-left: 4px solid #f59e0b; padding-left: 16px; margin-bottom: 24px;">
      <h2 style="color: #064e3b; font-size: 18px; font-weight: 800; margin: 0 0 4px 0;">Website Contact Message</h2>
      <p style="color: #64748b; font-size: 13px; margin: 0;">Inquiry received via website public contact form</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 35%;">Sender Name:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 700;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Sender Email:</td>
          <td style="padding: 6px 0; color: #1e293b;"><a href="mailto:${data.email}" style="color: #059669; text-decoration: none; font-weight: 600;">${data.email}</a></td>
        </tr>
        ${data.phone ? `<tr><td style="padding: 6px 0; color: #64748b;">Phone:</td><td style="padding: 6px 0; color: #1e293b;">${data.phone}</td></tr>` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Date & Time:</td>
          <td style="padding: 6px 0; color: #475569;">${timestamp}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <h4 style="color: #064e3b; font-size: 12px; font-weight: 800; text-transform: uppercase; margin: 0 0 10px 0;">Message Content</h4>
      <p style="color: #1e293b; font-size: 14px; line-height: 1.7; margin: 0; white-space: pre-line;">${data.message}</p>
    </div>

    <div style="text-align: center;">
      <a href="mailto:${data.email}?subject=Re: ${encodeURIComponent(data.subject || 'Inquiry to Imam Malik College')}" style="display: inline-block; background-color: #064e3b; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 13px;">
        Reply to ${data.name} →
      </a>
    </div>
  `, `New contact message from ${data.name}`);

  const text = `New Contact Form Message\nFrom: ${data.name} (${data.email})\nPhone: ${data.phone || 'N/A'}\nSubject: ${data.subject || 'Inquiry'}\n\nMessage:\n${data.message}`;

  return { subject, html, text };
}

/**
 * Contact Acknowledgement to User
 */
export function getContactFormUserAcknowledgementTemplate(data: {
  name: string;
  subject?: string;
}): { subject: string; html: string; text: string } {
  const subject = "We Received Your Message - Imam Malik Science & Tahfiz College";

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        ✉️
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Thank You for Contacting Us</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">We have received your message and will respond shortly.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.name}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      Thank you for reaching out to <strong>${SCHOOL_NAME}</strong>. Our admissions and administration team will review your inquiry and get in touch with you as soon as possible.
    </p>

    <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin-bottom: 0;">
      For urgent admission assistance or entrance exam queries, you can also reach our administrative desk by phone at <strong>${SCHOOL_PHONE}</strong> during working hours (8:00 AM - 4:00 PM).
    </p>
  `, "Thank you for contacting Imam Malik College. We received your message.");

  const text = `Thank you for contacting ${SCHOOL_NAME}.\nDear ${data.name},\nWe have received your message and our team will get back to you shortly.\nPhone: ${SCHOOL_PHONE}`;

  return { subject, html, text };
}

/**
 * 9. Password Reset / OTP Verification Code Template
 */
export function getPasswordResetOTPTemplate(data: {
  name: string;
  otpCode: string;
  expiresInMinutes?: number;
}): { subject: string; html: string; text: string } {
  const subject = "Your Verification Code - Imam Malik Science & Tahfiz College";
  const minutes = data.expiresInMinutes || 15;

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        🔐
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Account Verification Code</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">Use the one-time code below to securely reset your credentials.</p>
    </div>

    <p style="font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
      Dear <strong>${data.name}</strong>,
    </p>

    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
      We received a password reset request for your account on the <strong>${SCHOOL_NAME}</strong> portal. Enter this 6-digit verification code:
    </p>

    <!-- OTP Code Display -->
    <div style="text-align: center; margin: 28px 0;">
      <div style="display: inline-block; background-color: #064e3b; color: #f59e0b; font-size: 32px; font-weight: 900; letter-spacing: 8px; padding: 16px 36px; border-radius: 12px; font-family: monospace; border: 2px solid #f59e0b; box-shadow: 0 4px 14px rgba(6, 78, 59, 0.2);">
        ${data.otpCode}
      </div>
      <p style="color: #dc2626; font-size: 12px; font-weight: 600; margin-top: 10px;">
        ⏳ This code will expire in ${minutes} minutes.
      </p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin-bottom: 24px;">
      <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0;">
        🔒 <strong>Security Warning:</strong> Never share this code with anyone. Staff and teachers from Imam Malik College will never ask for your verification code or password.
      </p>
    </div>

    <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
      If you did not request this password reset, please ignore this email or contact support if you suspect unauthorized activity.
    </p>
  `, `Your verification code is ${data.otpCode}`);

  const text = `Your verification code is: ${data.otpCode}\nThis code expires in ${minutes} minutes.\nNever share this code with anyone.\n${SCHOOL_NAME}`;

  return { subject, html, text };
}

/**
 * 10. Brevo System Test Template
 */
export function getTestEmailTemplate(data: {
  testRecipient: string;
  senderName: string;
  senderEmail: string;
  provider: string;
}): { subject: string; html: string; text: string } {
  const subject = "Brevo Email Integration Test - Imam Malik College";

  const html = renderEmailBase(`
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; background-color: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 28px; margin-bottom: 12px;">
        🚀
      </div>
      <h2 style="color: #064e3b; font-size: 20px; font-weight: 800; margin: 0 0 6px 0;">Brevo Integration Test Successful!</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0;">Your transactional email delivery pipeline is operational.</p>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748b; width: 40%;">Delivery Provider:</td>
          <td style="padding: 6px 0; color: #064e3b; font-weight: 800; text-transform: uppercase;">${data.provider}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Configured Sender:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.senderName} &lt;${data.senderEmail}&gt;</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Test Recipient:</td>
          <td style="padding: 6px 0; color: #1e293b; font-weight: 600;">${data.testRecipient}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748b;">Dispatch Time:</td>
          <td style="padding: 6px 0; color: #475569;">${new Date().toISOString()}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #047857; text-align: center; margin: 0;">
      ✓ All templates, responsive containers, and deliverability headers are verified.
    </p>
  `, "Brevo email integration test delivered successfully.");

  const text = `Brevo Email Integration Test\nRecipient: ${data.testRecipient}\nProvider: ${data.provider}\nStatus: OK`;

  return { subject, html, text };
}
