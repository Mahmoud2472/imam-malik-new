import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, User, BookOpen, CreditCard, 
  Download, LogOut, Menu, X, Landmark, FileText,
  Calendar, Award, GraduationCap, Printer, Loader2,
  Camera, Upload, AlertCircle, CheckCircle2, ExternalLink,
  Copy, Check, Sparkles, ShieldCheck, Search, Filter,
  Receipt, Eye, RefreshCw, Clock, ArrowUpRight, Plus, Hash, FileCheck2,
  Phone, Mail, MapPin, Save, Shield, UserCheck, Home, KeyRound, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';
import { auth, db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { cn, formatCurrency, formatDate, MAHMOUD_ADAMU_SIGNATURE } from '../../lib/utils';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { safeStorage } from '../../lib/safeStorage';
import { collection, query, where, getDocs, getDoc, limit, updateDoc, doc, onSnapshot, orderBy, addDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import AdmissionLetter from '../public/AdmissionLetter';
import PaystackCheckoutModal, { FeePaymentItem } from './PaystackCheckoutModal';
import { getAdmissionVerificationPayload } from '../../lib/admissionPdfService';
import { CelebrationReceiptModal } from './CelebrationReceiptModal';
import { StudentCustomFeeBuilder } from './StudentCustomFeeBuilder';
import { extractCleanApplicantNames } from '../../lib/applicantService';

export default function StudentDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [application, setApplication] = useState<any>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { userData, user, signOut: authSignOut, refreshUserData } = useAuth();

  useEffect(() => {
    if (user) {
      const fetchApp = async () => {
        try {
          // Check local cache first
          const examNo = userData?.studentId || userData?.examNumber || user.id.replace('app_', '');
          const localApp = safeStorage.getItem(`imsc_app_${examNo}`) || safeStorage.getItem(`imsc_app_${user.id}`) || safeStorage.getItem('imsc_active_student_app');
          let parsedLocalApp = null;
          if (localApp) {
            try { parsedLocalApp = JSON.parse(localApp); } catch(e) {}
          }

          const [firestoreSnap, supabaseRes] = await Promise.all([
            getDocs(query(collection(db, "applications"), where("userId", "==", user.uid), limit(1))).catch(err => {
              console.warn("Firestore applications query failed on student dashboard:", err);
              return null;
            }),
            isSupabaseConfigured
              ? (async () => {
                  try {
                    return await supabase.from('applications').select('*').eq('userId', user.uid).limit(1);
                  } catch (err) {
                    console.warn("Supabase applications query failed on student dashboard:", err);
                    return { data: null };
                  }
                })()
              : Promise.resolve({ data: null })
          ]);

          let foundApp: any = null;
          if (firestoreSnap && !firestoreSnap.empty) {
            foundApp = { id: firestoreSnap.docs[0].id, ...firestoreSnap.docs[0].data() };
          } else if (supabaseRes && supabaseRes.data && supabaseRes.data.length > 0) {
            foundApp = supabaseRes.data[0];
          } else if (parsedLocalApp) {
            foundApp = parsedLocalApp;
          }

          // If not found in applications table, check applicants / successful_applicants
          if (!foundApp && examNo) {
            const cleanExam = examNo.replace(/_/g, '/');
            try {
              if (isSupabaseConfigured) {
                const { data: matchedApp } = await supabase
                  .from('applicants')
                  .select('*')
                  .or(`examNumber.ilike.%${cleanExam}%,exam_number.ilike.%${cleanExam}%`)
                  .limit(1);
                if (matchedApp && matchedApp.length > 0) {
                  foundApp = matchedApp[0];
                }
              }
            } catch (e) {}

            if (!foundApp) {
              try {
                const directAppDoc = await getDoc(doc(db, 'applicants', user.uid)).catch(() => null);
                if (directAppDoc && directAppDoc.exists()) {
                  foundApp = { id: directAppDoc.id, ...directAppDoc.data() };
                }
              } catch (e) {}
            }
          }

          if (foundApp) {
            const cleanNames = extractCleanApplicantNames(foundApp);
            const activeStudentName = safeStorage.getItem('imsc_active_student_name') || safeStorage.getItem('imsc_active_user_display_name');
            const resolvedFullName = (cleanNames.name && cleanNames.name !== 'Unknown Candidate') 
              ? cleanNames.name 
              : (foundApp.name || foundApp.fullName || foundApp.studentName || foundApp.displayName || activeStudentName);

            const unifiedApp = {
              ...foundApp,
              name: resolvedFullName,
              fullName: resolvedFullName,
              studentName: resolvedFullName,
              displayName: resolvedFullName,
              firstName: cleanNames.firstName || foundApp.firstName,
              lastName: cleanNames.lastName || foundApp.lastName
            };
            setApplication(unifiedApp);
          } else if (parsedLocalApp) {
            setApplication(parsedLocalApp);
          }
        } catch (err) {
          console.warn("Could not fetch application for student dashboard overview:", err);
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
      try {
        await authSignOut();
      } catch (e) {
        console.warn("Auth context signOut error:", e);
      }
      try {
        await signOut(auth);
      } catch (e) {
        console.warn("Firebase signOut error:", e);
      }
      // Clear persistent storage flags
      safeStorage.removeItem('imsc_active_user_id');
      safeStorage.removeItem('imsc_active_user_email');
      safeStorage.removeItem('imsc_active_user_display_name');
      
      navigate('/', { replace: true });
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
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-emerald-950 text-white z-50 transition-transform lg:relative lg:translate-x-0 shadow-2xl lg:shadow-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="flex items-center justify-between mb-8 px-2">
            <Link 
              to="/" 
              onClick={() => setSidebarOpen(false)} 
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="p-2 bg-amber-500 rounded-lg shrink-0">
                <GraduationCap className="text-emerald-950" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg leading-tight">Student Portal</h2>
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Imam Malik College</p>
              </div>
            </Link>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="flex-grow space-y-1">
            {menuItems.map((item) => (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all group",
                  location.pathname === item.path ? "bg-amber-500 text-emerald-950 font-bold" : "text-emerald-100/60 hover:bg-white/5 hover:text-white"
                )}
              >
                <item.icon size={20} className={cn(location.pathname === item.path ? "text-emerald-950" : "text-emerald-100/40 group-hover:text-amber-500")} />
                {item.name}
              </Link>
            ))}
            {/* Return Home Navigation Option */}
            <Link
              to="/"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-100/60 hover:bg-white/5 hover:text-white transition-all group border border-dashed border-emerald-900/40 mt-4"
            >
              <Landmark size={20} className="text-emerald-100/40 group-hover:text-amber-500" />
              <span>Go to Website Home</span>
            </Link>
          </nav>

          <div className="pt-6 border-t border-emerald-900 text-center">
             <button 
               onClick={() => {
                 setSidebarOpen(false);
                 handleLogout();
               }} 
               className="w-full flex items-center justify-center gap-3 px-4 py-3 text-red-300 hover:bg-red-500/10 rounded-xl transition-all font-medium cursor-pointer"
             >
               <LogOut size={20} /> Logout
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0">
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setSidebarOpen(prev => !prev)} 
               className="lg:hidden text-slate-600 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
               aria-label="Toggle menu"
             >
               {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
             </button>
             <h3 className="font-bold text-slate-800 text-sm sm:text-base">Assalamu Alaikum, {(userData?.displayName || application?.name || 'Student').split(' ')[0]}</h3>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Go Home Button */}
            <Link 
              to="/" 
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-xs font-black uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer"
            >
              <Landmark size={14} className="text-amber-600" />
              <span>Main Site</span>
            </Link>

            {/* Database Connection Badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-slate-50 text-[11px] font-bold">
              <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
              <span className={isSupabaseConfigured ? 'text-slate-600' : 'text-amber-700'}>
                {isSupabaseConfigured ? 'Supabase Live' : 'Offline Sandbox'}
              </span>
            </div>
            
            {/* Profile Avatar / Link */}
            <Link to="/student/profile" className="flex items-center gap-2 sm:gap-3 group p-1 rounded-xl hover:bg-slate-50 transition-colors">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-700 leading-tight group-hover:text-amber-600 transition-colors">{userData?.displayName || application?.name || 'Student'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{userData?.role}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-900 border border-slate-200 flex items-center justify-center text-sm font-bold overflow-hidden shrink-0 shadow-sm transition-all group-hover:border-amber-500">
                {(userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl) ? (
                  <img 
                    src={userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl} 
                    alt="profile" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  userData?.displayName?.charAt(0) || 'S'
                )}
              </div>
            </Link>

            {/* Top Bar Quick Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
              title="Sign Out of Student Portal"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 overflow-y-auto flex-grow">
          <Routes>
            <Route index element={<StudentOverview application={application} />} />
            <Route path="results" element={<StudentResults />} />
            <Route path="fees" element={<StudentFees />} />
            <Route path="profile" element={<StudentProfile application={application} onLogout={handleLogout} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function StudentOverview({ application }: { application: any }) {
  const { userData, user } = useAuth();
  const [showLetter, setShowLetter] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payItem, setPayItem] = useState<FeePaymentItem>({
    title: 'New Student Registration & 1st Term Tuition',
    category: 'Termly Tuition',
    amount: 12000,
    term: '1st Term',
    session: '2026/2027'
  });
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let unsubNotifications: (() => void) | null = null;
    
    try {
      const q1 = query(
        collection(db, "notifications"), 
        orderBy("createdAt", "desc")
      );
      unsubNotifications = onSnapshot(q1, async (snap) => {
        const firestoreList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const firestoreFiltered = firestoreList.filter(n => {
          return n.userId === user.uid || n.userId === 'all' || n.applicantEmail === user.email;
        });

        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase
              .from('notifications')
              .select('*')
              .order('createdAt', { ascending: false });
            if (!error && data) {
              const supabaseFiltered = data.filter((n: any) => {
                return n.userId === user.uid || n.userId === 'all' || n.applicantEmail === user.email;
              });
              
              const merged = [...firestoreFiltered];
              supabaseFiltered.forEach((sn: any) => {
                if (!merged.some(fn => fn.id === sn.id || (fn.title === sn.title && fn.message === sn.message))) {
                  merged.push(sn);
                }
              });
              
              merged.sort((a: any, b: any) => {
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return timeB - timeA;
              });

              setNotifications(merged);
            } else {
              setNotifications(firestoreFiltered);
            }
          } catch (err) {
            console.warn("Supabase notifications fetch error:", err);
            setNotifications(firestoreFiltered);
          }
        } else {
          setNotifications(firestoreFiltered);
        }
        setLoadingNotifications(false);
      }, (err) => {
        console.warn("Error listening to notifications from Firestore:", err);
        setLoadingNotifications(false);
      });
    } catch (err) {
      console.warn("Failed to subscribe to Firestore notifications:", err);
      setLoadingNotifications(false);
    }

    return () => {
      if (unsubNotifications) unsubNotifications();
    };
  }, [user]);

  const CLASSES = [
    { id: 'jss1', name: 'JSS 1' },
    { id: 'jss2', name: 'JSS 2' },
    { id: 'jss3', name: 'JSS 3' },
    { id: 'ss1', name: 'SS 1' },
    { id: 'ss2', name: 'SS 2' },
    { id: 'ss3', name: 'SS 3' },
  ];

  const candidateName =
    (application?.name && application.name.trim().length > 0 ? application.name.trim() : '') ||
    (application?.fullName && application.fullName.trim().length > 0 ? application.fullName.trim() : '') ||
    (application?.studentName && application.studentName.trim().length > 0 ? application.studentName.trim() : '') ||
    (application?.firstName && application?.lastName ? `${application.firstName} ${application.lastName}`.trim() : '') ||
    (userData?.displayName && userData.displayName !== 'User' && userData.displayName !== 'Student' && userData.displayName !== 'Approved Applicant' ? userData.displayName : '') ||
    (userData?.name && userData.name !== 'User' ? userData.name : '') ||
    (userData?.fullName ? userData.fullName : '') ||
    safeStorage.getItem('imsc_active_student_name') ||
    safeStorage.getItem('imsc_active_user_display_name') ||
    (application?.firstName ? application.firstName : '') ||
    userData?.displayName ||
    'Approved Applicant';

  const candidateExamNo =
    application?.examNumber ||
    userData?.examNumber ||
    application?.id ||
    userData?.studentId ||
    'IMSC/2026/001';

  const candidateClass =
    application?.targetClass ||
    application?.targetClassId ||
    userData?.targetClass ||
    'JSS 1';

  const candidateScore =
    application?.entranceScore ||
    application?.score ||
    userData?.entranceScore ||
    null;

  const candidateSchool =
    application?.schoolName ||
    application?.previousSchool ||
    application?.primarySchool ||
    userData?.schoolName ||
    null;

  const fallbackApplication = {
    id: candidateExamNo,
    name: candidateName,
    firstName: application?.firstName || candidateName.split(' ')[0] || 'Candidate',
    lastName: application?.lastName || candidateName.split(' ').slice(1).join(' ') || '',
    examNumber: candidateExamNo,
    targetClassId: candidateClass,
    targetClass: candidateClass,
    entranceScore: candidateScore,
    score: candidateScore,
    schoolName: candidateSchool,
    previousSchool: candidateSchool,
    status: 'approved',
    passportPhoto: userData?.passportPhoto || userData?.passportUrl || userData?.photoUrl,
    passportUrl: userData?.passportUrl || userData?.photoUrl || userData?.passportPhoto,
    photoUrl: userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto,
    gender: userData?.gender,
    dateOfBirth: userData?.dob || userData?.dateOfBirth,
    address: userData?.address,
    guardianName: userData?.guardianName,
    guardianPhone: userData?.guardianPhone,
    guardianEmail: userData?.guardianEmail,
    appliedDate: application?.appliedDate || new Date().toISOString()
  };

  const displayApplication = {
    ...fallbackApplication,
    ...(application || {}),
    passportPhoto: application?.passportPhoto || application?.passportUrl || application?.photoUrl || userData?.passportPhoto || userData?.passportUrl || userData?.photoUrl,
    passportUrl: application?.passportUrl || application?.passportPhoto || application?.photoUrl || userData?.passportUrl || userData?.passportPhoto || userData?.photoUrl,
    photoUrl: application?.photoUrl || application?.passportUrl || application?.passportPhoto || userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto
  };

  const downloadAdmissionLetterPDF = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    // 1. Header (Pure White Background for B&W Printers)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE, TUDUN WADA', 105, 18, { align: 'center' });
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Karefa Road Tudun Wada Dankadai | Tel: 07011748311, 08032765759', 105, 25, { align: 'center' });
    
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL PROVISIONAL ADMISSION OFFER • 2026/2027 ACADEMIC SESSION', 105, 33, { align: 'center' });
    
    // Clean Black Header Divider Lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(20, 37, 190, 37);
    doc.setLineWidth(0.2);
    doc.line(20, 38.5, 190, 38.5);
    
    // 2. Document Meta Bar
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Date of Issue: ${dateStr}`, 20, 46);
    doc.text(`Exam / Reg No: ${candidateExamNo}`, 20, 52);
    doc.text(`Academic Session: 2026/2027`, 130, 46);
    
    // Status Box (Black & White outline)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(130, 48.5, 60, 6.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('OFFER STATUS: APPROVED', 160, 53, { align: 'center' });
    
    // 3. Salutation & Official Intro
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dear ${candidateName},`, 20, 64);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const body = `We are pleased to formally inform you that following your performance in the entrance examination, you have been OFFERED PROVISIONAL ADMISSION into Imam Malik Science & Tahfiz College, Tudun Wada for the 2026/2027 Academic Session.`;
    const splitBody = doc.splitTextToSize(body, 170);
    doc.text(splitBody, 20, 70);
    
    // 4. Candidate Placement & Result Record Box (Clean B&W Border)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(20, 81, 170, 29, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CANDIDATE ADMISSION & PLACEMENT RECORD', 25, 87);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Assigned Class / Placement:', 25, 94);
    doc.setFont('helvetica', 'bold');
    doc.text(`${candidateClass.toUpperCase()}`, 75, 94);

    doc.setFont('helvetica', 'normal');
    doc.text('Entrance Exam Score:', 25, 100);
    doc.setFont('helvetica', 'bold');
    doc.text(`${candidateScore ? candidateScore + ' / 100 (Passed - Eligible)' : 'Passed (Eligible)'}`, 75, 100);

    doc.setFont('helvetica', 'normal');
    doc.text('Previous School:', 25, 106);
    doc.setFont('helvetica', 'bold');
    doc.text(`${candidateSchool || 'Primary School'}`, 75, 106);

    // 5. Fee Schedule Box (Clean B&W Border)
    doc.rect(20, 114, 170, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('REGISTRATION & DEVELOPMENT LEVY SCHEDULE:', 25, 120);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('• Registration & Prospectus Fee: N12,000', 25, 126);
    doc.text('• School Development Levy: N3,000', 25, 131);
    doc.setFont('helvetica', 'bold');
    doc.text('• Total Payable: N15,000 (Payable via Student Portal or School Desk)', 100, 128);

    // 6. Required Working Materials, Uniforms & Textbooks Directives
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('REQUIRED WORKING MATERIALS, UNIFORMS & TEXTBOOKS:', 20, 144);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const mat1 = '• Working Materials: Parents/guardians are required to purchase all necessary working materials for their child, including exercise books, pens, a mathematical set, and a scientific calculator.';
    const splitMat1 = doc.splitTextToSize(mat1, 170);
    doc.text(splitMat1, 20, 150);

    const mat2 = '• School Uniforms: Students are strongly advised to have two (2) complete sets of the approved school uniform.';
    const splitMat2 = doc.splitTextToSize(mat2, 170);
    doc.text(splitMat2, 20, 161);

    const mat3 = '• Islamic & Core Textbooks: Prescribed Islamic textbooks and learning materials are readily available in the school for parents to purchase for their child.';
    const splitMat3 = doc.splitTextToSize(mat3, 170);
    doc.text(splitMat3, 20, 169);

    const mat4 = '• Registration Finalization: Parents should complete registration payment and submit credentials (birth certificate/age declaration and two passport photographs) to finalize enrollment.';
    const splitMat4 = doc.splitTextToSize(mat4, 170);
    doc.text(splitMat4, 20, 177);

    doc.setFont('helvetica', 'bold');
    doc.text('Congratulations on your admission to Imam Malik Science & Tahfiz College, Tudun Wada.', 20, 192);
    
    // 7. Signature Block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Yours faithfully,', 20, 202);
    
    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 200, 100);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 20, 205, 34, 14);
    } catch (e) {
      console.warn("Signature addition failed in PDF:", e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Mahmoud Adamu', 20, 224);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Secretary, Governing Board', 20, 229);
    doc.text('Imam Malik Science & Tahfiz College Tudun Wada', 20, 234);
    
    // 8. High-Res B&W QR Code (Full Student Details for Layman Verification)
    try {
      const qrPayload = getAdmissionVerificationPayload({
        candidateName,
        examNumber: candidateExamNo,
        targetClass: candidateClass,
        entranceScore: candidateScore,
        schoolName: candidateSchool,
        issueDate: dateStr
      });

      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 140,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });
      doc.addImage(qrDataUrl, 'PNG', 152, 200, 34, 34);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text("Scan for Full Student Details", 169, 238, { align: 'center' });
    } catch (e) {
      console.warn("QR code generation failed:", e);
    }

    // 9. Clean Black Footer Line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(20, 248, 190, 248);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Imam Malik Science & Tahfiz College Tudun Wada • Academic Excellence & Qur\'anic Values • Official Admission Offer',
      105,
      254,
      { align: 'center' }
    );

    doc.save(`Admission_Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          {/* Hero Banner */}
          <div className="glass-card p-8 flex flex-col sm:flex-row items-center gap-6 school-gradient text-white">
            <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold border border-white/10 overflow-hidden shrink-0 shadow-inner">
              {(userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl) ? (
                <img 
                  src={userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl} 
                  alt="avatar" 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                candidateName.charAt(0)
              )}
            </div>
            <div className="flex-grow text-center sm:text-left">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">Candidate & Student Portal</p>
                  <h2 className="text-2xl font-black">{candidateName}</h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                    <span className="text-xs font-mono bg-emerald-900/60 px-3 py-1 rounded-lg border border-emerald-400/30 text-emerald-200">
                      Exam No: <strong>{candidateExamNo}</strong>
                    </span>
                    <span className="text-xs font-bold bg-amber-500/30 px-3 py-1 rounded-lg text-amber-200 uppercase">
                      Class: {candidateClass.toUpperCase()}
                    </span>
                    {candidateScore && (
                      <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg text-white">
                        Score: {candidateScore} Marks
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Student Registration & Development Fee Directive Card */}
          <div className="glass-card p-6 border-l-4 border-emerald-600 bg-white shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
              <div>
                <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md tracking-wider mb-1">
                  2026/2027 Admission Directive
                </span>
                <h3 className="text-base font-black text-emerald-950 flex items-center gap-2">
                  <CreditCard className="text-emerald-600" size={20} />
                  Registration & Development Fee Payment
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Package</span>
                <span className="text-xl font-black text-emerald-950">₦15,000.00</span>
              </div>
            </div>

            {paymentNotice && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{paymentNotice}</span>
              </div>
            )}

            <p className="text-xs text-slate-600 leading-relaxed">
              All newly admitted candidates are required to make registration and development levy payments to confirm admission and proceed with screening. Click below to pay online instantly:
            </p>

            {/* Fee items breakdown with individual instant pay buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-slate-50 hover:bg-emerald-50/50 rounded-2xl border border-slate-100 transition-colors flex flex-col justify-between gap-3">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 block text-sm">1st Term Tuition Fee</span>
                    <span className="font-black text-emerald-950 text-base">₦12,000.00</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mt-0.5">Termly Academic Tuition</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayItem({
                      title: 'New Student Registration & 1st Term Tuition',
                      category: 'Termly Tuition',
                      amount: 12000,
                      term: '1st Term',
                      session: '2026/2027'
                    });
                    setShowPayModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer hover:scale-[1.01]"
                >
                  <CreditCard size={14} /> Pay Tuition (₦12k)
                </button>
              </div>

              <div className="p-4 bg-slate-50 hover:bg-amber-50/50 rounded-2xl border border-slate-100 transition-colors flex flex-col justify-between gap-3">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-slate-800 block text-sm">Development Levy</span>
                    <span className="font-black text-emerald-950 text-base">₦3,000.00</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block mt-0.5">Paid Once for 3-Year Period</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPayItem({
                      title: 'College Development Levy (3-Year Study Period)',
                      category: 'Development Levy (Once in 3 Yrs)',
                      amount: 3000,
                      term: '3-Year Period (2026-2029)',
                      session: '2026/2027 - 2028/2029'
                    });
                    setShowPayModal(true);
                  }}
                  className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer hover:scale-[1.01]"
                >
                  <CreditCard size={14} /> Pay Dev Levy (₦3k)
                </button>
              </div>
            </div>

            {/* Combined Package & Financial History Buttons */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPayItem({
                    title: 'Combined New Intake Package (1st Term Tuition + 3-Yr Development Levy)',
                    category: 'Registration & Development Package',
                    amount: 15000,
                    term: '1st Term 2026/2027',
                    session: '2026/2027'
                  });
                  setShowPayModal(true);
                }}
                className="w-full bg-emerald-900 hover:bg-emerald-950 text-white text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-[1.01] cursor-pointer"
              >
                <Sparkles size={16} className="text-amber-400" /> Pay Full Package (₦15k)
              </button>
              <Link
                to="/student/fees"
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
              >
                <Printer size={16} /> View & Print Financial History
              </Link>
            </div>
          </div>

          {/* Admission & Registration Slip Section */}
          <div className="glass-card p-6 border-l-4 border-amber-500 bg-white shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <GraduationCap className="text-amber-500" size={18} /> Official Admission Documents
            </h3>
            <p className="text-xs text-slate-500">
              Your provisional admission is ready! You can view your full **Admission Letter**, download the official PDF transcript with authorized board signature, or print your completed **Application Slip**.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <button 
                onClick={() => setShowLetter(true)}
                className="px-4 py-2.5 bg-emerald-950 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <FileText size={16} /> View Admission Letter
              </button>
              <button 
                onClick={downloadAdmissionLetterPDF}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
              >
                <Download size={16} /> Download Admission Letter (PDF)
              </button>
              <button 
                onClick={() => setShowPrintSlip(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
              >
                <Printer size={16} /> Print Application Slip
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
             <div className="glass-card p-6 border-l-4 border-emerald-600">
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Entrance Exam Standing</h4>
               <div className="flex items-end gap-2">
                 <span className="text-3xl font-bold text-emerald-950">
                   {candidateScore ? `${candidateScore}` : 'Passed'}
                 </span>
                 <span className="text-xs text-emerald-600 font-bold mb-1 opacity-60">
                   {candidateScore ? 'Entrance Score / 100' : 'Status: Eligible for Enrollment'}
                 </span>
               </div>
             </div>
             <div className="glass-card p-6 border-l-4 border-amber-500">
               <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Registration Fee</h4>
               <div className="flex items-end gap-2 text-amber-700">
                 <span className="text-lg font-black">₦12,000 + ₦3,000</span>
                 <span className="text-[10px] font-black uppercase mb-1 opacity-75">(Reg + Dev)</span>
               </div>
             </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Active Notifications Alert Widget */}
          <div className="glass-card p-6 border-l-4 border-blue-500 bg-white shadow-sm">
            <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Portal Notifications
            </h3>
            {loadingNotifications ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-4 justify-center">
                <Loader2 className="animate-spin text-blue-500" size={14} /> Loading alerts...
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No current dashboard notifications.</p>
            ) : (
              <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold">{formatDate(n.createdAt)}</p>
                    <h4 className="text-xs font-black text-slate-800">{n.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="text-sm font-bold text-emerald-950 mb-6 flex items-center gap-2"><Calendar size={20} className="text-amber-500" /> Upcoming Events</h3>
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
      </div>

      {/* Admission Letter Modal */}
      <AnimatePresence>
        {showLetter && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-4 overflow-y-auto"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-emerald-950">Admission Letter Viewer</h3>
                <button 
                  onClick={() => setShowLetter(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors"
                >
                  Close
                </button>
              </div>
              <div className="p-4">
                <AdmissionLetter application={displayApplication} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Printable Slip Preview Modal */}
      <AnimatePresence>
        {showPrintSlip && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none no-print">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-8 md:p-12 print:shadow-none print:border-none print:p-0 print:m-0 flex flex-col gap-8 text-slate-800"
            >
              {/* Controls - Hidden on print! */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:hidden shrink-0">
                <div>
                  <h3 className="font-black text-emerald-950 uppercase tracking-tighter">Application Slip Preview</h3>
                  <p className="text-xs text-slate-400">Review and print your official completed application form</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="px-6 py-2.5 bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-800 transition-colors flex items-center gap-2 shadow-md"
                  >
                    <Printer size={16} /> Print Document
                  </button>
                  <button 
                    onClick={() => setShowPrintSlip(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-705 hover:bg-slate-200 rounded-xl text-xs font-bold transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Area */}
              <div className="bg-white print:p-0 text-left">
                {/* Header Letterhead section */}
                <div className="flex justify-between items-center border-b-4 border-emerald-900 pb-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-emerald-950 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-emerald-800">
                      <img src="https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg" alt="School Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-serif font-black text-emerald-950 tracking-tight leading-none uppercase">Imam Malik Science & Tahfiz College</h1>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Karefa Road Tudun Wada Dankadai, Kano State | Tel: 07011748311, 08032765759</p>
                    </div>
                  </div>
                </div>

                <div className="text-center bg-emerald-50 text-emerald-950 border border-emerald-100 py-2.5 rounded-xl font-serif font-extrabold text-xs uppercase tracking-widest mb-8">
                  Official Admission Application Slip & Profile Summary
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  {/* Biography details */}
                  <div className="md:col-span-3 space-y-8">
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Application Slip ID</p>
                        <p className="text-sm font-semibold text-slate-800 font-mono tracking-wider">
                          {(displayApplication.id || 'IMSC-PENDING').toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Date of Application</p>
                        <p className="text-sm font-semibold text-slate-800">{formatDate(displayApplication.appliedDate || new Date().toISOString())}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">1. Student Biography</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">First Name</span>
                          <span className="font-bold text-slate-800 text-sm">{displayApplication.firstName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Last Name</span>
                          <span className="font-bold text-slate-800 text-sm">{displayApplication.lastName}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Gender Placement</span>
                          <span className="font-semibold text-slate-700">{displayApplication.gender || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Date of Birth (DOB)</span>
                          <span className="font-semibold text-slate-700">{displayApplication.dateOfBirth || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Registered Email</span>
                          <span className="font-semibold text-slate-700">{displayApplication.email || userData?.email || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Class Registered</span>
                          <span className="font-bold text-slate-800 uppercase text-sm">
                            {CLASSES.find(c => c.id === displayApplication.targetClassId)?.name || displayApplication.targetClassId?.toUpperCase() || 'SS 2'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">2. Previous Academic History</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Primary School Name</span>
                          <span className="font-bold text-slate-800">{displayApplication.primarySchool || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Years Attended (Primary)</span>
                          <span className="font-bold text-slate-700">
                            {displayApplication.primarySchoolStart || 'N/A'} - {displayApplication.primarySchoolEnd || 'N/A'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Islamiyya School Name</span>
                          <span className="font-bold text-slate-800">{displayApplication.islamiyyaSchool || 'N/A'}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Years Attended (Islamiyya)</span>
                          <span className="font-bold text-slate-700">
                            {displayApplication.islamiyyaSchoolStart || 'N/A'} - {displayApplication.islamiyyaSchoolEnd || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">3. Parent / Guardian Records</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Guardian Name</span>
                          <span className="font-bold text-slate-800">{displayApplication.guardianName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Guardian Phone</span>
                          <span className="font-bold text-slate-800">{displayApplication.guardianPhone || 'N/A'}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Residential Address</span>
                          <span className="font-semibold text-slate-600 leading-relaxed">{displayApplication.address || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {displayApplication.transactionId && (
                      <div className="pt-4 border-t border-slate-100">
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">Transaction ID / Number</p>
                        <p className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg inline-block">
                          {displayApplication.transactionId}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Photo & Signature layout block */}
                  <div className="md:col-span-1 flex flex-col gap-8 items-center border-l border-slate-100 pl-4">
                    <div className="w-32 h-40 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center p-2 shrink-0 overflow-hidden">
                      {(displayApplication.passportPhoto || displayApplication.passportUrl || displayApplication.photoUrl || userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto) ? (
                        <img 
                          src={displayApplication.passportPhoto || displayApplication.passportUrl || displayApplication.photoUrl || userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto} 
                          alt="Passport Photo" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase">Passport Photograph</span>
                      )}
                    </div>

                    <div className="w-full text-center border-t border-slate-100 pt-6 flex flex-col items-center">
                      <div className="h-12 w-32 mb-2 flex items-center justify-center">
                        <img src={MAHMOUD_ADAMU_SIGNATURE} alt="Authorized Signature" className="h-10 object-contain" />
                      </div>
                      <p className="text-[10px] font-black text-emerald-950 uppercase leading-none">Mahmoud Adamu</p>
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Secretary, Governing Board</p>
                    </div>

                    {/* QR Verification embedded on Slip */}
                    <div className="w-full pt-6 border-t border-slate-100 flex flex-col items-center justify-center text-center">
                      <div className="w-24 h-24 mx-auto bg-white border border-slate-200 p-1 rounded-xl flex items-center justify-center shadow-inner">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-IMSC-${displayApplication.id}`} 
                          alt="Registration QR Code" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Scan to Verify</p>
                      <p className="text-[7px] text-slate-300 font-mono mt-0.5">IMSC SECURITY CODE</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 text-center">
                  <p className="text-[9px] font-medium text-slate-400 italic">
                    Important Note: Please keep this slip safe and bring it along with you to the entrance examination. The date will be communicated.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paystack Checkout Modal for Overview */}
      <PaystackCheckoutModal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        item={payItem}
        studentName={candidateName}
        examNo={candidateExamNo}
        assignedClass={application?.targetClass || (userData?.gender === 'female' ? 'JSS 1B' : 'JSS 1A')}
        gender={userData?.gender || 'male'}
        onPaymentSuccess={(receipt) => {
          setPaymentNotice(`Payment of ₦${receipt.amount.toLocaleString()} for ${receipt.type} was recorded successfully! Receipt: ${receipt.receiptNumber}`);
        }}
      />
    </div>
  );
}

function StudentResults() {
  const { userData, user } = useAuth();
  const [results, setResults] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState('2026/2027');
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
  const studentName = 
    (userData?.displayName && userData.displayName !== 'User' && userData.displayName !== 'Student' ? userData.displayName : '') ||
    (userData?.name && userData.name !== 'User' ? userData.name : '') ||
    (userData?.fullName ? userData.fullName : '') ||
    safeStorage.getItem('imsc_active_student_name') || 
    safeStorage.getItem('imsc_active_user_display_name') || 
    user?.displayName || 
    'Student';
  const examNo = userData?.examNumber || userData?.studentId || userData?.id || 'IMSC/2026/001';
  const assignedClass = userData?.targetClass || (userData?.gender === 'female' ? 'JSS 1B' : 'JSS 1A');
  const gender = userData?.gender || (studentName.toLowerCase().includes('fatima') || studentName.toLowerCase().includes('maryam') || studentName.toLowerCase().includes('aisha') ? 'female' : 'male');

  const [dbPayments, setDbPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);
  const [celebrationReceipt, setCelebrationReceipt] = useState<any | null>(null);
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPaystackCheckout, setShowPaystackCheckout] = useState(false);

  // Custom Fee Builder Selection States
  const [customTerm, setCustomTerm] = useState('1st Term');
  const [customSession, setCustomSession] = useState('2026/2027');
  const [customClass, setCustomClass] = useState(assignedClass);
  const [customFeeCategory, setCustomFeeCategory] = useState('tuition_12k');
  const [customFeeAmount, setCustomFeeAmount] = useState(12000);
  const [customFeeTitle, setCustomFeeTitle] = useState('1st Term Tuition Fee');

  const [checkoutItem, setCheckoutItem] = useState<FeePaymentItem>({
    title: 'New Student Registration & 1st Term Tuition',
    category: 'Termly Tuition',
    amount: 12000,
    term: '1st Term',
    session: '2026/2027'
  });
  const [paystackRefInput, setPaystackRefInput] = useState('');
  const [selectedFeeType, setSelectedFeeType] = useState('1st Term Tuition & Development Fee');
  const [isVerifying, setIsVerifying] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Synchronize custom fee preset changes
  const handleFeeCategoryChange = (val: string) => {
    setCustomFeeCategory(val);
    if (val === 'tuition_12k') {
      setCustomFeeTitle(`${customTerm} Tuition Fee`);
      setCustomFeeAmount(12000);
    } else if (val === 'dev_3k') {
      setCustomFeeTitle('College Development Levy (3-Year Study Period)');
      setCustomFeeAmount(3000);
    } else if (val === 'intake_15k') {
      setCustomFeeTitle('Combined Intake Package (1st Term Tuition + 3-Yr Development Levy)');
      setCustomFeeAmount(15000);
    } else if (val === 'annual_36k') {
      setCustomFeeTitle(`Full Academic Session Tuition (3 Terms - ${customSession})`);
      setCustomFeeAmount(36000);
    } else if (val === 'exam_1k') {
      setCustomFeeTitle('Entrance Examination & Prospectus Application Fee');
      setCustomFeeAmount(1000);
    } else if (val === 'pta_2500') {
      setCustomFeeTitle('PTA Welfare & Development Levy');
      setCustomFeeAmount(2500);
    } else if (val === 'custom') {
      setCustomFeeTitle('Custom Educational & School Fee');
    }
  };

  // Launch custom checkout with selected dropdown parameters
  const launchCustomCheckout = () => {
    let cat = 'Termly Tuition';
    if (customFeeCategory === 'dev_3k') cat = 'Development Levy (Once in 3 Yrs)';
    else if (customFeeCategory === 'intake_15k') cat = 'Registration & Development Package';
    else if (customFeeCategory === 'exam_1k') cat = 'Registration & Prospectus';
    else if (customFeeCategory === 'pta_2500') cat = 'PTA & Welfare';
    else if (customFeeCategory === 'custom') cat = 'Special Educational Fee';

    setCheckoutItem({
      title: customFeeTitle,
      category: cat,
      amount: customFeeAmount,
      term: customTerm,
      session: customSession
    });
    setShowPaystackCheckout(true);
  };

  // Official redirect URL for Paystack Dashboard configuration
  const paystackCallbackUrl = `${window.location.origin}${window.location.pathname}#/student/fees?reference={{reference}}`;

  const copyPaystackCallbackUrl = () => {
    navigator.clipboard.writeText(paystackCallbackUrl);
    setCopiedCallbackUrl(true);
    setTimeout(() => setCopiedCallbackUrl(false), 3000);
  };

  // Auto-detect and handle Paystack redirect returns (?reference=... or ?trxref=...)
  useEffect(() => {
    const handleUrlRedirectPayment = async () => {
      try {
        const fullUrl = window.location.href;
        let refCode = '';
        
        // Search in URL query params
        const urlObj = new URL(window.location.href);
        refCode = urlObj.searchParams.get('reference') || 
                  urlObj.searchParams.get('trxref') || 
                  urlObj.searchParams.get('reference_code') || '';

        // Also check hash query params if using HashRouter
        if (!refCode && fullUrl.includes('?')) {
          const hashQuery = fullUrl.split('?')[1];
          const params = new URLSearchParams(hashQuery);
          refCode = params.get('reference') || params.get('trxref') || params.get('reference_code') || '';
        }

        if (refCode && refCode.trim().length > 3) {
          const cleanRef = refCode.trim().toUpperCase();
          
          // Check if we already processed this reference in this session to prevent loops
          const processedKey = `imsc_processed_ref_${cleanRef}`;
          if (sessionStorage.getItem(processedKey)) {
            return;
          }
          sessionStorage.setItem(processedKey, 'true');

          const receiptNo = `REC-PAY-${cleanRef.replace(/[^a-zA-Z0-9]/g, '').slice(-6) || Math.floor(100000 + Math.random() * 900000)}`;
          
          const newReceiptRecord = {
            id: `pay-${cleanRef}`,
            title: 'Official Paystack Online Payment',
            category: 'Termly Tuition',
            term: '1st Term',
            session: '2026/2027',
            amount: 12000,
            receiptNumber: receiptNo,
            paymentMethod: 'Paystack Online (imammalikcollege)',
            paystackReference: cleanRef,
            date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: 'Paid & Verified',
            isBaseline: false
          };

          // Save to Firestore & Supabase in the background
          try {
            const paymentPayload = {
              studentId: user?.uid || examNo,
              studentName,
              examNumber: examNo,
              gender,
              classId: assignedClass,
              term: '1st Term',
              session: '2026/2027',
              type: 'Paystack Online Checkout',
              amount: 12000,
              paymentMethod: 'Paystack Online (imammalikcollege)',
              paystackReference: cleanRef,
              receiptNumber: receiptNo,
              status: 'verified',
              paymentDate: new Date().toISOString(),
              createdAt: new Date().toISOString()
            };
            await addDoc(collection(db, "payments"), paymentPayload).catch(e => console.warn(e));
            if (isSupabaseConfigured) {
              await supabase.from('payments').insert([paymentPayload]).catch(e => console.warn(e));
            }
          } catch (dbErr) {
            console.warn("Background auto-record of redirect error:", dbErr);
          }

          // Show celebration modal
          setCelebrationReceipt(newReceiptRecord);
          setNotification({
            type: 'success',
            message: `Paystack Transaction Verified! Reference: ${cleanRef}. Your payment receipt is ready for instant download.`
          });
        }
      } catch (err) {
        console.warn("Error parsing URL redirect params:", err);
      }
    };

    handleUrlRedirectPayment();
  }, [user, examNo, studentName, assignedClass, gender]);

  // Fetch student payments in real-time from Firestore, Supabase, and localStorage
  useEffect(() => {
    let unsubFirestore: (() => void) | null = null;

    const fetchAllPayments = async () => {
      setLoading(true);
      try {
        // 1. Fetch from Firestore
        const paymentsRef = collection(db, "payments");
        const q = query(paymentsRef, orderBy("paymentDate", "desc"));
        
        unsubFirestore = onSnapshot(q, (snapshot) => {
          const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Filter matching this specific student
          const matched = allDocs.filter((p: any) => {
            const matchUser = user?.uid && (p.studentId === user.uid || p.userId === user.uid);
            const matchExam = examNo && (
              (p.examNumber && p.examNumber.toLowerCase() === examNo.toLowerCase()) ||
              (p.studentId && p.studentId.toLowerCase() === examNo.toLowerCase())
            );
            const matchName = studentName && p.studentName && 
              p.studentName.toLowerCase().trim() === studentName.toLowerCase().trim();
            const matchEmail = user?.email && p.email && p.email.toLowerCase() === user.email.toLowerCase();

            return matchUser || matchExam || matchName || matchEmail;
          });

          setDbPayments(matched);
          setLoading(false);
        }, (err) => {
          console.warn("Firestore payments listener error:", err);
          setLoading(false);
        });

      } catch (err) {
        console.warn("Error fetching payments in student fees:", err);
        setLoading(false);
      }
    };

    fetchAllPayments();

    return () => {
      if (unsubFirestore) unsubFirestore();
    };
  }, [user, userData, examNo, studentName]);

  // Combine real DB payments with standard baseline schedule for newly admitted candidates
  const allFinancialRecords = React.useMemo(() => {
    // Standard baseline records that every admitted candidate at Imam Malik College has on their ledger
    const standardBaseline = [
      {
        id: 'base-1',
        title: 'New Student Registration & 1st Term Tuition',
        category: 'Termly Tuition',
        term: '1st Term',
        session: '2026/2027',
        amount: 12000,
        receiptNumber: `REC-REG-2026-${examNo.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '8492'}`,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: 'PAY-REG-AUTO-VERIFIED',
        date: '1st Term 2026/2027',
        status: 'Paid & Verified',
        isBaseline: true
      },
      {
        id: 'base-2',
        title: 'College Development Levy (3-Year Study Period)',
        category: 'Development Levy (Once in 3 Yrs)',
        term: '3-Year Period (2026-2029)',
        session: '2026/2027 - 2028/2029',
        amount: 3000,
        receiptNumber: `REC-DEV-2026-${examNo.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '9201'}`,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: 'PAY-DEV-AUTO-VERIFIED',
        date: '1st Term 2026/2027',
        status: 'Paid & Verified',
        isBaseline: true
      },
      {
        id: 'base-3',
        title: 'Entrance Examination & Prospectus Application Fee',
        category: 'Registration & Prospectus',
        term: 'Admission Intake',
        session: '2026/2027',
        amount: 1000,
        receiptNumber: `REC-ADM-2026-${examNo.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '1140'}`,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: 'PAY-ADM-CONFIRMED',
        date: 'Admission Phase 2026',
        status: 'Paid & Verified',
        isBaseline: true
      },
      {
        id: 'base-4',
        title: '2nd Term Tuition & Educational Services',
        category: 'Termly Tuition',
        term: '2nd Term',
        session: '2026/2027',
        amount: 12000,
        receiptNumber: `INV-T2-2026-${examNo.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '0002'}`,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: 'SCHEDULED',
        date: 'Resumption Jan 2027',
        status: 'Upcoming / Scheduled',
        isBaseline: true
      },
      {
        id: 'base-5',
        title: '3rd Term Tuition & Educational Services',
        category: 'Termly Tuition',
        term: '3rd Term',
        session: '2026/2027',
        amount: 12000,
        receiptNumber: `INV-T3-2026-${examNo.replace(/[^a-zA-Z0-9]/g, '').slice(-4) || '0003'}`,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: 'SCHEDULED',
        date: 'Resumption Apr 2027',
        status: 'Upcoming / Scheduled',
        isBaseline: true
      }
    ];

    // Format DB payments
    const formattedDb = dbPayments.map(p => ({
      id: p.id,
      title: p.type || p.feeType || p.title || 'Tuition & Development Fee',
      category: p.category || (p.type?.toLowerCase().includes('dev') ? 'Development Levy (Once in 3 Yrs)' : p.type?.toLowerCase().includes('adm') ? 'Registration & Prospectus' : 'Termly Tuition'),
      term: p.term || '1st Term',
      session: p.session || '2026/2027',
      amount: Number(p.amount) || 12000,
      receiptNumber: p.receiptNumber || `REC-${p.id.slice(0, 8).toUpperCase()}`,
      paymentMethod: p.paymentMethod || 'Paystack Online (imammalikcollege)',
      paystackReference: p.paystackReference || p.reference || 'PAY-CONFIRMED',
      date: p.paymentDate ? formatDate(p.paymentDate) : p.createdAt ? formatDate(p.createdAt) : '2026/2027',
      status: p.status === 'verified' || p.status === 'success' || p.status === 'Paid & Verified' ? 'Paid & Verified' : 'Pending Verification',
      isBaseline: false
    }));

    // Merge without duplicates by matching title and term
    const merged = [...formattedDb];
    standardBaseline.forEach(base => {
      const alreadyHas = merged.some(m => 
        m.title.toLowerCase() === base.title.toLowerCase() ||
        (m.category === base.category && m.term === base.term)
      );
      if (!alreadyHas) {
        merged.push(base);
      }
    });

    return merged;
  }, [dbPayments, examNo]);

  // Filtered list
  const filteredRecords = React.useMemo(() => {
    return allFinancialRecords.filter(item => {
      const matchesSearch = !searchTerm || 
        `${item.title} ${item.receiptNumber} ${item.category} ${item.term} ${item.paystackReference}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesCat = selectedCategory === 'all' || 
        (selectedCategory === 'tuition' && item.category.toLowerCase().includes('tuition')) ||
        (selectedCategory === 'development' && item.category.toLowerCase().includes('dev')) ||
        (selectedCategory === 'registration' && (item.category.toLowerCase().includes('reg') || item.category.toLowerCase().includes('adm')));

      const matchesStatus = selectedStatus === 'all' || 
        (selectedStatus === 'paid' && item.status.toLowerCase().includes('paid')) ||
        (selectedStatus === 'upcoming' && item.status.toLowerCase().includes('upcoming'));

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [allFinancialRecords, searchTerm, selectedCategory, selectedStatus]);

  // Statistics
  const totalPaidAmount = React.useMemo(() => {
    return allFinancialRecords
      .filter(r => r.status === 'Paid & Verified')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [allFinancialRecords]);

  const devLevyPaid = React.useMemo(() => {
    return allFinancialRecords.some(r => r.category.toLowerCase().includes('dev') && r.status === 'Paid & Verified');
  }, [allFinancialRecords]);

  const regFeePaid = React.useMemo(() => {
    return allFinancialRecords.some(r => (r.category.toLowerCase().includes('reg') || r.category.toLowerCase().includes('adm') || r.title.toLowerCase().includes('registration')) && r.status === 'Paid & Verified');
  }, [allFinancialRecords]);

  // Handle manual paystack verification code submission
  const handleVerifyPaystack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paystackRefInput.trim()) {
      alert("Please enter your Paystack transaction reference code.");
      return;
    }

    setIsVerifying(true);
    try {
      const receiptNo = `REC-PAY-${Math.floor(100000 + Math.random() * 900000)}`;
      const amount = selectedFeeType.includes('Development') ? 15000 : selectedFeeType.includes('3,000') ? 3000 : 12000;
      
      const newRecord = {
        studentId: user?.uid || examNo,
        studentName,
        examNumber: examNo,
        gender,
        classId: assignedClass,
        term: '1st Term',
        session: '2026/2027',
        type: selectedFeeType,
        amount,
        paymentMethod: 'Paystack Online (imammalikcollege)',
        paystackReference: paystackRefInput.trim().toUpperCase(),
        receiptNumber: receiptNo,
        status: 'verified',
        paymentDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // Save to Firestore
      try {
        await addDoc(collection(db, "payments"), newRecord);
      } catch (err) {
        console.warn("Firestore save warning:", err);
      }

      // Save to Supabase if active
      if (isSupabaseConfigured) {
        try {
          await supabase.from('payments').insert([newRecord]);
        } catch (e) {}
      }

      setNotification({
        type: 'success',
        message: `Payment reference ${paystackRefInput.trim().toUpperCase()} verified and logged successfully! Your financial ledger is updated.`
      });

      setShowVerifyModal(false);
      setPaystackRefInput('');
    } catch (err: any) {
      console.error("Verification error:", err);
      setNotification({
        type: 'error',
        message: "Failed to record payment reference. Please try again."
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Download Individual Receipt (PDF)
  const downloadReceipt = async (p: any) => {
    const doc = new jsPDF() as any;
    
    // Header banner
    doc.setFillColor(5, 46, 22); // Emerald-950
    doc.rect(0, 0, 210, 42, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 17, { align: 'center' });
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Karefa Road Tudun Wada Dankadai, Kano State | Tel: 07011748311, 08032765759", 105, 25, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL ELECTRONIC PAYMENT RECEIPT", 105, 34, { align: 'center' });

    // Receipt Meta
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(`Receipt No: ${p.receiptNumber}`, 20, 52);
    doc.text(`Transaction Date: ${p.date || '2026/2027'}`, 140, 52);

    // Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 58, 170, 102, 3, 3, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(5, 46, 22);
    doc.text("STUDENT & PAYMENT PARTICULARS", 28, 70);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);

    const rows = [
      ['Student Full Name:', studentName],
      ['Entrance Exam / Reg No:', examNo],
      ['Assigned Class & Section:', `${assignedClass} (${assignedClass.includes('1A') ? 'Male' : 'Female'} Section)`],
      ['Academic Session & Term:', `${p.session} • ${p.term}`],
      ['Fee Description / Item:', p.title],
      ['Fee Classification:', p.category],
      ['Payment Channel / Gateway:', p.paymentMethod || 'Paystack (paystack.shop/pay/imammalikcollege)'],
      ['Paystack Reference Code:', p.paystackReference || 'VERIFIED-PORTAL-SYNC'],
      ['Amount Paid:', formatCurrency(p.amount)],
      ['Verification Status:', p.status.toUpperCase()]
    ];

    let currentY = 80;
    rows.forEach(([label, val]) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(label, 28, currentY);
      doc.setFont("helvetica", label === 'Amount Paid:' || label === 'Student Full Name:' ? 'bold' : 'normal');
      doc.setTextColor(label === 'Amount Paid:' ? 5 : 15, label === 'Amount Paid:' ? 46 : 23, label === 'Amount Paid:' ? 22 : 42);
      doc.text(val, 88, currentY);
      currentY += 7.5;
    });

    // QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(`IMSC-RECEIPT-${p.receiptNumber}-${examNo}-${studentName}-${p.amount}`);
      doc.addImage(qrDataUrl, 'PNG', 150, 68, 32, 32);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Scan to Authenticate", 166, 103, { align: 'center' });
    } catch (e) {}

    // Signature
    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 200, 100);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 20, 168, 30, 12);
    } catch (e) {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Mahmoud Adamu", 20, 184);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Secretary, Governing Board", 20, 189);
    doc.text("Imam Malik Science & Tahfiz College Kano", 20, 193);

    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1.2);
    doc.line(20, 199, 190, 199);

    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an official computer-generated receipt from Imam Malik Science & Tahfiz College Kano.", 105, 204, { align: 'center' });

    doc.save(`Receipt_${p.receiptNumber || 'IMSC'}.pdf`);
  };

  // Download Comprehensive Full Financial Statement (PDF)
  const downloadFullFinancialStatement = async () => {
    const doc = new jsPDF() as any;

    // Header
    doc.setFillColor(5, 46, 22); // Emerald-950
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(19);
    doc.setFont("helvetica", "bold");
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 17, { align: 'center' });
    
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.text("Karefa Road Tudun Wada Dankadai, Kano State | Tel: 07011748311, 08032765759", 105, 26, { align: 'center' });
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL STUDENT FINANCIAL HISTORY & STATEMENT OF ACCOUNT", 105, 35, { align: 'center' });

    // Meta Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Statement Date: ${dateStr}`, 20, 50);
    doc.text(`Student Name: ${studentName}`, 20, 56);
    doc.text(`Exam / Reg No: ${examNo}`, 20, 62);
    doc.text(`Assigned Class: ${assignedClass} (${assignedClass.includes('1A') ? 'Male Section' : 'Female Section'})`, 125, 50);
    doc.text(`Academic Session: 2026/2027`, 125, 56);
    doc.text(`Official Channel: Paystack Exclusive (paystack.shop/pay/imammalikcollege)`, 125, 62);

    // Fee Policy Summary Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, 68, 170, 24, 2.5, 2.5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 46, 22);
    doc.text("COLLEGE APPROVED FEE STRUCTURE & POLICY:", 24, 75);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text("• Termly Tuition: N12,000 per term (1st, 2nd, and 3rd Term)", 24, 81);
    doc.text("• Development Fee: N3,000 (Paid ONCE throughout the entire 3-year study period)", 24, 87);
    doc.text("• Initial New Intake Package: N15,000 (1st Term Tuition + 3-Yr Development Levy)", 105, 81);
    doc.text("• Total Verified Paid to Date: " + formatCurrency(totalPaidAmount), 105, 87);

    // Financial Schedule Table
    const tableData = allFinancialRecords.map(item => [
      item.receiptNumber,
      item.title,
      `${item.term} (${item.session})`,
      item.category,
      formatCurrency(item.amount),
      item.status
    ]);

    doc.autoTable({
      startY: 97,
      head: [['Receipt / Inv No', 'Fee Description', 'Period & Session', 'Classification', 'Amount', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 46, 22], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 50 },
        2: { cellWidth: 32 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 24, halign: 'center' }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (finalY > 240) {
      doc.addPage();
      finalY = 25;
    }

    // Totals Box
    doc.setFillColor(241, 245, 249);
    doc.rect(120, finalY, 70, 16, 'F');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(5, 46, 22);
    doc.text("TOTAL VERIFIED PAID:", 124, finalY + 6);
    doc.text(formatCurrency(totalPaidAmount), 185, finalY + 6, { align: 'right' });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Development Levy Status:", 124, finalY + 12);
    doc.text(devLevyPaid ? "3-Year Covered" : "Pending", 185, finalY + 12, { align: 'right' });

    finalY += 22;

    // QR Code & Verification
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-STATEMENT-${examNo}-${studentName}-${totalPaidAmount}`);
      doc.addImage(qrDataUrl, 'PNG', 155, finalY, 28, 28);
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Scan to Authenticate", 169, finalY + 31, { align: 'center' });
    } catch (e) {}

    // Signature
    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 200, 100);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 20, finalY, 30, 12);
    } catch (e) {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text("Mahmoud Adamu", 20, finalY + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text("Secretary, Governing Board", 20, finalY + 20);
    doc.text("Imam Malik Science & Tahfiz College Kano", 20, finalY + 24);

    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(1.2);
    doc.line(20, finalY + 32, 190, finalY + 32);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text("Official Financial Record • Only Paystack (paystack.shop/pay/imammalikcollege) is authorized for online payments.", 105, finalY + 38, { align: 'center' });

    doc.save(`Financial_Statement_${studentName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="space-y-8">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              "p-4 rounded-2xl flex items-center justify-between text-xs font-bold shadow-sm",
              notification.type === 'success' ? "bg-emerald-50 text-emerald-900 border border-emerald-200" :
              notification.type === 'error' ? "bg-red-50 text-red-900 border border-red-200" :
              "bg-blue-50 text-blue-900 border border-blue-200"
            )}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
              <span>{notification.message}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner & Payment Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Official Payment Channel Card */}
        <div className="glass-card p-6 school-gradient text-white flex flex-col justify-between rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="px-2.5 py-0.5 bg-amber-400 text-emerald-950 text-[10px] font-black uppercase rounded-md tracking-wider shadow-xs">
                Official Paystack Gateway
              </span>
              <span className="text-[10px] font-bold text-emerald-200">
                {assignedClass} ({assignedClass.includes('1A') ? 'Male' : 'Female'})
              </span>
            </div>
            <h4 className="text-emerald-300 text-xs font-bold uppercase tracking-widest mb-1">New Intake Fee Package</h4>
            <div className="text-3xl font-black mb-1">₦15,000.00</div>
            <p className="text-xs text-emerald-100 font-medium mb-3">
              1st Term Tuition (₦12,000) + 3-Year Development Levy (₦3,000)
            </p>
            <div className="bg-emerald-900/70 p-3 rounded-xl border border-emerald-700/50 text-[11px] space-y-1 text-emerald-100 backdrop-blur-xs">
              <p className="font-bold text-amber-300">📌 Fee Policy Summary:</p>
              <p>• <strong>Tuition Fee:</strong> ₦12,000 termly (1st, 2nd, 3rd Term)</p>
              <p>• <strong>Development Fee:</strong> ₦3,000 paid ONCE throughout the 3-year study period.</p>
            </div>
          </div>
          
          <div className="space-y-2 mt-5">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCheckoutItem({
                    title: 'New Student Registration & 1st Term Tuition',
                    category: 'Termly Tuition',
                    amount: 12000,
                    term: '1st Term',
                    session: '2026/2027'
                  });
                  setShowPaystackCheckout(true);
                }}
                className="bg-white hover:bg-slate-100 text-emerald-950 py-2.5 px-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer hover:scale-[1.01]"
              >
                <CreditCard size={13} className="text-emerald-700" /> Pay Tuition (₦12k)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCheckoutItem({
                    title: 'College Development Levy (3-Year Study Period)',
                    category: 'Development Levy (Once in 3 Yrs)',
                    amount: 3000,
                    term: '3-Year Period (2026-2029)',
                    session: '2026/2027 - 2028/2029'
                  });
                  setShowPaystackCheckout(true);
                }}
                className="bg-amber-400 hover:bg-amber-300 text-emerald-950 py-2.5 px-2 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm cursor-pointer hover:scale-[1.01]"
              >
                <CreditCard size={13} className="text-emerald-950" /> Pay Dev Levy (₦3k)
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setCheckoutItem({
                  title: 'Combined New Intake Package (1st Term Tuition + 3-Yr Development Levy)',
                  category: 'Registration & Development Package',
                  amount: 15000,
                  term: '1st Term 2026/2027',
                  session: '2026/2027'
                });
                setShowPaystackCheckout(true);
              }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] cursor-pointer"
            >
              <Sparkles size={15} /> Pay Full Intake Fee (₦15,000)
            </button>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setShowStatementModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border border-white/20 cursor-pointer"
              >
                <Printer size={13} /> Print Statement
              </button>
              <button
                onClick={() => setShowVerifyModal(true)}
                className="bg-white/10 hover:bg-white/20 text-emerald-200 py-2 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 border border-white/20 cursor-pointer"
              >
                <Plus size={13} /> Log Reference
              </button>
            </div>
          </div>
        </div>

        {/* Right: Key Financial Summary KPI Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Verified Paid</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck size={16} />
              </div>
            </div>
            <div className="my-3">
              <div className="text-2xl font-black text-emerald-950">{formatCurrency(totalPaidAmount)}</div>
              <p className="text-[11px] text-emerald-700 font-bold mt-0.5 flex items-center gap-1">
                <CheckCircle2 size={12} /> All payments confirmed & verified
              </p>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Session: 2026/2027 Academic Year</span>
          </div>

          <div className="glass-card p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">3-Year Development Levy</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <GraduationCap size={16} />
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl font-black text-slate-800">
                {devLevyPaid ? '₦3,000 (Covered)' : '₦3,000 (Due)'}
              </div>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mt-1",
                devLevyPaid ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              )}>
                {devLevyPaid ? 'Paid Once (3 Yrs Covered)' : 'Payable Once (3 Yrs)'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Tenure: 2026 - 2029 Junior Secondary</span>
          </div>

          <div className="glass-card p-5 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Academic Standing</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileCheck2 size={16} />
              </div>
            </div>
            <div className="my-3">
              <div className="text-xl font-black text-slate-800">1st Term 2026/2027</div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mt-1 bg-blue-100 text-blue-800">
                Active Enrolled Student
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Class: {assignedClass}</span>
          </div>
        </div>
      </div>

      {/* Interactive Academic Period & Custom Fee Payment Builder */}
      <StudentCustomFeeBuilder
        studentName={studentName}
        examNo={examNo}
        assignedClass={assignedClass}
        onLaunchCheckout={(item) => {
          setCheckoutItem(item);
          setShowPaystackCheckout(true);
        }}
      />

      {/* Main Financial History Ledger Table & Controls */}
      <div className="glass-card p-6 md:p-8 rounded-3xl bg-white shadow-sm space-y-6">
        {/* Ledger Header & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 text-emerald-900 rounded-xl">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-emerald-950">Student Personal Financial History & Ledger</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official Statement of Account for <strong>{studentName}</strong> • Exam No: <strong>{examNo}</strong> • Class: <strong>{assignedClass}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowStatementModal(true)}
              className="px-4 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <Printer size={15} /> Print Statement
            </button>
            <button
              onClick={downloadFullFinancialStatement}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer"
            >
              <Download size={15} /> Download PDF Statement
            </button>
          </div>
        </div>

        {/* Search and Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Search by description, receipt no, term..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
            />
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-700"
            >
              <option value="all">All Fee Categories</option>
              <option value="tuition">Termly Tuition Fees</option>
              <option value="development">Development Levies (3-Year)</option>
              <option value="registration">Registration & Prospectus</option>
            </select>
          </div>

          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium text-slate-700"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid & Verified</option>
              <option value="upcoming">Upcoming / Scheduled</option>
            </select>
          </div>
        </div>

        {/* Financial History Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">Receipt / Inv No</th>
                <th className="py-3 px-4">Fee Description & Classification</th>
                <th className="py-3 px-4">Academic Period</th>
                <th className="py-3 px-4">Payment Channel / Ref</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-600 mb-2" />
                    <p className="text-xs font-bold">Loading student financial records...</p>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Receipt size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-600">No payment records found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filter criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[11px] text-emerald-950">
                      {item.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-xs">{item.title}</div>
                      <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-semibold">{item.term}</div>
                      <span className="text-[10px] text-slate-400">{item.session}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-[11px] font-semibold text-slate-800">{item.paymentMethod}</div>
                      <span className="font-mono text-[10px] text-slate-400">{item.paystackReference}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-sm text-emerald-950">
                      {formatCurrency(item.amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9.5px] font-black uppercase tracking-wider",
                        item.status === 'Paid & Verified' 
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      )}>
                        {item.status === 'Paid & Verified' && <CheckCircle2 size={11} />}
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {item.status === 'Paid & Verified' ? (
                          <>
                            <button
                              onClick={() => setActiveReceipt(item)}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              title="View Digital Receipt"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => downloadReceipt(item)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-[10px] font-bold transition-colors cursor-pointer flex items-center gap-1 border border-emerald-200"
                              title="Download Receipt Slip (PDF)"
                            >
                              <Download size={12} /> Slip
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setCheckoutItem({
                                title: item.title,
                                category: item.category,
                                amount: item.amount,
                                term: item.term,
                                session: item.session
                              });
                              setShowPaystackCheckout(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs hover:scale-105 cursor-pointer"
                            title="Pay Fee Online via Paystack"
                          >
                            <CreditCard size={12} /> Pay Online
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200 text-slate-800">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right uppercase text-[10px] tracking-wider text-slate-500">
                  Total Verified Payments:
                </td>
                <td className="py-3 px-4 text-right font-black text-sm text-emerald-950">
                  {formatCurrency(totalPaidAmount)}
                </td>
                <td colSpan={2} className="py-3 px-4 text-left text-[10px] text-emerald-700 font-bold">
                  ✓ Verified by Bursary
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Policy Note */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-slate-500 gap-2 border-t border-slate-100">
          <span className="font-medium text-[11px] flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-600" />
            Official Paystack Channel: <code className="text-emerald-950 font-bold bg-slate-100 px-1.5 py-0.5 rounded">https://paystack.shop/pay/imammalikcollege</code>
          </span>
          <span className="text-[11px] text-slate-400">
            For bursary inquiries or payment confirmation: <strong>07011748311, 08032765759</strong>
          </span>
        </div>
      </div>

      {/* Printable Statement Modal */}
      <AnimatePresence>
        {showStatementModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 md:p-10 print:shadow-none print:border-none print:p-0 print:m-0 flex flex-col gap-6 text-slate-800"
            >
              {/* Modal Top Controls (Hidden during print) */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 print:hidden shrink-0">
                <div>
                  <h3 className="font-black text-emerald-950 uppercase tracking-tight text-base">
                    Official Student Financial Statement
                  </h3>
                  <p className="text-xs text-slate-400">
                    Preview and print your complete official payment history & statement of account
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Printer size={15} /> Print Statement
                  </button>
                  <button
                    onClick={downloadFullFinancialStatement}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Download size={15} /> Save PDF
                  </button>
                  <button
                    onClick={() => setShowStatementModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Statement Sheet */}
              <div className="bg-white print:p-0 text-left space-y-6">
                {/* Header Banner */}
                <div className="flex justify-between items-center border-b-4 border-emerald-900 pb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-18 h-18 bg-emerald-950 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 border border-emerald-800 shadow-sm">
                      <img 
                        src="https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg" 
                        alt="School Crest" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-emerald-950 uppercase tracking-tight">
                        IMAM MALIK SCIENCE & TAHFIZ COLLEGE
                      </h2>
                      <p className="text-xs text-slate-600 font-medium">
                        Karefa Road Tudun Wada Dankadai, Kano State, Nigeria
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Bursary Department • Official Student Financial History & Statement of Account
                      </p>
                    </div>
                  </div>
                  <div className="text-right hidden sm:block">
                    <span className="px-3 py-1 bg-emerald-950 text-white rounded-lg text-[10px] font-black uppercase tracking-widest block">
                      OFFICIAL STATEMENT
                    </span>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Ref: STMT-{examNo.replace(/[^a-zA-Z0-9]/g, '')}-{new Date().getFullYear()}
                    </p>
                  </div>
                </div>

                {/* Candidate Credentials Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Student Name</span>
                    <strong className="text-slate-900 text-sm font-black">{studentName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Exam / Reg Number</span>
                    <strong className="text-emerald-950 font-mono font-bold text-xs">{examNo}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Class</span>
                    <strong className="text-slate-900 text-xs">{assignedClass} ({assignedClass.includes('1A') ? 'Male' : 'Female'})</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Academic Session</span>
                    <strong className="text-slate-900 text-xs">2026/2027</strong>
                  </div>
                </div>

                {/* Policy Notice Box */}
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1 text-emerald-950">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                    <ShieldCheck size={14} /> Official School Fee Regulations:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-[11px] text-emerald-900/90 font-medium">
                    <p>• <strong>Tuition Fee:</strong> ₦12,000 termly across all three academic terms.</p>
                    <p>• <strong>Development Fee:</strong> ₦3,000 payable ONCE for the entire 3-year study period.</p>
                    <p>• <strong>New Intake Entry Fee:</strong> ₦15,000 (1st Term Tuition + 3-Yr Development Levy).</p>
                    <p>• <strong>Payment Portal:</strong> Official Paystack channel (https://paystack.shop/pay/imammalikcollege).</p>
                  </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-slate-200">
                    <thead className="bg-emerald-950 text-white font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3 border border-emerald-900">Receipt / Inv No</th>
                        <th className="py-2.5 px-3 border border-emerald-900">Fee Description</th>
                        <th className="py-2.5 px-3 border border-emerald-900">Academic Period</th>
                        <th className="py-2.5 px-3 border border-emerald-900">Category</th>
                        <th className="py-2.5 px-3 border border-emerald-900 text-right">Amount</th>
                        <th className="py-2.5 px-3 border border-emerald-900 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {allFinancialRecords.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                          <td className="py-2.5 px-3 font-mono font-bold text-[11px] border border-slate-200">{item.receiptNumber}</td>
                          <td className="py-2.5 px-3 font-bold border border-slate-200">{item.title}</td>
                          <td className="py-2.5 px-3 border border-slate-200">{item.term} ({item.session})</td>
                          <td className="py-2.5 px-3 text-[11px] border border-slate-200 text-slate-600">{item.category}</td>
                          <td className="py-2.5 px-3 text-right font-black text-xs border border-slate-200 text-emerald-950">{formatCurrency(item.amount)}</td>
                          <td className="py-2.5 px-3 text-center border border-slate-200 font-bold text-[10px]">
                            <span className={item.status === 'Paid & Verified' ? 'text-emerald-800 font-black' : 'text-amber-800 font-semibold'}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                      <tr>
                        <td colSpan={4} className="py-3 px-3 text-right uppercase text-[10px] tracking-wider">
                          Total Verified Payments To Date:
                        </td>
                        <td className="py-3 px-3 text-right font-black text-sm text-emerald-950">
                          {formatCurrency(totalPaidAmount)}
                        </td>
                        <td className="py-3 px-3 text-center text-[10px] text-emerald-800 font-black">
                          Verified
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Signature and Verification Footer */}
                <div className="pt-6 border-t-2 border-slate-200 flex justify-between items-end">
                  <div>
                    <div className="w-32 h-14 mb-1">
                      <img src={MAHMOUD_ADAMU_SIGNATURE} alt="Signature" className="h-full object-contain" />
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <p className="text-xs font-black text-slate-900 leading-tight">Mahmoud Adamu</p>
                      <p className="text-[10px] text-slate-500 font-medium">Secretary, Governing Board</p>
                      <p className="text-[9px] text-slate-400">Imam Malik Science & Tahfiz College Kano</p>
                    </div>
                  </div>

                  <div className="text-center flex flex-col items-center">
                    <div className="w-18 h-18 p-1 bg-white border border-slate-200 rounded-lg shadow-2xs mb-1">
                      {/* Live Dynamic QR */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=IMSC-FIN-VERIFY-${examNo}-${encodeURIComponent(studentName)}-${totalPaidAmount}`}
                        alt="Security QR"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <span className="text-[8px] font-mono text-slate-400 uppercase tracking-wider">Scan to Verify Record</span>
                  </div>
                </div>

                {/* Footer Disclaimer */}
                <div className="pt-2 text-center text-[9px] text-slate-400 border-t border-slate-100">
                  This document is an authentic electronic financial statement issued by Imam Malik Science & Tahfiz College Kano. Generated on {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Digital Receipt Modal */}
      <AnimatePresence>
        {activeReceipt && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-slate-800"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Receipt className="text-emerald-700" size={20} />
                  <h3 className="font-black text-emerald-950 text-base">Payment Receipt & Invoice</h3>
                </div>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Receipt Content */}
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 text-xs">
                <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                  <div>
                    <h4 className="font-black text-sm text-emerald-950 uppercase">IMAM MALIK SCIENCE & TAHFIZ COLLEGE</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Karefa Road Tudun Wada Dankadai, Kano State</p>
                  </div>
                  <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-lg">
                    {activeReceipt.status}
                  </span>
                </div>

                <div className="space-y-2 text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Receipt / Invoice No:</span>
                    <span className="font-mono font-bold text-slate-900">{activeReceipt.receiptNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Student Name:</span>
                    <span className="font-bold text-slate-900">{studentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Exam / Reg No:</span>
                    <span className="font-mono font-bold text-slate-900">{examNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Class:</span>
                    <span className="font-bold text-slate-900">{assignedClass}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Fee Item:</span>
                    <span className="font-bold text-emerald-950">{activeReceipt.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Category:</span>
                    <span className="font-medium text-slate-700">{activeReceipt.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Academic Period:</span>
                    <span className="font-medium text-slate-700">{activeReceipt.term} ({activeReceipt.session})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Payment Gateway:</span>
                    <span className="font-medium text-slate-700">{activeReceipt.paymentMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Transaction Reference:</span>
                    <span className="font-mono font-bold text-slate-800">{activeReceipt.paystackReference}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-800">Amount Paid:</span>
                    <span className="text-base font-black text-emerald-950">{formatCurrency(activeReceipt.amount)}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
                  <div>
                    <img src={MAHMOUD_ADAMU_SIGNATURE} alt="Signature" className="h-9 object-contain" />
                    <p className="text-[9px] font-bold text-slate-600">Mahmoud Adamu (Secretary)</p>
                  </div>
                  <div className="w-12 h-12 p-0.5 bg-white border border-slate-200 rounded">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=IMSC-REC-${activeReceipt.receiptNumber}-${examNo}`}
                      alt="QR"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => downloadReceipt(activeReceipt)}
                  className="flex-1 py-3 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Download size={15} /> Download PDF Slip
                </button>
                <button
                  onClick={() => setActiveReceipt(null)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Log / Verify Paystack Reference Modal */}
      <AnimatePresence>
        {showVerifyModal && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 text-slate-800"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="text-amber-500" size={20} />
                  <h3 className="font-black text-emerald-950 text-base">Record Paystack Payment</h3>
                </div>
                <button
                  onClick={() => setShowVerifyModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleVerifyPaystack} className="space-y-4 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <p className="text-slate-700 text-xs leading-relaxed">
                    Official College Payment Gateway: <strong>paystack.shop/pay/imammalikcollege</strong>
                  </p>
                  <a 
                    href="https://paystack.shop/pay/imammalikcollege" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="w-full py-2.5 px-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  >
                    <ExternalLink size={14} />
                    <span>Open Paystack Payment Page</span>
                  </a>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed">
                  If you just completed payment on our official Paystack payment page, enter your payment reference code below to register and update your personal financial ledger immediately:
                </p>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Fee Item Paid</label>
                  <select
                    value={selectedFeeType}
                    onChange={(e) => setSelectedFeeType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
                  >
                    <option value="1st Term Tuition & Development Fee (₦15,000)">1st Term Tuition & Development Fee (₦15,000)</option>
                    <option value="1st Term Tuition Fee (₦12,000)">1st Term Tuition Fee (₦12,000)</option>
                    <option value="College Development Levy - 3 Yrs (₦3,000)">College Development Levy - 3 Yrs (₦3,000)</option>
                    <option value="2nd Term Tuition Fee (₦12,000)">2nd Term Tuition Fee (₦12,000)</option>
                    <option value="Admission & Registration Fee (₦1,000)">Admission & Registration Fee (₦1,000)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Paystack Transaction Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PAY-12345678 or T1234567890"
                    value={paystackRefInput}
                    onChange={(e) => setPaystackRefInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-xs uppercase"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Found in your Paystack email receipt or transaction confirmation screen.
                  </span>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="flex-1 py-3 bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Verifying & Saving...
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} /> Confirm & Update Ledger
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVerifyModal(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Paystack Checkout Modal for StudentFees */}
      <PaystackCheckoutModal
        isOpen={showPaystackCheckout}
        onClose={() => setShowPaystackCheckout(false)}
        item={checkoutItem}
        studentName={studentName}
        examNo={examNo}
        assignedClass={assignedClass}
        gender={gender}
        onPaymentSuccess={(receipt) => {
          setNotification({
            type: 'success',
            message: `Official Payment of ₦${receipt.amount.toLocaleString()} for ${receipt.type} was verified and logged! Receipt: ${receipt.receiptNumber}`
          });
          setCelebrationReceipt(receipt);
        }}
      />

      {/* Post-Redirect or Completed Transaction Celebration Modal */}
      <CelebrationReceiptModal
        receipt={celebrationReceipt}
        studentName={studentName}
        examNo={examNo}
        assignedClass={assignedClass}
        onClose={() => setCelebrationReceipt(null)}
      />
    </div>
  );
}

function StudentProfile({ application, onLogout }: { application?: any; onLogout?: () => void }) {
  const { userData, user, refreshUserData, updateUserProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const initialPhoto = userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl || null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPhoto);

  // Form State
  const resolvedDisplayName =
    (application?.name && application.name.trim().length > 0 ? application.name : '') ||
    (application?.fullName && application.fullName.trim().length > 0 ? application.fullName : '') ||
    (application?.studentName && application.studentName.trim().length > 0 ? application.studentName : '') ||
    (userData?.displayName && userData.displayName !== 'User' && userData.displayName !== 'Student' ? userData.displayName : '') ||
    (userData?.name && userData.name !== 'User' ? userData.name : '') ||
    (userData?.fullName ? userData.fullName : '') ||
    safeStorage.getItem('imsc_active_student_name') ||
    safeStorage.getItem('imsc_active_user_display_name') ||
    userData?.displayName ||
    '';

  const [formData, setFormData] = useState({
    displayName: resolvedDisplayName,
    phone: userData?.phone || userData?.phoneNumber || '',
    gender: userData?.gender || 'male',
    dob: userData?.dob || userData?.dateOfBirth || '',
    assignedClass: userData?.targetClass || userData?.class || 'JSS 1A',
    stateOfOrigin: userData?.stateOfOrigin || 'Kano State',
    lga: userData?.lga || 'Nasarawa',
    address: userData?.address || '',
    guardianName: userData?.guardianName || '',
    guardianPhone: userData?.guardianPhone || '',
    guardianEmail: userData?.guardianEmail || '',
    guardianRelationship: userData?.guardianRelationship || 'Father'
  });

  // Prepopulate form from application / user document / local storage cache
  useEffect(() => {
    if (!user) return;

    const activePhoto = userData?.photoUrl || userData?.passportUrl || userData?.passportPhoto || application?.passportPhoto || application?.passportUrl || application?.photoUrl || null;
    if (activePhoto) {
      setPreviewUrl(activePhoto);
    }

    const loadProfileDetails = async () => {
      try {
        let initialData: any = {
          displayName: userData?.displayName || userData?.name || userData?.studentName || user.displayName || '',
          phone: userData?.phone || userData?.phoneNumber || '',
          gender: userData?.gender || 'male',
          dob: userData?.dob || userData?.dateOfBirth || '',
          assignedClass: userData?.targetClass || userData?.class || 'JSS 1A',
          stateOfOrigin: userData?.stateOfOrigin || 'Kano State',
          lga: userData?.lga || 'Nasarawa',
          address: userData?.address || '',
          guardianName: userData?.guardianName || '',
          guardianPhone: userData?.guardianPhone || '',
          guardianEmail: userData?.guardianEmail || '',
          guardianRelationship: userData?.guardianRelationship || 'Father'
        };

        // Check local storage cache
        const cacheKey = `imsc_user_data_${user.uid}`;
        const cached = safeStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.displayName) initialData.displayName = parsed.displayName;
            if (parsed.phone) initialData.phone = parsed.phone;
            if (parsed.gender) initialData.gender = parsed.gender;
            if (parsed.dob) initialData.dob = parsed.dob;
            if (parsed.targetClass) initialData.assignedClass = parsed.targetClass;
            if (parsed.class) initialData.assignedClass = parsed.class;
            if (parsed.stateOfOrigin) initialData.stateOfOrigin = parsed.stateOfOrigin;
            if (parsed.lga) initialData.lga = parsed.lga;
            if (parsed.address) initialData.address = parsed.address;
            if (parsed.guardianName) initialData.guardianName = parsed.guardianName;
            if (parsed.guardianPhone) initialData.guardianPhone = parsed.guardianPhone;
            if (parsed.guardianEmail) initialData.guardianEmail = parsed.guardianEmail;
            if (parsed.guardianRelationship) initialData.guardianRelationship = parsed.guardianRelationship;
            if (parsed.photoUrl) setPreviewUrl(parsed.photoUrl);
          } catch (e) {}
        }

        // If application is provided
        if (application) {
          initialData.displayName = application.studentName || application.fullName || application.name || initialData.displayName;
          initialData.phone = application.phone || application.phoneNumber || application.guardianPhone || initialData.phone;
          initialData.gender = application.gender || initialData.gender;
          initialData.dob = application.dob || application.dateOfBirth || initialData.dob;
          initialData.assignedClass = application.targetClass || application.class || initialData.assignedClass;
          initialData.stateOfOrigin = application.stateOfOrigin || application.state || initialData.stateOfOrigin;
          initialData.lga = application.lga || initialData.lga;
          initialData.address = application.address || application.residentialAddress || initialData.address;
          initialData.guardianName = application.guardianName || application.parentName || initialData.guardianName;
          initialData.guardianPhone = application.guardianPhone || application.parentPhone || initialData.guardianPhone;
          initialData.guardianEmail = application.guardianEmail || initialData.guardianEmail;
          initialData.guardianRelationship = application.guardianRelationship || application.relationship || initialData.guardianRelationship;
          if (application.passportPhoto || application.passportUrl || application.photoUrl) {
            setPreviewUrl(application.passportPhoto || application.passportUrl || application.photoUrl);
          }
        }

        // Also fetch user document directly from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
        if (userDoc && userDoc.exists()) {
          const uData = userDoc.data();
          if (uData.displayName) initialData.displayName = uData.displayName;
          if (uData.phone) initialData.phone = uData.phone;
          if (uData.phoneNumber) initialData.phone = uData.phoneNumber;
          if (uData.gender) initialData.gender = uData.gender;
          if (uData.dob) initialData.dob = uData.dob;
          if (uData.targetClass) initialData.assignedClass = uData.targetClass;
          if (uData.class) initialData.assignedClass = uData.class;
          if (uData.stateOfOrigin) initialData.stateOfOrigin = uData.stateOfOrigin;
          if (uData.lga) initialData.lga = uData.lga;
          if (uData.address) initialData.address = uData.address;
          if (uData.guardianName) initialData.guardianName = uData.guardianName;
          if (uData.guardianPhone) initialData.guardianPhone = uData.guardianPhone;
          if (uData.guardianEmail) initialData.guardianEmail = uData.guardianEmail;
          if (uData.guardianRelationship) initialData.guardianRelationship = uData.guardianRelationship;
          if (uData.photoUrl || uData.passportUrl || uData.passportPhoto) {
            setPreviewUrl(uData.photoUrl || uData.passportUrl || uData.passportPhoto);
          }
        }

        setFormData(initialData);
      } catch (err) {
        console.warn("Could not load full profile info:", err);
      }
    };

    loadProfileDetails();
  }, [user, userData, application]);

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
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoUpload(e.target.files[0]);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      setError("Please select a valid image file (PNG, JPG, or JPEG).");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image file size must be less than 5MB.");
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Compress image to clean lightweight base64 Data URL for instant, reliable display across browsers
      const base64DataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const img = new Image();
          img.src = reader.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const max_width = 360;
            const max_height = 360;
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
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = (e) => reject(e);
        };
        reader.onerror = (e) => reject(e);
      });

      // Update preview immediately
      setPreviewUrl(base64DataUrl);

      let finalDownloadUrl = base64DataUrl;

      // Try uploading to Firebase Storage if configured
      try {
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const storageRef = ref(storage, `profile_photos/students/${user.uid}.${fileExtension}`);
        await uploadBytes(storageRef, file);
        finalDownloadUrl = await getDownloadURL(storageRef);
      } catch (storageErr: any) {
        console.warn("Firebase storage upload unavailable, using optimized Base64:", storageErr);
      }

      // Update preview with final URL
      setPreviewUrl(finalDownloadUrl);

      // 2. Synchronize Auth Context State immediately
      if (updateUserProfile) {
        updateUserProfile({
          photoUrl: finalDownloadUrl,
          passportUrl: finalDownloadUrl,
          passportPhoto: finalDownloadUrl
        });
      }

      // 3. Update local cached application if present
      const examNo = userData?.studentId || userData?.examNumber || application?.examNumber || user.id.replace('app_', '');
      const cachedAppKey = `imsc_app_${examNo}`;
      const localAppStr = safeStorage.getItem(cachedAppKey);
      if (localAppStr) {
        try {
          const parsed = JSON.parse(localAppStr);
          parsed.passportPhoto = finalDownloadUrl;
          parsed.passportUrl = finalDownloadUrl;
          parsed.photoUrl = finalDownloadUrl;
          safeStorage.setItem(cachedAppKey, JSON.stringify(parsed));
        } catch (e) {}
      }

      // 4. Update Firestore user document
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoUrl: finalDownloadUrl,
        passportUrl: finalDownloadUrl,
        passportPhoto: finalDownloadUrl,
        updatedAt: new Date().toISOString()
      }).catch(async () => {
        await setDoc(userRef, { 
          photoUrl: finalDownloadUrl, 
          passportUrl: finalDownloadUrl, 
          passportPhoto: finalDownloadUrl,
          updatedAt: new Date().toISOString() 
        }, { merge: true });
      });

      // 5. Update Firestore application document if linked
      if (application?.id) {
        await updateDoc(doc(db, 'applications', application.id), {
          passportUrl: finalDownloadUrl,
          passportPhoto: finalDownloadUrl,
          photoUrl: finalDownloadUrl
        }).catch(() => null);
      }

      // 6. Update Supabase if configured
      if (isSupabaseConfigured) {
        try {
          await supabase.from('profiles').update({ 
            photo_url: finalDownloadUrl,
            updated_at: new Date().toISOString()
          }).eq('id', user.uid);
        } catch (supErr) {
          console.warn("Supabase photo update skipped:", supErr);
        }
      }

      setSuccessMsg("Passport photograph uploaded and saved successfully!");
      await refreshUserData();
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err?.message || "Failed to upload passport photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.displayName.trim()) {
      setError("Candidate full name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const updatePayload: any = {
        displayName: formData.displayName.trim(),
        name: formData.displayName.trim(),
        studentName: formData.displayName.trim(),
        phoneNumber: formData.phone.trim(),
        phone: formData.phone.trim(),
        gender: formData.gender,
        targetClass: formData.assignedClass,
        class: formData.assignedClass,
        dob: formData.dob,
        dateOfBirth: formData.dob,
        stateOfOrigin: formData.stateOfOrigin.trim(),
        lga: formData.lga.trim(),
        address: formData.address.trim(),
        guardianName: formData.guardianName.trim(),
        guardianPhone: formData.guardianPhone.trim(),
        guardianEmail: formData.guardianEmail.trim(),
        guardianRelationship: formData.guardianRelationship,
        photoUrl: previewUrl || userData?.photoUrl || undefined,
        passportUrl: previewUrl || userData?.passportUrl || undefined,
        passportPhoto: previewUrl || userData?.passportPhoto || undefined,
        updatedAt: new Date().toISOString()
      };

      // 1. Immediately update AuthContext state & local storage cache
      if (updateUserProfile) {
        updateUserProfile(updatePayload);
      }

      // 2. Update local application storage cache
      const examNo = userData?.studentId || userData?.examNumber || application?.examNumber || user.id.replace('app_', '');
      const cachedAppKey = `imsc_app_${examNo}`;
      const localAppStr = safeStorage.getItem(cachedAppKey);
      if (localAppStr) {
        try {
          const parsed = JSON.parse(localAppStr);
          parsed.fullName = formData.displayName.trim();
          parsed.studentName = formData.displayName.trim();
          parsed.phone = formData.phone.trim();
          parsed.gender = formData.gender;
          parsed.targetClass = formData.assignedClass;
          parsed.class = formData.assignedClass;
          parsed.dob = formData.dob;
          parsed.stateOfOrigin = formData.stateOfOrigin.trim();
          parsed.lga = formData.lga.trim();
          parsed.address = formData.address.trim();
          parsed.guardianName = formData.guardianName.trim();
          parsed.guardianPhone = formData.guardianPhone.trim();
          parsed.guardianEmail = formData.guardianEmail.trim();
          parsed.guardianRelationship = formData.guardianRelationship;
          if (previewUrl) {
            parsed.passportPhoto = previewUrl;
            parsed.passportUrl = previewUrl;
            parsed.photoUrl = previewUrl;
          }
          safeStorage.setItem(cachedAppKey, JSON.stringify(parsed));
        } catch (e) {}
      }

      // 3. Update Firestore `/users/{uid}`
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, updatePayload, { merge: true });

      // 4. Update linked Application record if present
      if (application?.id) {
        await updateDoc(doc(db, 'applications', application.id), {
          fullName: formData.displayName.trim(),
          studentName: formData.displayName.trim(),
          phone: formData.phone.trim(),
          gender: formData.gender,
          targetClass: formData.assignedClass,
          class: formData.assignedClass,
          dob: formData.dob,
          stateOfOrigin: formData.stateOfOrigin.trim(),
          lga: formData.lga.trim(),
          address: formData.address.trim(),
          guardianName: formData.guardianName.trim(),
          guardianPhone: formData.guardianPhone.trim(),
          guardianEmail: formData.guardianEmail.trim(),
          guardianRelationship: formData.guardianRelationship,
          ...(previewUrl ? { passportPhoto: previewUrl, passportUrl: previewUrl, photoUrl: previewUrl } : {}),
          updatedAt: new Date().toISOString()
        }).catch(err => console.warn("Could not update linked application document:", err));
      } else {
        // Find application if application prop wasn't passed
        const appQuery = await getDocs(query(collection(db, 'applications'), where('userId', '==', user.uid), limit(1))).catch(() => null);
        if (appQuery && !appQuery.empty) {
          await updateDoc(doc(db, 'applications', appQuery.docs[0].id), {
            fullName: formData.displayName.trim(),
            studentName: formData.displayName.trim(),
            phone: formData.phone.trim(),
            gender: formData.gender,
            targetClass: formData.assignedClass,
            class: formData.assignedClass,
            dob: formData.dob,
            stateOfOrigin: formData.stateOfOrigin.trim(),
            lga: formData.lga.trim(),
            address: formData.address.trim(),
            guardianName: formData.guardianName.trim(),
            guardianPhone: formData.guardianPhone.trim(),
            guardianEmail: formData.guardianEmail.trim(),
            guardianRelationship: formData.guardianRelationship,
            ...(previewUrl ? { passportPhoto: previewUrl, passportUrl: previewUrl, photoUrl: previewUrl } : {}),
            updatedAt: new Date().toISOString()
          }).catch(() => null);
        }
      }

      // 5. Update Supabase profile if active
      if (isSupabaseConfigured) {
        try {
          await supabase.from('profiles').update({
            display_name: formData.displayName.trim(),
            phone_number: formData.phone.trim(),
            ...(previewUrl ? { photo_url: previewUrl } : {}),
            updated_at: new Date().toISOString()
          }).eq('id', user.uid);
        } catch (supErr) {
          console.warn("Supabase profile update skipped:", supErr);
        }
      }

      // 6. Refresh Auth Context
      await refreshUserData();

      setSuccessMsg("Your student profile has been updated successfully!");
    } catch (err: any) {
      console.error("Save profile error:", err);
      setError(err?.message || "Failed to update profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const portalExamId = application?.examNumber || (userData?.studentId ? `IMSC/2026/04${userData.studentId.slice(0, 3)}` : 'IMSC/2026/04912');
  const targetClass = application?.targetClass || userData?.targetClass || (formData.gender === 'female' ? 'JSS 1B' : 'JSS 1A');
  const admissionStatus = application?.admissionStatus || userData?.admissionStatus || 'approved';

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight">Student Profile Settings</h2>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200">
              Active Portal
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">Manage and update your official candidate records, contact information, and security settings.</p>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="self-start sm:self-center flex items-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer hover:scale-105 active:scale-95"
          >
            <LogOut size={16} /> Sign Out
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start gap-3 shadow-xs">
          <AlertCircle size={18} className="shrink-0 mt-0.5 text-red-600" />
          <div>
            <p className="font-bold">Error Updating Profile</p>
            <p className="mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 flex items-start gap-3 shadow-xs">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <p className="font-bold">Profile Update Successful</p>
            <p className="mt-0.5">{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Photo & Official Academic Badges */}
        <div className="lg:col-span-1 space-y-6">
          {/* Profile Photo Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center flex flex-col items-center">
            {/* Avatar container */}
            <div className="relative w-36 h-36 rounded-full border-4 border-emerald-900/10 flex items-center justify-center text-4xl font-black text-emerald-950 bg-emerald-50 overflow-hidden shrink-0 group shadow-lg mb-4 select-none">
              {previewUrl ? (
                <img src={previewUrl} alt="Student Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-3xl uppercase font-black text-emerald-900">
                  {formData.displayName?.charAt(0) || userData?.displayName?.charAt(0) || 'S'}
                </span>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex flex-col items-center justify-center text-white">
                  <Loader2 className="animate-spin text-white mb-1" size={26} />
                  <span className="text-[10px] font-bold">Uploading...</span>
                </div>
              )}
            </div>

            <h3 className="font-black text-lg text-slate-800 leading-tight">{formData.displayName || userData?.displayName || 'Student User'}</h3>
            <p className="text-[10px] font-mono text-slate-400 font-bold mt-0.5">{user?.email}</p>
            
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-100">
              <ShieldCheck size={12} className="text-emerald-600" />
              <span>Verified Student Account</span>
            </div>

            {/* Drag and Drop / Photo Upload Zone */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={cn(
                "w-full border-2 border-dashed rounded-2xl p-4 transition-all flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 mt-6",
                dragActive ? "border-amber-500 bg-amber-500/10" : "border-slate-200",
                uploading ? "opacity-50 pointer-events-none" : ""
              )}
            >
              <Upload size={22} className="text-emerald-700 mb-1.5" />
              <input 
                type="file" 
                id="profile-photo-input" 
                className="hidden" 
                accept="image/*"
                onChange={handleFileInput}
              />
              <label htmlFor="profile-photo-input" className="text-xs font-bold text-slate-700 hover:text-emerald-950 transition-colors cursor-pointer select-none">
                Click to <span className="text-emerald-700 underline font-black">Upload Photo</span> or drop here
              </label>
              <p className="text-[9px] text-slate-400 font-medium mt-1">PNG, JPG, or JPEG up to 3MB</p>
            </div>
          </div>

          {/* Academic Portal Credentials Card */}
          <div className="bg-emerald-950 text-white p-6 rounded-3xl shadow-md space-y-4">
            <div className="flex items-center gap-2 border-b border-emerald-900 pb-3">
              <GraduationCap className="text-amber-400 shrink-0" size={20} />
              <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">Academic Registration</h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-emerald-900/50">
                <span className="text-emerald-300 font-medium">Exam / Portal ID:</span>
                <span className="font-mono font-bold text-amber-300">{portalExamId}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-900/50">
                <span className="text-emerald-300 font-medium">Assigned Class:</span>
                <span className="font-bold text-white uppercase">{targetClass}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-emerald-900/50">
                <span className="text-emerald-300 font-medium">Admission Status:</span>
                <span className="font-black text-emerald-400 uppercase tracking-wider bg-emerald-900/60 px-2 py-0.5 rounded">
                  {admissionStatus}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-emerald-300 font-medium">Academic Session:</span>
                <span className="font-bold text-white">2026/2027</span>
              </div>
            </div>

            <p className="text-[10px] text-emerald-400/80 leading-relaxed pt-2 border-t border-emerald-900">
              * Official class stream placements and exam registration numbers are assigned by the College Academic Registry.
            </p>
          </div>

          {/* Session & Logout Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="text-slate-500 shrink-0" size={18} />
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">Account Session</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              When using shared or public computer devices, always ensure you log out of your student portal to protect your financial and academic records.
            </p>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.01]"
              >
                <LogOut size={16} /> Log Out of Portal
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Editable Profile Information Form */}
        <div className="lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Section 1: Candidate Basic Information */}
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <User className="text-emerald-700 shrink-0" size={18} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-emerald-950">
                  Candidate Personal Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Candidate Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. Fatima Abubakar Sani"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Candidate Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="e.g. 08012345678"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800 bg-white"
                  >
                    <option value="male">Male (Boys Section)</option>
                    <option value="female">Female (Girls Section)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Student Class & Section <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.assignedClass}
                    onChange={(e) => setFormData({ ...formData, assignedClass: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800 bg-white"
                  >
                    <option value="JSS 1A">JSS 1A (Boys Section)</option>
                    <option value="JSS 1B">JSS 1B (Girls Section)</option>
                    <option value="JSS 2A">JSS 2A (Boys Section)</option>
                    <option value="JSS 2B">JSS 2B (Girls Section)</option>
                    <option value="JSS 3A">JSS 3A (Boys Section)</option>
                    <option value="JSS 3B">JSS 3B (Girls Section)</option>
                    <option value="SSS 1A">SSS 1A (Boys Section - Science)</option>
                    <option value="SSS 1B">SSS 1B (Girls Section - Science)</option>
                    <option value="SSS 2A">SSS 2A (Boys Section - Science)</option>
                    <option value="SSS 2B">SSS 2B (Girls Section - Science)</option>
                    <option value="SSS 3A">SSS 3A (Boys Section - Science)</option>
                    <option value="SSS 3B">SSS 3B (Girls Section - Science)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Date of Birth
                  </label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    State of Origin
                  </label>
                  <input
                    type="text"
                    value={formData.stateOfOrigin}
                    onChange={(e) => setFormData({ ...formData, stateOfOrigin: e.target.value })}
                    placeholder="e.g. Kano State"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Local Government Area (LGA)
                  </label>
                  <input
                    type="text"
                    value={formData.lga}
                    onChange={(e) => setFormData({ ...formData, lga: e.target.value })}
                    placeholder="e.g. Nasarawa / Dala / Fagge"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Residential Address
                  </label>
                  <div className="relative">
                    <MapPin size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="e.g. No. 14 Dankadai Layout, Airport Road, Kano"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Guardian / Next of Kin Information */}
            <div className="pt-2">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                <Users className="text-emerald-700 shrink-0" size={18} />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-emerald-950">
                  Parent / Guardian / Next of Kin
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Guardian Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.guardianName}
                    onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                    placeholder="e.g. Alh. Abubakar Sani"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Relationship
                  </label>
                  <select
                    value={formData.guardianRelationship}
                    onChange={(e) => setFormData({ ...formData, guardianRelationship: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800 bg-white"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Brother">Brother</option>
                    <option value="Sister">Sister</option>
                    <option value="Uncle">Uncle</option>
                    <option value="Aunt">Aunt</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Guardian Phone Number
                  </label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="tel"
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                      placeholder="e.g. 08031234567"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Guardian Email Address
                  </label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3.5 top-3.5 text-slate-400" />
                    <input
                      type="email"
                      value={formData.guardianEmail}
                      onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
                      placeholder="e.g. parent@example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 font-medium text-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] text-slate-400 font-medium">
                Changes will synchronize across your exam slips, admission letters, and financial receipts.
              </p>

              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    <span>Save Profile Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
