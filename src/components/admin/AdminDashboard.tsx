import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Users, UserCheck, CreditCard, 
  Settings, Bell, LogOut, Menu, X, Landmark, 
  BookOpen, UserPlus, FileText, QrCode, FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { cn } from '../../lib/utils';
import { isSupabaseConfigured } from '../../lib/supabase';

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
  const location = useLocation();
  const navigate = useNavigate();
  const { userData } = useAuth();

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
          <div className="flex items-center gap-3 mb-10 px-2">
            <Landmark className="text-amber-500" size={32} />
            <div>
              <h2 className="font-bold text-lg leading-tight">IMSC Admin</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Management Suite</p>
            </div>
          </div>

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
            <button className="relative p-2 text-slate-400 hover:text-emerald-900 transition-colors">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full" />
            </button>
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
