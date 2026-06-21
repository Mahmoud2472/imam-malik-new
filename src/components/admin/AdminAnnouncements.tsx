import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bell, Send, History, Trash2, Loader2, Mail, Eye, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function AdminAnnouncements() {
  const [activeTab, setActiveTab] = useState<'announcements' | 'outbox'>('announcements');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Outbound Dispatch logs
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [dbNotifications, setDbNotifications] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [viewingLog, setViewingLog] = useState<any>(null);
  const [sendingTest, setSendingTest] = useState(false);

  // Load announcements
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.warn("Announcements loading fallback initiated:", error);
      getDocs(collection(db, "announcements")).then((snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        list.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setAnnouncements(list);
        setLoading(false);
      });
    });
    return () => unsubscribe();
  }, []);

  // Load Outbound Email Dispatch logs
  useEffect(() => {
    if (activeTab === 'outbox') {
      setLoadingLogs(true);
      const qEmails = query(collection(db, "email_logs"), orderBy("sentAt", "desc"));
      const unsubscribeEmails = onSnapshot(qEmails, (snapshot) => {
        setEmailLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingLogs(false);
      }, (err) => {
        console.warn("Emails logs fetch fallback:", err);
        getDocs(collection(db, "email_logs")).then(snap => {
          const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          fetched.sort((a: any, b: any) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime());
          setEmailLogs(fetched);
          setLoadingLogs(false);
        });
      });

      const qNotifs = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
      const unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
        setDbNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Notifications log fetch fallback:", err);
        getDocs(collection(db, "notifications")).then(snap => {
          const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          fetched.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setDbNotifications(fetched);
        });
      });

      return () => {
        unsubscribeEmails();
        unsubscribeNotifs();
      };
    }
  }, [activeTab]);

  const broadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title,
        content,
        date: new Date().toISOString(),
        priority: 'high'
      });
      setTitle('');
      setContent('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Remove this announcement from the system?")) {
      await deleteDoc(doc(db, "announcements", id));
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm("Permanently wipe clean all outbound delivery logs for testing?")) {
      alert("Demo Wipe Complete. In a real system, transaction logs are archived safely.");
    }
  };

  const handleSendTestTrigger = async () => {
    setSendingTest(true);
    try {
      // 1. Trigger simulated outbox log in Firestore
      const testEmail = "test-applicant@mail.com";
      const testName = "Adam Alhassan";
      const testClass = "JSS 1";

      await addDoc(collection(db, "notifications"), {
        userId: "demo-test-uid",
        applicantEmail: testEmail,
        title: "Admission Status: Approved! 🎉",
        message: `Congratulations ${testName}! Your admission application for class ${testClass} has been approved. You are now promoted to the Student role.`,
        type: "admission_status",
        status: "unread",
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, "email_logs"), {
        userId: "demo-test-uid",
        to: testEmail,
        subject: "Imam Malik Science & Tahfiz College - Admission Approved! 🎉",
        body: `Dear ${testName},\n\nCongratulations!\n\nWe are extremely pleased to inform you that your application for admission to Imam Malik Science & Tahfiz College has been APPROVED for class: ${testClass}.\n\nYou can now log back into the portal at https://imsc.edu/auth using your registered student credentials.\n\nBest regards,\nAdmission Office\nImam Malik Science & Tahfiz College`,
        sentAt: new Date().toISOString(),
        status: "delivered"
      });

      alert("🎉 Simulated Outbox Event Dispatched! Both a Database Notification and outbound Email Log have been created instantly.");
    } catch (err) {
      console.error(err);
      alert("Failed to send test trigger.");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Tab Switcher Headers */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('announcements')}
          className={cn(
            "px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all transition-colors flex items-center gap-2",
            activeTab === 'announcements' 
              ? "border-emerald-800 text-emerald-950 font-black" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Bell size={16} /> Campus Broadcasts
        </button>
        <button
          onClick={() => setActiveTab('outbox')}
          className={cn(
            "px-6 py-3 font-bold text-sm uppercase tracking-wider border-b-2 transition-all transition-colors flex items-center gap-2 relative",
            activeTab === 'outbox' 
              ? "border-emerald-800 text-emerald-950 font-black" 
              : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          <Mail size={16} /> Outbox Mail Logs
          <span className="bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 text-[9px] font-black uppercase">Auto-Dispatched</span>
        </button>
      </div>

      {activeTab === 'announcements' ? (
        <div className="grid lg:grid-cols-2 gap-12">
          {/* New Broadcast Form */}
          <div className="glass-card p-10 ring-4 ring-emerald-50 bg-white shadow-xl shadow-emerald-900/5">
            <div className="flex items-center gap-3 mb-10">
              <div className="p-3 bg-amber-50 rounded-2xl">
                <Bell className="text-amber-600" size={28} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-emerald-950 leading-tight">New Broadcast</h3>
                <p className="text-sm text-slate-500">Post updates to the website homepage</p>
              </div>
            </div>
            <form onSubmit={broadcast} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 animate-fade-in">Headline</label>
                <input 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="input-field" 
                  placeholder="e.g. 2nd Term Vacation Date" 
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
                <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="input-field h-40" 
                  placeholder="Write detailed announcement..." 
                  required
                />
              </div>
              <button disabled={sending} className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-lg shadow-xl shadow-emerald-900/20 transition-all active:scale-95">
                {sending ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Publish to Website</>}
              </button>
            </form>
          </div>

          {/* Past Announcements History */}
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-emerald-950 flex items-center gap-2">
                <History size={20} className="text-slate-400" /> Past Announcements
              </h3>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{announcements.length} Published</span>
            </div>
            
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-900" /></div>
            ) : (
              <div className="space-y-4">
                {announcements.map((old) => (
                  <div key={old.id} className="glass-card p-6 flex justify-between items-center group hover:border-emerald-200 transition-colors">
                    <div>
                      <h5 className="font-bold text-slate-800 mb-0.5">{old.title}</h5>
                      <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-md line-clamp-2">{old.content}</p>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-2">
                        {old.date ? new Date(old.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDelete(old.id)}
                      className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 shrink-0"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                {announcements.length === 0 && (
                  <p className="text-center py-20 text-slate-400 font-medium">No announcements published yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Outbox Email & System Notification Logs Tab */
        <div className="space-y-8 animate-fade-in text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-50 border border-emerald-100 p-6 rounded-2xl">
            <div>
              <h4 className="font-extrabold text-emerald-950 flex items-center gap-1.5 text-base">
                <Sparkles className="text-amber-500" size={18} /> Automated Dispatch Centre
              </h4>
              <p className="text-xs text-slate-600 mt-1">
                The college is fully configured to fire automated email dispatches and real-time dashboard notifications whenever an applicant's admission status changes in the system.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={handleSendTestTrigger}
                disabled={sendingTest}
                className="px-4 py-2 bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm"
              >
                {sendingTest ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 
                Send Demo Event
              </button>
              <button 
                onClick={handleClearLogs}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Wipe Logs
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Outbound Email Logs */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Mail size={16} /> Outgoing Automated Emails ({emailLogs.length})
              </h4>
              
              {loadingLogs ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-950" /></div>
              ) : (
                <div className="glass-card divide-y overflow-hidden max-h-[500px] overflow-y-auto">
                  {emailLogs.length > 0 ? (
                    emailLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                        <div className="overflow-hidden space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800">{log.to}</span>
                            <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded font-black uppercase">Delivered</span>
                          </div>
                          <p className="text-xs text-slate-500 font-bold truncate">{log.subject}</p>
                          <span className="block text-[10px] text-slate-400 font-medium">
                            {log.sentAt ? new Date(log.sentAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                          </span>
                        </div>
                        <button 
                          onClick={() => setViewingLog({ type: 'Email', ...log })}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-950 text-[11px] font-bold transition-all flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Eye size={12} /> View Body
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-slate-400">
                      <Mail size={32} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-xs font-bold leading-tight">No automated email dispatches recorded.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Approve or reject any student application to see this list populate.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Dashboard Notification Triggers */}
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Bell size={16} /> Dashboard Portal Triggers ({dbNotifications.length})
              </h4>

              {loadingLogs ? (
                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-emerald-950" /></div>
              ) : (
                <div className="glass-card divide-y overflow-hidden max-h-[500px] overflow-y-auto">
                  {dbNotifications.length > 0 ? (
                    dbNotifications.map((notif) => (
                      <div key={notif.id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center group">
                        <div className="overflow-hidden space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800">{notif.applicantEmail || 'Registered Applicant'}</span>
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded font-black uppercase",
                              notif.status === 'unread' ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-500"
                            )}>
                              {notif.status || 'unread'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-bold leading-tight">{notif.title}</p>
                          <p className="text-[11px] text-slate-400 truncate">{notif.message}</p>
                          <span className="block text-[10px] text-slate-400 font-medium">
                            {notif.createdAt ? new Date(notif.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                          </span>
                        </div>
                        <button 
                          onClick={() => setViewingLog({ type: 'System Trigger', to: notif.applicantEmail, subject: notif.title, body: notif.message, sentAt: notif.createdAt })}
                          className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-emerald-50 hover:text-emerald-950 text-[11px] font-bold transition-all flex items-center gap-1 opacity-0 group-hover:opacity-100 shrink-0"
                        >
                          <Eye size={12} /> Inspect
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-slate-400">
                      <Bell size={32} className="mx-auto text-slate-200 mb-2" />
                      <p className="text-xs font-bold leading-tight">No system dashboard notifications recorded.</p>
                      <p className="text-[10px] text-slate-400 mt-1">Wait for status changed triggers to write live documents.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Log Inspector Modal */}
      <AnimatePresence>
        {viewingLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingLog(null)}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 bg-emerald-950 text-white flex justify-between items-center">
                <div>
                  <span className="text-[9px] bg-amber-500 text-emerald-950 font-black uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block">
                    {viewingLog.type} Inspector
                  </span>
                  <h4 className="font-extrabold text-sm truncate max-w-sm">Recipient: {viewingLog.to || 'Registered Applicant'}</h4>
                </div>
                <button 
                  onClick={() => setViewingLog(null)} 
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Subject / Header Title</span>
                  <p className="font-extrabold text-slate-800 text-sm leading-tight">{viewingLog.subject || viewingLog.title || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Simulated Ingress Body</span>
                  <div className="bg-slate-50 p-4 rounded-2xl border text-xs text-slate-600 font-medium leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-sans">
                    {viewingLog.body || viewingLog.message}
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold pt-2 border-t">
                  <span>DISPATCH: AUTOMATIC (SMTP VIRTUAL)</span>
                  <span>SENT AT: {new Date(viewingLog.sentAt || viewingLog.createdAt).toLocaleString('en-GB')}</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t flex justify-end">
                <button 
                  onClick={() => setViewingLog(null)} 
                  className="px-6 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-bold text-slate-700 transition"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
