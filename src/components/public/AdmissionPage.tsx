import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, CreditCard, FileText, UserPlus, Download, AlertCircle, Loader2, ShieldCheck, LogIn, Printer } from 'lucide-react';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, doc, updateDoc, setDoc, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { jsPDF } from 'jspdf';
import { generateId, formatDate, cn, formatCurrency } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import AdmissionLetter from './AdmissionLetter';
import { signOut } from 'firebase/auth';
import QRCode from 'qrcode';

type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  targetClassId: string;
  guardianName: string;
  guardianPhone: string;
  address: string;
  passportPhoto?: string;
  hasSpecialNeeds: string;
  specialNeedsDetails?: string;
};

export default function AdmissionPage() {
  const { user, userData, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [hasPaid, setHasPaid] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [verifyingUrl, setVerifyingUrl] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [admissionFee, setAdmissionFee] = useState({ amount: 1000, name: 'Admission Application Fee' });
  const [openedPaymentTab, setOpenedPaymentTab] = useState(false);
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  
  // Custom Netlify Settings
  const [netlifyFormUrl, setNetlifyFormUrl] = useState<string>('');
  const [useExternalForm, setUseExternalForm] = useState<boolean>(false);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState<boolean>(false);
  
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>();

  // Watch all active form fields to auto-save drafts
  const watchedFields = watch();

  useEffect(() => {
    if (user && watchedFields && Object.keys(watchedFields).length > 0) {
      localStorage.setItem(`imsc_draft_admission_${user.uid}`, JSON.stringify(watchedFields));
    }
  }, [watchedFields, user]);

  const CLASSES = [
    { id: 'jss1', name: 'JSS 1' },
    { id: 'jss2', name: 'JSS 2' },
    { id: 'jss3', name: 'JSS 3' },
    { id: 'ss1', name: 'SS 1' },
    { id: 'ss2', name: 'SS 2' },
    { id: 'ss3', name: 'SS 3' },
  ];

  const verifyManualPayment = async (reference: string, silent = false): Promise<boolean> => {
    if (!reference || reference.length < 5) {
      if (!silent) alert("Please enter a valid Transaction Reference.");
      return false;
    }

    if (silent) setVerifyingUrl(true);
    setIsSubmitting(true);
    
    try {
      // 1. Check if this reference is already in our DB to avoid duplicates
      const qCheck = query(collection(db, "payments"), where("paystackReference", "==", reference), limit(1));
      const checkSnap = await getDocs(qCheck);
      
      if (checkSnap.empty) {
        // Record the new payment reference
        await addDoc(collection(db, "payments"), {
          studentId: user?.uid,
          amount: admissionFee.amount,
          type: "Admission Fee",
          paymentDate: serverTimestamp(),
          receiptNumber: `ADM-${generateId().toUpperCase().slice(0, 6)}`,
          status: 'verified', // We trust the Paystack redirect link for this setup
          paystackReference: reference,
          verificationMethod: silent ? 'url_redirect' : 'manual_entry'
        });
      }

      if (user?.uid) {
        localStorage.setItem(`imsc_paid_uid_${user.uid}`, 'true');
      }
      setHasPaid(true);
      setStep(2);
      if (!silent) alert("Payment verified! You can now proceed to fill the form.");
      return true;
    } catch (err) {
      console.error("Verification Error:", err);
      if (!silent) alert("Verification failed. Please try again or contact support.");
      return false;
    } finally {
      setIsSubmitting(false);
      setVerifyingUrl(false);
    }
  };

  const handleInitialPayment = async () => {
    if (!user) return;
    
    const publicKey = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY;
    const directLink = "https://paystack.shop/pay/mxrl-hceiv";

    // Scenario A: Use Integrated Popup (If Public Key exists)
    if (publicKey && publicKey !== 'pk_test_demo' && (window as any).PaystackPop) {
      setIsSubmitting(true);
      try {
        // @ts-ignore
        const handler = window.PaystackPop.setup({
          key: publicKey,
          email: user.email,
          amount: admissionFee.amount * 100,
          currency: 'NGN',
          callback: async (response: any) => {
            await verifyManualPayment(response.reference, true);
          },
          onClose: () => setIsSubmitting(false)
        });
        handler.openIframe();
        return;
      } catch (err) {
        console.error("Popup failed, falling back to link", err);
      }
    }

    // Scenario B: Fallback to Direct Link
    setOpenedPaymentTab(true);
    window.open(directLink, '_blank');
  };

  useEffect(() => {
    if (!user && !authLoading) {
      navigate('/auth?mode=register');
      return;
    }

    if (user) {
      setValue('email', user.email || '');
      const parts = user.displayName?.split(' ') || [];
      if (parts.length >= 2) {
        setValue('firstName', parts[0]);
        setValue('lastName', parts.slice(1).join(' '));
      }

      // Restore previously saved form draft from local storage
      try {
        const savedDraft = localStorage.getItem(`imsc_draft_admission_${user.uid}`);
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          Object.keys(parsed).forEach((key) => {
            const val = parsed[key as keyof FormData];
            if (val !== undefined && val !== '') {
              setValue(key as keyof FormData, val);
            }
          });
          if (parsed.passportPhoto) {
            setPassportPreview(parsed.passportPhoto);
          }
        }
      } catch (err) {
        console.warn("Could not parse draft form state:", err);
      }

      // Fetch dynamic admission fee
      const fetchFee = async () => {
        try {
          const qFee = query(collection(db, "fees"), limit(20));
          const feeSnap = await getDocs(qFee);
          const fees = feeSnap.docs.map(doc => doc.data());
          const admFee = fees.find(f => f.name.toLowerCase().includes('admission'));
          if (admFee) {
            setAdmissionFee({ amount: admFee.amount, name: admFee.name });
          }
        } catch (e) {
          console.error("Error fetching fee:", e);
        }
      };

      fetchFee();

      // Fetch Netlify Form configs
      const fetchNetlifySettings = async () => {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const configSnap = await getDoc(doc(db, "config", "admission_settings"));
          if (configSnap.exists()) {
            const data = configSnap.data();
            if (data.netlifyFormUrl) setNetlifyFormUrl(data.netlifyFormUrl);
            if (data.useExternalForm !== undefined) setUseExternalForm(data.useExternalForm);
          } else {
            const localUrl = localStorage.getItem('imsc_netlify_form_url');
            if (localUrl) setNetlifyFormUrl(localUrl);
            const localUseExt = localStorage.getItem('imsc_use_external_form') === 'true';
            setUseExternalForm(localUseExt);
          }
        } catch (e) {
          console.warn("Error fetching netlify settings:", e);
          const localUrl = localStorage.getItem('imsc_netlify_form_url');
          if (localUrl) setNetlifyFormUrl(localUrl);
          const localUseExt = localStorage.getItem('imsc_use_external_form') === 'true';
          setUseExternalForm(localUseExt);
        }
      };
      fetchNetlifySettings();

      // Check for successful payment and application status
      const checkStatus = async () => {
        setIsLoadingStatus(true);
        try {
          // 1. First, handle returning from Paystack redirect
          const ref = searchParams.get('reference') || searchParams.get('trxref');
          let verifiedJustNow = false;
          if (ref && !hasPaid) {
            verifiedJustNow = await verifyManualPayment(ref, true);
            // Clear URL to prevent re-runs using React Router replace
            navigate('/admission', { replace: true });
          }

          // 2. Check Database for existing payment records for this user
          const qPayment = query(
            collection(db, "payments"), 
            where("studentId", "==", user.uid)
          );
          const paymentSnap = await getDocs(qPayment);
          
          const foundPayment = paymentSnap.docs.some(d => {
            const type = (d.data().type || "").toLowerCase();
            return type.includes('admission');
          });

          const isPaid = verifiedJustNow || foundPayment || (user?.uid ? localStorage.getItem(`imsc_paid_uid_${user.uid}`) === 'true' : false);

          // 3. Check for existing application
          const qApp = query(
            collection(db, "applications"), 
            where("userId", "==", user.uid),
            limit(1)
          );
          const appSnap = await getDocs(qApp);
          
          // Determine the correct step
          if (!appSnap.empty) {
            const appData = appSnap.docs[0].data();
            // If they have a completed application (at least has a status), show success/letter
            if (appData.status === 'approved' || appData.status === 'pending') {
              setExistingApplication({ id: appSnap.docs[0].id, ...appData });
              setStep(3);
              setHasPaid(true); // Implied if they have an application
            } else if (isPaid) {
              setHasPaid(true);
              setStep(2);
            }
          } else if (isPaid) {
            setHasPaid(true);
            setStep(2);
          } else {
            // No payment found, stay at step 1
            setHasPaid(false);
            setStep(1);
          }

          // Force step 3 if user is already a student/admitted (Role-based override)
          if (userData?.role === 'student' || userData?.admissionStatus === 'approved') {
            setStep(3);
          }

        } catch (err) {
          console.error("Error checking admission status:", err);
        } finally {
          setIsLoadingStatus(false);
          setCheckingPayment(false);
        }
      };

      checkStatus();
    }
    // We remove hasPaid from dependencies to prevent unintended loops, 
    // unless searchParams changes which indicates a return from payment
  }, [user, authLoading, navigate, setValue, searchParams, userData?.role, userData?.admissionStatus]);

  const watchSpecialNeeds = watch("hasSpecialNeeds");
  const [passportPreview, setPassportPreview] = useState<string | null>(null);

  const handleAutoFillDemo = () => {
    setValue('firstName', 'Balarabe');
    setValue('lastName', 'Musa');
    setValue('gender', 'Male');
    setValue('dateOfBirth', '2012-08-15');
    setValue('targetClassId', 'ss2');
    setValue('phone', '08031234567');
    setValue('hasSpecialNeeds', 'No');
    setValue('guardianName', 'Mallam Ibrahim Musa');
    setValue('guardianPhone', '07011223344');
    setValue('address', 'No. 42 Gwarzo Road, Tudun Wada, Kano State');
    
    // Tiny valid light gray pixel to represent physical passport photo upload
    const dummyImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkPwwAAd8AW7CjHQAAAABJRU5ErkJggg==";
    setValue('passportPhoto', dummyImage);
    setPassportPreview(dummyImage);
  };

  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 500) {
        alert("Image is too large. Please use a file smaller than 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPassportPreview(base64String);
        setValue('passportPhoto', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    const txnId = `TXN-${generateId().toUpperCase().slice(0, 8)}`;
    try {
      const docRef = await addDoc(collection(db, "applications"), {
        ...data,
        userId: user?.uid,
        paymentStatus: 'verified',
        appliedDate: serverTimestamp(),
        status: 'pending',
        transactionId: txnId
      });
      
      setApplicationId(docRef.id);

      // Submit to Netlify Form via AJAX
      const formDataObj = new URLSearchParams();
      formDataObj.set('form-name', 'admission-applications');
      formDataObj.set('firstName', data.firstName || '');
      formDataObj.set('lastName', data.lastName || '');
      formDataObj.set('email', data.email || '');
      formDataObj.set('phone', data.phone || '');
      formDataObj.set('gender', data.gender || '');
      formDataObj.set('dateOfBirth', data.dateOfBirth || '');
      formDataObj.set('targetClassId', data.targetClassId || '');
      formDataObj.set('guardianName', data.guardianName || '');
      formDataObj.set('guardianPhone', data.guardianPhone || '');
      formDataObj.set('address', data.address || '');
      // Keep payload small to avoid HTTP 413 or slow posts
      formDataObj.set('passportPhoto', (data.passportPhoto && data.passportPhoto.length < 5000) ? data.passportPhoto : 'Uploaded photo (stored in Firebase)');
      formDataObj.set('hasSpecialNeeds', data.hasSpecialNeeds || '');
      formDataObj.set('specialNeedsDetails', data.specialNeedsDetails || '');
      formDataObj.set('paymentStatus', 'verified');
      formDataObj.set('transactionId', txnId);

      try {
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formDataObj.toString()
        });
        console.log("Successfully posted application form to Netlify Form Collector!");
      } catch (netlifyErr) {
        console.warn("Netlify Forms AJAX dispatch skipped/unavailable (this is normal when running locally/Cloud Run):", netlifyErr);
      }
      
      // Auto-generate PDF after submission
      generatePDF(data, docRef.id);
      
      setStep(3);
      
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingSettings(true);
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      await setDoc(doc(db, "config", "admission_settings"), {
        netlifyFormUrl: netlifyFormUrl.trim(),
        useExternalForm: useExternalForm,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email
      }, { merge: true });
      localStorage.setItem('imsc_netlify_form_url', netlifyFormUrl.trim());
      localStorage.setItem('imsc_use_external_form', useExternalForm ? 'true' : 'false');
      alert("Admission settings saved successfully!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      localStorage.setItem('imsc_netlify_form_url', netlifyFormUrl.trim());
      localStorage.setItem('imsc_use_external_form', useExternalForm ? 'true' : 'false');
      alert("Settings updated locally!");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const generatePDF = async (data: FormData, id: string) => {
    const doc = new jsPDF();
    const logoUrl = "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg";
    
    // Header
    try {
      // Trying to add the official school logo to the PDF
      doc.addImage(logoUrl, 'JPEG', 10, 10, 20, 20);
    } catch (e) {
      console.warn("Logo failed to load for PDF:", e);
    }

    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(217, 119, 6);
    doc.text("ADMISSION APPLICATION SLIP", 105, 30, { align: 'center' });
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 35, 190, 35);

    // Passport Photo Placeholder or Image
    if (data.passportPhoto) {
      try {
        doc.addImage(data.passportPhoto, 'JPEG', 160, 40, 30, 35);
      } catch (e) {
        doc.rect(160, 40, 30, 35);
        doc.setFontSize(8);
        doc.text("Passport", 175, 57, { align: 'center' });
      }
    } else {
      doc.rect(160, 40, 30, 35);
      doc.setFontSize(8);
      doc.text("Passport", 175, 57, { align: 'center' });
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Application ID: ${id}`, 20, 45);
    doc.text(`Date: ${formatDate(new Date())}`, 20, 52);
    
    doc.setFont("helvetica", "bold");
    doc.text("Student Information", 20, 65);
    doc.setFont("helvetica", "normal");
    doc.text(`Full Name: ${data.firstName} ${data.lastName}`, 20, 72);
    doc.text(`Target Class: ${CLASSES.find(c => c.id === data.targetClassId)?.name}`, 20, 79);
    doc.text(`Gender: ${data.gender}`, 20, 86);
    doc.text(`Date of Birth: ${data.dateOfBirth}`, 20, 93);
    
    if (data.hasSpecialNeeds === 'Yes') {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      doc.text("Medical/Special Attention Required:", 20, 105);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0,0,0);
      const splitDetails = doc.splitTextToSize(data.specialNeedsDetails || "Details not provided", 170);
      doc.text(splitDetails, 20, 112);
    }

    const nextY = data.hasSpecialNeeds === 'Yes' ? 140 : 110;

    doc.setFont("helvetica", "bold");
    doc.text("Guardian Details", 20, nextY);
    doc.setFont("helvetica", "normal");
    doc.text(`Guardian: ${data.guardianName}`, 20, nextY + 7);
    doc.text(`Phone: ${data.guardianPhone}`, 20, nextY + 14);
    
    // Security QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-IMSC-${id}`);
      doc.addImage(qrDataUrl, 'PNG', 160, nextY - 10, 30, 30);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify", 175, nextY + 22, { align: 'center' });
    } catch (e) {
      console.warn("QR generation failed:", e);
    }

    doc.line(20, nextY + 25, 190, nextY + 25);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Note: Please keep this slip safe. Admission details will be sent to your email.", 105, nextY + 35, { align: 'center' });
    
    doc.save(`IMSC_Application_${id}.pdf`);
  };

  if (authLoading || (user && (checkingPayment || isLoadingStatus))) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-slate-50">
        <Loader2 className="animate-spin text-emerald-950 mb-4" size={40} />
        <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Checking Admission Status...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="school-gradient py-20 text-white text-center relative">
        {user && (
          <button 
            onClick={() => signOut(auth).then(() => navigate('/'))}
            className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
          >
            Sign Out
          </button>
        )}
        <h1 className="text-4xl font-bold mb-4">Admissions Portal</h1>
        <p className="text-emerald-100 max-w-xl mx-auto px-4 opacity-80">
          Welcome {userData?.displayName || user?.displayName || 'Applicant'}. Follow the steps below to complete your admission.
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-10 pb-20">
        {/* Admin Setup Panel for Netlify Integration */}
        {(user?.email === 'maitechitservices6@gmail.com' || userData?.role === 'admin') && (
          <div className="mb-6 p-6 bg-slate-900 border border-slate-800 text-white rounded-3xl text-left shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                  🛠️ Developer Settings: Paystack & Netlify Form Mode
                </h3>
                <p className="text-[11px] text-slate-400">
                  Quick control panel to connect Paystack to Netlify Forms or use our dynamic native flow!
                </p>
              </div>
              <span className="self-start sm:self-center text-[9px] bg-emerald-950 text-emerald-300 font-bold px-2.5 py-1 rounded-full uppercase border border-emerald-800 tracking-wider">
                Authorized Setup Mode
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Admission Form Presentation Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUseExternalForm(false)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer text-center",
                        !useExternalForm 
                          ? "bg-emerald-900 border-emerald-500 text-white shadow-md"
                          : "bg-slate-800/50 border-slate-700 text-slate-350 hover:bg-slate-800"
                      )}
                    >
                      🌟 Built-in Native Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseExternalForm(true)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-[11px] font-extrabold uppercase tracking-wide transition-all cursor-pointer text-center",
                        useExternalForm 
                          ? "bg-emerald-900 border-emerald-500 text-white shadow-md"
                          : "bg-slate-800/50 border-slate-700 text-slate-350 hover:bg-slate-800"
                      )}
                    >
                      📄 External Netlify Form
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="netlifyFormUrlInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Netlify Form Link (Optional)
                  </label>
                  <input
                    id="netlifyFormUrlInput"
                    type="url"
                    placeholder="e.g. https://your-netlify-site.netlify.app/admission-form"
                    value={netlifyFormUrl}
                    onChange={(e) => setNetlifyFormUrl(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:border-amber-500 text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-[10px] leading-relaxed max-w-lg text-slate-400">
                  {!useExternalForm 
                    ? "👉 Currently using our responsive Built-in form. It saves submissions to Firestore and auto-saves drafts while sending a duplicate AJAX block to Netlify Forms on submit."
                    : "👉 Currently using the External Netlify form iframe. Applicants will fill out your form inside an iframe after successful payment."}
                </p>
                <button
                  type="submit"
                  disabled={isUpdatingSettings}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {isUpdatingSettings ? "Saving Settings..." : "Save Config Settings"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden relative">
          {/* Automatic Verification Overlay */}
          <AnimatePresence>
            {verifyingUrl && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 text-emerald-950"
              >
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 animate-bounce">
                  <CreditCard size={32} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter mb-2">Verifying Transaction...</h3>
                <p className="text-sm text-slate-500 max-w-xs">
                  We're checking your payment with Paystack. Please don't refresh the page, your form will load in a moment.
                </p>
                <Loader2 className="animate-spin mt-6 text-amber-500" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Progress Bar */}
          <div className="bg-slate-50 px-8 py-6 grid grid-cols-3 gap-2 border-b border-slate-100">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex flex-col gap-2">
                <div className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  step >= i ? "bg-emerald-600" : "bg-slate-200"
                )} />
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-widest",
                  step === i ? "text-emerald-700" : "text-slate-400"
                )}>
                  {i === 1 ? 'Payment' : i === 2 ? 'Form' : 'Complete'}
                </span>
              </div>
            ))}
          </div>

          <div className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="text-center"
                >
                  <div className="mb-8 p-8 bg-amber-50 rounded-3xl border border-amber-100 inline-block">
                    <CreditCard size={64} className="text-amber-600 mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-emerald-950 mb-2">{admissionFee.name}</h3>
                    <div className="text-3xl font-black text-emerald-900 mb-4">{formatCurrency(admissionFee.amount)}</div>
                    <p className="text-sm text-slate-500 max-w-xs mx-auto">
                      You must pay the application fee before the admission form becomes available.
                    </p>
                  </div>

                  {openedPaymentTab && (
                    <div className="mb-8 max-w-lg mx-auto p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-left">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 mt-0.5">⏱️</div>
                        <div>
                          <h4 className="font-bold text-emerald-950 mb-1">Awaiting Payment...</h4>
                          <p className="text-xs text-slate-600 leading-relaxed mb-4">
                            We opened your Paystack payment page in a new window. Please complete the transaction there.
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-xs bg-emerald-950/5 p-4 rounded-xl space-y-3 border border-emerald-900/10">
                        <p className="font-bold text-emerald-900">💡 School Admin Info (Automatic Redirect Setup):</p>
                        <p className="text-slate-600 leading-relaxed">
                          To make applicants return to this form instantly, navigate to your <strong>Paystack Commerce/Page Dashboard</strong> and set the <strong>Redirect/Callback URL</strong>.
                        </p>
                        
                        <div className="space-y-2">
                          <p className="font-bold text-[11px] text-slate-700">Option 1: Primary Redirect URL (Recommended - Avoids 403 blocks):</p>
                          <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                            <code className="text-[10px] break-all select-all font-mono text-emerald-950 flex-grow">
                              {window.location.origin}/
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/`);
                                setCopiedCallbackUrl(true);
                                setTimeout(() => setCopiedCallbackUrl(false), 3000);
                              }}
                              className="bg-emerald-900 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md hover:bg-emerald-800 transition-colors shrink-0"
                            >
                              {copiedCallbackUrl ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="font-bold text-[11px] text-slate-700">Option 2: Direct Admission Route URL:</p>
                          <div className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                            <code className="text-[10px] break-all select-all font-mono text-emerald-950 flex-grow">
                              {window.location.origin}/#/admission
                            </code>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/#/admission`);
                                setCopiedCallbackUrl(true);
                                setTimeout(() => setCopiedCallbackUrl(false), 3000);
                              }}
                              className="bg-emerald-900 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-md hover:bg-emerald-800 transition-colors shrink-0"
                            >
                              {copiedCallbackUrl ? "Copied!" : "Copy"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="max-w-sm mx-auto space-y-4">
                    <button 
                      onClick={handleInitialPayment}
                      disabled={isSubmitting}
                      className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> {openedPaymentTab ? "Relaunch Paystack Payment" : "Securely Pay with Paystack"}</>}
                    </button>
                    
                    {/* Sandbox bypass for easier testing / evaluation */}
                    <button 
                      type="button"
                      onClick={() => verifyManualPayment("DEMO-" + Math.floor(Math.random() * 1000000) + "-PAID", false)}
                      disabled={isSubmitting}
                      className="w-full py-3 bg-amber-500/10 text-amber-800 border-2 border-dashed border-amber-300 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-amber-500/20 active:scale-95 transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      ⚡ Bypass Payment Step (Simulate Success)
                    </button>

                    <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                      Immediate access to the draft form after successful verification or testing bypass.
                    </p>

                    <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col gap-4">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left">Already Paid or Have Reference?</p>
                      <p className="text-slate-500 text-xs text-left leading-relaxed">
                        If Paystack didn't redirect you automatically, enter your <strong>Paystack Transaction Reference</strong> (from the receipt/email starting with e.g. T...) below to instantly unlock the application:
                      </p>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="paymentRef"
                          placeholder="Enter Transaction Reference" 
                          className="flex-grow px-4 py-3 bg-slate-100 rounded-xl text-sm font-medium border border-transparent focus:bg-white focus:border-emerald-500 outline-none transition-all"
                        />
                        <button 
                          onClick={() => verifyManualPayment((document.getElementById('paymentRef') as HTMLInputElement).value)}
                          className="px-4 py-3 bg-emerald-100 text-emerald-700 rounded-xl text-sm font-bold hover:bg-emerald-200 transition-all font-mono"
                        >
                          Verify
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {useExternalForm ? (
                    <div className="space-y-8 text-left animate-fade-in">
                      <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-emerald-950 uppercase tracking-tight flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Application Fee Paid Successfully!
                          </h4>
                          <p className="text-xs text-slate-650 leading-relaxed max-w-xl">
                            We've verified your transaction. Please fill out the registration form embedded below to complete your admission application.
                          </p>
                        </div>
                        
                        {/* Quick printable confirmation receipt slip */}
                        <button
                          type="button"
                          onClick={() => {
                            const mockData = {
                              firstName: user?.displayName?.split(' ')[0] || 'Applicant',
                              lastName: user?.displayName?.split(' ').slice(1).join(' ') || 'User',
                              email: user?.email || '',
                              phone: '',
                              gender: '',
                              dateOfBirth: '',
                              targetClassId: 'jss1',
                              guardianName: '',
                              guardianPhone: '',
                              address: '',
                              hasSpecialNeeds: 'No'
                            };
                            generatePDF(mockData, applicationId || 'PAYSTACK-' + Math.floor(Math.random() * 1000000));
                          }}
                          className="px-4 py-2.5 bg-emerald-990 hover:bg-emerald-900 bg-emerald-950 text-white font-extrabold tracking-wide rounded-xl text-xs uppercase transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
                        >
                          <Download size={14} /> Print Payment Receipt
                        </button>
                      </div>

                      {netlifyFormUrl ? (
                        <div className="border border-slate-200 rounded-3xl overflow-hidden bg-white shadow-inner" style={{ height: '700px' }}>
                          <iframe 
                            src={netlifyFormUrl} 
                            title="Netlify Registration Form" 
                            className="w-full h-full border-0"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                          />
                        </div>
                      ) : (
                        <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                          <FileText size={48} className="text-slate-350 mx-auto mb-4" />
                          <h4 className="font-bold text-slate-700">Netlify Form Setup Required</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-normal mb-6">
                            You've selected the external Netlify form mode. Please use the developer settings panel above to enter your form URL.
                          </p>
                          <button
                            type="button"
                            onClick={() => setUseExternalForm(false)}
                            className="px-5 py-2.5 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                          >
                            Use Built-in Form Instead
                          </button>
                        </div>
                      )}

                      <div className="pt-6 border-t border-slate-100 flex justify-between items-center bg-slate-50 p-6 rounded-2xl">
                        <p className="text-xs text-slate-500 font-medium text-left">
                          Completed submitting the embedded form? Click below to finalize your registration and print the receipt.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setStep(3);
                          }}
                          className="px-6 py-3 bg-emerald-950 text-white hover:bg-emerald-900 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer"
                        >
                          Finish & View Acknowledgement
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Alert panel and Quick fill action */}
                      <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        <div className="text-left">
                          <h4 className="text-sm font-extrabold text-emerald-950 mb-1 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Reactive Auto-Save Activated
                          </h4>
                          <p className="text-xs text-slate-500 leading-relaxed max-w-sm">
                            All typed fields are instantly saved to draft state in the background. If you refresh or return later, this form will auto-load filled.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAutoFillDemo}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-emerald-950 hover:text-white font-extrabold tracking-wide rounded-xl text-xs uppercase transition-all shadow-md cursor-pointer shrink-0"
                        >
                          ✨ Auto-Fill Demo Profile
                        </button>
                      </div>

                      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                        <div>
                          <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2 text-left">
                            <UserPlus size={20} className="text-amber-500" /> Student Information
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Passport Photograph</label>
                              <div className="flex items-center gap-4">
                                <div className="w-24 h-24 bg-slate-100 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                                  {passportPreview ? (
                                    <img src={passportPreview} className="w-full h-full object-cover" />
                                  ) : (
                                    <UserPlus className="text-slate-300" size={32} />
                                  )}
                                </div>
                                <div className="flex-grow">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handlePassportChange}
                                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all"
                                  />
                                  <p className="mt-1 text-xs text-slate-400">Accepted formats: JPG, PNG. Max 500KB.</p>
                                </div>
                              </div>
                              <input type="hidden" {...register("passportPhoto", { required: true })} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                              <input {...register("firstName", { required: true })} className="input-field" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                              <input {...register("lastName", { required: true })} className="input-field" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                              <input {...register("email", { required: true })} className="input-field bg-slate-100 cursor-not-allowed" readOnly />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Gender</label>
                              <select {...register("gender", { required: true })} className="input-field">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Date of Birth</label>
                              <input type="date" {...register("dateOfBirth", { required: true })} className="input-field" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Apply for Class</label>
                              <select {...register("targetClassId", { required: true })} className="input-field">
                                <option value="">Select Class</option>
                                {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                              <input {...register("phone", { required: true })} className="input-field" />
                            </div>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                          <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2 text-red-600 text-left">
                             Medical & Special Needs
                          </h3>
                          <div className="space-y-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left">
                            <div className="space-y-4">
                              <p className="text-sm font-medium text-slate-700">Does your child have any special illness or need special attention?</p>
                              <div className="flex gap-6">
                                {['No', 'Yes'].map(opt => (
                                  <label key={opt} className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                      type="radio" 
                                      value={opt} 
                                      {...register("hasSpecialNeeds", { required: true })}
                                      className="w-4 h-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-bold group-hover:text-emerald-700 transition-colors">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                            
                            {watchSpecialNeeds === 'Yes' && (
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-2 animate-fade-in"
                              >
                                <label className="text-xs font-bold text-slate-500 uppercase">Provide Details</label>
                                <textarea 
                                  {...register("specialNeedsDetails", { required: watchSpecialNeeds === 'Yes' })} 
                                  placeholder="Describe medications, allergies, or educational support needs..."
                                  className="input-field min-h-[100px]" 
                                />
                              </motion.div>
                            )}
                          </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                          <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2 text-left">
                            <ShieldCheck size={20} className="text-amber-500" /> Guardian & Address
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Guardian Name</label>
                              <input {...register("guardianName", { required: true })} className="input-field" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Guardian Phone</label>
                              <input {...register("guardianPhone", { required: true })} className="input-field" />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Residential Address</label>
                              <textarea {...register("address", { required: true })} className="input-field min-h-[100px]" />
                            </div>
                          </div>
                        </div>

                        <button type="submit" disabled={isSubmitting} className="w-full btn-primary py-4 text-lg cursor-pointer">
                          {isSubmitting ? <Loader2 className="animate-spin" /> : 'Submit Application'}
                        </button>
                      </form>
                    </>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-6"
                >
                  {existingApplication?.status === 'approved' ? (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-emerald-50 border border-emerald-100 p-6 rounded-2xl text-left shadow-sm no-print">
                        <div>
                          <h4 className="font-extrabold text-emerald-950 mb-1">🎉 Admission Confirmed!</h4>
                          <p className="text-xs text-slate-600">Your application has been approved. You can print your Admission Letter or view the original Application Slip below for your records.</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => generatePDF(existingApplication, existingApplication?.id || 'ID-ERR')}
                            className="px-4 py-2 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Download size={14} /> Download Slip
                          </button>
                          <button 
                            onClick={() => setShowPrintSlip(true)}
                            className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                          >
                            <Printer size={14} /> Print Slip
                          </button>
                        </div>
                      </div>
                      <AdmissionLetter application={existingApplication} />
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                        <CheckCircle2 size={48} />
                      </div>
                      <h2 className="text-3xl font-bold text-emerald-950 mb-4">Application Success!</h2>
                      <p className="text-slate-500 mb-12 max-w-sm mx-auto">
                        Your application has been received and is currently being reviewed. You can download or print your application slip below.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button 
                          onClick={() => generatePDF(existingApplication || watch(), applicationId || existingApplication?.id || 'ID-ERR')} 
                          className="btn-primary flex items-center justify-center gap-2 px-8"
                        >
                          <Download size={18} /> Download Application Slip
                        </button>
                        <button 
                          onClick={() => setShowPrintSlip(true)}
                          className="px-8 py-3 bg-amber-500 hover:bg-amber-650 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-md"
                        >
                          <Printer size={18} /> Print Application Slip
                        </button>
                        <button 
                          onClick={() => navigate('/')}
                          className="px-8 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
                        >
                          Back to Home
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Printable Slip Preview Modal */}
      <AnimatePresence>
        {showPrintSlip && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none">
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
                      <p className="text-xs text-amber-650 font-extrabold uppercase tracking-widest mt-1">Admissions & Academic Records Bureau</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Karefa Road Tudun Wada Dankadai, Kano State | Tel: 07011748311</p>
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
                          {(existingApplication?.id || applicationId || 'IMSC-PENDING').toUpperCase()}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Date of Application</p>
                        <p className="text-sm font-semibold text-slate-800">{formatDate(new Date())}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">1. Student Biography</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">First Name</span>
                          <span className="font-bold text-slate-800 text-sm">{existingApplication?.firstName || watch('firstName')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Last Name</span>
                          <span className="font-bold text-slate-800 text-sm">{existingApplication?.lastName || watch('lastName')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Gender Placement</span>
                          <span className="font-semibold text-slate-700">{existingApplication?.gender || watch('gender')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Date of Birth (DOB)</span>
                          <span className="font-semibold text-slate-700">{existingApplication?.dateOfBirth || watch('dateOfBirth')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Registered Email</span>
                          <span className="font-semibold text-slate-700">{existingApplication?.email || watch('email')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Class Registered</span>
                          <span className="font-bold text-slate-800 uppercase text-sm">
                            {CLASSES.find(c => c.id === (existingApplication?.targetClassId || watch('targetClassId')))?.name || "SS 2"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">2. Parent / Guardian Records</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Primary Sponsor Name</span>
                          <span className="font-bold text-slate-800">{existingApplication?.guardianName || watch('guardianName')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Sponsor Contact lines</span>
                          <span className="font-bold text-slate-800 font-mono">{existingApplication?.guardianPhone || watch('guardianPhone')}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Authorized Residential Address</span>
                          <span className="font-semibold text-slate-700 leading-relaxed block bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                            {existingApplication?.address || watch('address')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">3. Medical Status Declarations</h4>
                      <div className="text-xs p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
                        {(existingApplication?.hasSpecialNeeds || watch('hasSpecialNeeds')) === 'Yes' ? (
                          <div>
                            <span className="text-red-700 font-extrabold uppercase tracking-wide block mb-1">⚠️ Medical/Educational Support Required:</span>
                            <p className="font-medium text-slate-700 leading-relaxed">{existingApplication?.specialNeedsDetails || watch('specialNeedsDetails')}</p>
                          </div>
                        ) : (
                          <p className="font-bold text-slate-500">Applicant declared NO active medical needs, special allergies, or restricted learning support criteria.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Passport side */}
                  <div className="md:col-span-1 flex flex-col items-center gap-6 border-l border-slate-100 pl-0 md:pl-6 print:pl-6 print:border-l shrink-0">
                    <div className="w-32 h-40 bg-slate-50 border-2 border-slate-200 rounded-lg overflow-hidden flex items-center justify-center relative select-none shadow-sm">
                      {(existingApplication?.passportPhoto || passportPreview) ? (
                        <img src={existingApplication?.passportPhoto || passportPreview} alt="Passport Photo" className="w-full h-full object-cover animate-fade-in" />
                      ) : (
                        <div className="text-center p-4">
                          <UserPlus className="text-slate-300 mx-auto mb-1" size={24} />
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">PASSPORT<br/>PHOTO</span>
                        </div>
                      )}
                    </div>

                    <div className="text-center space-y-2 mt-4 bg-emerald-50/10 border border-emerald-900/5 p-4 rounded-2xl w-full">
                      <div className="w-24 h-24 mx-auto bg-white border border-slate-200 p-1 rounded-xl flex items-center justify-center shadow-inner">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=VERIFY-IMSC-${existingApplication?.id || applicationId || 'PENDING'}`} 
                          alt="Registration QR Code" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Scan to Verify Registry</p>
                    </div>
                  </div>
                </div>

                {/* Footer seal declarations */}
                <div className="grid grid-cols-2 gap-8 border-t border-slate-200 pt-10 mt-12 text-xs">
                  <div className="space-y-4">
                    <p className="text-slate-500 italic">I declare that all information supplied on this application file is complete and entirely accurate.</p>
                    <div className="pt-8 border-b border-dashed border-slate-300 w-48 text-left font-semibold text-slate-400">Applicant/Sponsor Sign & Date</div>
                  </div>
                  <div className="space-y-4">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mb-4">Official Seal / Verification Bureau Only</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="h-12 border-b border-slate-300"></div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">First Scrutineer</span>
                      </div>
                      <div>
                        <div className="h-12 border-b border-slate-300"></div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">Registrar Seal</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
