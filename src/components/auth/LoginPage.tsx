import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GraduationCap, Mail, Lock, Loader2, ArrowLeft, Landmark, UserPlus, LogIn } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>((searchParams.get('mode') as any) === 'register' ? 'register' : 'login');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const getRedirectUrl = (defaultPath: string) => {
    const returnTo = searchParams.get('return-to');
    if (returnTo) {
      const searchCopy = new URLSearchParams(searchParams);
      searchCopy.delete('return-to');
      searchCopy.delete('mode');
      const searchStr = searchCopy.toString();
      return `/${returnTo}${searchStr ? '?' + searchStr : ''}`;
    }
    return defaultPath;
  };

  const [isForceMock, setIsForceMock] = useState(localStorage.getItem('imsc_force_mock_supabase') === 'true');
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [customUrl, setCustomUrl] = useState(localStorage.getItem('imsc_custom_supabase_url') || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem('imsc_custom_supabase_anon_key') || '');
  const [customPaystack, setCustomPaystack] = useState(localStorage.getItem('imsc_paystack_public_key') || '');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSaveCustomConfig = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanedUrl = customUrl.trim();
    while (cleanedUrl.endsWith('/')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }
    if (cleanedUrl.endsWith('/rest/v1')) {
      cleanedUrl = cleanedUrl.slice(0, -8);
    }
    while (cleanedUrl.endsWith('/')) {
      cleanedUrl = cleanedUrl.slice(0, -1);
    }
    if (cleanedUrl) {
      localStorage.setItem('imsc_custom_supabase_url', cleanedUrl);
    } else {
      localStorage.removeItem('imsc_custom_supabase_url');
    }

    if (customKey.trim()) {
      localStorage.setItem('imsc_custom_supabase_anon_key', customKey.trim());
    } else {
      localStorage.removeItem('imsc_custom_supabase_anon_key');
    }

    if (customPaystack.trim()) {
      localStorage.setItem('imsc_paystack_public_key', customPaystack.trim());
    } else {
      localStorage.removeItem('imsc_paystack_public_key');
    }

    localStorage.removeItem('imsc_force_mock_supabase');
    window.location.reload();
  };

  const toggleMockMode = () => {
    const newVal = !isForceMock;
    localStorage.setItem('imsc_force_mock_supabase', newVal ? 'true' : 'false');
    setIsForceMock(newVal);
    window.location.reload();
  };

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'register') setMode('register');
    else if (qMode === 'login') setMode('login');

    const sbUrl = searchParams.get('sb_url');
    const sbKey = searchParams.get('sb_key');
    if (sbUrl && sbKey) {
      let cleanedUrl = sbUrl.trim();
      while (cleanedUrl.endsWith('/')) {
        cleanedUrl = cleanedUrl.slice(0, -1);
      }
      if (cleanedUrl.endsWith('/rest/v1')) {
        cleanedUrl = cleanedUrl.slice(0, -8);
      }
      while (cleanedUrl.endsWith('/')) {
        cleanedUrl = cleanedUrl.slice(0, -1);
      }
      localStorage.setItem('imsc_custom_supabase_url', cleanedUrl);
      localStorage.setItem('imsc_custom_supabase_anon_key', sbKey.trim());
      localStorage.removeItem('imsc_force_mock_supabase');
      
      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('sb_url');
      newParams.delete('sb_key');
      const newSearch = newParams.toString();
      navigate(window.location.pathname + (newSearch ? '?' + newSearch : ''), { replace: true });
      window.location.reload();
    }
  }, [searchParams, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoadingStatus(mode === 'login' ? 'Verifying credentials...' : 'Creating secure user credentials...');

    try {
      if (mode === 'login') {
        const { data, error: authErr } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authErr) throw authErr;
        const user = data.user;
        
        setLoadingStatus('Retrieving user dashboard configuration...');
        let role = 'applicant';
        const cacheKey = `imsc_user_data_${user!.id}`;
        
        try {
          const { data: profile, error: dbErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user!.id)
            .single();

          if (profile && !dbErr) {
            role = profile.role || 'applicant';
            const userProfile = {
              role,
              displayName: profile.displayName || profile.display_name || email.split('@')[0],
              email: profile.email || email,
              studentId: profile.studentId || profile.student_id,
              teacherId: profile.teacherId || profile.teacher_id,
              photoUrl: profile.photoUrl || profile.photo_url,
              admissionStatus: profile.admissionStatus || profile.admission_status,
              targetClass: profile.targetClass || profile.target_class
            };
            localStorage.setItem(cacheKey, JSON.stringify(userProfile));
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
              displayName: displayName || email.split('@')[0] || 'New User',
              email,
              createdAt: new Date().toISOString()
            };
            
            await supabase.from('profiles').insert({
              id: user!.id,
              email: newProfile.email,
              role: newProfile.role,
              displayName: newProfile.displayName
            });
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

        if (role === 'admin') navigate(getRedirectUrl('/admin'));
        else if (role === 'teacher') navigate(getRedirectUrl('/teacher'));
        else if (role === 'student') navigate(getRedirectUrl('/student'));
        else if (role === 'applicant') navigate(getRedirectUrl('/admission'));
        else navigate(getRedirectUrl('/'));
      } else {
        let role = 'applicant';
        const userDisplayName = displayName || email.split('@')[0];
        
        const emailLower = email.toLowerCase();
        if (emailLower.includes('admin')) {
          role = 'admin';
        } else if (emailLower.includes('teacher')) {
          role = 'teacher';
        } else if (emailLower.includes('student')) {
          role = 'student';
        }

        const { data, error: registerErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              displayName: userDisplayName,
              role: role
            }
          }
        });

        if (registerErr) {
          const message = (registerErr.message || '').toLowerCase();
          if (message.includes('already-registered') || message.includes('already exists') || message.includes('use')) {
            setLoadingStatus('Email exists, signing in instead...');
            const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
              email,
              password
            });
            if (signInErr) throw registerErr; // report original signup err if fallback signin fails
            
            const user = signInData.user;
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
            if (profile) {
              role = profile.role || 'applicant';
              localStorage.setItem(`imsc_user_data_${user!.id}`, JSON.stringify(profile));
            }
          } else {
            throw registerErr;
          }
        } else if (data.user) {
          const user = data.user;
          setLoadingStatus('Completing profile setup...');
          
          const newProfile = {
            role,
            displayName: userDisplayName,
            email,
            createdAt: new Date().toISOString()
          };
          
          try {
            await supabase.from('profiles').insert({
              id: user.id,
              email,
              role,
              displayName: userDisplayName
            });
          } catch (writeErr) {
            console.warn("Could not save new user document online.", writeErr);
          }

          localStorage.setItem(`imsc_user_data_${user.id}`, JSON.stringify(newProfile));
        }

        setLoadingStatus('Navigating to portal dashboard...');
        if (role === 'admin') navigate(getRedirectUrl('/admin'));
        else if (role === 'teacher') navigate(getRedirectUrl('/teacher'));
        else if (role === 'student') navigate(getRedirectUrl('/student'));
        else if (role === 'applicant') navigate(getRedirectUrl('/admission'));
        else navigate(getRedirectUrl('/'));
      }
    } catch (err: any) {
      console.error(err);
      const message = (err?.message || '').toLowerCase();
      let msg = "Authentication failed. Please check your qualifications.";
      
      if (message.includes('already') || message.includes('exists') || message.includes('use')) {
        msg = "This email address is already registered. Please sign in instead.";
      } else if (message.includes('invalid') && message.includes('email')) {
        msg = "Please enter a valid email address.";
      } else if (message.includes('invalid') && message.includes('credential') || message.includes('password') || message.includes('not found')) {
        msg = "Incorrect email or password. Please verify your credentials and try again.";
      } else if (message.includes('weak') || message.includes('at least 6')) {
        msg = "Your password is too weak. Please choose a password with at least 6 characters.";
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
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: target.email,
        password: target.password
      });

      if (signInErr) {
        // If not found in mock/real, register it
        const { data: regData, error: regErr } = await supabase.auth.signUp({
          email: target.email,
          password: target.password,
          options: {
            data: {
              displayName: target.displayName,
              role
            }
          }
        });

        if (regErr) throw regErr;
        
        const user = regData.user;
        if (user) {
          const payload: any = {
            id: user.id,
            email: target.email,
            role,
            displayName: target.displayName,
            admission_status: (target as any).admissionStatus || 'pending'
          };
          if (role === 'teacher') payload.teacher_id = (target as any).teacherId;
          if (role === 'student') {
            payload.student_id = (target as any).studentId;
            payload.target_class = (target as any).targetClass;
          }

          await supabase.from('profiles').insert(payload);
          localStorage.setItem(`imsc_user_data_${user.id}`, JSON.stringify({
            role,
            displayName: target.displayName,
            email: target.email,
            studentId: (target as any).studentId,
            teacherId: (target as any).teacherId,
            admissionStatus: (target as any).admissionStatus,
            targetClass: (target as any).targetClass
          }));
        }
      } else if (data.user) {
        const user = data.user;
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        
        let targetProfile = profile;
        if (!profile) {
          const payload: any = {
            id: user.id,
            email: target.email,
            role,
            displayName: target.displayName,
            admission_status: (target as any).admissionStatus || 'pending'
          };
          if (role === 'teacher') payload.teacher_id = (target as any).teacherId;
          if (role === 'student') {
            payload.student_id = (target as any).studentId;
            payload.target_class = (target as any).targetClass;
          }
          await supabase.from('profiles').insert(payload);
          targetProfile = payload;
        }

        localStorage.setItem(`imsc_user_data_${user.id}`, JSON.stringify({
          role,
          displayName: targetProfile.displayName || targetProfile.display_name || target.displayName,
          email: target.email,
          studentId: targetProfile.studentId || targetProfile.student_id || (target as any).studentId,
          teacherId: targetProfile.teacherId || targetProfile.teacher_id || (target as any).teacherId,
          admissionStatus: targetProfile.admissionStatus || targetProfile.admission_status || (target as any).admissionStatus,
          targetClass: targetProfile.targetClass || targetProfile.target_class || (target as any).targetClass
        }));
      }

      // Re-route based on role
      if (role === 'admin') navigate(getRedirectUrl('/admin'));
      else if (role === 'teacher') navigate(getRedirectUrl('/teacher'));
      else if (role === 'student') navigate(getRedirectUrl('/student'));
      else if (role === 'applicant') navigate(getRedirectUrl('/admission'));
      else navigate(getRedirectUrl('/'));

    } catch (err: any) {
      console.error("Demo login error:", err);
      setError(err?.message || "Demo login activation failed. Please try again.");
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

          {/* Database Mode Control Banner */}
          <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider">Connection Mode</span>
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${isSupabaseConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                  {isSupabaseConfigured ? 'Live Supabase (Production)' : 'Simulated Table Sandbox'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigDetails(!showConfigDetails)}
                  className="px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-600 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-lg bg-white transition-all cursor-pointer"
                >
                  {showConfigDetails ? 'Hide Config' : 'Configure Custom DB'}
                </button>
                <button
                  type="button"
                  onClick={toggleMockMode}
                  className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider bg-emerald-900 border border-emerald-950 text-white hover:bg-emerald-950 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  {isSupabaseConfigured ? 'Use Local Mode' : 'Use Live Online'}
                </button>
              </div>
            </div>

            {!isSupabaseConfigured && (
              <div className="text-[11px] bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-250 leading-relaxed font-sans mt-2 space-y-1.5 text-left">
                <p className="font-bold flex items-center gap-1 text-[11.5px] text-amber-950">⚠️ Multi-Device Setup Note</p>
                <p>
                  Since you are on a new device, your custom Supabase database URL is not set in this browser's local storage memory.
                </p>
                <p className="text-[10px] text-amber-800 font-medium">
                  To connect your account, click <strong>"Configure Custom DB"</strong> to paste your URL & Anon Key, or use a shareable configuration setup link from your other device to connect instantly!
                </p>
              </div>
            )}

            {customUrl && customKey && (
              <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center flex-wrap gap-2">
                <span className="text-[10px] text-slate-500 font-medium">Sync with other devices:</span>
                <button
                  type="button"
                  onClick={() => {
                    const origin = window.location.origin + window.location.pathname;
                    const shareUrl = `${origin}?sb_url=${encodeURIComponent(customUrl)}&sb_key=${encodeURIComponent(customKey)}`;
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 3000);
                    });
                  }}
                  className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all cursor-pointer"
                >
                  {copiedLink ? '✅ Link Copied!' : '🔗 Copy Setup Link for Mobile/Other Devices'}
                </button>
              </div>
            )}

            {showConfigDetails && (
              <motion.form 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={handleSaveCustomConfig}
                className="pt-3 border-t border-slate-200/60 space-y-3 text-left"
              >
                <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                  If you are deploying to a custom domain (e.g., Netlify) and your live connection is yellow/orange, enter your project credentials here to connect this browser session directly:
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Supabase Project URL</label>
                    <input
                      type="url"
                      placeholder="https://your-project-id.supabase.co"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Supabase Anon Key</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">Paystack Public Key (Optional)</label>
                    <input
                      type="text"
                      placeholder="pk_live_..."
                      value={customPaystack}
                      onChange={(e) => setCustomPaystack(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono bg-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('imsc_custom_supabase_url');
                      localStorage.removeItem('imsc_custom_supabase_anon_key');
                      localStorage.removeItem('imsc_paystack_public_key');
                      setCustomUrl('');
                      setCustomKey('');
                      setCustomPaystack('');
                      window.location.reload();
                    }}
                    className="px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  >
                    Reset to Default
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg transition-colors shadow-sm cursor-pointer"
                  >
                    Save & Connect
                  </button>
                </div>
              </motion.form>
            )}
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-150 flex items-start gap-3 leading-relaxed">
                <div className="w-5 h-5 bg-red-100 text-red-700 rounded-full flex items-center justify-center shrink-0 font-black">!</div>
                <div className="flex-1 space-y-2">
                  <p className="font-bold">{error}</p>
                  
                  {error.toLowerCase().includes('rate limit') || error.toLowerCase().includes('too many') ? (
                    <div className="text-[11px] bg-red-100/50 p-2.5 rounded-lg border border-red-200 text-red-800 space-y-1.5 mt-2">
                      <p className="font-semibold text-[11px]">⚠️ Live Supabase Security/Rate Limit Enforced</p>
                      <p>Supabase limits email sign-ups per hour on the free tier to prevent bot registrations.</p>
                      <div className="pt-1.5 space-y-1">
                        <p className="font-bold text-[10.5px]">To disable or raise this in Supabase:</p>
                        <ul className="list-disc list-inside space-y-1 pl-1 text-[10px] text-red-700">
                          <li>Go to your <strong>Supabase Dashboard</strong> &rarr; <strong>Authentication</strong> &rarr; <strong>Rate Limits</strong>, and increase hourly limits (e.g. 100).</li>
                          <li>Go to <strong>Authentication</strong> &rarr; <strong>Providers</strong> &rarr; <strong>Email Provider</strong>, and toggle <strong>"Confirm Email"</strong> off to let users register and sign in instantly without waiting for verify links!</li>
                        </ul>
                      </div>
                      <div className="pt-2.5">
                        <button
                          type="button"
                          onClick={toggleMockMode}
                          className="w-full bg-emerald-900 border border-emerald-950 text-white rounded-lg px-3 py-2 font-bold uppercase tracking-wider text-[10px] hover:bg-emerald-950 transition-colors shadow-sm cursor-pointer"
                        >
                          ⚡ Switch to Local Sandbox & Continue Testing
                        </button>
                      </div>
                    </div>
                  ) : (
                    mode === 'login' && (
                      <p className="text-[10px] text-red-600 mt-1">If you are the admin/owner, use the <strong className="uppercase">Admin Sandbox Portal</strong> below to sign in instantly.</p>
                    )
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
              className="w-full btn-primary py-3.5 flex flex-col items-center justify-center gap-1 text-base shadow-lg shadow-emerald-900/10 cursor-pointer"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-1 py-0.5">
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin text-amber-400" size={18} />
                    <span className="font-bold text-sm">Please Wait...</span>
                  </div>
                  <span className="text-[10px] text-emerald-100 font-sans tracking-wide font-normal">{loadingStatus || 'Processing...'}</span>
                </div>
              ) : (
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
                <h4 className="text-[10px] font-black text-emerald-950 uppercase tracking-widest">Admin Sandbox Portal</h4>
                <span className="text-[9px] text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full font-serif font-extrabold uppercase border border-amber-200/50">Auto-Provisioning</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed font-medium">
                Click the button below to sign in as the administrator. If the account does not exist inside your Firebase setup, the app will instantly register and seed the profile documents dynamically.
              </p>
              
              <div>
                <button
                  type="button"
                  onClick={() => triggerDemoAccess('admin')}
                  disabled={loading}
                  className="w-full p-3.5 bg-emerald-950/5 hover:bg-emerald-950/10 text-emerald-950 rounded-xl hover:border-emerald-300 transition-all text-left border border-emerald-950/5 group relative cursor-pointer"
                >
                  <p className="text-[11px] sm:text-xs font-black uppercase tracking-tight leading-none text-emerald-950 mb-1.5">Admin & Owner Portal</p>
                  <p className="text-[10px] text-slate-500 font-medium font-mono leading-none">admin@imsc.edu</p>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

