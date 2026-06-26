import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, Users, DollarSign, UserCheck, AlertCircle } from 'lucide-react';
import { collection, query, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, cn } from '../../lib/utils';
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

  useEffect(() => {
    // Real-time stats listeners
    const unsubStudents = onSnapshot(collection(db, "students"), (snap) => {
      setStats(prev => ({ ...prev, totalStudents: snap.size }));
    });

    const unsubApps = onSnapshot(collection(db, "applications"), (snap) => {
      setStats(prev => ({ ...prev, pendingApps: snap.docs.filter(d => d.data().status === 'pending').length }));
    });

    const unsubPayments = onSnapshot(query(collection(db, "payments"), orderBy("paymentDate", "desc")), (snap) => {
      const total = snap.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setStats(prev => ({ ...prev, totalRevenue: total }));
      setRecentPayments(snap.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStudents();
      unsubApps();
      unsubPayments();
    };
  }, []);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 glass-card p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h3 className="text-lg font-bold text-emerald-950">Revenue Growth</h3>
              <p className="text-sm text-slate-500">Term-by-term fee collection overview</p>
            </div>
            <select className="bg-slate-100 border-none rounded-lg text-xs font-bold px-3 py-2">
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

        {/* Recent Activity */}
        <div className="glass-card p-8 overflow-hidden">
          <h3 className="text-lg font-bold text-emerald-950 mb-6">Recent Payments</h3>
          <div className="space-y-6">
            {recentPayments.map((pay, idx) => (
              <div key={idx} onClick={() => navigate('/admin/payments')} className="flex justify-between items-center group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center font-bold text-emerald-900 group-hover:bg-emerald-900 group-hover:text-white transition-colors">
                    {pay.studentId?.charAt(0) || 'P'}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-slate-800 truncate max-w-[120px]">Payment {pay.receiptNumber}</h5>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{pay.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-emerald-600">{formatCurrency(pay.amount)}</div>
                  <div className="text-[10px] text-slate-400 font-medium">Verified</div>
                </div>
              </div>
            ))}
            {recentPayments.length === 0 && (
              <p className="text-center py-10 text-slate-400 text-sm">No recent payments.</p>
            )}
          </div>
          <button 
            onClick={() => navigate('/admin/payments')}
            className="w-full mt-8 py-3 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors uppercase tracking-widest"
          >
            View All Transactions
          </button>
        </div>
      </div>
    </div>
  );
}

