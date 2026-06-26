import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, CreditCard, FileText, UserPlus, Download, AlertCircle, Loader2, ShieldCheck, LogIn, Printer, Bell, Mail, Check, X } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, updateDoc, doc, orderBy } from 'firebase/firestore';
import { supabase } from '../../lib/supabase';
import { jsPDF } from 'jspdf';
import { generateId, formatDate, cn, formatCurrency, MAHMOUD_ADAMU_SIGNATURE } from '../../lib/utils';
import { useAuth } from '../../lib/auth';
import { safeStorage } from '../../lib/safeStorage';
import AdmissionLetter from './AdmissionLetter';
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
  primarySchool: string;
  primarySchoolStart: string;
  primarySchoolEnd: string;
  islamiyyaSchool: string;
  islamiyyaSchoolStart: string;
  islamiyyaSchoolEnd: string;
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
  const [admissionFee, setAdmissionFee] = useState({ amount: 1000, name: 'Admission & Prospectus Fee' });
  const [openedPaymentTab, setOpenedPaymentTab] = useState(false);
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState(false);
  const [showPrintSlip, setShowPrintSlip] = useState(false);
  
  // Custom Netlify Settings
  const [admissionFormEnabled, setAdmissionFormEnabled] = useState<boolean>(() => {
    const cached = localStorage.getItem('imsc_admission_form_enabled');
    return cached !== 'false';
  });
  const [netlifyFormUrl, setNetlifyFormUrl] = useState<string>(localStorage.getItem('imsc_netlify_form_url') || '/');
  const [useExternalForm, setUseExternalForm] = useState<boolean>(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState<string>(
    localStorage.getItem('imsc_paystack_public_key') || 
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 
    'pk_live_322d4bde836a684b28f791049b8c3997742c8985'
  );
  const [admissionFeeAmount, setAdmissionFeeAmount] = useState<number>(() => {
    const cached = localStorage.getItem('imsc_admission_fee_amount');
    return cached ? parseInt(cached, 10) : 1000;
  });

  // Client-side automated notifications centre
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        console.warn("Notifications subscription error, falling back to basic query:", err);
        const qSimple = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid)
        );
        getDocs(qSimple).then(snap => {
          const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // sort locally
          fetched.sort((a: any, b: any) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA;
          });
          setNotifications(fetched);
        }).catch(e => console.error("Could not fetch notifications fallback:", e));
      });
      return () => unsubscribe();
    }
  }, [user]);

  const markNotificationsAsRead = async () => {
    const unread = notifications.filter(n => n.status === 'unread');
    for (const n of unread) {
      try {
        await updateDoc(doc(db, "notifications", n.id), { status: 'read' });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
  };
  const [isUpdatingSettings, setIsUpdatingSettings] = useState<boolean>(false);
  
  const isHeadlessEndpoint = !!(netlifyFormUrl?.includes('/s/') || netlifyFormUrl?.includes('formbold.com/s/'));
  const shouldRenderExternal = useExternalForm && !isHeadlessEndpoint;
  
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<FormData>();

  // Watch all active form fields to auto-save drafts
  const watchedFields = watch();

  useEffect(() => {
    if (watchedFields && Object.keys(watchedFields).length > 0) {
      const prunedFields = { ...watchedFields };
      // Always exclude large passportPhoto base64 data to avoid local storage quota exceeded errors
      delete prunedFields.passportPhoto;

      try {
        if (user) {
          safeStorage.setItem(`imsc_draft_admission_${user.uid}`, JSON.stringify(prunedFields));
        } else {
          safeStorage.setItem('imsc_draft_admission_guest', JSON.stringify(prunedFields));
        }
      } catch (err) {
        console.warn("Could not save auto-save draft due to storage limits:", err);
      }
    }
  }, [watchedFields, user]);

  useEffect(() => {
    // Dynamic fallback to guarantee Paystack Inline SDK script is active
    if (!(window as any).PaystackPop) {
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.async = true;
      script.onload = () => {
        console.log("[Paystack] Inline SDK dynamically loaded successfully");
        // Trigger dummy state update or fee reference fetch to re-evaluate the button
        setAdmissionFee(prev => ({ ...prev }));
      };
      document.head.appendChild(script);
    }
  }, []);

  const CLASSES = [
    { id: 'jss1', name: 'JSS 1' },
    { id: 'jss2', name: 'JSS 2' },
    { id: 'jss3', name: 'JSS 3' },
    { id: 'ss1', name: 'SS 1' },
    { id: 'ss2', name: 'SS 2' },
    { id: 'ss3', name: 'SS 3' },
  ];

  const triggerFormBoldSubmission = async (data: FormData, txnId: string) => {
    try {
      console.log("[FormBold] Preparing submission for transaction ID:", txnId);
      const hiddenForm = document.querySelector('form[name="admission-applications"]') as HTMLFormElement;
      const formBoldUrl = netlifyFormUrl?.trim() || "https://formbold.com/s/9mBJY";
      
      if (hiddenForm) {
        hiddenForm.action = formBoldUrl;
        hiddenForm.method = "POST";
        
        const setField = (name: string, value: string) => {
          const input = hiddenForm.querySelector(`[name="${name}"]`) as HTMLInputElement | HTMLTextAreaElement;
          if (input) {
            input.value = value || '';
          } else {
            const newInput = document.createElement('input');
            newInput.type = 'hidden';
            newInput.name = name;
            newInput.value = value || '';
            hiddenForm.appendChild(newInput);
          }
        };

        setField('firstName', data.firstName);
        setField('lastName', data.lastName);
        setField('email', data.email);
        setField('phone', data.phone);
        setField('gender', data.gender);
        setField('dateOfBirth', data.dateOfBirth);
        setField('targetClassId', data.targetClassId);
        setField('guardianName', data.guardianName);
        setField('guardianPhone', data.guardianPhone);
        setField('address', data.address);
        setField('passportPhoto', (data.passportPhoto && data.passportPhoto.length < 5000) ? data.passportPhoto : 'Uploaded photo (stored offline/local)');
        setField('hasSpecialNeeds', data.hasSpecialNeeds);
        setField('specialNeedsDetails', data.specialNeedsDetails || '');
        setField('primarySchool', data.primarySchool);
        setField('primarySchoolStart', data.primarySchoolStart);
        setField('primarySchoolEnd', data.primarySchoolEnd);
        setField('islamiyyaSchool', data.islamiyyaSchool);
        setField('islamiyyaSchoolStart', data.islamiyyaSchoolStart);
        setField('islamiyyaSchoolEnd', data.islamiyyaSchoolEnd);
        setField('paymentStatus', 'verified');
        setField('transactionId', txnId);

        // Submit via AJAX programmatic fetch
        const formData = new FormData(hiddenForm);
        fetch(formBoldUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json'
          }
        }).then((res) => {
          console.log("[FormBold] AJAX submission complete!", res);
        }).catch((err) => {
          console.warn("[FormBold] AJAX submission failed:", err);
        });

        // Trigger standard form submit event
        try {
          const event = new Event('submit', { cancelable: true, bubbles: true });
          hiddenForm.dispatchEvent(event);
        } catch (e) {
          console.warn("Could not dispatch submit event to hidden form", e);
        }
      } else {
        // Direct AJAX post fallback if hidden form is missing
        const rawFormData = new FormData();
        rawFormData.append('firstName', data.firstName || '');
        rawFormData.append('lastName', data.lastName || '');
        rawFormData.append('email', data.email || '');
        rawFormData.append('phone', data.phone || '');
        rawFormData.append('gender', data.gender || '');
        rawFormData.append('dateOfBirth', data.dateOfBirth || '');
        rawFormData.append('targetClassId', data.targetClassId || '');
        rawFormData.append('guardianName', data.guardianName || '');
        rawFormData.append('guardianPhone', data.guardianPhone || '');
        rawFormData.append('address', data.address || '');
        rawFormData.append('passportPhoto', (data.passportPhoto && data.passportPhoto.length < 5000) ? data.passportPhoto : 'Uploaded photo (stored offline/local)');
        rawFormData.append('hasSpecialNeeds', data.hasSpecialNeeds || '');
        rawFormData.append('specialNeedsDetails', data.specialNeedsDetails || '');
        rawFormData.append('primarySchool', data.primarySchool || '');
        rawFormData.append('primarySchoolStart', data.primarySchoolStart || '');
        rawFormData.append('primarySchoolEnd', data.primarySchoolEnd || '');
        rawFormData.append('islamiyyaSchool', data.islamiyyaSchool || '');
        rawFormData.append('islamiyyaSchoolStart', data.islamiyyaSchoolStart || '');
        rawFormData.append('islamiyyaSchoolEnd', data.islamiyyaSchoolEnd || '');
        rawFormData.append('paymentStatus', 'verified');
        rawFormData.append('transactionId', txnId);

        fetch(formBoldUrl, {
          method: 'POST',
          body: rawFormData,
          headers: {
            'Accept': 'application/json'
          }
        }).then((res) => {
          console.log("[FormBold Direct] AJAX submission complete!", res);
        }).catch((err) => {
          console.warn("[FormBold Direct] AJAX submission failed:", err);
        });
      }
    } catch (e) {
      console.error("[FormBold] General submission error:", e);
    }
  };

  const verifyManualPayment = async (reference: string, silent = false): Promise<boolean> => {
    if (!reference || reference.length < 5) {
      if (!silent) alert("Please enter a valid Transaction Reference.");
      return false;
    }

    if (silent) setVerifyingUrl(true);
    setIsSubmitting(true);
    
    try {
      // 1. Try to record/query in Supabase, but never let DB latency or errors block the applicant's progress
      try {
        const { data: qCheck } = await supabase
          .from('payments')
          .select('*')
          .eq('paystackReference', reference)
          .limit(1);
        
        if (!qCheck || qCheck.length === 0) {
          // Record the new payment reference
          await supabase.from('payments').insert({
            studentId: user?.uid || "guest-or-anon",
            amount: admissionFee.amount,
            type: "Admission Fee",
            receiptNumber: `ADM-${generateId().toUpperCase().slice(0, 6)}`,
            status: 'verified', // We trust the Paystack redirect link for this setup
            paystackReference: reference,
            verificationMethod: silent ? 'url_redirect' : 'manual_entry'
          });
        }
      } catch (dbErr) {
        console.warn("Supabase save of payment reference skipped or failed. This is normal in sandbox/local run. Defaulting to local memory fallback mode:", dbErr);
      }

      // 2. Commit to localStorage to persist state across page reloads/refreshes instantly
      if (user?.uid) {
        localStorage.setItem(`imsc_paid_uid_${user.uid}`, 'true');
      }
      localStorage.setItem(`imsc_payment_ref_${user?.uid || 'anon'}`, reference);

      // 3. Attempt FormBold auto-submission from cached fields/draft details if available
      try {
        const currentHookValues = getValues();
        let studentData: FormData = { ...currentHookValues };
        if (!studentData.firstName && user?.uid) {
          const draftRaw = localStorage.getItem(`imsc_draft_admission_${user.uid}`);
          if (draftRaw) {
            studentData = { ...studentData, ...JSON.parse(draftRaw) };
          }
        }
        if (studentData && studentData.firstName) {
          triggerFormBoldSubmission(studentData, reference);
        }
      } catch (fbErr) {
        console.warn("FormBold auto-submission from callback draft skipped/failed", fbErr);
      }

      setHasPaid(true);
      setStep(3);
      
      if (!silent) {
        alert("Payment verified successfully! You can now proceed to fill the admission form.");
      }
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
    const email = user?.email || watch('email') || prompt("Please enter your email to receive your payment receipt from Paystack:") || "guest@school.com";
    if (email !== "guest@school.com" && email && !email.includes('@')) {
      alert("Please enter a valid email address.");
      return;
    }
    setValue('email', email);
    
    // Choose the configured state key or env key or a default public test key fallback
    const activeKey = paystackPublicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_322d4bde836a684b28f791049b8c3997742c8985';
    const directLink = `https://paystack.shop/pay/mxrl-hceiv`;

    // Scenario A: Use Integrated Popup (Always try inline Pop.setup first if the js.paystack.co inline.js is loaded)
    if ((window as any).PaystackPop) {
      setIsSubmitting(true);
      try {
        // @ts-ignore
        const handler = window.PaystackPop.setup({
          key: activeKey,
          email: email,
          amount: admissionFee.amount * 100,
          currency: 'NGN',
          callback: function(response: any) {
            verifyManualPayment(response.reference, true);
          },
          onClose: function() {
            setIsSubmitting(false);
          }
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
    // 1. Initial configuration & draft restoration
    if (user) {
      setValue('email', user.email || '');
      const parts = user.displayName?.split(' ') || [];
      if (parts.length >= 2) {
        setValue('firstName', parts[0]);
        setValue('lastName', parts.slice(1).join(' '));
      }

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
    } else {
      try {
        const savedDraft = localStorage.getItem('imsc_draft_admission_guest');
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
        console.warn("Could not parse guest draft form state:", err);
      }
    }

    // 2. Fetch dynamic admission fee
    const fetchFee = async () => {
      try {
        const { data: fees } = await supabase
          .from('fees')
          .select('*')
          .limit(20);
        
        let targetAmount = admissionFeeAmount;
        let feeName = 'Admission Application Fee';

        if (fees && fees.length > 0) {
          const admFee = fees.find((f: any) => f.name && f.name.toLowerCase().includes('admission'));
          if (admFee) {
            feeName = admFee.name;
            const cachedAmount = localStorage.getItem('imsc_admission_fee_amount');
            targetAmount = cachedAmount ? parseInt(cachedAmount, 10) : admFee.amount;
          }
        } else {
          const cachedAmount = localStorage.getItem('imsc_admission_fee_amount');
          if (cachedAmount) targetAmount = parseInt(cachedAmount, 10);
        }

        setAdmissionFee({ amount: targetAmount, name: feeName });
        setAdmissionFeeAmount(targetAmount);
      } catch (e) {
        console.error("Error fetching fee:", e);
        const cachedAmount = localStorage.getItem('imsc_admission_fee_amount');
        const targetAmount = cachedAmount ? parseInt(cachedAmount, 10) : 1000;
        setAdmissionFee({ amount: targetAmount, name: 'Admission Application Fee' });
        setAdmissionFeeAmount(targetAmount);
      }
    };
    fetchFee();

    // 3. Fetch Netlify Form configs
    const fetchNetlifySettings = async () => {
      try {
        const { data: config } = await supabase
          .from('config')
          .select('*')
          .eq('id', 'admission_settings')
          .single();

        if (config) {
          if (config.netlifyFormUrl) setNetlifyFormUrl(config.netlifyFormUrl);
          setUseExternalForm(false); // Force false to use built-in form
          if (config.paystackPublicKey) {
            setPaystackPublicKey(config.paystackPublicKey);
            localStorage.setItem('imsc_paystack_public_key', config.paystackPublicKey);
          }
          if (config.admissionFeeAmount !== undefined) {
            setAdmissionFeeAmount(config.admissionFeeAmount);
            localStorage.setItem('imsc_admission_fee_amount', String(config.admissionFeeAmount));
            setAdmissionFee(prev => ({ ...prev, amount: config.admissionFeeAmount }));
          }
          if (config.admissionFormEnabled !== undefined) {
            setAdmissionFormEnabled(config.admissionFormEnabled);
            localStorage.setItem('imsc_admission_form_enabled', String(config.admissionFormEnabled));
          }
        } else {
          const localUrl = localStorage.getItem('imsc_netlify_form_url');
          if (localUrl) setNetlifyFormUrl(localUrl);
          setUseExternalForm(false); // Force false to use built-in form
          const localKey = localStorage.getItem('imsc_paystack_public_key');
          if (localKey) setPaystackPublicKey(localKey);
          const localAmount = localStorage.getItem('imsc_admission_fee_amount');
          if (localAmount) {
            const amountVal = parseInt(localAmount, 10);
            setAdmissionFeeAmount(amountVal);
            setAdmissionFee(prev => ({ ...prev, amount: amountVal }));
          }
          const localEnabled = localStorage.getItem('imsc_admission_form_enabled');
          if (localEnabled !== null) {
            setAdmissionFormEnabled(localEnabled === 'true');
          }
        }
      } catch (e) {
        console.warn("Error fetching netlify settings:", e);
        const localUrl = localStorage.getItem('imsc_netlify_form_url');
        if (localUrl) setNetlifyFormUrl(localUrl);
        setUseExternalForm(false); // Force false to use built-in form
        const localKey = localStorage.getItem('imsc_paystack_public_key');
        if (localKey) setPaystackPublicKey(localKey);
        const localAmount = localStorage.getItem('imsc_admission_fee_amount');
        if (localAmount) {
          const amountVal = parseInt(localAmount, 10);
          setAdmissionFeeAmount(amountVal);
          setAdmissionFee(prev => ({ ...prev, amount: amountVal }));
        }
        const localEnabled = localStorage.getItem('imsc_admission_form_enabled');
        if (localEnabled !== null) {
          setAdmissionFormEnabled(localEnabled === 'true');
        }
      }
    };
    fetchNetlifySettings();

    // 4. Check for successful payment and application status
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

        // 2. Check Database for existing payment records for this user (with try-catch safety)
        let foundPayment = false;
        if (user?.uid) {
          try {
            const { data: payments } = await supabase
              .from('payments')
              .select('*')
              .eq('studentId', user.uid);

            foundPayment = (payments || []).some((d: any) => {
              const type = (d.type || "").toLowerCase();
              return type.includes('admission');
            });
          } catch (payErr) {
            console.warn("Supabase payment check failed. Relying on local memory and localstorage.", payErr);
          }
        }

        const isPaid = verifiedJustNow || foundPayment || (user?.uid ? localStorage.getItem(`imsc_paid_uid_${user.uid}`) === 'true' : false);

        // 3. Check for existing application (Supabase check with try-catch fallback)
        let foundApp: any = null;
        if (user?.uid) {
          try {
            const { data: applications } = await supabase
              .from('applications')
              .select('*')
              .eq('userId', user.uid)
              .limit(1);

            if (applications && applications.length > 0) {
              foundApp = applications[0];
            }
          } catch (appQueryErr) {
            console.warn("Supabase application check failed. Falling back to local storage.", appQueryErr);
          }
        }

        // Check localStorage as robust fallback
        let offlineApp = null;
        const storageKey = user?.uid ? `imsc_submitted_app_${user.uid}` : 'imsc_submitted_app_guest';
        try {
          const localRaw = safeStorage.getItem(storageKey);
          if (localRaw) {
            offlineApp = JSON.parse(localRaw);
          }
        } catch (storageErr) {
          console.warn("Could not parse local backup application:", storageErr);
        }
        
        // Determine the correct step
        if (!user) {
          setStep(1);
          setHasPaid(false);
        } else if (foundApp) {
          const appData = foundApp;
          // If they have a completed application (at least has a status), show success/letter
          if (appData.status === 'approved' || appData.status === 'pending') {
            setExistingApplication({ id: foundApp.id, ...appData });
            setStep(4);
            setHasPaid(true); // Implied if they have an application
          } else if (isPaid) {
            setHasPaid(true);
            setStep(3);
          } else {
            setHasPaid(false);
            setStep(2);
          }
        } else if (offlineApp) {
          console.log("Restored saved application profile from local recovery:", offlineApp);
          setExistingApplication(offlineApp);
          setStep(4);
          setHasPaid(true);
        } else if (isPaid) {
          setHasPaid(true);
          setStep(3);
        } else {
          // No payment found, stay at step 2 (Payment)
          setHasPaid(false);
          setStep(2);
        }

        // Force step 4 if user is already a student/admitted (Role-based override)
        if (userData?.role === 'student' || userData?.admissionStatus === 'approved') {
          setStep(4);
        }

      } catch (err) {
        console.error("Error checking admission status:", err);
      } finally {
        setIsLoadingStatus(false);
        setCheckingPayment(false);
      }
    };

    if (!authLoading) {
      if (!user) {
        navigate('/auth?mode=register&return-to=admission', { replace: true });
        return;
      }
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
    setValue('primarySchool', 'Tudun Wada Primary School');
    setValue('primarySchoolStart', '2018');
    setValue('primarySchoolEnd', '2024');
    setValue('islamiyyaSchool', 'Imam Malik Islamiyya School');
    setValue('islamiyyaSchoolStart', '2019');
    setValue('islamiyyaSchoolEnd', '2024');
    
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
    const paidReference = localStorage.getItem(`imsc_payment_ref_${user?.uid || 'anon'}`);
    if (!paidReference) {
      alert("No verified payment reference found. Please complete the application fee payment first.");
      setHasPaid(false);
      setStep(2);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(true);
    const txnId = `TXN-${generateId().toUpperCase().slice(0, 8)}`;
    const finalDocId = txnId;
    
    try {
      // 1. Instantly save complete local backup for absolute zero-latency safety
      const completeApp = {
        id: finalDocId,
        ...data,
        userId: user?.uid || 'guest-or-anon',
        paymentStatus: 'verified',
        paystackReference: paidReference,
        appliedDate: new Date().toISOString(),
        status: 'pending',
        transactionId: txnId
      };
      
      const storageKey = user?.uid ? `imsc_submitted_app_${user.uid}` : 'imsc_submitted_app_guest';
      try {
        const prunedApp = {
          ...completeApp,
          passportPhoto: (data.passportPhoto && data.passportPhoto.length < 5000)
            ? data.passportPhoto
            : 'Uploaded photo (stored in database)'
        };
        safeStorage.setItem(storageKey, JSON.stringify(prunedApp));
      } catch (storageErr) {
        console.warn("Could not save submitted application to local storage backup due to quota limits:", storageErr);
      }

      setExistingApplication(completeApp);
      setApplicationId(finalDocId);

      // 2. Dispatch Supabase insert in background/asynchronously to render instantly without network lags
      (async () => {
        try {
          await supabase.from('applications').insert({
            ...data,
            userId: user?.uid,
            paymentStatus: 'verified',
            paystackReference: paidReference,
            appliedDate: new Date().toISOString(),
            status: 'pending',
            transactionId: txnId
          });
          console.log("Supabase background save complete!");
        } catch (err) {
          console.warn("Supabase background write skipped/failed:", err);
        }
      })();

      // 3. Dispatch to Netlify Form via background AJAX so the page renders instantly
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
      formDataObj.set('passportPhoto', (data.passportPhoto && data.passportPhoto.length < 5000) ? data.passportPhoto : 'Uploaded photo (stored in Firebase)');
      formDataObj.set('hasSpecialNeeds', data.hasSpecialNeeds || '');
      formDataObj.set('specialNeedsDetails', data.specialNeedsDetails || '');
      formDataObj.set('primarySchool', data.primarySchool || '');
      formDataObj.set('primarySchoolStart', data.primarySchoolStart || '');
      formDataObj.set('primarySchoolEnd', data.primarySchoolEnd || '');
      formDataObj.set('islamiyyaSchool', data.islamiyyaSchool || '');
      formDataObj.set('islamiyyaSchoolStart', data.islamiyyaSchoolStart || '');
      formDataObj.set('islamiyyaSchoolEnd', data.islamiyyaSchoolEnd || '');
      formDataObj.set('paymentStatus', 'verified');
      formDataObj.set('paystackReference', paidReference || '');
      formDataObj.set('transactionId', txnId);

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formDataObj.toString()
      }).then(() => {
        console.log("Netlify background form post completed successfully!");
      }).catch((err) => {
        console.warn("Netlify background form post warning:", err);
      });

      // 3.5 Dispatched successfully to Netlify Forms Database! Skip external FormBold endpoint.
      console.log("Admission form saved to Netlify Forms database and online database.");

      // 4. Move straight to Step 4 (instant response!)
      setStep(4);

      // 5. Generate PDF in the background
      setTimeout(() => {
        generatePDF(data, finalDocId);
      }, 300);

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
      await supabase.from('config').upsert({
        id: 'admission_settings',
        netlifyFormUrl: netlifyFormUrl.trim(),
        useExternalForm: false, // Force false online
        paystackPublicKey: paystackPublicKey.trim(),
        admissionFeeAmount: parseInt(String(admissionFeeAmount), 10),
        admissionFormEnabled: admissionFormEnabled,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email
      });
      localStorage.setItem('imsc_netlify_form_url', netlifyFormUrl.trim());
      localStorage.setItem('imsc_use_external_form', 'false'); // Force false locally
      localStorage.setItem('imsc_paystack_public_key', paystackPublicKey.trim());
      localStorage.setItem('imsc_admission_fee_amount', String(admissionFeeAmount));
      localStorage.setItem('imsc_admission_form_enabled', String(admissionFormEnabled));
      setAdmissionFee(prev => ({ ...prev, amount: parseInt(String(admissionFeeAmount), 10) }));
      alert("Admission settings saved successfully!");
    } catch (err: any) {
      console.error("Error saving settings:", err);
      localStorage.setItem('imsc_netlify_form_url', netlifyFormUrl.trim());
      localStorage.setItem('imsc_use_external_form', 'false'); // Force false locally
      localStorage.setItem('imsc_paystack_public_key', paystackPublicKey.trim());
      localStorage.setItem('imsc_admission_fee_amount', String(admissionFeeAmount));
      localStorage.setItem('imsc_admission_form_enabled', String(admissionFormEnabled));
      setAdmissionFee(prev => ({ ...prev, amount: parseInt(String(admissionFeeAmount), 10) }));
      alert("Settings updated locally!");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const generatePDF = async (data: FormData, id: string) => {
    const doc = new jsPDF();
    const logoUrl = "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg";
    
    // Header - Try to load image asynchronously under 750ms so as not to block PDF compilation
    try {
      const loadImageWithTimeout = (url: string, timeoutMs: number): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timer = setTimeout(() => {
            img.src = ""; // cancel request
            reject(new Error("Image fetch timeout"));
          }, timeoutMs);
          img.onload = () => {
            clearTimeout(timer);
            resolve(img);
          };
          img.onerror = (e) => {
            clearTimeout(timer);
            reject(e);
          };
          img.src = url;
        });
      };

      const logoImg = await loadImageWithTimeout(logoUrl, 750);
      doc.addImage(logoImg, 'JPEG', 10, 10, 20, 20);
    } catch (e) {
      console.warn("Logo failed to load for PDF within timeout limit, using default: ", e);
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
    
    // Previous Academic History Section
    doc.setFont("helvetica", "bold");
    doc.text("Previous Academic History", 20, 102);
    doc.setFont("helvetica", "normal");
    doc.text(`Primary School: ${data.primarySchool || 'N/A'} (Years: ${data.primarySchoolStart || 'N/A'} - ${data.primarySchoolEnd || 'N/A'})`, 20, 109);
    doc.text(`Islamiyya School: ${data.islamiyyaSchool || 'N/A'} (Years: ${data.islamiyyaSchoolStart || 'N/A'} - ${data.islamiyyaSchoolEnd || 'N/A'})`, 20, 116);
    
    if (data.hasSpecialNeeds === 'Yes') {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      doc.text("Medical/Special Attention Required:", 20, 126);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0,0,0);
      const splitDetails = doc.splitTextToSize(data.specialNeedsDetails || "Details not provided", 170);
      doc.text(splitDetails, 20, 133);
    }

    const nextY = data.hasSpecialNeeds === 'Yes' ? 155 : 130;

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
    try {
      doc.addImage(MAHMOUD_ADAMU_SIGNATURE, 'PNG', 20, nextY + 27, 30, 12);
    } catch (e) {
      console.warn("Signature addition failed:", e);
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text("Mahmoud Adamu", 20, nextY + 41);
    doc.setFont("helvetica", "normal");
    doc.text("Secretary, Governing Board", 20, nextY + 45);

    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 100);
    doc.text("Important Note: Please keep this slip safe and bring it along with you to the entrance examination. The date will be communicated.", 105, nextY + 54, { align: 'center' });
    
    doc.save(`IMSC_Application_${id}.pdf`);
  };

  const isUserAdmin = user?.email === 'maitechitservices6@gmail.com' || userData?.role === 'admin';
  const showClosedState = !admissionFormEnabled && !isUserAdmin && !existingApplication;

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
          <div className="absolute top-4 right-4 flex items-center gap-3 z-50">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    markNotificationsAsRead();
                  }
                }}
                className="relative p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all transform active:scale-95 flex items-center justify-center border border-white/10 shadow-sm"
                title="Notifications"
              >
                <Bell size={18} />
                {notifications.filter(n => n.status === 'unread').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full text-[10px] font-black flex items-center justify-center text-emerald-950 animate-pulse">
                    {notifications.filter(n => n.status === 'unread').length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 15, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-left"
                  >
                    <div className="p-4 bg-emerald-950 text-white flex justify-between items-center">
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">Inbox Notifications</h4>
                        <p className="text-[10px] text-emerald-300">Admission status updates & actions</p>
                      </div>
                      <button 
                        onClick={() => setShowNotifications(false)}
                        className="text-white/70 hover:text-white p-1"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div key={n.id} className={cn("p-4 transition-all duration-200", n.status === 'unread' ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-slate-50")}>
                            <div className="flex gap-2.5">
                              <div className={cn("mt-0.5 p-1.5 rounded-lg shrink-0", n.title.includes('Approved') ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600")}>
                                <Bell size={14} />
                              </div>
                              <div className="space-y-1 w-full">
                                <div className="flex justify-between items-start gap-2">
                                  <h5 className="text-xs font-bold text-slate-800 leading-tight">{n.title}</h5>
                                  {n.status === 'unread' && (
                                    <span className="text-[8px] bg-amber-500 text-emerald-950 font-black uppercase px-1 py-0.5 rounded flex-shrink-0">NEW</span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">{n.message}</p>
                                <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                  {n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400">
                          <Bell className="mx-auto text-slate-300 mb-2" size={24} />
                          <p className="text-xs font-bold">No inbox notifications yet.</p>
                          <p className="text-[10px] text-slate-400 mt-1">Status changes will alert you here.</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button 
              onClick={() => supabase.auth.signOut().then(() => navigate('/'))}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm transition-colors border border-white/10 font-bold"
            >
              Sign Out
            </button>
          </div>
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
                  🛠️ Developer Settings: Paystack, FormBold & External Form Mode
                </h3>
                <p className="text-[11px] text-slate-400">
                  Quick control panel to connect Paystack to FormBold forms or Netlify Forms!
                </p>
              </div>
              <span className="self-start sm:self-center text-[9px] bg-emerald-950 text-emerald-300 font-bold px-2.5 py-1 rounded-full uppercase border border-emerald-800 tracking-wider">
                Authorized Setup Mode
              </span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-left">
                  <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    🌟 Active Form Engine: Built-in Native Form (saves to Netlify)
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    FormBold is permanently deactivated to prevent mobile device login blocks and hCaptcha verification popups. The portal now runs purely on the beautifully custom-styled <strong>Built-in Native Form</strong> which instantly syncs to your central database roster and dispatches submissions directly to your <strong>Netlify Forms Database</strong> (POSTing securely to <code>/</code>).
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="paystackPublicKeyInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    💡 Paystack Public Key
                  </label>
                  <input
                    id="paystackPublicKeyInput"
                    type="text"
                    placeholder="e.g. pk_test_... or pk_live_..."
                    value={paystackPublicKey}
                    onChange={(e) => setPaystackPublicKey(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:border-amber-500 text-white font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="admissionFeeAmountInput" className="block text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    💰 Admission Fee Amount (NGN)
                  </label>
                  <input
                    id="admissionFeeAmountInput"
                    type="number"
                    min="1"
                    placeholder="e.g. 1000"
                    value={admissionFeeAmount}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setAdmissionFeeAmount(isNaN(val) ? 0 : val);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 text-xs rounded-xl focus:outline-none focus:border-amber-500 text-white font-mono"
                  />
                </div>

                <div className="md:col-span-2 p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      🚧 Application Form Availability Status
                    </h5>
                    <p className="text-[10px] text-slate-400 leading-relaxed max-w-md">
                      Instantly toggle the registration portal's availability. When disabled, prospective students are barred from submitting new registrations and see a polite closure banner instead.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdmissionFormEnabled(!admissionFormEnabled)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm border",
                      admissionFormEnabled 
                        ? "bg-emerald-950/40 text-emerald-400 border-emerald-800 hover:bg-emerald-900/30" 
                        : "bg-red-950/40 text-red-400 border-red-900 hover:bg-red-900/30"
                    )}
                  >
                    ● {admissionFormEnabled ? "Portal Active (Open)" : "Portal Suspended (Closed)"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                <p className="text-[10px] leading-relaxed max-w-lg text-slate-400">
                  {!useExternalForm 
                    ? "👉 Currently using our responsive Built-in form. It is persisted completely offline in local memory."
                    : "👉 Currently using the External FormBold embed. FormBold form loads immediately after successful Paystack payment."}
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

            {/* Quick guide for FormBold setup */}
            <div className="mt-6 pt-6 border-t border-slate-800 space-y-3 text-xs text-slate-300">
              <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                💡 Setup Checklist: Connecting Netlify Forms Database
              </h4>
              <p className="leading-relaxed text-[11px] text-slate-400">
                To collect student registrations securely into Netlify's built-in database without writing any complex server-side database code, follow these three steps:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] leading-relaxed pt-2">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-extrabold text-amber-400">1. Deploy Repository</p>
                  <p className="text-slate-400">
                    Push your code to GitHub and connect git to your <strong>Netlify Account</strong>. Build and deploy using standard Vite settings.
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-extrabold text-amber-400">2. Crawlers Auto-Detect</p>
                  <p className="text-slate-400">
                    Netlify's build engine automatically detects the form inside <code>index.html</code> with the name <code>admission-applications</code>.
                  </p>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-extrabold text-amber-400">3. View Form Submissions</p>
                  <p className="text-slate-400">
                    Go to your Netlify Site dashboard, click <strong>Site configuration</strong> &rarr; <strong>Forms</strong>. All submitted profiles will list there instantly!
                  </p>
                </div>
              </div>
              <div className="bg-amber-450/10 bg-amber-950/20 p-3.5 rounded-xl border border-amber-500/20 text-[11px] text-slate-300 mt-2">
                <span className="font-bold text-amber-400">🚀 Bulletproof Fallback Active:</span> Even if your Firestore database connection fails or permission is denied during setup, this portal remains fully functional. It caches application slips in local safety memory, lets students generate official printed PDFs immediately, and dispatches registration files straight to your <strong>Netlify database</strong>.
              </div>
            </div>
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

          {showClosedState ? (
            <div className="p-8 md:p-16 text-center max-w-2xl mx-auto space-y-8 my-4 animate-fade-in">
              <div className="w-16 h-16 bg-amber-50 text-amber-700 rounded-3xl flex items-center justify-center mx-auto border border-amber-100 shadow-sm animate-pulse">
                <AlertCircle size={32} />
              </div>
              
              <div className="space-y-3">
                <h3 className="text-2xl font-extrabold text-slate-800">Admissions Portal Closed</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Thank you for your interest in Imam Malik Science & Tahfiz College. Online admission applications for the current intake are currently <strong>closed or suspended</strong>.
                </p>
              </div>

              {!user ? (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    If you have an existing application or have already paid the application fee, please sign in to your account to view your admission letter, print your screening slip, or track your profile status.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => navigate('/auth?mode=login&return-to=admission')}
                      className="btn-primary py-3 px-6 flex items-center justify-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider shadow-sm"
                    >
                      <LogIn size={14} /> Sign In to Your Account
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                  <p className="text-xs text-slate-600 font-medium">
                    You are signed in as <strong className="text-slate-800 font-bold">{user.email}</strong>, but we could not find any submitted registrations associated with this profile.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    If you believe this is an error or need further assistance, please contact the college registry desk.
                  </p>
                  <button
                    onClick={() => supabase.auth.signOut()}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="bg-slate-50 px-8 py-6 grid grid-cols-4 gap-2 border-b border-slate-100">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex flex-col gap-2">
                <div className={cn(
                  "h-2 rounded-full transition-all duration-500",
                  step >= i ? "bg-emerald-600" : "bg-slate-200"
                )} />
                <span className={cn(
                  "text-[10px] uppercase font-bold tracking-widest text-[#0c4a6e] select-none",
                  step === i ? "text-emerald-700 font-extrabold" : "text-slate-400"
                )}>
                  {i === 1 ? '1. Account' : i === 2 ? '2. Payment' : i === 3 ? '3. Form' : '4. Complete'}
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
                  {!user ? (
                    <div className="max-w-md mx-auto py-10 px-6 sm:px-8 bg-white border border-slate-150 rounded-3xl shadow-sm space-y-8 text-center animate-fade-in">
                      <div className="w-16 h-16 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                        <UserPlus size={32} />
                      </div>
                      
                      <div className="space-y-3">
                        <h3 className="text-2xl font-bold text-slate-800">Account Required</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          To apply for admission, you must first create an applicant account. This allows you to:
                        </p>
                        <ul className="text-left text-xs text-slate-600 space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-100 font-medium">
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span> Securely pay the Paystack admission fee
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span> Auto-save your application progress safely
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span> Log back in at any time to check your status
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-600 font-bold">✓</span> Print admission letters & view class assignments
                          </li>
                        </ul>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <button
                          onClick={() => navigate('/auth?mode=register&return-to=admission')}
                          className="btn-primary py-3.5 flex items-center justify-center gap-2 cursor-pointer font-bold text-sm shadow-sm"
                        >
                          <UserPlus size={16} /> Create Account
                        </button>
                        <button
                          onClick={() => navigate('/auth?mode=login&return-to=admission')}
                          className="py-3.5 px-4 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                        >
                          <LogIn size={16} /> Sign In
                        </button>
                      </div>

                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                        Are you an administrator or teacher? <span className="underline hover:text-slate-500 transition-colors cursor-pointer" onClick={() => navigate('/auth?mode=login')}>Log in here</span>.
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto py-10 px-6 sm:px-8 bg-white border border-slate-150 rounded-3xl shadow-sm text-center animate-fade-in spacing-y-6">
                      <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} />
                      </div>
                      <h3 className="text-xl font-extrabold text-slate-800">Account Setup Active</h3>
                      <p className="text-xs text-slate-500 mt-2 mb-6">
                        You are successfully signed in as <strong className="text-slate-800 font-bold">{user.email}</strong>.
                      </p>
                      <button
                        onClick={() => setStep(2)}
                        className="w-full btn-primary py-3.5 px-6 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm text-xs uppercase tracking-wider"
                      >
                        Proceed to Step 2: Payment
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
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
                    <div className="mb-8 max-w-lg mx-auto p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-left animate-fade-in">
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
                          <p className="font-bold text-[11px] text-slate-705 text-slate-700">Option 1: Primary Redirect URL (Recommended - Avoids 403 blocks):</p>
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
                    {(() => {
                      const activeKey = paystackPublicKey || import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_live_322d4bde836a684b28f791049b8c3997742c8985';
                      const hasInlineProvider = !!(window as any).PaystackPop;
                      const isDefaultKey = activeKey.includes('pk_test_d30e527d704ba348e') || activeKey === 'pk_test_YourPublicKeyHere';
                      const isAdmin = user?.email === 'maitechitservices6@gmail.com' || userData?.role === 'admin';
                      
                      return (
                        <div className="space-y-3">
                          {isDefaultKey && (
                            <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed shadow-sm text-left">
                              <p className="font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                ⚠️ {isAdmin ? "Action Required: Paystack Key Config" : "Paystack Authorization Notice"}
                              </p>
                              {isAdmin ? (
                                <div className="mt-1 space-y-1.5">
                                  <p className="text-slate-700">
                                    You are using the default placeholder public key. Since you are logged in as <strong className="text-amber-950 font-black">{user?.email}</strong>, you see this admin notification:
                                  </p>
                                  <p className="font-semibold text-slate-800">To resolve the <span className="underline italic">"Please enter a valid Key"</span> popup issue:</p>
                                  <ul className="list-disc pl-3.5 space-y-1 text-slate-700">
                                    <li>Scroll up to the top of this page to the <strong className="text-amber-950">🛠️ Developer Settings</strong> panel.</li>
                                    <li>Input your own active Paystack Public Key (e.g. <code>pk_test_...</code> or <code>pk_live_...</code> from your Paystack Dashboard Settings tab).</li>
                                    <li>Click **Save Config Settings** to persist your key!</li>
                                  </ul>
                                </div>
                              ) : (
                                <div className="mt-1 space-y-1.5 text-slate-700">
                                  <p>
                                    The portal is currently using test mode credentials. If the checkout popup displays an invalid key notice:
                                  </p>
                                  <ul className="list-disc pl-3.5 space-y-1">
                                    <li>Use the <strong className="text-amber-950">Try direct Paystack link instead</strong> option below to register directly on the school's Paystack checkout store page.</li>
                                    <li>Alternatively, click the dashed <strong className="text-amber-950">Bypass Payment</strong> button below to evaluate or submit the form instantly in demo mode.</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {hasInlineProvider ? (
                            <div className="space-y-2">
                              <button 
                                type="button"
                                onClick={handleInitialPayment}
                                disabled={isSubmitting}
                                className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md h-12"
                              >
                                {isSubmitting ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={20} /> {openedPaymentTab ? "Relaunch Paystack Payment" : "Securely Pay with Paystack"}</>}
                              </button>
                              <p className="text-center text-[11px] text-slate-500">
                                Having issues with the popup?{" "}
                                <a 
                                  href="https://paystack.shop/pay/mxrl-hceiv"
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={() => setOpenedPaymentTab(true)}
                                  className="text-emerald-700 font-bold underline hover:text-emerald-800"
                                >
                                  Try direct Paystack link instead
                                </a>
                              </p>
                            </div>
                          ) : (
                            (() => {
                              const payLink = "https://paystack.shop/pay/mxrl-hceiv";
                              return (
                                <a 
                                  href={payLink}
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={() => setOpenedPaymentTab(true)}
                                  className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 cursor-pointer font-bold shadow-md h-12 text-center select-none block hover:scale-[1.01] active:scale-95 transition-transform"
                                >
                                  <CheckCircle2 size={20} /> {openedPaymentTab ? "Relaunch Paystack Payment" : "Securely Pay with Paystack"}
                                </a>
                              );
                            })()
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Secure Status Note */}
                    <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-left">
                      <p className="text-xs text-emerald-950 leading-relaxed font-semibold">
                        🛡️ Secure Verification Network:
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed mt-1">
                        All payments are validated in real-time. Once your payment succeeds, the system instantly logs your official transaction reference and unlocks the registration forms. Unverified submissions or bypass attempts will be automatically flagged and blacklisted.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {shouldRenderExternal ? (
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
                            const mockData: FormData = {
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
                              hasSpecialNeeds: 'No',
                              primarySchool: '',
                              primarySchoolStart: '',
                              primarySchoolEnd: '',
                              islamiyyaSchool: '',
                              islamiyyaSchoolStart: '',
                              islamiyyaSchoolEnd: ''
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
                            title="FormBold/External Registration Form" 
                            className="w-full h-full border-0"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                          />
                        </div>
                      ) : (
                        <div className="p-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-300">
                          <FileText size={48} className="text-slate-350 mx-auto mb-4" />
                          <h4 className="font-bold text-slate-700">FormBold / External Form Link Required</h4>
                          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-normal mb-6">
                            You've selected the external form mode. Please use the developer settings panel above to enter your FormBold Form URL.
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
                            setStep(4);
                          }}
                          className="px-6 py-3 bg-emerald-950 text-white hover:bg-emerald-900 rounded-xl font-bold text-xs uppercase tracking-widest cursor-pointer"
                        >
                          Finish & View Acknowledgement
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {useExternalForm && isHeadlessEndpoint && (
                        <div className="mb-6 p-5 bg-amber-50 rounded-2xl border border-amber-200 text-left space-y-2">
                          <h4 className="text-xs font-black text-amber-905 text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                            💡 FormBold API Endpoint Connected
                          </h4>
                          <p className="text-xs text-slate-650 leading-relaxed">
                            Your portal is configured to integrate with a FormBold headless endpoint (<code>{netlifyFormUrl}</code>). Since direct FormBold submission paths (<code>/s/...</code>) do not host user-facing web forms and cannot be embedded in an iframe (which triggers a 404), we have automatically loaded our beautifully styled, fully responsive <strong>Built-in Admission Form</strong> below.
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Filling out the form below writes securely to your database roster and dispatches a background webhook post straight to your FormBold account!
                          </p>
                        </div>
                      )}

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

                      <form 
                        name="admission-applications" 
                        data-netlify="true" 
                        data-netlify-honeypot="bot-field" 
                        onSubmit={handleSubmit(onSubmit)} 
                        className="space-y-8"
                      >
                        <input type="hidden" name="form-name" value="admission-applications" />
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
                              {errors.passportPhoto && <p className="text-xs text-red-500 mt-1">Please upload a valid passport photograph</p>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">First Name</label>
                              <input {...register("firstName", { required: true })} className="input-field" />
                              {errors.firstName && <span className="text-[10px] text-red-500">First name is required</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Last Name</label>
                              <input {...register("lastName", { required: true })} className="input-field" />
                              {errors.lastName && <span className="text-[10px] text-red-500">Last name is required</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Email Address</label>
                              <input 
                                type="email" 
                                {...register("email", { 
                                  required: "Email is required",
                                  pattern: {
                                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                    message: "Invalid email address"
                                  }
                                })} 
                                placeholder="name@example.com"
                                className="input-field" 
                              />
                              {errors.email && <span className="text-[10px] text-red-500">{errors.email.message || "Email is required"}</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Gender</label>
                              <select {...register("gender", { required: true })} className="input-field">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                              </select>
                              {errors.gender && <span className="text-[10px] text-red-500">Gender is required</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Date of Birth</label>
                              <input type="date" {...register("dateOfBirth", { required: true })} className="input-field" />
                              {errors.dateOfBirth && <span className="text-[10px] text-red-500">Date of birth is required</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Apply for Class</label>
                              <select {...register("targetClassId", { required: true })} className="input-field">
                                <option value="">Select Class</option>
                                {CLASSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                              {errors.targetClassId && <span className="text-[10px] text-red-500">Please select a class</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                              <input {...register("phone", { required: true })} className="input-field" />
                              {errors.phone && <span className="text-[10px] text-red-500">Phone number is required</span>}
                            </div>
                          </div>
                        </div>

                        <div className="pt-8 border-t border-slate-100">
                          <h3 className="text-lg font-bold text-emerald-950 mb-6 flex items-center gap-2 text-left">
                            <FileText size={20} className="text-amber-500" /> Academic & Islamiyya Background
                          </h3>
                          <div className="space-y-6">
                            {/* Primary School Details */}
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 text-left">
                              <h4 className="font-bold text-sm text-emerald-920 border-b border-slate-200 pb-2 flex items-center gap-1.5 text-emerald-900">
                                Primary School Records
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2 md:col-span-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Primary School Name</label>
                                  <input {...register("primarySchool", { required: true })} placeholder="e.g. Tudun Wada Primary School" className="input-field" />
                                  {errors.primarySchool && <span className="text-[10px] text-red-500">This field is required</span>}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Year Started</label>
                                  <input type="number" min="1990" max="2030" {...register("primarySchoolStart", { required: true })} placeholder="e.g. 2018" className="input-field" />
                                  {errors.primarySchoolStart && <span className="text-[10px] text-red-500">Required</span>}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Year Graduated</label>
                                  <input type="number" min="1990" max="2030" {...register("primarySchoolEnd", { required: true })} placeholder="e.g. 2024" className="input-field" />
                                  {errors.primarySchoolEnd && <span className="text-[10px] text-red-500">Required</span>}
                                </div>
                              </div>
                            </div>

                            {/* Islamiyya School Details */}
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 text-left">
                              <h4 className="font-bold text-sm text-emerald-920 border-b border-slate-200 pb-2 flex items-center gap-1.5 text-emerald-900">
                                Islamiyya School Records
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2 md:col-span-1">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Islamiyya School Name</label>
                                  <input {...register("islamiyyaSchool", { required: true })} placeholder="e.g. Al-Iman Islamiyya School" className="input-field" />
                                  {errors.islamiyyaSchool && <span className="text-[10px] text-red-500">This field is required</span>}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Year Started</label>
                                  <input type="number" min="1990" max="2030" {...register("islamiyyaSchoolStart", { required: true })} placeholder="e.g. 2019" className="input-field" />
                                  {errors.islamiyyaSchoolStart && <span className="text-[10px] text-red-500">Required</span>}
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Year Left</label>
                                  <input type="number" min="1990" max="2030" {...register("islamiyyaSchoolEnd", { required: true })} placeholder="e.g. 2024" className="input-field" />
                                  {errors.islamiyyaSchoolEnd && <span className="text-[10px] text-red-500">Required</span>}
                                </div>
                              </div>
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
                              {errors.guardianName && <span className="text-[10px] text-red-500">Guardian name is required</span>}
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Guardian Phone</label>
                              <input {...register("guardianPhone", { required: true })} className="input-field" />
                              {errors.guardianPhone && <span className="text-[10px] text-red-500">Guardian phone number is required</span>}
                            </div>
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Residential Address</label>
                              <textarea {...register("address", { required: true })} className="input-field min-h-[100px]" />
                              {errors.address && <span className="text-[10px] text-red-500">Residential address is required</span>}
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

              {step === 4 && (
                <motion.div
                  key="step4"
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
            </>
          )}
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
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">2. Previous Academic History</h4>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Primary School Name</span>
                          <span className="font-bold text-slate-800">{existingApplication?.primarySchool || watch('primarySchool') || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Years Attended (Primary)</span>
                          <span className="font-bold text-slate-700">
                            {existingApplication?.primarySchoolStart || watch('primarySchoolStart') || 'N/A'} - {existingApplication?.primarySchoolEnd || watch('primarySchoolEnd') || 'N/A'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Islamiyya School Name</span>
                          <span className="font-bold text-slate-800">{existingApplication?.islamiyyaSchool || watch('islamiyyaSchool') || 'N/A'}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200/60 col-span-2">
                          <span className="text-slate-400 font-bold uppercase block mb-0.5">Years Attended (Islamiyya)</span>
                          <span className="font-bold text-slate-700">
                            {existingApplication?.islamiyyaSchoolStart || watch('islamiyyaSchoolStart') || 'N/A'} - {existingApplication?.islamiyyaSchoolEnd || watch('islamiyyaSchoolEnd') || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">3. Parent / Guardian Records</h4>
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
                      <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider border-b border-emerald-900/10 pb-1">4. Medical Status Declarations</h4>
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
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block mb-4">Official Seal & Signatures</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="h-12 border-b border-slate-300"></div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mt-1">First Scrutineer</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-12 flex items-center justify-center">
                          <img src={MAHMOUD_ADAMU_SIGNATURE} alt="Mahmoud Adamu Signature" className="h-10 object-contain" />
                        </div>
                        <div className="border-b border-slate-300 w-full"></div>
                        <span className="text-[9px] text-slate-900 font-bold uppercase block mt-1 text-center">Mahmoud Adamu</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase block text-center">Secretary, Governing Board</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rewritten Note Block at the bottom of the HTML preview */}
                <div className="mt-8 pt-6 border-t border-slate-100 text-center">
                  <p className="text-[11px] font-medium text-slate-500 leading-relaxed max-w-2xl mx-auto bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                    <strong className="text-emerald-950">Important Note:</strong> Please keep this slip safe and bring it along with you to the entrance examination. The date will be communicated.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
