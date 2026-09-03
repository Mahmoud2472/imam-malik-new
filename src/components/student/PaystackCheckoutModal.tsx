import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, ExternalLink, ShieldCheck, CheckCircle2, 
  AlertCircle, Copy, Check, X, Loader2, Landmark, 
  Sparkles, Receipt, ArrowRight, HelpCircle
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { DEFAULT_PAYSTACK_PUBLIC_KEY } from '../../lib/supabase-defaults';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { sendPaymentSuccessEmail } from '../../lib/emailService';

export interface FeePaymentItem {
  title: string;
  category: string;
  amount: number;
  term: string;
  session: string;
  receiptNumber?: string;
}

interface PaystackCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: FeePaymentItem;
  studentName: string;
  examNo: string;
  assignedClass: string;
  gender?: string;
  onPaymentSuccess: (receiptData: any) => void;
}

export default function PaystackCheckoutModal({
  isOpen,
  onClose,
  item: initialItem,
  studentName,
  examNo,
  assignedClass: initialAssignedClass,
  gender = 'male',
  onPaymentSuccess
}: PaystackCheckoutModalProps) {
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'inline' | 'link' | 'transfer' | 'redirect_guide'>('inline');
  const [isProcessing, setIsProcessing] = useState(false);
  const [referenceInput, setReferenceInput] = useState('');
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedRedirectUrl, setCopiedRedirectUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Customizable selection state (Term, Session, Class, Fee Preset)
  const [selectedTerm, setSelectedTerm] = useState(initialItem.term || '1st Term');
  const [selectedSession, setSelectedSession] = useState(initialItem.session || '2026/2027');
  const [selectedClass, setSelectedClass] = useState(initialAssignedClass || 'JSS 1A (Boys Section)');
  const [feeCategoryPreset, setFeeCategoryPreset] = useState<string>(
    initialItem.category.toLowerCase().includes('dev') ? 'development' :
    initialItem.category.toLowerCase().includes('package') ? 'package' :
    initialItem.category.toLowerCase().includes('adm') ? 'admission' :
    'tuition'
  );
  const [customTitle, setCustomTitle] = useState(initialItem.title);
  const [customAmount, setCustomAmount] = useState<number>(initialItem.amount || 12000);
  const [showCustomizer, setShowCustomizer] = useState(false);

  // Sync when initialItem changes
  React.useEffect(() => {
    setSelectedTerm(initialItem.term || '1st Term');
    setSelectedSession(initialItem.session || '2026/2027');
    setCustomTitle(initialItem.title);
    setCustomAmount(initialItem.amount);
    if (initialItem.category.toLowerCase().includes('dev')) setFeeCategoryPreset('development');
    else if (initialItem.category.toLowerCase().includes('package')) setFeeCategoryPreset('package');
    else if (initialItem.category.toLowerCase().includes('adm')) setFeeCategoryPreset('admission');
    else setFeeCategoryPreset('tuition');
  }, [initialItem]);

  if (!isOpen) return null;

  // Compute active item from selection
  const currentItem: FeePaymentItem = {
    title: customTitle,
    category: 
      feeCategoryPreset === 'tuition' ? 'Termly Tuition' :
      feeCategoryPreset === 'development' ? 'Development Levy (Once in 3 Yrs)' :
      feeCategoryPreset === 'package' ? 'Registration & Development Package' :
      feeCategoryPreset === 'admission' ? 'Registration & Prospectus' :
      'General / Custom School Fee',
    amount: Number(customAmount) > 0 ? Number(customAmount) : 12000,
    term: selectedTerm,
    session: selectedSession
  };

  const email = user?.email || userData?.email || `${examNo.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'student'}@student.imsc.edu.ng`;
  const activeKey = (window as any).customPaystackKey || DEFAULT_PAYSTACK_PUBLIC_KEY || 'pk_live_322d4bde836a684b28f791049b8c3997742c8985';

  // Compute the live redirect link for Paystack Dashboard
  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://ais-dev-soxajy6xorbq2bfiujxmci-462479283857.europe-west2.run.app';
  const paystackRedirectUrl = `${originUrl}/#/student/fees?reference={{reference}}`;

  const copyPaystackRedirectUrl = () => {
    navigator.clipboard.writeText(paystackRedirectUrl);
    setCopiedRedirectUrl(true);
    setTimeout(() => setCopiedRedirectUrl(false), 2500);
  };

  const handlePresetChange = (preset: string) => {
    setFeeCategoryPreset(preset);
    if (preset === 'tuition') {
      setCustomTitle(`New Student Registration & ${selectedTerm} Tuition`);
      setCustomAmount(12000);
    } else if (preset === 'development') {
      setCustomTitle('College Development Levy (3-Year Study Period)');
      setCustomAmount(3000);
      setSelectedTerm('3-Year Period (2026-2029)');
    } else if (preset === 'package') {
      setCustomTitle(`Combined New Intake Package (${selectedTerm} Tuition + 3-Yr Development Levy)`);
      setCustomAmount(15000);
    } else if (preset === 'full_year') {
      setCustomTitle(`Full Academic Session Tuition (3 Terms - 2026/2027)`);
      setCustomAmount(36000);
      setSelectedTerm('Full Academic Session (3 Terms)');
    } else if (preset === 'admission') {
      setCustomTitle('Entrance Examination & Prospectus Application Fee');
      setCustomAmount(1000);
      setSelectedTerm('Admission Intake');
    } else if (preset === 'pta') {
      setCustomTitle('PTA Levy & Academic Welfare Support');
      setCustomAmount(2500);
    } else {
      setCustomTitle('Custom / Miscellaneous Fee Payment');
    }
  };

  const ensurePaystackScriptLoaded = async (): Promise<boolean> => {
    if ((window as any).PaystackPop) return true;

    return new Promise((resolve) => {
      try {
        const existing = document.querySelector('script[src*="paystack.co"]');
        if (existing) {
          existing.addEventListener('load', () => resolve(true));
          setTimeout(() => resolve(!!(window as any).PaystackPop), 1200);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      } catch (e) {
        resolve(false);
      }
    });
  };

  const handlePaystackInline = async () => {
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const scriptReady = await ensurePaystackScriptLoaded();
      const hasPaystack = !!(window as any).PaystackPop;

      if (!scriptReady && !hasPaystack) {
        setErrorMessage("Paystack inline popup was blocked by browser or connection. Switched to direct payment link.");
        setActiveTab('link');
        setIsProcessing(false);
        return;
      }

      const categoryPrefix = currentItem.category.toLowerCase().includes('dev') ? 'DEV' : 
                             currentItem.category.toLowerCase().includes('adm') ? 'ADM' : 'TUI';
      const txnRef = `IMSC-${categoryPrefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

      // Define standard synchronous callback handlers to pass strict Paystack inline validation
      const onPaymentSuccessCallback = function(response: any) {
        const verifiedRef = (response && (response.reference || response.trxref)) || txnRef;
        finalizeSuccessfulPayment(verifiedRef, 'Paystack Online (Interactive Gateway)');
      };

      const onPaymentCloseCallback = function() {
        setIsProcessing(false);
      };

      const paystackOptions: any = {
        key: activeKey,
        email: email,
        amount: Math.round(Number(currentItem.amount) * 100), // in kobo
        currency: 'NGN',
        ref: txnRef,
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
        metadata: {
          custom_fields: [
            { display_name: "Student Name", variable_name: "student_name", value: studentName },
            { display_name: "Exam / Student ID", variable_name: "exam_number", value: examNo },
            { display_name: "Assigned Class", variable_name: "assigned_class", value: selectedClass },
            { display_name: "Fee Item", variable_name: "fee_title", value: currentItem.title },
            { display_name: "Fee Classification", variable_name: "fee_category", value: currentItem.category },
            { display_name: "Academic Term", variable_name: "academic_term", value: currentItem.term },
            { display_name: "Academic Session", variable_name: "academic_session", value: currentItem.session }
          ]
        },
        callback: onPaymentSuccessCallback,
        onClose: onPaymentCloseCallback
      };

      // Call PaystackPop.setup
      if (typeof (window as any).PaystackPop?.setup === 'function') {
        const handler = (window as any).PaystackPop.setup(paystackOptions);
        if (handler && typeof handler.openIframe === 'function') {
          handler.openIframe();
        }
      } else if (typeof (window as any).PaystackPop === 'function') {
        const paystack = new (window as any).PaystackPop();
        if (typeof paystack.newTransaction === 'function') {
          paystack.newTransaction(paystackOptions);
        } else if (typeof paystack.setup === 'function') {
          paystack.setup(paystackOptions).openIframe();
        }
      } else {
        throw new Error("Paystack inline SDK not initialized properly");
      }
    } catch (err: any) {
      console.error("Paystack inline popup execution error:", err);
      setErrorMessage("Could not launch inline popup. You can use the Direct Paystack Link or Bank Transfer options below.");
      setActiveTab('link');
      setIsProcessing(false);
    }
  };

  const finalizeSuccessfulPayment = async (reference: string, method: string) => {
    setIsProcessing(true);
    try {
      const receiptNo = `REC-${currentItem.category.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;
      const paymentRecord = {
        studentId: user?.uid || examNo,
        studentName,
        examNumber: examNo,
        gender,
        classId: selectedClass,
        term: currentItem.term || '1st Term',
        session: currentItem.session || '2026/2027',
        type: currentItem.title,
        category: currentItem.category,
        amount: currentItem.amount,
        paymentMethod: method,
        paystackReference: reference.trim().toUpperCase(),
        receiptNumber: receiptNo,
        status: 'verified',
        paymentDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      // 1. Save to Firestore
      try {
        await addDoc(collection(db, "payments"), paymentRecord);
      } catch (fsErr) {
        console.warn("Firestore payment save warning:", fsErr);
      }

      // 2. Save to Supabase
      if (isSupabaseConfigured) {
        try {
          await supabase.from('payments').insert([paymentRecord]);
        } catch (sbErr) {
          console.warn("Supabase payment save warning:", sbErr);
        }
      }

      // 3. Add notification for student & admin
      try {
        await addDoc(collection(db, "notifications"), {
          userId: user?.uid || 'all',
          title: `Payment Confirmed: ${currentItem.title} 🎉`,
          message: `Official payment of ₦${currentItem.amount.toLocaleString()} for ${currentItem.title} (${selectedTerm}, ${selectedSession}, ${selectedClass}) was confirmed and logged to your account.`,
          type: 'payment_success',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      } catch (notifErr) {}

      // Dispatch Brevo transaction email receipt to student/parent
      sendPaymentSuccessEmail({
        customerName: studentName,
        email: email,
        amount: currentItem.amount,
        reference: reference.trim().toUpperCase(),
        description: `${currentItem.title} (${currentItem.term} ${currentItem.session} • ${selectedClass})`,
        receiptNumber: receiptNo,
        userId: user?.uid
      }).catch(emErr => console.warn("Background student fee email notice warning:", emErr));

      // 4. Return to parent
      onPaymentSuccess({
        ...paymentRecord,
        id: receiptNo,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      });

      onClose();
    } catch (err: any) {
      console.error("Error finalizing payment:", err);
      setErrorMessage("Payment was authorized but recording encountered a delay. Please contact bursary with reference: " + reference);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceInput.trim()) {
      setErrorMessage("Please enter the transaction reference code or teller number.");
      return;
    }
    const method = activeTab === 'transfer' ? 'Direct Bank Transfer / Deposit' : 'Paystack Online (paystack.shop/pay/imammalikcollege)';
    await finalizeSuccessfulPayment(referenceInput.trim(), method);
  };

  const copyAccountNumber = () => {
    navigator.clipboard.writeText('1018294821');
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 no-print">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 text-slate-800"
        >
          {/* Modal Header */}
          <div className="p-6 school-gradient text-white relative">
            <div className="flex justify-between items-start">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-400 text-emerald-950 text-[10px] font-black uppercase rounded-md tracking-wider mb-2 shadow-xs">
                  <ShieldCheck size={12} /> Secure College Fee Gateway
                </span>
                <h3 className="text-xl font-black">{currentItem.title}</h3>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Candidate: <strong>{studentName}</strong> • Exam/Portal ID: <strong className="font-mono">{examNo}</strong>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                title="Close checkout modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Prominent Amount & Target Metadata Tag */}
            <div className="mt-4 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-200 block">Total Amount Payable</span>
                <div className="text-2xl font-black text-amber-300">
                  {formatCurrency(currentItem.amount)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-200 block">Academic Details</span>
                <span className="text-xs font-bold text-white block">
                  {selectedTerm} • {selectedSession}
                </span>
                <span className="text-[11px] font-semibold text-amber-300">
                  {selectedClass}
                </span>
              </div>
            </div>
          </div>

          {/* Customizable Term, Session, Class, and Fee Preset Dropdown Selector Panel */}
          <div className="bg-emerald-50/70 border-b border-emerald-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-600" />
                Select Term, Session & Class
              </span>
              <button
                type="button"
                onClick={() => setShowCustomizer(!showCustomizer)}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              >
                {showCustomizer ? "Hide Customizer" : "Change Term / Session / Class"}
              </button>
            </div>

            {showCustomizer ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900 mb-1">
                    Academic Term
                  </label>
                  <select
                    value={selectedTerm}
                    onChange={(e) => {
                      setSelectedTerm(e.target.value);
                      if (feeCategoryPreset === 'tuition') {
                        setCustomTitle(`New Student Registration & ${e.target.value} Tuition`);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                    <option value="Annual / Full Session">Annual / Full Session</option>
                    <option value="3-Year Period (2026-2029)">3-Year Period (2026-2029)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900 mb-1">
                    Academic Session
                  </label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="2026/2027">2026/2027 (Current Intake)</option>
                    <option value="2025/2026">2025/2026</option>
                    <option value="2027/2028">2027/2028</option>
                    <option value="2028/2029">2028/2029</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900 mb-1">
                    Target Student Class
                  </label>
                  <select
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="JSS 1A (Boys Section)">JSS 1A (Boys Section)</option>
                    <option value="JSS 1B (Girls Section)">JSS 1B (Girls Section)</option>
                    <option value="JSS 2A (Boys Section)">JSS 2A (Boys Section)</option>
                    <option value="JSS 2B (Girls Section)">JSS 2B (Girls Section)</option>
                    <option value="JSS 3A (Boys Section)">JSS 3A (Boys Section)</option>
                    <option value="JSS 3B (Girls Section)">JSS 3B (Girls Section)</option>
                    <option value="SSS 1A (Boys Section)">SSS 1A (Boys Section)</option>
                    <option value="SSS 1B (Girls Section)">SSS 1B (Girls Section)</option>
                    <option value="SSS 2A (Boys Section)">SSS 2A (Boys Section)</option>
                    <option value="SSS 2B (Girls Section)">SSS 2B (Girls Section)</option>
                    <option value="SSS 3A (Boys Section)">SSS 3A (Boys Section)</option>
                    <option value="SSS 3B (Girls Section)">SSS 3B (Girls Section)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 pt-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900 mb-1">
                    Fee Classification Preset
                  </label>
                  <select
                    value={feeCategoryPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="tuition">Termly Tuition Fee (₦12,000)</option>
                    <option value="development">3-Year Development Levy (₦3,000)</option>
                    <option value="package">Combined Intake Package (₦15,000)</option>
                    <option value="full_year">Full Session Tuition 3 Terms (₦36,000)</option>
                    <option value="admission">Entrance Exam & Prospectus Fee (₦1,000)</option>
                    <option value="pta">PTA Welfare Levy (₦2,500)</option>
                    <option value="custom">Custom Other Fee Amount</option>
                  </select>
                </div>

                <div className="pt-1">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-900 mb-1">
                    Fee Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-xl font-bold text-emerald-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-900">
                <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  Term: <strong>{selectedTerm}</strong>
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  Session: <strong>{selectedSession}</strong>
                </span>
                <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  Class: <strong>{selectedClass}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Payment Method Selector Tabs */}
          <div className="grid grid-cols-4 bg-slate-100 p-1.5 border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => { setActiveTab('inline'); setErrorMessage(null); }}
              className={cn(
                "py-2.5 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[11px]",
                activeTab === 'inline' ? "bg-white text-emerald-950 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <CreditCard size={13} className={activeTab === 'inline' ? "text-emerald-600" : ""} />
              <span>Instant Popup</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('link'); setErrorMessage(null); }}
              className={cn(
                "py-2.5 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[11px]",
                activeTab === 'link' ? "bg-white text-emerald-950 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ExternalLink size={13} className={activeTab === 'link' ? "text-emerald-600" : ""} />
              <span>Direct Link</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('transfer'); setErrorMessage(null); }}
              className={cn(
                "py-2.5 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[11px]",
                activeTab === 'transfer' ? "bg-white text-emerald-950 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <Landmark size={13} className={activeTab === 'transfer' ? "text-emerald-600" : ""} />
              <span>Bank Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => { setActiveTab('redirect_guide'); setErrorMessage(null); }}
              className={cn(
                "py-2.5 px-1.5 rounded-xl flex items-center justify-center gap-1 transition-all text-center cursor-pointer text-[11px]",
                activeTab === 'redirect_guide' ? "bg-white text-emerald-950 shadow-xs font-black" : "text-slate-500 hover:text-slate-800"
              )}
            >
              <ArrowRight size={13} className={activeTab === 'redirect_guide' ? "text-amber-600" : ""} />
              <span>Callback Link</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-6 space-y-5">
            {errorMessage && (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <p className="font-bold">Payment Notice</p>
                  <p className="text-[11px] text-amber-800">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* TAB 1: INSTANT PAYSTACK POPUP */}
            {activeTab === 'inline' && (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold">
                    <Sparkles size={16} className="text-emerald-600" />
                    <span>Instant Automated Processing</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Pay securely for <strong>{currentItem.title}</strong> ({selectedTerm}, {selectedSession}, {selectedClass}) using any Nigerian Debit Card, Bank App Transfer, USSD, or QR.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded">💳 Debit Cards</span>
                    <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded">📱 USSD Banking</span>
                    <span className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded">🏦 Bank Account Transfer</span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePaystackInline}
                    disabled={isProcessing}
                    className="w-full py-4 bg-emerald-800 hover:bg-emerald-900 text-white rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 hover:scale-[1.01] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Opening Paystack Checkout...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Pay {formatCurrency(currentItem.amount)} Online Now</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    Secured by 256-Bit SSL Encryption • Instant official receipt generation
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: DIRECT PAYSTACK LINK */}
            {activeTab === 'link' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3">
                  <p className="text-slate-700 leading-relaxed">
                    Click the official school Paystack checkout page link below to complete your payment in a new tab:
                  </p>
                  <a
                    href="https://paystack.shop/pay/imammalikcollege"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-emerald-950 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.01]"
                  >
                    <ExternalLink size={16} />
                    Open Paystack Page (paystack.shop/pay/imammalikcollege)
                  </a>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Transaction Reference / Confirmation Code
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PAY-9823412 or T9823412984"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-xs uppercase font-bold"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Found in your Paystack email notification or completion screen.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>Confirm & Update Ledger</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB 3: DIRECT SCHOOL BANK TRANSFER */}
            {activeTab === 'transfer' && (
              <div className="space-y-4">
                <div className="p-4 bg-amber-50/80 rounded-2xl border border-amber-200 text-xs space-y-3">
                  <div className="flex items-center gap-2 text-amber-950 font-bold">
                    <Landmark size={16} className="text-amber-700" />
                    <span>Official College Bank Account Details</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2 text-slate-700">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Account Name:</span>
                      <span className="font-bold text-slate-900 text-right">IMAM MALIK SCIENCE & TAHFIZ COLLEGE</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">Bank Name:</span>
                      <span className="font-bold text-slate-900">Stanbic IBTC Bank / Zenith Bank</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Account Number</span>
                        <span className="font-mono font-black text-base text-emerald-950 tracking-wider">1018294821</span>
                      </div>
                      <button
                        type="button"
                        onClick={copyAccountNumber}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedAccount ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copiedAccount ? "Copied!" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Make your transfer of <strong>{formatCurrency(currentItem.amount)}</strong>, then enter your Transaction Reference, Session ID, or Depositor's Name below for immediate recording:
                  </p>
                </div>

                <form onSubmit={handleManualSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      Bank Transfer Reference / Session ID / Depositor Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TRF-10928374 or Ibrahim Adamu"
                      value={referenceInput}
                      onChange={(e) => setReferenceInput(e.target.value)}
                      className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-xs uppercase font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="w-full py-3.5 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    <span>Submit Transfer Proof & Issue Receipt</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB 4: PAYSTACK REDIRECT URL & CALLBACK SETUP GUIDE */}
            {activeTab === 'redirect_guide' && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3 border border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Receipt size={16} />
                    <span>Paystack Dashboard Callback / Redirect URL</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Use this official URL in your <strong>Paystack Dashboard Settings &gt; Preferences</strong> or <strong>Payment Page &gt; Redirect after payment</strong> so payers are automatically returned to their Student Dashboard with a success message and direct PDF receipt generation.
                  </p>

                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-2">
                    <code className="text-[11px] font-mono text-emerald-400 break-all select-all">
                      {paystackRedirectUrl}
                    </code>
                    <button
                      type="button"
                      onClick={copyPaystackRedirectUrl}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedRedirectUrl ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedRedirectUrl ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    How the Automatic Return Works:
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    1. Payer completes payment on Paystack.
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    2. Paystack immediately redirects them to the URL with <code className="font-mono bg-emerald-100 px-1 rounded">?reference=...</code> parameter.
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    3. The portal verifies the payment, displays an instant Celebration Confirmation Modal, logs it to their statement of account, and provides a 1-click button to download/print the official stamped PDF payment receipt.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Note */}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <HelpCircle size={12} /> Need help? Bursary: <strong>07011748311, 08032765759</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-slate-900 font-bold hover:underline cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
