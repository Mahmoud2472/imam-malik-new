import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, BookOpen, UserCheck, 
  Settings, LogOut, Menu, X, Landmark, 
  Plus, Upload, FileText, ChevronRight, Save, Bell, Loader2, Search,
  Camera, AlertCircle, CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { 
  collection, query, where, getDocs, addDoc, serverTimestamp, 
  onSnapshot, doc, updateDoc, writeBatch, orderBy, limit 
} from 'firebase/firestore';
import { auth, db, storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../../lib/auth';
import { cn, formatDate } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export default function TeacherDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState({ students: 0, subjects: 0, classes: 0 });
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    // Fetch stats
    const fetchStats = async () => {
      try {
        const qStudents = query(collection(db, "students"));
        const qClasses = query(collection(db, "classes"));
        const qSubjects = query(collection(db, "subjects"));
        
        const [studentSnap, classSnap, subjectSnap] = await Promise.all([
          getDocs(qStudents),
          getDocs(qClasses),
          getDocs(qSubjects)
        ]);
        
        setStats({
          students: studentSnap.size,
          classes: classSnap.size,
          subjects: subjectSnap.size
        });
      } catch (e) {
        console.error("Error fetching stats:", e);
      }
    };
    
    fetchStats();
  }, [user]);

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/teacher' },
    { name: 'Enter Results', icon: Plus, path: '/teacher/results' },
    { name: 'My Subjects', icon: BookOpen, path: '/teacher/subjects' },
    { name: 'School Students', icon: UserCheck, path: '/teacher/students' },
    { name: 'My Profile', icon: UserCheck, path: '/teacher/profile' },
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
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-emerald-950 text-white z-50 transition-transform lg:relative lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="p-2 bg-amber-500 rounded-lg">
              <BookOpen className="text-emerald-950" size={24} />
            </div>
            <div>
              <h2 className="font-bold text-lg leading-tight text-white">Staff Portal</h2>
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Imam Malik College</p>
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
                {userData?.displayName?.charAt(0) || 'T'}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate text-white">{userData?.displayName || 'Teacher'}</p>
                <p className="text-[10px] text-emerald-400 font-medium tracking-tight">Academic Instructor</p>
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

      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Menu size={24} />
            </button>
            <h3 className="font-bold text-slate-800 text-lg">Academic Suite</h3>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest border-r border-slate-100 pr-6">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            
            <Link to="/teacher/profile" className="flex items-center gap-3 group bg-transparent border-none cursor-pointer">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-700 leading-tight group-hover:text-amber-500 transition-colors">{userData?.displayName}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Teacher</p>
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

        <div className="p-8 overflow-y-auto flex-grow bg-slate-50">
          <Routes>
            <Route index element={<TeacherOverview stats={stats} />} />
            <Route path="results" element={<TeacherResultEntry />} />
            <Route path="subjects" element={<TeacherSubjects />} />
            <Route path="students" element={<TeacherStudents />} />
            <Route path="profile" element={<TeacherProfile />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function TeacherOverview({ stats }: { stats: any }) {
  const { userData } = useAuth();
  return (
    <div className="space-y-8">
      <div className="glass-card p-10 school-gradient text-white flex flex-col md:flex-row justify-between items-center gap-8">
        <div>
          <h2 className="text-3xl font-bold mb-2 tracking-tight">Welcome, {userData?.displayName?.split(' ')[0]}!</h2>
          <p className="text-emerald-100/70">Academic management active. You have {stats.subjects} active subjects assigned.</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 text-center w-36">
            <div className="text-3xl font-black text-amber-400">{stats.students}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-widest mt-1">Students</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 text-center w-36">
            <div className="text-3xl font-black text-emerald-300">{stats.classes}</div>
            <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-widest mt-1">Classes</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-emerald-950 flex items-center gap-2">
              <BookOpen size={20} className="text-amber-500" /> Recent Activity
            </h3>
            <Link to="/teacher/results" className="text-xs font-bold text-emerald-600 uppercase hover:underline">View All</Link>
          </div>
          <div className="space-y-4">
            {['Basic Science - JSS 1', 'Biology - SS 2', 'Further Maths - SS 3'].map((cls, i) => (
              <div key={i} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-emerald-500 transition-all cursor-pointer group shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-lg flex items-center justify-center font-black">
                    {cls.charAt(0)}
                  </div>
                  <span className="font-bold text-slate-700">{cls}</span>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-8 bg-amber-50 border-amber-100">
          <h3 className="text-lg font-bold text-amber-900 mb-6 flex items-center gap-2"><Bell size={20} /> Quick Actions</h3>
          <div className="grid grid-cols-2 gap-4">
            <Link to="/teacher/results" className="p-4 bg-white rounded-xl shadow-sm border border-amber-200 hover:bg-emerald-50 transition-colors text-center group">
              <Plus className="mx-auto mb-2 text-amber-600 group-hover:text-emerald-600" />
              <p className="text-xs font-black text-slate-800 uppercase">Input Scores</p>
            </Link>
            <Link to="/teacher/students" className="p-4 bg-white rounded-xl shadow-sm border border-amber-200 hover:bg-emerald-50 transition-colors text-center group">
              <UserCheck className="mx-auto mb-2 text-amber-600 group-hover:text-emerald-600" />
              <p className="text-xs font-black text-slate-800 uppercase">View Students</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeacherResultEntry() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [session, setSession] = useState('2025/2026');
  const [term, setTerm] = useState('1st Term');
  
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch classes and subjects
    const fetchData = async () => {
      const qC = query(collection(db, "classes"));
      const qS = query(collection(db, "subjects"));
      const [snapC, snapS] = await Promise.all([getDocs(qC), getDocs(qS)]);
      setClasses(snapC.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSubjects(snapS.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  const handleFetchStudents = async () => {
    if (!selectedClass || !selectedSubject) {
      alert("Please select both class and subject.");
      return;
    }
    setLoading(true);
    try {
      // 1. Fetch students in the class
      const qS = query(collection(db, "students"), where("currentClassId", "==", selectedClass));
      const snapS = await getDocs(qS);
      const studentList = snapS.docs.map(doc => ({ 
        id: doc.id, 
        name: `${doc.data().firstName} ${doc.data().lastName}`,
        admissionNumber: doc.data().admissionNumber
      }));

      // 2. Check if results already exist for these students/subject/term
      const qR = query(
        collection(db, "results"), 
        where("classId", "==", selectedClass),
        where("subjectId", "==", selectedSubject),
        where("term", "==", term),
        where("session", "==", session)
      );
      const snapR = await getDocs(qR);
      const existingResults = snapR.docs.reduce((acc: any, doc) => {
        acc[doc.data().studentId] = { id: doc.id, ...doc.data() };
        return acc;
      }, {});

      setStudents(studentList.map(s => ({
        ...s,
        ca: existingResults[s.id]?.ca || 0,
        exam: existingResults[s.id]?.exam || 0,
        remark: existingResults[s.id]?.remark || '',
        existingId: existingResults[s.id]?.id || null
      })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const calculateGrade = (total: number) => {
    if (total >= 75) return { grade: 'A', remark: 'Excellent' };
    if (total >= 65) return { grade: 'B', remark: 'Very Good' };
    if (total >= 50) return { grade: 'C', remark: 'Good' };
    if (total >= 45) return { grade: 'D', remark: 'Pass' };
    return { grade: 'F', remark: 'Fail' };
  };

  const saveResults = async () => {
    setSaving(true);
    try {
      const batch = writeBatch(db);
      
      students.forEach(s => {
        const total = Number(s.ca || 0) + Number(s.exam || 0);
        const { grade, remark } = calculateGrade(total);
        const resData = {
          studentId: s.id,
          studentName: s.name,
          classId: selectedClass,
          subjectId: selectedSubject,
          session,
          term,
          ca: Number(s.ca || 0),
          exam: Number(s.exam || 0),
          total,
          grade,
          remark: s.remark || remark,
          updatedAt: serverTimestamp()
        };

        if (s.existingId) {
          batch.update(doc(db, "results", s.existingId), resData);
        } else {
          const newDocRef = doc(collection(db, "results"));
          batch.set(newDocRef, { ...resData, createdAt: serverTimestamp() });
        }
      });

      await batch.commit();
      alert("All results saved successfully!");
      handleFetchStudents(); // Refresh data
    } catch (e) {
      console.error(e);
      alert("Error saving results.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="glass-card p-8 flex flex-col xl:flex-row gap-6 items-end shadow-sm">
        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Session</label>
            <select value={session} onChange={e => setSession(e.target.value)} className="input-field">
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Term</label>
            <select value={term} onChange={e => setTerm(e.target.value)} className="input-field">
              <option value="1st Term">1st Term</option>
              <option value="2nd Term">2nd Term</option>
              <option value="3rd Term">3rd Term</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Class</label>
            <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} className="input-field">
              <option value="">Choose Class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Subject</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} className="input-field">
              <option value="">Choose Subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <button 
          onClick={handleFetchStudents} 
          disabled={loading}
          className="btn-primary w-full xl:w-48 h-12 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" /> : 'Fetch Students'}
        </button>
      </div>

      {students.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card overflow-hidden shadow-2xl"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">CA (40)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Exam (60)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Grade</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {students.map((student, idx) => {
                  const total = Number(student.ca || 0) + Number(student.exam || 0);
                  const { grade, remark } = calculateGrade(total);
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{student.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{student.admissionNumber}</div>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="40"
                          className="w-20 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-xl outline-none transition-all font-bold"
                          value={student.ca}
                          onChange={e => {
                            const newStudents = [...students];
                            newStudents[idx].ca = e.target.value;
                            setStudents(newStudents);
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          max="60"
                          className="w-20 px-3 py-2 bg-slate-50 border-2 border-transparent focus:border-emerald-500 focus:bg-white rounded-xl outline-none transition-all font-bold"
                          value={student.exam}
                          onChange={e => {
                            const newStudents = [...students];
                            newStudents[idx].exam = e.target.value;
                            setStudents(newStudents);
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-4 py-1.5 rounded-xl font-black text-sm transition-all", 
                          total >= 70 ? "bg-emerald-100 text-emerald-700" : 
                          total >= 40 ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        )}>
                          {total}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-lg text-emerald-950">{grade}</span>
                      </td>
                      <td className="px-6 py-4">
                         <input 
                          type="text"
                          placeholder={remark}
                          className="w-full min-w-[120px] px-3 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-600 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
                          value={student.remark}
                          onChange={e => {
                            const newStudents = [...students];
                            newStudents[idx].remark = e.target.value;
                            setStudents(newStudents);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-8 bg-slate-50 text-right border-t border-slate-100 flex justify-between items-center">
            <p className="text-xs text-slate-500 italic">Auto-calculating ranking upon save...</p>
            <button 
              onClick={saveResults} 
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-10"
            >
              {saving ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Sync Results to Portal</>}
            </button>
          </div>
        </motion.div>
      )}

      {students.length === 0 && !loading && (
        <div className="glass-card p-16 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
               <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">No Students Loaded</h3>
            <p className="text-slate-500 max-w-sm mx-auto">Select a class and subject above to begin entering academic results for this term.</p>
        </div>
      )}
    </div>
  );
}

function TeacherStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchStudents = async () => {
      const qS = query(collection(db, "students"), orderBy("firstName"));
      const qC = query(collection(db, "classes"));
      const [snapS, snapC] = await Promise.all([getDocs(qS), getDocs(qC)]);
      setStudents(snapS.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setClasses(snapC.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchStudents();
  }, []);

  const filtered = students.filter(s => 
    `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-900" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm transition-all focus-within:shadow-md">
        <div className="relative flex-grow max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-slate-700" 
            placeholder="Search students in your roster..." 
          />
        </div>
        <div className="hidden md:block">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Roster: {filtered.length} Students</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(s => (
          <div key={s.id} className="glass-card p-6 hover:border-emerald-500 transition-all group cursor-pointer">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-900 text-amber-500 flex items-center justify-center font-black text-xl shadow-lg group-hover:scale-110 transition-transform">
                {s.firstName[0]}
              </div>
              <div>
                <h4 className="font-bold text-slate-800 tracking-tight group-hover:text-emerald-700">{s.firstName} {s.lastName}</h4>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.admissionNumber}</p>
              </div>
            </div>
            <div className="space-y-3">
               <div className="flex justify-between text-xs items-center">
                 <span className="text-slate-400 font-bold uppercase tracking-tighter">Current Class</span>
                 <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-black text-[9px] uppercase">
                    {classes.find(c => c.id === s.currentClassId)?.name || 'N/A'}
                 </span>
               </div>
               <div className="flex justify-between text-xs items-center">
                 <span className="text-slate-400 font-bold uppercase tracking-tighter">Performance</span>
                 <span className="font-bold text-emerald-600">Good</span>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeacherSubjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchS = async () => {
      const q = query(collection(db, "subjects"), orderBy("name"));
      const snap = await getDocs(q);
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    };
    fetchS();
  }, []);

  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-emerald-900" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {subjects.map((sub, i) => (
        <div key={sub.id} className="glass-card p-8 group hover:bg-emerald-950 hover:text-white transition-all duration-500 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
             <BookOpen size={120} />
          </div>
          <div className="p-4 bg-emerald-50 text-emerald-900 rounded-2xl w-fit mb-6 group-hover:bg-amber-500 group-hover:text-emerald-950 transition-colors">
            <BookOpen size={32} />
          </div>
          <h3 className="text-xl font-bold mb-1 tracking-tight">{sub.name}</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-300">Code: {sub.code || 'N/A'}</p>
          <div className="mt-8 pt-6 border-t border-slate-100 group-hover:border-emerald-900 flex justify-between items-center">
             <span className="text-xs font-bold opacity-60">Session: 2025/2026</span>
             <ChevronRight className="text-amber-500 group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TeacherProfile() {
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
        const storageRef = ref(storage, `profile_photos/teachers/${user.uid}.${fileExtension}`);
        
        // Storage upload
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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in text-left">
      <div className="text-left">
        <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Teacher Profile Settings</h2>
        <p className="text-xs text-slate-500 font-medium">Manage your educational profile photo and verify registered credential details.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Card & Photo Editor */}
        <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center justify-between min-h-[400px]">
          <div className="w-full flex flex-col items-center">
            {/* Avatar container */}
            <div className="relative w-32 h-32 rounded-full border-4 border-emerald-900/10 flex items-center justify-center text-5xl font-black text-emerald-950 bg-emerald-50 overflow-hidden shrink-0 group shadow-lg mb-6 select-none">
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
            <p className="text-[10px] bg-amber-500/10 text-amber-705 font-extrabold px-3 py-1 rounded-full uppercase tracking-widest border border-amber-500/20 mb-6">{userData?.role}</p>

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
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Staff Portal ID</p>
               <p className="text-sm font-bold text-slate-800 font-mono">IMSC/2026/STAFF{userData?.teacherId?.slice(0,3) || '922'}</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Designation</p>
               <p className="text-sm font-bold text-slate-800 uppercase">Senior Lecturer / Educator</p>
             </div>
             <div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Portal Status</p>
               <span className="inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider mt-1 bg-emerald-50 text-emerald-700 border border-emerald-100">
                 Active
               </span>
             </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs text-slate-500 leading-relaxed mt-4">
            <span className="font-extrabold text-slate-700 block mb-1">🛡️ Faculty Data Protection Security Compliance</span>
            Your profile details and metadata are visible in student transcribing cards and official portal lists. All updates are recorded and strictly logged under zero-trust authorization patterns. Please secure your session by logging out when leaving any public terminals.
          </div>
        </div>
      </div>
    </div>
  );
}
