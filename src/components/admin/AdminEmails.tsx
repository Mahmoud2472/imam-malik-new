import React, { useState, useEffect } from 'react';
import { 
  Mail, Send, RefreshCw, CheckCircle2, AlertTriangle, 
  Clock, ShieldCheck, Search, Filter, Eye, AlertCircle, 
  Sparkles, ExternalLink, HelpCircle, X, ChevronRight,
  UserCheck, CreditCard, FileText, Lock, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getEmailServiceStatus, 
  getEmailLogs, 
  sendTestEmail, 
  retryEmailLog, 
  EmailLogItem, 
  EmailServiceStatus 
} from '../../lib/emailService';
import { cn } from '../../lib/utils';
import { useAuth } from '../../lib/auth';

export default function AdminEmails() {
  const { userData } = useAuth();
  const [status, setStatus] = useState<EmailServiceStatus | null>(null);
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sent' | 'simulated' | 'failed'>('all');
  
  // Test Dispatch Form state
  const [testEmail, setTestEmail] = useState(userData?.email || 'admin@imsc.edu.ng');
  const [testType, setTestType] = useState('registration_user');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Retry state
  const [retryingLogId, setRetryingLogId] = useState<string | null>(null);

  // Preview Modal
  const [previewLog, setPreviewLog] = useState<EmailLogItem | null>(null);
  const [showDnsGuide, setShowDnsGuide] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [serviceStatus, emailLogs] = await Promise.all([
        getEmailServiceStatus(),
        getEmailLogs(100)
      ]);
      setStatus(serviceStatus);
      setLogs(emailLogs);
    } catch (err) {
      console.error("Error loading email dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      alert("Please enter a valid recipient email address for testing.");
      return;
    }

    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await sendTestEmail(testEmail, testType);
      setTestResult({
        success: res.success,
        message: res.message
      });
      // Refresh logs
      fetchDashboardData();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Failed to dispatch test notification.'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleRetry = async (log: EmailLogItem) => {
    setRetryingLogId(log.id);
    try {
      const res = await retryEmailLog(log.id);
      if (res.success) {
        alert(`Email retry sent to ${log.recipient}!`);
        fetchDashboardData();
      } else {
        alert(`Retry failed: ${res.message}`);
      }
    } catch (err: any) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setRetryingLogId(null);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.recipient.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.notificationType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = 
      statusFilter === 'all' ? true : log.status === statusFilter;

    return matchesSearch && matchesFilter;
  });

  const totalLogs = logs.length;
  const sentCount = logs.filter(l => l.status === 'sent').length;
  const simulatedCount = logs.filter(l => l.status === 'simulated').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-950 text-amber-500 rounded-xl">
              <Mail size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Brevo Email Notification Centre</h1>
              <p className="text-sm text-slate-500 font-medium">
                Automated transactional email dispatch, security audit & deliverability management
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDnsGuide(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ShieldCheck size={16} className="text-emerald-700" />
            <span>DKIM & Deliverability Guide</span>
          </button>
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-950 text-white font-bold text-xs hover:bg-emerald-900 transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={cn(isLoading && "animate-spin")} />
            <span>Refresh Logs</span>
          </button>
        </div>
      </div>

      {/* Brevo Configuration Status Card */}
      <div className={cn(
        "p-6 rounded-2xl border transition-all",
        status?.isConfigured 
          ? "bg-emerald-950 text-white border-emerald-900" 
          : "bg-amber-950/90 text-white border-amber-800"
      )}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={cn(
                "w-2.5 h-2.5 rounded-full animate-pulse",
                status?.isConfigured ? "bg-emerald-400" : "bg-amber-400"
              )} />
              <span className="text-xs font-black uppercase tracking-widest text-amber-400">
                {status?.isConfigured ? "Brevo Live API Connected" : "Simulation Mode Active"}
              </span>
            </div>
            <h3 className="text-lg font-bold">
              {status?.isConfigured 
                ? "Live Transactional Email Service is Operational" 
                : "Brevo API Key Pending — Running in Safe Simulation Mode"}
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              {status?.isConfigured
                ? "Emails to applicants, students, parents, and administrators are dispatched directly through Brevo's high-deliverability SMTP infrastructure with zero client key exposure."
                : "The application is currently simulating transactional email dispatch. All actions, templates, and triggers function seamlessly and are logged below. To activate real delivery, provide BREVO_API_KEY in your settings."}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/10 text-xs shrink-0">
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Sender Name</span>
              <span className="font-bold truncate max-w-[150px] block">{status?.senderName || 'Imam Malik College'}</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Sender Email</span>
              <span className="font-bold truncate max-w-[150px] block">{status?.senderEmail || 'noreply@imsc.edu.ng'}</span>
            </div>
            <div>
              <span className="text-white/60 block text-[10px] uppercase font-bold">Admin Alert Address</span>
              <span className="font-bold truncate max-w-[150px] block">{status?.adminEmail || 'admin@imsc.edu.ng'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Dispatches</span>
            <Mail size={18} />
          </div>
          <p className="text-2xl font-black text-slate-900">{totalLogs}</p>
          <span className="text-[10px] text-slate-500 font-medium">Lifetime tracked notifications</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Live Delivered</span>
            <CheckCircle2 size={18} />
          </div>
          <p className="text-2xl font-black text-emerald-700">{sentCount}</p>
          <span className="text-[10px] text-emerald-600 font-medium">Sent via Brevo API</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Simulated</span>
            <Clock size={18} />
          </div>
          <p className="text-2xl font-black text-amber-700">{simulatedCount}</p>
          <span className="text-[10px] text-amber-600 font-medium">Logged & rendered safely</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Failed / Rejected</span>
            <AlertTriangle size={18} />
          </div>
          <p className="text-2xl font-black text-red-700">{failedCount}</p>
          <span className="text-[10px] text-red-500 font-medium">Eligible for retry</span>
        </div>
      </div>

      {/* Main Grid: Test Runner + Live Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Live Email Test Console */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2 text-emerald-950">
              <Sparkles size={18} className="text-amber-500" />
              <h3 className="font-extrabold text-base">Brevo Test Console</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Safely test any of the 8 notification templates to a single designated recipient.
            </p>
          </div>

          <form onSubmit={handleSendTest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Notification Template Type
              </label>
              <select
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-800"
              >
                <option value="registration_user">1. User Registration Confirmation</option>
                <option value="registration_admin">2. Admin User Onboarding Alert</option>
                <option value="application_submitted">3. Application Submission Receipt</option>
                <option value="payment_success">4. Payment Verified Receipt</option>
                <option value="payment_failed">5. Payment Failed / Cancelled Notice</option>
                <option value="status_approved">6. Admission Status: Approved! 🎉</option>
                <option value="contact_form">7. Public Website Contact Message</option>
                <option value="password_reset">8. Password Reset / OTP Code</option>
                <option value="system_test">9. System Connectivity Diagnostic</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Test Recipient Address
              </label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-800"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Zero spam protection: only this single address will receive the test.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSendingTest}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-950 hover:bg-emerald-900 text-white font-bold text-xs transition-all shadow-md active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} className={cn(isSendingTest && "animate-pulse")} />
              <span>{isSendingTest ? "Dispatching via Brevo..." : "Send Test Notification"}</span>
            </button>
          </form>

          {/* Test Feedback */}
          {testResult && (
            <div className={cn(
              "p-4 rounded-xl border text-xs leading-relaxed space-y-1",
              testResult.success 
                ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
                : "bg-red-50 text-red-900 border-red-200"
            )}>
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? <CheckCircle2 size={16} className="text-emerald-700" /> : <AlertCircle size={16} className="text-red-600" />}
                <span>{testResult.success ? "Test Dispatch Completed" : "Test Dispatch Failed"}</span>
              </div>
              <p>{testResult.message}</p>
            </div>
          )}

          {/* Quick Notification Type Guide */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs space-y-2">
            <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Active Triggers in Portal</h4>
            <ul className="space-y-1.5 text-slate-600 text-[11px]">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>Registration:</strong> Triggered on new student/staff sign up</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>Admission:</strong> Dispatched upon form submit & fee payment</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>Bursary:</strong> Dispatched upon Paystack fee verification</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span><strong>Admin Decisions:</strong> Instant status change & offer letters</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Central Email Logs Table */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Live Transactional Email Logs</h3>
              <p className="text-xs text-slate-500">History of all dispatched notices, receipts, and system alerts</p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              {(['all', 'sent', 'simulated', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer",
                    statusFilter === f ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search logs by recipient email, subject, or notification type..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>

          {/* Table Container */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-3.5">Recipient & Type</th>
                    <th className="p-3.5">Subject</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Time</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log, idx) => (
                      <tr key={`${log.id || 'log'}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{log.recipient}</div>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                            {log.notificationType.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="p-3.5 max-w-[200px]">
                          <p className="truncate text-slate-700 font-medium">{log.subject}</p>
                          {log.providerMessageId && (
                            <span className="text-[9px] text-slate-400 font-mono">{log.providerMessageId}</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                            log.status === 'sent' && "bg-emerald-100 text-emerald-800",
                            log.status === 'simulated' && "bg-amber-100 text-amber-800",
                            log.status === 'failed' && "bg-red-100 text-red-800"
                          )}>
                            {log.status === 'sent' && <CheckCircle2 size={10} />}
                            {log.status === 'simulated' && <Clock size={10} />}
                            {log.status === 'failed' && <AlertTriangle size={10} />}
                            {log.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-[11px] text-slate-500 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="p-3.5 text-right whitespace-nowrap space-x-1">
                          {log.htmlPreview && (
                            <button
                              onClick={() => setPreviewLog(log)}
                              className="p-1.5 text-slate-400 hover:text-emerald-900 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                              title="Preview Email Content"
                            >
                              <Eye size={15} />
                            </button>
                          )}
                          <button
                            onClick={() => handleRetry(log)}
                            disabled={retryingLogId === log.id}
                            className="p-1.5 text-slate-400 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                            title="Retry Email Dispatch"
                          >
                            <RefreshCw size={15} className={cn(retryingLogId === log.id && "animate-spin")} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-12 text-center text-slate-400">
                        <Mail className="mx-auto mb-2 text-slate-300" size={32} />
                        <p className="font-bold text-sm">No email logs matching query</p>
                        <p className="text-xs text-slate-400 mt-1">Emails dispatched across the portal will appear here automatically.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewLog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 bg-emerald-950 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-sm">Email Preview</h3>
                  <p className="text-xs text-emerald-300 font-mono mt-0.5">To: {previewLog.recipient} | Subject: {previewLog.subject}</p>
                </div>
                <button
                  onClick={() => setPreviewLog(null)}
                  className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-grow bg-slate-100">
                <div 
                  className="bg-white rounded-xl shadow p-4"
                  dangerouslySetInnerHTML={{ __html: previewLog.htmlPreview || '<p>No HTML preview stored</p>' }}
                />
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
                <span className="text-xs text-slate-500">
                  Status: <strong>{previewLog.status.toUpperCase()}</strong> ({previewLog.provider})
                </span>
                <button
                  onClick={() => {
                    handleRetry(previewLog);
                    setPreviewLog(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-950 text-white font-bold text-xs hover:bg-emerald-900 cursor-pointer"
                >
                  Resend This Email
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deliverability / DNS Guide Modal */}
      <AnimatePresence>
        {showDnsGuide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-5 bg-emerald-950 text-white flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="text-amber-500" size={20} />
                  <h3 className="font-bold text-sm">Brevo Email Deliverability & DNS Setup</h3>
                </div>
                <button
                  onClick={() => setShowDnsGuide(false)}
                  className="p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600 leading-relaxed">
                <p>
                  To achieve 100% inbox placement and prevent school emails from landing in spam/junk folders, add the following DNS records to your school domain manager (e.g. Cloudflare, Namecheap, cPanel):
                </p>

                {/* SPF */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">1. SPF Record (Sender Policy Framework)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">TXT Record</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Authorizes Brevo servers to send emails on behalf of your domain.</p>
                  <div className="p-2.5 bg-slate-900 text-amber-400 font-mono rounded-lg text-[11px] break-all">
                    v=spf1 include:spf.brevo.com ~all
                  </div>
                </div>

                {/* DKIM */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">2. DKIM Record (DomainKeys Identified Mail)</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">TXT Record</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Cryptographically signs emails to confirm sender authenticity.</p>
                  <div className="p-2 bg-slate-200 text-slate-800 font-mono rounded text-[10px]">
                    Host/Name: <strong>mail._domainkey.imsc.edu.ng</strong>
                  </div>
                  <div className="p-2.5 bg-slate-900 text-amber-400 font-mono rounded-lg text-[10px] break-all">
                    k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeMVIkuJNY97WbiWz... (Generated in Brevo Dashboard)
                  </div>
                </div>

                {/* DMARC */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 text-xs">3. DMARC Policy</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">TXT Record</span>
                  </div>
                  <div className="p-2 bg-slate-200 text-slate-800 font-mono rounded text-[10px]">
                    Host/Name: <strong>_dmarc.imsc.edu.ng</strong>
                  </div>
                  <div className="p-2.5 bg-slate-900 text-amber-400 font-mono rounded-lg text-[11px] break-all">
                    v=DMARC1; p=none; sp=none; rua=mailto:dmarc@imsc.edu.ng
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setShowDnsGuide(false)}
                  className="px-5 py-2 rounded-xl bg-emerald-950 text-white font-bold text-xs hover:bg-emerald-900 cursor-pointer"
                >
                  Close Guide
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
