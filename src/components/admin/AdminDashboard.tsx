import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserCheck, CreditCard, 
  Settings, Bell, LogOut, Menu, X, Landmark, 
  BookOpen, UserPlus, FileText, QrCode, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { isSupabaseConfigured } from '../../lib/supabase';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, limit } from 'firebase/firestore';

// Sub-components (to be implemented)
import AdminOverview from './AdminOverview';
import AdminStudents from './AdminStudents';
import AdminApplications from './AdminApplications';
import AdminPayments from './AdminPayments';
import AdminConfig from './AdminConfig';
import AdminAnnouncements from './AdminAnnouncements';
import AdminScanner from './AdminScanner';
import AdminSheets from './AdminSheets';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuth();

  useEffect(() => {
    // Real-time listener for system notifications
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedNotifs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setNotifications(fetchedNotifs);
    }, (error) => {
      console.warn("Notifications subscription error in AdminDashboard:", error);
    });

    return () => unsubscribe();
  }, []);

  const markNotificationsAsRead = async () => {
    const unread = notifications.filter(n => n.status === 'unread');
    for (const n of unread) {
      try {
        await updateDoc(doc(db, "notifications", n.id), { status: 'read' });
      } catch (err) {
        console.error("Error marking admin notification as read:", err);
      }
    }
  };

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { name: 'Applications', icon: UserPlus, path: '/admin/applications' },
    { name: 'Students', icon: Users, path: '/admin/students' },
    { name: 'Payments', icon: CreditCard, path: '/admin/payments' },
    { name: 'Verify QR Code', icon: QrCode, path: '/admin/verify' },
    { name: 'Google Sheets Sync', icon: FileSpreadsheet, path: '/admin/sheets' },
    { name: 'Academic Config', icon: Settings, path: '/admin/config' },
    { name: 'Announcements', icon: Bell, path: '/admin/announcements' },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = '/';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-emerald-950 text-white z-50 transition-transform lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <Link to="/" className="flex items-center gap-3 mb-10 px-2 hover:opacity-80 transition-opacity">
            <Landmark className="text-amber-500" size={32} />
            <div>
              <h2 className="font-bold text-lg leading-tight">IMSC Admin</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Management Suite</p>
            </div>
          </Link>

          <nav className="flex-grow space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  location.pathname === item.path 
                    ? "bg-amber-500 text-emerald-950 font-bold" 
                     : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(
                  location.pathname === item.path ? "text-emerald-950" : "text-emerald-100/40 group-hover:text-amber-500"
                )} />
                {item.name}
              </Link>
            ))}
            {/* Added Return Home Navigation Option */}
            <Link
              to="/"
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-100/60 hover:bg-white/5 hover:text-white transition-all group border border-dashed border-emerald-900/40 mt-4"
            >
              <Landmark size={20} className="text-emerald-100/40 group-hover:text-amber-500" />
              <span>Go to Website Home</span>
            </Link>
          </nav>

          <div className="pt-6 border-t border-emerald-900">
            <div className="flex items-center gap-3 px-4 py-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center font-bold text-amber-500">
                {userData?.displayName?.charAt(0) || 'A'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate">{userData?.displayName || 'Administrator'}</p>
                <p className="text-[10px] text-emerald-400 font-medium">Full Access</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300 hover:bg-red-500/10 transition-all font-medium"
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Menu size={24} />
            </button>
            <h3 className="font-bold text-slate-800 text-lg">
              {menuItems.find(m => m.path === location.pathname)?.name || 'Dashboard'}
            </h3>
          </div>
          <div className="flex items-center gap-6">
            {/* Go Home Button */}
            <Link 
              to="/" 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Landmark size={14} className="text-amber-600" />
              <span>Main Site</span>
            </Link>

            {/* Database Connection Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className={isSupabaseConfigured ? 'text-slate-600' : 'text-amber-700'}>
                {isSupabaseConfigured ? 'Supabase Live' : 'Offline Sandbox'}
              </span>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    markNotificationsAsRead();
                  }
                }}
                className="relative p-2 text-slate-400 hover:text-emerald-900 transition-colors transform active:scale-95 flex items-center justify-center cursor-pointer"
              >
                <Bell size={20} />
                {notifications.filter(n => n.status === 'unread').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[10px] font-black flex items-center justify-center text-emerald-950 animate-pulse">
                    {notifications.filter(n => n.status === 'unread').length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-left z-50"
                  >
                    <div className="p-4 bg-emerald-950 text-white flex justify-between items-center">
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">Admin Inbox Notifications Centre</h4>
                        <p className="text-[10px] text-emerald-300">Live admission payments & status logs</p>
                      </div>
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="text-white/70 hover:text-white p-1 cursor-pointer"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div key={n.id} className={cn("p-4 transition-all duration-200", n.status === 'unread' ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-slate-50")}>
                            <div className="flex gap-2.5">
                              <div className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", n.type === 'admission_payment' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                                <Bell size={14} />
                              </div>
                              <div className="space-y-1 w-full">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="text-xs font-bold text-slate-800 leading-tight">{n.title}</h5>
                                  {n.status === 'unread' && (
                                    <span className="text-[8px] bg-amber-500 text-emerald-950 font-black uppercase px-1 py-0.5 rounded flex-shrink-0">NEW</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{n.message}</p>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400">
                          <Bell className="mx-auto text-slate-300 mb-2" size={24} />
                          <p className="text-xs font-bold">No notifications yet.</p>
                          <p className="text-[10px] text-slate-400 mt-1">Updates will appear here dynamically.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Viewport */}
        <div className="p-8 overflow-y-auto flex-grow bg-slate-50">
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="students" element={<AdminStudents />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="verify" element={<AdminScanner />} />
            <Route path="sheets" element={<AdminSheets />} />
            <Route path="config" element={<AdminConfig />} />
            <Route path="announcements" element={<AdminAnnouncements />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
