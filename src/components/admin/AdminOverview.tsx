import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, Users, DollarSign, UserCheck, AlertCircle, 
  FileSpreadsheet, ExternalLink, RefreshCw, CheckCircle2, 
  Activity, ArrowUpRight, Clock, ShieldCheck, FileText, Sparkles
} from 'lucide-react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, cn, formatDate } from '../../lib/utils';
import AdminStatusDashboard from './AdminStatusDashboard';

const data = [
  { name: 'Jan', revenue: 4000, students: 240 },
  { name: 'Feb', revenue: 3000, students: 238 },
  { name: 'Mar', revenue: 7000, students: 250 },
  { name: 'Apr', revenue: 8000, students: 270 },
  { name: 'May', revenue: 12000, students: 300 },
];

export default function AdminOverview() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalRevenue: 0,
    pendingApps: 0,
    activeTeachers: 38
  });
  const [recentPayments, setRecentPayments] = useState<any[]>([]);
  const [recentApps, setRecentApps] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'apps' | 'payments'>('all');

  useEffect(() => {
    // Real-time stats listeners
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStats(prev => ({ ...prev, totalStudents: snap.size }));
    });

    const unsubApps = onSnapshot(collection(db, "applications"), (snap) => {
      setStats(prev => ({ ...prev, pendingApps: snap.docs.filter(d => d.data().status === 'pending').length }));
    });

    // Real-time apps list listener for activity feed
    const qApps = query(collection(db, "applications"), orderBy("appliedDate", "desc"));
    const unsubAppsList = onSnapshot(qApps, (snap) => {
      setRecentApps(snap.docs.map(doc => ({
        id: doc.id,
        type: 'application',
        title: 'New Admission Application',
        name: doc.data().fullName || `${doc.data().firstName || ''} ${doc.data().lastName || ''}`.trim() || 'New Applicant',
        email: doc.data().email || 'N/A',
        classId: doc.data().targetClassId || doc.data().targetClass || 'N/A',
        status: doc.data().status || 'pending',
        timestamp: doc.data().appliedDate || doc.data().createdAt || new Date().toISOString(),
        amount: doc.data().amountPaid || null
      })));
    }, (err) => {
      console.warn("Firestore unsubAppsList error in AdminOverview:", err);
    });

    // Real-time payments listener
    const unsubPayments = onSnapshot(query(collection(db, "payments"), orderBy("paymentDate", "desc")), (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setStats(prev => ({ ...prev, totalRevenue: total }));
      setRecentPayments(snap.docs.map(doc => ({
        id: doc.id,
        type: 'payment',
        title: 'Payment Received',
        name: doc.data().studentName || doc.data().studentEmail || 'N/A',
        email: doc.data().studentEmail || 'N/A',
        classId: doc.data().classId || 'N/A',
        status: doc.data().status || 'verified',
        timestamp: doc.data().paymentDate || new Date().toISOString(),
        amount: doc.data().amount || 0,
        receiptNumber: doc.data().receiptNumber || doc.data().paystackReference || doc.data().reference || 'N/A',
        paymentType: doc.data().type || 'Admission Fee'
      })));
    }, (err) => {
      console.warn("Firestore unsubPayments error in AdminOverview:", err);
    });

    return () => {
      unsubStudents();
      unsubApps();
      unsubAppsList();
      unsubPayments();
    };
  }, []);

  // Merge and sort both activities chronologically in real-time
  const combinedActivities = [
    ...recentApps,
    ...recentPayments
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter activities based on selection tab
  const filteredActivities = combinedActivities.filter(activity => {
    if (activeTab === 'all') return true;
    if (activeTab === 'apps') return activity.type === 'application';
    if (activeTab === 'payments') return activity.type === 'payment';
    return true;
  }).slice(0, 10); // Show latest 10 activities

  return (
    <div className="space-y-8 pb-12">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Students', value: stats.totalStudents, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Pending Apps', value: stats.pendingApps, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Owed Fees', value: formatCurrency(240000), icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="glass-card p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl", item.bg)}>
                <item.icon className={item.color} size={24} />
              </div>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <TrendingUp size={12} /> +12%
              </span>
            </div>
            <h4 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{item.label}</h4>
            <div className="text-2xl font-bold text-slate-800">{item.value}</div>
          </motion.div>
        ))}
      </div>

      <AdminStatusDashboard />

      {/* Google Sheets Backup Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-gradient-to-r from-emerald-950 to-emerald-900 border border-emerald-900 shadow-lg rounded-2xl text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden"
      >
        <div className="relative z-10 flex items-start gap-4">
          <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-amber-400 shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-black uppercase tracking-wider text-amber-400">Google Workspace Backup Database Active</h4>
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 leading-relaxed font-medium mt-1 max-w-2xl">
              All student profiles, incoming applications, and Paystack transactions sync securely with your private Google Sheet <strong>"IMST_Database"</strong>.
            </p>
            <a 
              href="https://docs.google.com/spreadsheets/d/1Ca3im4VDia822WPyi3tBGHf5BiiA3HQJraWBN2T03gw/edit?usp=drivesdk" 
              target="_blank" 
              rel="noreferrer" 
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-300 hover:text-amber-400 transition-colors mt-2 underline"
            >
              Open Connected Spreadsheet Link <ExternalLink size={11} />
            </a>
          </div>
        </div>
        <button
          onClick={() => navigate('/admin/sheets')}
          className="relative z-10 font-bold text-xs uppercase tracking-widest bg-amber-500 hover:bg-amber-600 text-emerald-950 px-5 py-3 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <RefreshCw size={14} className="animate-spin-slow" />
          Sync Center
        </button>
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-amber-500/10 rounded-full blur-[50px] -mr-16 -mt-16" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass-card p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-lg font-bold text-emerald-950">Revenue Growth</h3>
              <p className="text-sm text-slate-500">Term-by-term fee collection overview</p>
            </div>
            <select className="bg-slate-100 border-none rounded-lg text-xs font-bold px-3 py-2 text-slate-700">
              <option>2026/2027 Session</option>
              <option>2025/2026 Session</option>
              <option>2024/2025 Session</option>
            </select>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#065f46" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#065f46" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₦${value/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke="#065f46" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Activity Feed Column */}
        <div className="glass-card p-8 flex flex-col h-[480px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="text-emerald-800 animate-pulse" size={20} />
              <h3 className="text-lg font-bold text-emerald-950">Live Activities</h3>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Real-time
            </span>
          </div>

          {/* Toggle Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-slate-100/80 p-1 rounded-xl mb-5 text-[11px] font-bold text-slate-600">
            {[
              { id: 'all', label: 'All Activities' },
              { id: 'apps', label: 'Admission' },
              { id: 'payments', label: 'Payments' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "py-1.5 rounded-lg transition-all text-center cursor-pointer",
                  activeTab === tab.id ? "bg-white text-emerald-950 shadow-sm" : "hover:text-slate-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Feed Content */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
            <AnimatePresence mode="popLayout">
              {filteredActivities.map((act, idx) => (
                <motion.div
                  key={act.id || idx}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onClick={() => navigate(act.type === 'application' ? '/admin/applications' : '/admin/payments')}
                  className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl flex items-start gap-3 transition-all cursor-pointer group"
                >
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold",
                    act.type === 'application' 
                      ? "bg-blue-50 text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white" 
                      : "bg-amber-50 text-amber-600 border border-amber-100 group-hover:bg-amber-600 group-hover:text-white"
                  )}>
                    {act.type === 'application' ? <FileText size={16} /> : <DollarSign size={16} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-[11px] font-black tracking-wide text-slate-400 uppercase leading-none truncate">
                        {act.title}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 shrink-0 flex items-center gap-0.5">
                        <Clock size={10} />
                        {act.timestamp ? formatDate(act.timestamp) : 'N/A'}
                      </p>
                    </div>

                    <h5 className="text-xs font-extrabold text-slate-800 truncate mt-1">
                      {act.name}
                    </h5>

                    <p className="text-[10px] text-slate-500 truncate leading-relaxed mt-0.5 font-medium">
                      {act.type === 'application' ? (
                        <>Targeting Class: <span className="font-bold text-slate-700">{act.classId}</span> • <span className={cn(
                          "px-1.5 py-0.2 rounded-full text-[9px] uppercase font-black",
                          act.status === 'approved' ? "text-emerald-700 bg-emerald-50" :
                          act.status === 'rejected' ? "text-rose-700 bg-rose-50" : "text-blue-700 bg-blue-50"
                        )}>{act.status}</span></>
                      ) : (
                        <>{act.paymentType} • <span className="font-black text-emerald-600 font-mono">{formatCurrency(act.amount)}</span></>
                      )}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredActivities.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <Sparkles className="text-slate-300 mx-auto" size={24} />
                <p className="text-xs text-slate-400 font-bold">No active feeds recorded yet.</p>
              </div>
            )}
          </div>

          <button 
            onClick={() => navigate(activeTab === 'apps' ? '/admin/applications' : '/admin/payments')}
            className="w-full mt-4 py-2.5 rounded-xl border border-slate-100 text-[10px] font-black text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest text-center"
          >
            Manage Databases <ArrowUpRight size={12} className="inline ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
