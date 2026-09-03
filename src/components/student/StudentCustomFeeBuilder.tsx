import React, { useState } from 'react';
import { Calendar, Clock, GraduationCap, Receipt, Sparkles, CreditCard, ExternalLink, Check, Copy } from 'lucide-react';
import { FeePaymentItem } from './PaystackCheckoutModal';

interface StudentCustomFeeBuilderProps {
  studentName: string;
  examNo: string;
  assignedClass: string;
  onLaunchCheckout: (item: FeePaymentItem) => void;
}

export function StudentCustomFeeBuilder({
  studentName,
  examNo,
  assignedClass,
  onLaunchCheckout
}: StudentCustomFeeBuilderProps) {
  const [customTerm, setCustomTerm] = useState('1st Term');
  const [customSession, setCustomSession] = useState('2026/2027');
  const [customClass, setCustomClass] = useState(assignedClass || 'JSS 1A');
  const [customFeeCategory, setCustomFeeCategory] = useState('tuition_12k');
  const [customFeeAmount, setCustomFeeAmount] = useState(12000);
  const [customFeeTitle, setCustomFeeTitle] = useState('1st Term Tuition Fee');
  const [copiedCallbackUrl, setCopiedCallbackUrl] = useState(false);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0
    }).format(amt);
  };

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

  const handleProceed = () => {
    let cat = 'Termly Tuition';
    if (customFeeCategory === 'dev_3k') cat = 'Development Levy (Once in 3 Yrs)';
    else if (customFeeCategory === 'intake_15k') cat = 'Registration & Development Package';
    else if (customFeeCategory === 'exam_1k') cat = 'Registration & Prospectus';
    else if (customFeeCategory === 'pta_2500') cat = 'PTA & Welfare';
    else if (customFeeCategory === 'custom') cat = 'Special Educational Fee';

    onLaunchCheckout({
      title: customFeeTitle,
      category: cat,
      amount: customFeeAmount,
      term: customTerm,
      session: customSession
    });
  };

  const paystackCallbackUrl = `${window.location.origin}${window.location.pathname}#/student/fees?reference={{reference}}`;

  const copyCallbackUrl = () => {
    navigator.clipboard.writeText(paystackCallbackUrl);
    setCopiedCallbackUrl(true);
    setTimeout(() => setCopiedCallbackUrl(false), 3000);
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200/60">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-base font-black text-emerald-950 uppercase tracking-tight">
              Online Fee Payment & Academic Period Selector
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Choose the Academic Session, Term, Class, and Fee Item you are paying for:
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-200 self-start sm:self-auto">
          Instant Verified PDF Receipt
        </span>
      </div>

      {/* 4-Field Combo Box Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Combo 1: Academic Session */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Calendar size={13} className="text-emerald-700" />
            Academic Session <span className="text-red-500">*</span>
          </label>
          <select
            value={customSession}
            onChange={(e) => setCustomSession(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 cursor-pointer"
          >
            <option value="2026/2027">2026/2027 (Current Intake)</option>
            <option value="2025/2026">2025/2026</option>
            <option value="2027/2028">2027/2028</option>
            <option value="2028/2029">2028/2029</option>
          </select>
        </div>

        {/* Combo 2: Academic Term */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock size={13} className="text-emerald-700" />
            Academic Term <span className="text-red-500">*</span>
          </label>
          <select
            value={customTerm}
            onChange={(e) => {
              setCustomTerm(e.target.value);
              if (customFeeCategory === 'tuition_12k') {
                setCustomFeeTitle(`${e.target.value} Tuition Fee`);
              }
            }}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 cursor-pointer"
          >
            <option value="1st Term">1st Term (Resumption / Intake)</option>
            <option value="2nd Term">2nd Term (Mid-Year)</option>
            <option value="3rd Term">3rd Term (Promotional)</option>
            <option value="Annual / Full Session">Annual / Full Session (3 Terms)</option>
            <option value="3-Year Period (2026-2029)">3-Year Study Period</option>
          </select>
        </div>

        {/* Combo 3: Student Class */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <GraduationCap size={13} className="text-emerald-700" />
            Student Class / Stream <span className="text-red-500">*</span>
          </label>
          <select
            value={customClass}
            onChange={(e) => setCustomClass(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 cursor-pointer"
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

        {/* Combo 4: Fee Category Preset */}
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Receipt size={13} className="text-emerald-700" />
            Fee Category Preset <span className="text-red-500">*</span>
          </label>
          <select
            value={customFeeCategory}
            onChange={(e) => handleFeeCategoryChange(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-slate-800 cursor-pointer"
          >
            <option value="tuition_12k">Termly Tuition Fee (₦12,000)</option>
            <option value="dev_3k">3-Year Development Levy (₦3,000)</option>
            <option value="intake_15k">Full Intake Package (₦15,000)</option>
            <option value="annual_36k">Annual Session Tuition - 3 Terms (₦36,000)</option>
            <option value="exam_1k">Entrance Exam & Application (₦1,000)</option>
            <option value="pta_2500">PTA Welfare Levy (₦2,500)</option>
            <option value="custom">Other Custom Fee Item (Editable)</option>
          </select>
        </div>
      </div>

      {/* Editable Amount & Title if Custom, plus Proceed Button */}
      <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1 space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Paying For:</span>
            <strong className="text-emerald-950 font-black">{customFeeTitle}</strong>
          </div>
          <p className="text-[11px] text-slate-600">
            Selected Target: <strong>{customTerm}</strong> • Session <strong>{customSession}</strong> • Class: <strong>{customClass}</strong> • Candidate: <strong>{studentName}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
          {customFeeCategory === 'custom' && (
            <div className="w-32">
              <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Amount (₦)</label>
              <input
                type="number"
                min="100"
                step="100"
                value={customFeeAmount}
                onChange={(e) => setCustomFeeAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-xl font-mono font-black text-xs text-emerald-950"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleProceed}
            className="flex-1 md:flex-none px-6 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md shadow-emerald-900/10 hover:scale-[1.02] active:scale-98 transition-all cursor-pointer"
          >
            <CreditCard size={15} />
            <span>Proceed to Pay {formatCurrency(customFeeAmount)}</span>
          </button>
        </div>
      </div>

      {/* Paystack Dashboard Redirect Callback Link Bar */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-800">
        <div className="space-y-0.5 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <ExternalLink size={14} />
            <span>Paystack Dashboard Redirect / Callback Link</span>
          </div>
          <p className="text-[11px] text-slate-300">
            Paste this in your Paystack Dashboard &gt; Preferences &gt; "Redirect after payment" so payers return directly to their dashboard with a verified PDF receipt:
          </p>
          <code className="text-[10px] font-mono text-emerald-400 select-all block break-all pt-1">
            {paystackCallbackUrl}
          </code>
        </div>

        <button
          type="button"
          onClick={copyCallbackUrl}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          {copiedCallbackUrl ? <Check size={14} className="text-white" /> : <Copy size={14} />}
          <span>{copiedCallbackUrl ? "Copied Link!" : "Copy Redirect Link"}</span>
        </button>
      </div>
    </div>
  );
}
