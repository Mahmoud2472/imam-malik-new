import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Mail, Lock, Loader2, ArrowLeft, Landmark, UserPlus, LogIn } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>((searchParams.get('mode') as any) === 'register' ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'register') setMode('register');
    else if (qMode === 'login') setMode('login');
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        let role = 'applicant';
        const cacheKey = `imsc_user_data_${user.uid}`;
        
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            role = data?.role || 'applicant';
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } else {
            const emailLower = email.toLowerCase();
            if (emailLower.includes('admin')) {
              role = 'admin';
            } else if (emailLower.includes('teacher')) {
              role = 'teacher';
            } else if (emailLower.includes('student')) {
              role = 'student';
            }
            
            const newProfile = {
              role,
              displayName: user?.displayName || email.split('@')[0] || 'New User',
              email,
              createdAt: new Date().toISOString()
            };
            
            await setDoc(docRef, newProfile);
            localStorage.setItem(cacheKey, JSON.stringify(newProfile));
          }
        } catch (dbErr) {
          console.warn("Could not fetch user document online during login. Falling back to local cache or credentials prediction.", dbErr);
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              role = cachedData.role || 'applicant';
            } catch (e) {
              // ignore
            }
          } else {
            const emailLower = email.toLowerCase();
            if (emailLower.includes('admin')) {
              role = 'admin';
            } else if (emailLower.includes('teacher')) {
              role = 'teacher';
            } else if (emailLower.includes('student')) {
              role = 'student';
            }
          }
        }

        if (role === 'admin') navigate('/admin');
        else if (role === 'teacher') navigate('/teacher');
        else if (role === 'student') navigate('/student');
        else if (role === 'applicant') navigate('/admission');
        else navigate('/');
      } else {
        let user;
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          user = userCredential.user;
          await updateProfile(user, { displayName: displayName || email.split('@')[0] });
          
          const newProfile = {
            role: 'applicant',
            displayName: displayName || email.split('@')[0],
            email,
            createdAt: new Date().toISOString()
          };
          
          try {
            await setDoc(doc(db, "users", user.uid), newProfile);
          } catch (writeErr) {
            console.warn("Could not save new user document online. Storing locally for now.", writeErr);
          }
          localStorage.setItem(`imsc_user_data_${user.uid}`, JSON.stringify(newProfile));
        } catch (regErr: any) {
          const code = (regErr?.code || '').toLowerCase();
          const message = (regErr?.message || '').toLowerCase();
          if (code.includes('email-already-in-use') || message.includes('email-already-in-use')) {
            try {
              // Seamless login fallback if password is correct
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              user = userCredential.user;
            } catch (signInErr: any) {
              throw regErr;
            }
          } else {
            throw regErr;
          }
        }
        
        let role = 'applicant';
        const cacheKey = `imsc_user_data_${user.uid}`;
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            role = data?.role || 'applicant';
            localStorage.setItem(cacheKey, JSON.stringify(data));
          } else {
            const newProfile = {
              role: 'applicant',
              displayName: user.displayName || displayName || email.split('@')[0],
              email,
              createdAt: new Date().toISOString()
            };
            await setDoc(docRef, newProfile);
            localStorage.setItem(cacheKey, JSON.stringify(newProfile));
          }
        } catch (dbErr) {
          console.warn("Could not fetch user document details online after registration.", dbErr);
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            try {
              const cachedData = JSON.parse(cached);
              role = cachedData.role || 'applicant';
            } catch (e) {
              // ignore
            }
          }
        }
        
        if (role === 'admin') navigate('/admin');
        else if (role === 'teacher') navigate('/teacher');
        else if (role === 'student') navigate('/student');
        else if (role === 'applicant') navigate('/admission');
        else navigate('/');
      }
    } catch (err: any) {
      console.error(err);
      const code = (err?.code || '').toLowerCase();
      const message = (err?.message || '').toLowerCase();
      let msg = "Authentication failed. Please check your credentials.";
      
      if (code.includes('email-already-in-use') || message.includes('email-already-in-use')) {
        msg = "This email address is already registered. Please sign in instead.";
      } else if (code.includes('invalid-email') || message.includes('invalid-email')) {
        msg = "Please enter a valid email address.";
      } else if (
        code.includes('user-not-found') || message.includes('user-not-found') || 
        code.includes('wrong-password') || message.includes('wrong-password') || 
        code.includes('invalid-credential') || message.includes('invalid-credential')
      ) {
        msg = "Incorrect email or password. Please verify your credentials and try again.";
      } else if (code.includes('weak-password') || message.includes('weak-password')) {
        msg = "Your password is too weak. Please choose a password with at least 6 characters.";
      } else if (code.includes('network-request-failed') || message.includes('network-request-failed')) {
        msg = "Network connection issue. Please check your internet connection.";
      } else if (code.includes('too-many-requests') || message.includes('too-many-requests')) {
        msg = "Too many failed attempts. This account has been temporarily locked. Please try again soon.";
      } else {
        msg = err.message || msg;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const triggerDemoAccess = async (role: 'admin' | 'teacher' | 'student' | 'applicant') => {
    setLoading(true);
    setError(null);

    const demoCreds = {
      admin: { email: 'admin@imsc.edu', password: 'admin123', displayName: 'Admin Registrar' },
      teacher: { email: 'teacher@imsc.edu', password: 'teacher123', displayName: 'Mallam Ibrahim', teacherId: 'TCH922' },
      student: { email: 'student@imsc.edu', password: 'student123', displayName: 'Balarabe Musa', studentId: 'STU405', admissionStatus: 'approved', targetClass: 'SS 2' },
      applicant: { email: 'applicant@imsc.edu', password: 'applicant123', displayName: 'Zainab Umar' }
    };

    const target = demoCreds[role];

    try {
      // 1. Try to sign in
      try {
        const userCredential = await signInWithEmailAndPassword(auth, target.email, target.password);
        const user = userCredential.user;
        
        // Ensure user record exists in Firestore. If missing, make it.
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (!docSnap.exists()) {
          const payload: any = {
            role,
            displayName: target.displayName,
            email: target.email,
            createdAt: new Date().toISOString()
          };
          if (role === 'teacher') payload.teacherId = (target as any).teacherId;
          if (role === 'student') {
            payload.studentId = (target as any).studentId;
            payload.admissionStatus = (target as any).admissionStatus;
            payload.targetClass = (target as any).targetClass;
          }
          await setDoc(doc(db, "users", user.uid), payload);
        }
      } catch (signInErr: any) {
        // If not found, create it dynamically (case-insensitive checks)
        const code = (signInErr?.code || '').toLowerCase();
        const msg = (signInErr?.message || '').toLowerCase();
        
        if (
          code.includes('user-not-found') || msg.includes('user-not-found') ||
          code.includes('invalid-credential') || msg.includes('invalid-credential') ||
          code.includes('wrong-password') || msg.includes('wrong-password') ||
          code.includes('user-disabled') || msg.includes('user-disabled')
        ) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, target.email, target.password);
            const user = userCredential.user;
            await updateProfile(user, { displayName: target.displayName });

            const payload: any = {
              role,
              displayName: target.displayName,
              email: target.email,
              createdAt: new Date().toISOString()
            };
            if (role === 'teacher') payload.teacherId = (target as any).teacherId;
            if (role === 'student') {
              payload.studentId = (target as any).studentId;
              payload.admissionStatus = (target as any).admissionStatus;
              payload.targetClass = (target as any).targetClass;
            }
            await setDoc(doc(db, "users", user.uid), payload);
          } catch (createErr: any) {
            const createCode = (createErr?.code || '').toLowerCase();
            const createMsg = (createErr?.message || '').toLowerCase();
            if (createCode.includes('email-already-in-use') || createMsg.includes('email-already-in-use')) {
              // Simply sign in again or report password discrepancy
              throw new Error("This demo email is already registered with a customized password. Please use the manual signup form to register your own account.");
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      // Re-route based on role
      if (role === 'admin') navigate('/admin');
      else if (role === 'teacher') navigate('/teacher');
      else if (role === 'student') navigate('/student');
      else if (role === 'applicant') navigate('/admission');
      else navigate('/');

    } catch (err: any) {
      console.error("Demo login error:", err);
      const isIncorrectCred = (err?.code || '').toLowerCase().includes('invalid-credential') || 
                              (err?.message || '').toLowerCase().includes('invalid-credential') ||
                              (err?.code || '').toLowerCase().includes('wrong-password') || 
                              (err?.message || '').toLowerCase().includes('wrong-password');
      
      if (isIncorrectCred) {
        setError("Unable to sign in with demo credentials. If you altered this demo user's password, please sign in with your updated credentials or register a free applicant account.");
      } else {
        setError(err?.message || "Demo login activation failed. Please try again or register a custom account.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Pane - Branding */}
      <div className="hidden lg:flex flex-col justify-between school-gradient p-12 text-white relative overflow-hidden">
        <div className="relative z-10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-emerald-100 hover:text-white transition-colors mb-12 animate-pulse">
            <ArrowLeft size={18} /> Back to Website
          </button>
          <div className="flex items-center gap-3 mb-4">
            <Landmark className="text-amber-400" size={40} />
            <h1 className="text-3xl font-black tracking-tight uppercase">Imam Malik College</h1>
          </div>
          <p className="text-emerald-100/60 max-w-sm">Access your portal to manage your academic records, fees, and more.</p>
        </div>

        <div className="relative z-10 glass-card p-8 bg-white/5 border-white/10 scale-90 -ml-10">
          <p className="italic text-emerald-100 text-lg mb-4">"The best of you are those who learn the Quran and teach it."</p>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500">— Prophet Muhammad (PBUH)</p>
        </div>

        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] -mr-64 -mt-64" />
      </div>

      {/* Right Pane - Form */}
      <div className="flex flex-col items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md py-8">
          <div className="mb-8 text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-6">
              <div className="p-3 bg-emerald-900 rounded-2xl">
                <Landmark size={32} className="text-amber-400" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-emerald-950 mb-2">
              {mode === 'login' ? 'Welcome Back' : 'Create Applicant Account'}
            </h2>
            <p className="text-slate-500 text-sm">
              {mode === 'login' ? 'Please enter your credentials to log in.' : 'Register to start your admission journey.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-150 flex items-start gap-3 leading-relaxed">
                <div className="w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center shrink-0 font-black">!</div>
                <div className="flex-1">
                  <p className="font-bold">{error}</p>
                  {mode === 'login' && (
                    <p className="text-[10px] text-red-600 mt-1">If you don't have a personal account, use the <strong className="uppercase">Sandbox Demo Portals</strong> below to sign in instantly.</p>
                  )}
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="name@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs py-1">
                <label className="flex items-center gap-2 text-slate-500 cursor-pointer">
                  <input type="checkbox" className="rounded border-slate-300 text-emerald-950 focus:ring-emerald-950" /> Remember Me
                </label>
                <a href="#" className="text-emerald-950 font-bold hover:underline">Forgot password?</a>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 text-base shadow-lg shadow-emerald-900/10 cursor-pointer"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                mode === 'login' ? <><LogIn size={18} /> Sign In to Portal</> : <><UserPlus size={18} /> Create Account</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 mb-3 font-medium">
              {mode === 'login' ? "Looking to apply for admission?" : "Already have an account?"}
            </p>
            <button 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
              className="px-6 py-2 border border-emerald-900 text-emerald-900 text-xs font-black rounded-xl hover:bg-emerald-50 transition-colors uppercase tracking-wider cursor-pointer"
            >
              {mode === 'login' ? 'Apply for Admission' : 'Sign In instead'}
            </button>
          </div>

          {/* Sandbox Demo Access Portals Row */}
          {mode === 'login' && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex justify-between items-center mb-2.5">
                <h4 className="text-[10px] font-black text-emerald-950 uppercase tracking-widest">Sandbox Demo Access Portals</h4>
                <span className="text-[9px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-serif font-extrabold uppercase border border-amber-200/50">Auto-Provisioning</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
                Click any role portal button to sign in. If the account does not exist inside your Firebase setup, the app will instantly register and seed the profile documents dynamically.
              </p>
              
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => triggerDemoAccess('admin')}
                  disabled={loading}
                  className="p-3 bg-emerald-950/5 hover:bg-emerald-950/10 text-emerald-950 rounded-xl hover:border-emerald-300 transition-all text-left border border-emerald-950/5 group relative cursor-pointer"
                >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-tight leading-none text-emerald-950 mb-0.5">Admin Portal</p>
                  <p className="text-[9px] text-slate-500 font-medium font-mono leading-none">admin@imsc.edu</p>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDemoAccess('teacher')}
                  disabled={loading}
                  className="p-3 bg-emerald-950/5 hover:bg-emerald-950/10 text-emerald-950 rounded-xl hover:border-emerald-300 transition-all text-left border border-emerald-950/5 group relative cursor-pointer"
                >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-tight leading-none text-emerald-950 mb-0.5">Teacher Portal</p>
                  <p className="text-[9px] text-slate-500 font-medium font-mono leading-none">teacher@imsc.edu</p>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDemoAccess('student')}
                  disabled={loading}
                  className="p-3 bg-emerald-950/5 hover:bg-emerald-950/10 text-emerald-950 rounded-xl hover:border-emerald-300 transition-all text-left border border-emerald-950/5 group relative cursor-pointer"
                >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-tight leading-none text-emerald-950 mb-0.5">Student Portal</p>
                  <p className="text-[9px] text-slate-500 font-medium font-mono leading-none">student@imsc.edu</p>
                </button>

                <button
                  type="button"
                  onClick={() => triggerDemoAccess('applicant')}
                  disabled={loading}
                  className="p-3 bg-emerald-950/5 hover:bg-emerald-950/10 text-emerald-950 rounded-xl hover:border-emerald-300 transition-all text-left border border-emerald-950/5 group relative cursor-pointer"
                >
                  <p className="text-[10px] sm:text-xs font-black uppercase tracking-tight leading-none text-emerald-950 mb-0.5">Applicant Portal</p>
                  <p className="text-[9px] text-slate-500 font-medium font-mono leading-none">applicant@imsc.edu</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

