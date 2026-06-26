import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, User, BookOpen, CreditCard, 
  Download, LogOut, Menu, X, Landmark, FileText,
  Calendar, Award, GraduationCap, Printer, Loader2,
  Camera, Upload, AlertCircle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { isSupabaseConfigured } from '../../lib/supabase';
import { collection, query, where, getDocs, limit, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import AdmissionLetter from '../public/AdmissionLetter';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

export default function StudentDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, user } = useAuth();

  useEffect(() => {
    if (user && userData?.admissionStatus === 'approved') {
      const fetchApp = async () => {
        const q = query(collection(db, "applications"), where("userId", "==", user.uid), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setApplication({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      };
      fetchApp();
    }
  }, [user, userData]);

  const menuItems = [
    { name: 'Overview', icon: LayoutDashboard, path: '/student' },
    { name: 'My Results', icon: Award, path: '/student/results' },
    { name: 'Fees & Payments', icon: CreditCard, path: '/student/fees' },
    { name: 'My Profile', icon: User, path: '/student/profile' },
  ];

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error("Logout error:", error);
      // Fallback redirect even if signOut fails for some reason
      window.location.href = '/';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-emerald-950 text-white z-50 transition-transform lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="p-2 bg-amber-500 rounded-lg">
              <GraduationCap className="text-emerald-950" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight">Student Portal</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Imam Malik College</p>
            </div>
          </div>

          <nav className="flex-grow space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  location.pathname === item.path ? "bg-amber-500 text-emerald-950 font-bold" : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(location.pathname === item.path ? "text-emerald-950" : "text-emerald-100/40 group-hover:text-amber-500")} />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="pt-6 border-t border-emerald-900 text-center">
             <button onClick={handleLogout} className="w-full flex items-center justify-center gap-3 px-4 py-3 text-red-300 hover:bg-red-500/10 rounded-xl transition-all font-medium">
               <LogOut size={20} /> Logout
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500"><Menu size={24} /></button>
             <h3 className="font-bold text-slate-800">Assalamu Alaikum, {userData?.displayName?.split(' ')[0]}</h3>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Database Connection Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className={isSupabaseConfigured ? 'text-slate-600' : 'text-amber-700'}>
                {isSupabaseConfigured ? 'Supabase Live' : 'Offline Sandbox'}
              </span>
            </div>
            
            <Link to="/student/profile" className="flex items-center gap-3 group">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-700 leading-tight group-hover:text-amber-600 transition-colors">{userData?.displayName}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{userData?.role}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-900 border border-slate-200 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 shadow-sm transition-all group-hover:border-amber-500">
              {userData?.photoUrl ? (
                <img src={userData.photoUrl} alt="profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userData?.displayName?.charAt(0)
              )}
            </div>
          </Link>
        </div>
      </header>

        <div className="p-8 overflow-y-auto flex-grow">
          <Routes>
            <Route index element={<StudentOverview application={application} />} />
            <Route path="results" element={<StudentResults />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="profile" element={<StudentProfile />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function StudentOverview({ application }: { application: any }) {
  const { userData } = useAuth();
  const [showLetter, setShowLetter] = useState(false);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <div className="glass-card p-8 flex items-center gap-6 school-gradient text-white">
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold border border-white/10 overflow-hidden shrink-0">
              {userData?.photoUrl ? (
                <img src={userData.photoUrl} alt="avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userData?.displayName?.charAt(0)
              )}
            </div>
            <div className="flex-grow">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">Student Transcript</p>
                  <h2 className="text-2xl font-bold">{userData?.displayName}</h2>
                  <div className="flex gap-4 mt-2">
                    <span className="text-sm font-medium opacity-80">ID: IMSC/2026/04{userData?.studentId?.slice(0,3)}</span>
                    <span className="text-sm font-medium opacity-80 uppercase">Class: {userData?.targetClass || 'SS 2'}</span>
                  </div>
                </div>
                {userData?.admissionStatus === 'approved' && (
                  <button 
                    onClick={() => setShowLetter(true)}
                    className="px-4 py-2 bg-white text-emerald-950 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-amber-500 transition-colors shadow-lg"
                  >
                    Admission Letter
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div className="glass-card p-6 border-l-4 border-emerald-600">
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Acadmic Standing</h4>
               <div className="flex items-end gap-2">
                 <span className="text-3xl font-bold text-emerald-950">A-</span>
                 <span className="text-xs text-emerald-600 font-bold mb-1 opacity-60">Avg: 78.4%</span>
               </div>
             </div>
             <div className="glass-card p-6 border-l-4 border-amber-500">
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Fee Status</h4>
               <div className="flex items-end gap-2 text-amber-600">
                 <span className="text-lg font-bold">₦0.00 Owed</span>
                 <span className="text-[10px] font-black uppercase mb-1 opacity-60">(Clear)</span>
               </div>
             </div>
          </div>
        </div>

        <div className="glass-card p-8">
          <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2"><Calendar size={20} className="text-amber-500" /> Upcoming Events</h3>
          <div className="space-y-6">
            <div className="relative pl-6 border-l border-emerald-100">
              <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 bg-emerald-600 rounded-full" />
              <p className="text-xs text-slate-400 font-bold">APR 24, 2026</p>
              <h5 className="text-sm font-bold text-slate-800">2nd Term Examination</h5>
            </div>
            <div className="relative pl-6 border-l border-emerald-100">
               <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 bg-amber-500 rounded-full" />
               <p className="text-xs text-slate-400 font-bold">MAY 05, 2026</p>
               <h5 className="text-sm font-bold text-slate-800">Inter-House Sports</h5>
            </div>
          </div>
        </div>
      </div>

      {/* Admission Letter Modal */}
      <AnimatePresence>
        {showLetter && application && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLetter(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-slate-50 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shrink-0">
                <h3 className="font-black text-emerald-950 uppercase tracking-tighter">Your Official Admission Letter</h3>
                <button onClick={() => setShowLetter(false)} className="p-2 text-slate-400 hover:text-slate-950"><X size={24} /></button>
              </div>
              <div className="flex-grow overflow-y-auto p-4 md:p-8">
                <AdmissionLetter application={application} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StudentResults() {
  const { userData, user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState('2025/2026');
  const [term, setTerm] = useState('1st Term');
  const [ranking, setRanking] = useState<{ position: number; totalStudents: number; average: number; totalScore: number } | null>(null);

  useEffect(() => {
    if (!user || !userData) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch Subjects for names
        const qSub = query(collection(db, "subjects"));
        const snapSub = await getDocs(qSub);
        const subMap = snapSub.docs.reduce((acc: any, d) => {
          acc[d.id] = d.data().name;
          return acc;
        }, {});
        setSubjects(snapSub.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch student's results
        const qRes = query(
          collection(db, "results"),
          where("studentId", "==", user.uid),
          where("session", "==", session),
          where("term", "==", term)
        );
        const snapRes = await getDocs(qRes);
        const myResults = snapRes.docs.map(d => ({ id: d.id, ...d.data() }));
        setResults(myResults);

        // Calculate Ranking
        if (userData.targetClass || (userData as any).currentClassId) {
          const classId = userData.targetClass || (userData as any).currentClassId;
          const qAllRes = query(
            collection(db, "results"),
            where("classId", "==", classId),
            where("session", "==", session),
            where("term", "==", term)
          );
          const snapAll = await getDocs(qAllRes);
          
          // Group by student
          const studentTotals: any = {};
          snapAll.docs.forEach(d => {
            const data = d.data();
            if (!studentTotals[data.studentId]) studentTotals[data.studentId] = 0;
            studentTotals[data.studentId] += data.total;
          });

          const sorted = Object.entries(studentTotals)
            .map(([id, total]) => ({ id, total: total as number }))
            .sort((a, b) => b.total - a.total);

          const myTotal = studentTotals[user.uid] || 0;
          const pos = sorted.findIndex(s => s.id === user.uid) + 1;

          setRanking({
            position: pos || 0,
            totalStudents: sorted.length,
            totalScore: myTotal,
            average: myResults.length > 0 ? (myTotal / myResults.length) : 0
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, userData, session, term]);

  const downloadReportCard = async () => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(5, 46, 22);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text('REPORT CARD - OFFICIAL ACADEMIC TRANSCRIPT', 105, 30, { align: 'center' });

    // Student Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Student: ${userData?.displayName}`, 20, 55);
    doc.text(`Class: ${userData?.targetClass || 'N/A'}`, 20, 62);
    doc.text(`Term: ${term}`, 140, 55);
    doc.text(`Session: ${session}`, 140, 62);

    // Results Table
    const tableData = results.map(r => [
      subjects.find(s => s.id === r.subjectId)?.name || r.subjectId,
      r.ca,
      r.exam,
      r.total,
      r.grade,
      r.remark
    ]);

    doc.autoTable({
      startY: 70,
      head: [['Subject', 'CA (40)', 'Exam (60)', 'Total', 'Grade', 'Remark']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 46, 22] }
    });

    // Summary
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (ranking) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Score: ${ranking.totalScore}`, 20, finalY);
      doc.text(`Average: ${ranking.average.toFixed(2)}%`, 20, finalY + 7);
      doc.text(`Position: ${ranking.position} out of ${ranking.totalStudents}`, 140, finalY);
      
      doc.setFont('helvetica', 'normal');
      doc.text('General Comment:', 20, finalY + 20);
      doc.rect(20, finalY + 23, 170, 20); // Comment box
      doc.text(ranking.average >= 50 ? 'Satisfactory performance. Keep it up.' : 'Needs improvement in core subjects.', 25, finalY + 33);
      finalY = finalY + 43;
    }

    let qrY = finalY + 12;
    if (qrY > 230) {
      doc.addPage();
      qrY = 20;
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-REPORT-${user?.uid}-${session}-${term}`);
      doc.addImage(qrDataUrl, 'PNG', 160, qrY, 30, 30);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify Academic Record", 175, qrY + 33, { align: 'center' });
    } catch (e) {
      console.warn("QR code generation failed:", e);
    }

    doc.save(`Report_Card_${userData?.displayName?.replace(' ', '_')}_${term}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-4">
        <div className="flex gap-4">
          <select value={session} onChange={e => setSession(e.target.value)} className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase">
            <option value="2025/2026">2025/2026</option>
            <option value="2026/2027">2026/2027</option>
          </select>
          <select value={term} onChange={e => setTerm(e.target.value)} className="px-4 py-2 bg-slate-50 border-none rounded-xl text-xs font-bold uppercase">
            <option value="1st Term">1st Term</option>
            <option value="2nd Term">2nd Term</option>
            <option value="3rd Term">3rd Term</option>
          </select>
        </div>
        <button 
          onClick={downloadReportCard}
          disabled={results.length === 0}
          className="btn-primary flex items-center gap-2 text-sm px-6 py-2.5 disabled:opacity-50 cursor-pointer font-bold"
        >
          <Download size={16} /> Download Result PDF
        </button>
      </div>

      {loading ? (
        <div className="p-20 text-center"><Loader2 size={40} className="animate-spin mx-auto text-emerald-900" /></div>
      ) : results.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="glass-card p-6 border-b-4 border-emerald-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Score</p>
               <h3 className="text-2xl font-black text-emerald-950">{ranking?.totalScore}</h3>
             </div>
             <div className="glass-card p-6 border-b-4 border-blue-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Term Average</p>
               <h3 className="text-2xl font-black text-blue-900">{ranking?.average.toFixed(1)}%</h3>
             </div>
             <div className="glass-card p-6 border-b-4 border-amber-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Class Position</p>
               <h3 className="text-2xl font-black text-amber-900">{ranking?.position} <span className="text-xs text-slate-400">/ {ranking?.totalStudents}</span></h3>
             </div>
             <div className="glass-card p-6 border-b-4 border-purple-500">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Subjects Taken</p>
               <h3 className="text-2xl font-black text-purple-900">{results.length}</h3>
             </div>
          </div>

          <div className="glass-card shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Subject</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">C.A (40)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Exam (60)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Grade</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Remark</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {results.map((res) => (
                  <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-700">{subjects.find(s => s.id === res.subjectId)?.name || res.subjectId}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{res.ca}</td>
                    <td className="px-6 py-4 text-slate-500 font-medium">{res.exam}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold">{res.total}</span></td>
                    <td className="px-6 py-4 font-black text-amber-600 text-lg">{res.grade}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                        res.total >= 50 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                      )}>
                        {res.remark || (res.total >= 50 ? "Good" : "Credit")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card p-20 text-center">
          <BookOpen size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 font-medium">No results found for the selected term/session.</p>
        </div>
      )}
    </div>
  );
}

function StudentFees() {
  const { userData, user } = useAuth();
  const payments = [
    { title: 'Admission & Prospectus Fee', amount: 1000, date: 'Mar 12, 2026', method: 'Online' },
    { title: '1st Term Tuition', amount: 12000, date: 'Mar 14, 2026', method: 'Bank Transfer' },
  ];

  const downloadReceipt = async (p: any) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(6, 78, 59); // Emerald-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL PAYMENT RECEIPT", 105, 30, { align: 'center' });

    // Receipt Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const receiptNum = `REC-${p.title.toUpperCase().replace(/\s+/g, '-')}-${Math.floor(Math.random() * 899999 + 100000)}`;
    doc.text(`Receipt No: ${receiptNum}`, 20, 55);
    doc.text(`Date: ${p.date}`, 150, 55);

    // Main Content Box
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 65, 170, 80, 5, 5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Transaction Details", 30, 80);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Payer:", 30, 95);
    doc.text(`${userData?.displayName || user?.displayName || 'Student'} (${user?.email || 'N/A'})`, 80, 95);
    
    doc.text("Description:", 30, 105);
    doc.text(p.title, 80, 105);
    
    doc.text("Amount Paid:", 30, 115);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(p.amount), 80, 115);
    
    doc.setFont("helvetica", "normal");
    doc.text("Payment Mode:", 30, 125);
    doc.text(p.method, 80, 125);

    // Add security verification QR Code (right-aligned in transaction card)
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-PAYMENT-${p.title}-${p.amount}-${p.date}-${user?.uid || 'GUEST'}`);
      doc.addImage(qrDataUrl, 'PNG', 145, 75, 35, 35);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify", 162.5, 112, { align: 'center' });
    } catch (e) {
      console.warn("QR code generation failed:", e);
    }

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text("This is an official computer-generated receipt. No signature required.", 105, 160, { align: 'center' });
    doc.text("© 2026 Imam Malik Science & Tahfiz College", 105, 165, { align: 'center' });

    doc.save(`Receipt_${p.title.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="glass-card p-8 school-gradient text-white flex flex-col justify-between">
           <div>
             <h4 className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-4">Next Payment Due</h4>
             <div className="text-4xl font-bold mb-2">₦12,000.00</div>
             <p className="text-sm opacity-60">2nd Term Tuition Fee (2025/2026)</p>
           </div>
           <button 
             onClick={() => window.open('https://paystack.shop/pay/njvkcjper', '_blank')}
             className="w-full mt-8 bg-white text-emerald-950 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors"
           >
             Pay Fees Now
           </button>
         </div>

         <div className="md:col-span-2 glass-card p-8">
           <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2"><FileText size={20} className="text-amber-500" /> Payment History</h3>
           <div className="space-y-4">
             {payments.map((p, i) => (
               <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                 <div className="flex items-center gap-4">
                   <button onClick={() => downloadReceipt(p)} className="flex items-center justify-center w-10 h-10 bg-emerald-100 text-emerald-700 rounded-full hover:bg-emerald-200 transition-colors cursor-pointer border-none outline-none"><Download size={18} /></button>
                   <div>
                     <h5 className="text-sm font-bold text-slate-800">{p.title}</h5>
                     <p className="text-[10px] text-slate-400 font-bold uppercase">{p.date} • {p.method}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <div className="text-sm font-bold text-emerald-900">{formatCurrency(p.amount)}</div>
                   <button onClick={() => downloadReceipt(p)} className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 hover:underline cursor-pointer bg-transparent border-none outline-none">Download Receipt</button>
                 </div>
               </div>
             ))}
           </div>
         </div>
      </div>
    </div>
  );
}

function StudentProfile() {
  const { userData, user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(userData?.photoUrl || null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = async (file: File) => {
    if (!user) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      setError("Please select an image file (PNG, JPG, JPEG).");
      return;
    }

    // Check file size (e.g. 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    // Create a local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      let downloadUrl = "";
      
      try {
        // Attempt to upload to Firebase Storage
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `profile_photos/students/${user.uid}.${fileExtension}`);
        
        // Let's perform the storage upload
        await uploadBytes(storageRef, file);
        downloadUrl = await getDownloadURL(storageRef);
      } catch (storageErr: any) {
        console.warn("Firebase Storage failed or permission denied, using base64 fallback:", storageErr);
        
        // Fallback: convert file to compressed base64 string
        downloadUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              const max_width = 300;
              const max_height = 300;
              let width = img.width;
              let height = img.height;

              if (width > height) {
                if (width > max_width) {
                  height *= max_width / width;
                  width = max_width;
                }
              } else {
                if (height > max_height) {
                  width *= max_height / height;
                  height = max_height;
                }
              }
              canvas.width = width;
              canvas.height = height;
              ctx?.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
              resolve(dataUrl);
            };
            img.onerror = (e) => reject(e);
          };
          reader.onerror = (e) => reject(e);
        });
      }

      // Update Firestore document `/users/{userId}`
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoUrl: downloadUrl
      });

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="text-left">
        <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">My Profile Settings</h2>
        <p className="text-xs text-slate-500 font-medium">Update your profile photo and view your official student portal details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card & Photo Editor */}
        <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-between min-h-[400px]">
          <div className="w-full flex flex-col items-center">
            {/* Avatar container */}
            <div className="relative w-32 h-32 rounded-full border-4 border-emerald-900/10 flex items-center justify-center text-4xl font-black text-emerald-950 bg-emerald-50 overflow-hidden shrink-0 group shadow-lg mb-6 select-none">
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userData?.displayName?.charAt(0)
              )}
              {uploading && (
                <div className="absolute inset-x-0 inset-y-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center text-white">
                  <Loader2 className="animate-spin text-white" size={24} />
                </div>
              )}
            </div>

            <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{userData?.displayName}</h3>
            <p className="text-[10px] bg-emerald-50 text-emerald-700 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100 mb-6">{userData?.role}</p>

            {/* Drag and Drop Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "w-full border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50",
                dragActive ? "border-amber-500 bg-amber-500/10" : "border-slate-200",
                uploading ? "opacity-50 pointer-events-none" : ""
              )}
            >
              <Upload size={20} className="text-slate-400 mb-2" />
              <input 
                type="file" 
                id="profile-photo-input" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileInput}
              />
              <label htmlFor="profile-photo-input" className="text-xs font-bold text-slate-500 hover:text-emerald-950 transition-colors cursor-pointer select-none">
                Drag and drop or <span className="text-emerald-900 underline">browse</span>
              </label>
              <p className="text-[9px] text-slate-400 font-medium mt-1">PNG, JPG or JPEG up to 2MB</p>
            </div>
          </div>

          <div className="w-full mt-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-left text-xs text-red-600 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-left text-xs text-emerald-700 flex items-start gap-2">
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                <span>Uploaded successfully! Portal reloading...</span>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Profile Info */}
        <div className="md:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6 text-left">
          <h3 className="text-lg font-extrabold text-emerald-950 border-b border-slate-50 pb-4">Personal and Portal Information</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Full Name</p>
               <p className="text-sm font-bold text-slate-800">{userData?.displayName}</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Email Address</p>
               <p className="text-sm font-bold text-slate-800">{userData?.email}</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Student Portal ID</p>
               <p className="text-sm font-bold text-slate-800 font-mono">IMSC/2026/04{userData?.studentId?.slice(0,3)}</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Target Class</p>
               <p className="text-sm font-bold text-slate-800 uppercase">{userData?.targetClass || "SS 2"}</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Admission Status</p>
               <span className={cn(
                 "inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1",
                 userData?.admissionStatus === 'approved' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"
               )}>
                 {userData?.admissionStatus || 'pending'}
               </span>
             </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs text-slate-500 leading-relaxed mt-4">
            <span className="font-extrabold text-slate-700 block mb-1">🛡️ Portal Data Security Notice</span>
            All uploaded profile photographs are securely handled. Photos are optimized and mapped directly to your user identity records. For updates to restricted fields like your full name or registered class, please contact the College Registrar or School Administrator.
          </div>
        </div>
      </div>
    </div>
  );
}
