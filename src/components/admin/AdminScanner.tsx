import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  collection, doc, getDoc, updateDoc, query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  QrCode, Camera, AlertCircle, CheckCircle2, Loader2, X, RefreshCw, 
  Phone, Mail, User, BookOpen, Check, Sparkles, CreditCard, ExternalLink, HelpCircle
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminScanner() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  
  // Scanned / Lookup states
  const [verifiedDoc, setVerifiedDoc] = useState<any>(null);
  const [docType, setDocType] = useState<'application' | 'user' | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Audio Synthesizer Beep for instant physical feedback
  const playBeep = (type: 'success' | 'error' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'success') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note (clear validation sound)
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
        oscillator.stop(audioCtx.currentTime + 0.15);
      } else {
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(180, audioCtx.currentTime); // Low buzz for error/not found
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
        oscillator.stop(audioCtx.currentTime + 0.35);
      }
    } catch (err) {
      console.warn("Audio Context beep failed:", err);
    }
  };

  // Load Classes definition
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const snap = await getDocs(collection(db, "classes"));
        setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Classes load error:", err);
      }
    };
    fetchClasses();
  }, []);

  // Request cameras list on load
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then(devices => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back camera if available (typically has "back" or "rear" in labels)
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch(err => {
        console.warn("Error enumerating cameras:", err);
      });

    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    setError(null);
    setNotFound(false);
    setVerifiedDoc(null);
    setLoading(true);

    try {
      // Ensure any existing instance is cleaned up
      if (html5QrCodeRef.current) {
        await stopScanning();
      }

      const html5QrCode = new Html5Qrcode("qr-scanner-viewport");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: (width: number, height: number) => {
          const size = Math.min(width, height) * 0.7;
          return { width: size, height: size };
        }
      };

      // Start camera streaming
      await html5QrCode.start(
        selectedCameraId ? { deviceId: { exact: selectedCameraId } } : { facingMode: "environment" },
        config,
        (decodedText) => {
          // Success callback
          handleScannedData(decodedText);
        },
        () => {
          // Verbose frame failure callback (ignored to avoid spam)
        }
      );
      setScanning(true);
    } catch (err: any) {
      console.error("Failed to start scanner:", err);
      setError(err?.message || "Could not gain permission or find any video feed stream.");
    } finally {
      setLoading(false);
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current = null;
      } catch (err) {
        console.error("Error stopping scanner instance:", err);
      }
    }
    setScanning(false);
  };

  const handleScannedData = async (data: string) => {
    await stopScanning(); // Pause scanning instantly upon scan match
    playBeep('success');

    // Parse scanned code ID
    let finalId = data;
    if (data.startsWith('VERIFY-IMSC-')) {
      finalId = data.replace('VERIFY-IMSC-', '');
    }

    lookupRecord(finalId);
  };

  const lookupRecord = async (idToQuery: string) => {
    if (!idToQuery.trim()) return;
    setSearching(true);
    setNotFound(false);
    setVerifiedDoc(null);
    setDocType(null);
    setSuccessMsg(null);

    const cleanId = idToQuery.trim();

    try {
      // 1. Try fetching as direct Application ID
      const appRef = doc(db, 'applications', cleanId);
      const appSnap = await getDoc(appRef);

      if (appSnap.exists()) {
        setVerifiedDoc({ id: appSnap.id, ...appSnap.data() });
        setDocType('application');
        setSearching(false);
        return;
      }

      // 2. Try looking up in applications where transactionId matches cleanId, or studentId search
      const appsQuery = query(collection(db, 'applications'), where('transactionId', '==', cleanId));
      const appsSnap = await getDocs(appsQuery);
      if (!appsSnap.empty) {
        const firstDoc = appsSnap.docs[0];
        setVerifiedDoc({ id: firstDoc.id, ...firstDoc.data() });
        setDocType('application');
        setSearching(false);
        return;
      }

      // 3. Try looking up in users collection by id or studentId
      const userRef = doc(db, 'users', cleanId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setVerifiedDoc({ id: userSnap.id, ...userSnap.data() });
        setDocType('user');
        setSearching(false);
        return;
      }

      // 4. Try looking up users collection by custom studentId query
      const userQuery = query(collection(db, 'users'), where('studentId', '==', cleanId));
      const usersSnap = await getDocs(userQuery);
      if (!usersSnap.empty) {
        const firstDoc = usersSnap.docs[0];
        setVerifiedDoc({ id: firstDoc.id, ...firstDoc.data() });
        setDocType('user');
        setSearching(false);
        return;
      }

      // Not found anywhere
      playBeep('error');
      setNotFound(true);
    } catch (err: any) {
      console.error("Lookup error:", err);
      setError("An database query failure occurred: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const approveScannedApplication = async () => {
    if (!verifiedDoc || docType !== 'application') return;
    if (!window.confirm(`Are you sure you want to approve scanned applicant ${verifiedDoc.firstName} ${verifiedDoc.lastName}?`)) return;

    setLoading(true);
    try {
      // 1. Update Application Status
      await updateDoc(doc(db, "applications", verifiedDoc.id), { 
        status: 'approved',
        approvedDate: serverTimestamp() 
      });

      // 2. Update User records accordingly
      if (verifiedDoc.userId) {
        const userRef = doc(db, "users", verifiedDoc.userId);
        await updateDoc(userRef, { 
          admissionStatus: 'approved',
          targetClass: verifiedDoc.targetClassId,
          role: 'student' 
        });
      }

      setSuccessMsg("Application Approved & Admitted successfully!");
      // reload details
      await lookupRecord(verifiedDoc.id);
    } catch (err: any) {
      console.error("Error approving scanned doc:", err);
      setError("Failed to approve application: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || classId || 'N/A';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-left animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-emerald-950 uppercase tracking-tight flex items-center gap-2">
            <QrCode className="text-amber-500" size={28} /> Instant QR Registry Scanner
          </h2>
          <p className="text-xs text-slate-500 font-medium">Verify credentials, admissions logs, or receipt authenticity using camera scans or manual search lookup.</p>
        </div>
        <div className="flex gap-2">
          {scanning ? (
            <button 
              onClick={stopScanning}
              className="px-5 py-2.5 bg-red-650 hover:bg-red-750 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 uppercase tracking-wider cursor-pointer"
            >
              <X size={15} /> Stop Camera
            </button>
          ) : (
            <button 
              onClick={startScanning}
              className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-850 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 uppercase tracking-wider cursor-pointer"
            >
              <Camera size={15} /> Start Camera Scanner
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Scanner Device + Input */}
        <div className="lg:col-span-5 space-y-6">
          {/* Scanner frame */}
          <div className="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col justify-between min-h-[420px] relative overflow-hidden">
            {/* Glossy overlay background grid scanline */}
            <div className="absolute inset-0 bg-radial-gradient from-transparent to-slate-950/40 pointer-events-none" />

            {/* Device Configuration */}
            <div className="z-10 bg-slate-950/60 p-3 rounded-2xl border border-white/5 mb-4 flex flex-col gap-2">
              <label className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest block">Available Cameras</label>
              <div className="flex gap-2">
                <select 
                  value={selectedCameraId}
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value);
                    if (scanning) {
                      // Restart scanning with new camera input
                      setTimeout(() => startScanning(), 100);
                    }
                  }}
                  className="bg-slate-900 text-white text-xs font-bold p-2.5 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-500 flex-grow"
                  disabled={cameras.length === 0}
                >
                  {cameras.length > 0 ? (
                    cameras.map((cam) => (
                      <option key={cam.id} value={cam.id}>{cam.label || `Camera ${cameras.indexOf(cam) + 1}`}</option>
                    ))
                  ) : (
                    <option>No cameras found</option>
                  )}
                </select>
                <button 
                  onClick={() => {
                    Html5Qrcode.getCameras().then(devices => {
                      if (devices && devices.length > 0) {
                        setCameras(devices);
                        if (!selectedCameraId) setSelectedCameraId(devices[0].id);
                      }
                    });
                  }}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border border-slate-700 transition"
                  title="Reload Camera sources"
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="flex-grow flex items-center justify-center relative min-h-[220px] rounded-2xl bg-black border border-slate-800 overflow-hidden">
              {/* Dynamic canvas container */}
              <div id="qr-scanner-viewport" className="w-full h-full absolute inset-0 [&>video]:object-cover" />

              {!scanning && !loading && (
                <div className="text-center p-6 z-10 space-y-4">
                  <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center border border-slate-700 mx-auto">
                    <QrCode className="text-slate-400 animate-pulse" size={28} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Camera is Offline</p>
                    <p className="text-[10px] text-slate-500 max-w-xs mx-auto">To perform quick physical validation, activate your device camera via the button above.</p>
                  </div>
                </div>
              )}

              {loading && (
                <div className="z-10 flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-amber-500" size={32} />
                  <p className="text-xs font-bold tracking-wider text-slate-400 uppercase">Activating sensor stream...</p>
                </div>
              )}

              {scanning && (
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center z-10 w-full">
                  <div className="w-48 h-48 border-2 border-dashed border-amber-500/80 rounded-2xl relative">
                    <div className="absolute inset-x-0 h-0.5 bg-amber-500/80 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-[scan_2s_infinite]" />
                  </div>
                  <p className="text-[9px] text-amber-500 font-extrabold uppercase mt-4 tracking-widest bg-slate-950/80 px-2.5 py-1 rounded-full border border-amber-600/30">Active Scan Field</p>
                </div>
              )}
            </div>

            {/* Dynamic Status message under box */}
            <div className="z-10 mt-4 text-[11px] text-slate-400 font-medium text-center">
              Scan QR code printed directly in Admission slip outputs.
            </div>
          </div>

          {/* Manual Input Search fallback */}
          <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-emerald-950 uppercase tracking-widest flex items-center gap-1.5">
              <HelpCircle className="text-slate-400" size={16} /> Manual Verification Fallback
            </h4>
            <div className="flex gap-2">
              <input 
                type="text"
                placeholder="Ex ID: jY2ks9PlzX or application doc ID"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') lookupRecord(manualInput);
                }}
                className="input-field text-sm font-semibold tracking-wide placeholder:font-normal placeholder:text-slate-400"
              />
              <button 
                onClick={() => lookupRecord(manualInput)}
                disabled={searching || !manualInput.trim()}
                className="px-4 bg-emerald-900 text-white rounded-xl text-xs font-bold hover:bg-emerald-850 disabled:bg-slate-200 disabled:text-slate-400 transition"
              >
                {searching ? <Loader2 className="animate-spin" size={16} /> : "Query"}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Verify documents instantly if camera access is unavailable on this computer terminal.</p>
          </div>
        </div>

        {/* Right Side: Verification Details Output */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {/* Clear feedback for pending / error */}
            {!verifiedDoc && !searching && !notFound && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center h-full flex flex-col items-center justify-center space-y-4 min-h-[480px]"
              >
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-300">
                  <QrCode size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-800">Scan Or Query Registry File</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">Please point the camera at any official admission barcode or input an Application ID to load immediate validation data.</p>
                </div>
              </motion.div>
            )}

            {/* Searching state */}
            {searching && (
              <motion.div 
                key="loading-details"
                className="bg-white p-12 rounded-3xl border border-slate-100 shadow-sm text-center h-full flex flex-col items-center justify-center space-y-4 min-h-[480px]"
              >
                <Loader2 className="animate-spin text-emerald-900" size={32} />
                <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Retrieving cloud records...</p>
              </motion.div>
            )}

            {/* Error notifications */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 flex items-start gap-2 max-w-full my-4">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
                <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full"><X size={14} /></button>
              </div>
            )}

            {/* Document Scanned but Not Found */}
            {notFound && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-12 rounded-3xl border border-red-50 shadow-sm text-center h-full flex flex-col items-center justify-center space-y-6 min-h-[480px]"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center border border-red-100">
                  <AlertCircle size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-black uppercase text-red-950">Record Verification Failed</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                    The scanned Application ID or user profile database registry does not exist inside Imam Malik College servers.
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 font-serif p-2 bg-slate-50 rounded-xl max-w-xs border">
                  Verify the code matches standard formats: Ex ID <span className="font-mono">zZpA49LmXy</span>
                </div>
              </motion.div>
            )}

            {/* SUCCESSFUL VERIFIED RECORD DECK */}
            {verifiedDoc && !searching && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl border border-slate-150 shadow-sm overflow-hidden"
              >
                {/* Visual authenticity tag banner */}
                <div className="bg-emerald-950 text-white p-6 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-900 border border-emerald-800 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="text-amber-500" size={24} />
                    </div>
                    <div>
                      <span className="text-[9px] text-amber-500 font-extrabold uppercase tracking-widest block">AUTHENTICATION DECK</span>
                      <h3 className="text-sm font-bold tracking-tight uppercase">Registry Records Verified</h3>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[9px] bg-amber-500 text-emerald-950 font-black uppercase tracking-wider">
                    {docType === 'application' ? 'Provisional Admission' : 'Active Account Profile'}
                  </span>
                </div>

                <div className="p-8 space-y-8">
                  {/* Bio summary block */}
                  <div className="flex flex-col sm:flex-row gap-6 items-center border-b border-slate-100 pb-6">
                    {/* Passport */}
                    <div className="w-24 h-28 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center overflow-hidden shrink-0 select-none shadow-sm">
                      {verifiedDoc.passportPhoto || verifiedDoc.photoUrl ? (
                        <img src={verifiedDoc.passportPhoto || verifiedDoc.photoUrl} alt="Verified face ID" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center p-3">
                          <User className="text-slate-300 mx-auto" size={24} />
                          <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest block mt-1">NO PHOTO</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow space-y-2 text-center sm:text-left">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">NAME</span>
                        <h4 className="text-xl font-bold text-slate-800 leading-none">
                          {verifiedDoc.firstName ? `${verifiedDoc.firstName} ${verifiedDoc.lastName}` : (verifiedDoc.displayName || 'Unnamed User')}
                        </h4>
                      </div>

                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-full">
                          {docType === 'application' ? 'Application Record' : 'User Record'}
                        </span>
                        <span className={cn(
                          "px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full tracking-wider border",
                          verifiedDoc.status === 'approved' || verifiedDoc.admissionStatus === 'approved' || verifiedDoc.role === 'admin'
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                            : "bg-amber-50 text-amber-600 border-amber-100"
                        )}>
                          Status: {verifiedDoc.status || verifiedDoc.admissionStatus || verifiedDoc.role || 'pending'}
                        </span>
                      </div>
                    </div>

                    {/* QR and database ID details */}
                    <div className="text-center sm:text-right bg-slate-50/65 py-2 px-4 rounded-xl border max-w-[200px]">
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest block">REGISTRY GUID</span>
                      <span className="text-[10px] font-mono font-bold text-slate-800 select-all">{verifiedDoc.id}</span>
                    </div>
                  </div>

                  {/* Actions alert block */}
                  {successMsg && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs text-emerald-700 flex items-start gap-2">
                      <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* Comprehensive Data grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                        <Mail size={12} /> Contact Email
                      </span>
                      <span className="text-xs font-bold text-slate-700 block select-all">{verifiedDoc.email || 'N/A'}</span>
                    </div>

                    {docType === 'application' ? (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                            <BookOpen size={12} /> Registered Target Class
                          </span>
                          <span className="text-xs font-bold text-slate-700 block uppercase">
                            {getClassName(verifiedDoc.targetClassId)}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                            <CreditCard size={12} /> Application Fee status
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "inline-block w-2.5 h-2.5 rounded-full shrink-0",
                              verifiedDoc.paymentStatus === 'verified' ? "bg-emerald-500" : "bg-amber-500"
                            )} />
                            <span className="text-xs font-bold uppercase text-slate-700 leading-none">
                              {verifiedDoc.paymentStatus || 'pending'} 
                              {verifiedDoc.amount && ` (${formatCurrency(verifiedDoc.amount)})`}
                            </span>
                          </div>
                          {verifiedDoc.transactionId && (
                            <span className="text-[9px] text-slate-400 font-mono block mt-1">TXID: {verifiedDoc.transactionId}</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                            <User size={12} /> Parent/Guardian details
                          </span>
                          <span className="text-xs font-bold text-slate-700 block">{verifiedDoc.guardianName || 'N/A'}</span>
                          {verifiedDoc.guardianPhone && (
                            <span className="text-[10px] text-slate-500 font-mono block mt-0.5 flex items-center gap-1">
                              <Phone size={10} /> {verifiedDoc.guardianPhone}
                            </span>
                          )}
                        </div>

                        {verifiedDoc.address && (
                          <div className="col-span-1 sm:col-span-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Residential Address</span>
                            <span className="text-xs font-semibold text-slate-600 leading-relaxed block bg-slate-50 p-2.5 rounded-lg border">
                              {verifiedDoc.address}
                            </span>
                          </div>
                        )}

                        {verifiedDoc.specialNeedsDetails && (
                          <div className="col-span-1 sm:col-span-2 p-3.5 bg-red-50/40 border border-red-50 rounded-xl text-xs text-red-700">
                            <span className="font-extrabold uppercase text-[10px] tracking-wide block mb-1">⚠️ Restricted Declarations (Medical / Support):</span>
                            <p className="font-medium text-slate-700">{verifiedDoc.specialNeedsDetails}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Account Role</span>
                          <span className="text-xs font-bold text-slate-700 uppercase block">{verifiedDoc.role || 'N/A'}</span>
                        </div>

                        {verifiedDoc.studentId && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Official Student Portal ID</span>
                            <span className="text-xs font-mono font-black text-slate-700 block">IMSC/2026/04{verifiedDoc.studentId?.slice(0,3)}</span>
                          </div>
                        )}

                        {verifiedDoc.teacherId && (
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Faculty Staff Portal ID</span>
                            <span className="text-xs font-mono font-black text-slate-700 block">IMSC/2026/STAFF{verifiedDoc.teacherId?.slice(0,3)}</span>
                          </div>
                        )}

                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">Admission Registry Status</span>
                          <span className="text-xs font-bold text-slate-700 uppercase block">{verifiedDoc.admissionStatus || 'Active Faculty'}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Quick Verification Actions Panel */}
                  <div className="pt-6 border-t border-slate-100 flex flex-wrap gap-4 items-center justify-between">
                    <div>
                      {docType === 'application' && verifiedDoc.status !== 'approved' && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
                          <Sparkles size={14} className="animate-pulse" /> 
                          <span>Scanned candidate has valid payments. Ready for admission offer.</span>
                        </div>
                      )}
                      {verifiedDoc.status === 'approved' && (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-extrabold">
                          <Check size={14} /> Approved Application File
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {docType === 'application' && verifiedDoc.status !== 'approved' && (
                        <button 
                          onClick={approveScannedApplication}
                          disabled={loading}
                          className="px-5 py-2.5 bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-emerald-850 flex items-center gap-1 transition shadow-md"
                        >
                          {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Approve & Admit
                        </button>
                      )}

                      <a 
                        href={`/admin/${docType === 'application' ? 'applications' : 'students'}`}
                        className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                      >
                        Navigate To Registrar <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
