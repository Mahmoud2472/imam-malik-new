import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  sendEmailDirect,
  handleRegistrationEmail,
  handleApplicationSubmittedEmail,
  handlePaymentSuccessEmail,
  handlePaymentFailedEmail,
  handleStatusChangeEmail,
  handleContactFormEmail,
  handlePasswordResetOTP,
  handleVerifyOTP,
  getEmailStatus,
  getEmailLogsList,
  handleRetryEmail,
  handleTestEmail
} from './server/emailController';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body Parser with safe payload limit
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Imam Malik Science & Tahfiz College Portal',
      timestamp: new Date().toISOString()
    });
  });

  // --- BREVO EMAIL NOTIFICATION API ROUTES ---
  app.post('/api/email/send', sendEmailDirect);
  app.post('/api/email/registration', handleRegistrationEmail);
  app.post('/api/email/application-submitted', handleApplicationSubmittedEmail);
  app.post('/api/email/payment-success', handlePaymentSuccessEmail);
  app.post('/api/email/payment-failed', handlePaymentFailedEmail);
  app.post('/api/email/status-change', handleStatusChangeEmail);
  app.post('/api/email/contact', handleContactFormEmail);
  app.post('/api/email/password-reset', handlePasswordResetOTP);
  app.post('/api/email/verify-otp', handleVerifyOTP);
  app.get('/api/email/status', getEmailStatus);
  app.get('/api/email/logs', getEmailLogsList);
  app.post('/api/email/retry', handleRetryEmail);
  app.post('/api/email/test', handleTestEmail);

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Imam Malik College Portal running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
