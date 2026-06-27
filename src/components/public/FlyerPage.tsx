import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Copy, 
  Check, 
  Printer, 
  Smartphone, 
  Share2, 
  Calendar, 
  DollarSign, 
  BookOpen, 
  ArrowRight, 
  MapPin, 
  Phone, 
  Mail, 
  Clock, 
  Sparkles, 
  GraduationCap, 
  Heart,
  Palette,
  Eye
} from 'lucide-react';

// Theme configuration for the interactive flyer
interface FlyerTheme {
  id: string;
  name: string;
  bgGrad: string;
  accentBg: string;
  accentText: string;
  badgeBg: string;
  badgeText: string;
  borderCol: string;
  cardBg: string;
}

const FLYER_THEMES: FlyerTheme[] = [
  {
    id: 'emerald-gold',
    name: 'Royal Emerald & Gold (School Colors)',
    bgGrad: 'from-emerald-950 via-emerald-900 to-emerald-950',
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-500',
    badgeBg: 'bg-amber-500/15 border-amber-500/30',
    badgeText: 'text-amber-400',
    borderCol: 'border-amber-500/20',
    cardBg: 'bg-emerald-900/40 backdrop-blur-md border-emerald-800/40'
  },
  {
    id: 'royal-blue',
    name: 'Cosmic Ocean & Orange',
    bgGrad: 'from-blue-950 via-indigo-950 to-blue-950',
    accentBg: 'bg-orange-500',
    accentText: 'text-orange-500',
    badgeBg: 'bg-orange-500/15 border-orange-500/30',
    badgeText: 'text-orange-400',
    borderCol: 'border-orange-500/20',
    cardBg: 'bg-indigo-900/35 backdrop-blur-md border-indigo-800/40'
  },
  {
    id: 'crimson-dark',
    name: 'Imperial Crimson & Amber',
    bgGrad: 'from-red-950 via-rose-950 to-red-950',
    accentBg: 'bg-amber-400',
    accentText: 'text-amber-400',
    badgeBg: 'bg-amber-400/15 border-amber-400/30',
    badgeText: 'text-amber-300',
    borderCol: 'border-amber-400/20',
    cardBg: 'bg-red-900/35 backdrop-blur-md border-red-850/40'
  },
  {
    id: 'deep-purple',
    name: 'Vibrant Purple & Cyan',
    bgGrad: 'from-purple-950 via-fuchsia-950 to-purple-950',
    accentBg: 'bg-cyan-400',
    accentText: 'text-cyan-400',
    badgeBg: 'bg-cyan-400/15 border-cyan-400/30',
    badgeText: 'text-cyan-300',
    borderCol: 'border-cyan-400/20',
    cardBg: 'bg-purple-900/35 backdrop-blur-md border-purple-850/40'
  }
];

export default function FlyerPage() {
  const [selectedTheme, setSelectedTheme] = useState<FlyerTheme>(FLYER_THEMES[0]);
  const [copiedText, setCopiedText] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'poster' | 'instagram'>('poster');

  const advertText = `📣 ADMISSION OPEN: 2026/2027 ACADEMIC SESSION 📣
✨ IMAM MALIK SCIENCE & TAHFIZ COLLEGE ✨

We are pleased to announce that admission applications are now open for JSS 1 (Boys & Girls) into Imam Malik Science & Tahfiz College!

Nurturing Faith & Scientific Excellence with integrated Quranic Memorization and robust Science Curricula.

💵 Form Fee: ONLY ₦1,000.00
⏳ Deadline: Application closes in 2 weeks!
📅 Entrance Exam: Date will be communicated directly to applicants.

🚀 STEPS TO REGISTER:
1️⃣ Visit our website: https://imammalikcollege.com.ng
2️⃣ Click on the "Apply Now" button or navigate to the Admissions Page.
3️⃣ Pay the registration form fee of ₦1,000 online securely using Paystack.
4️⃣ Complete the application form & upload the candidate's passport photo.
5️⃣ Submit and download your Examination Slip. Keep it safe!

📍 School Address: Karefa Road Tudun Wada Dankadai, Kano State
📞 Phone: 07011748311
✉️ Email: maitechitservices6@gmail.com

Share this opportunity with friends and family! Give your child the best foundation for academic and spiritual success. 🌟`;

  const copyToClipboard = (text: string, isLink: boolean = false) => {
    navigator.clipboard.writeText(text);
    if (isLink) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto print:max-w-full">
        {/* Header - Hidden in Print */}
        <div className="mb-10 text-center md:text-left md:flex md:items-center md:justify-between border-b border-slate-200 pb-6 print:hidden">
          <div>
            <span className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Marketing Hub
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
              Interactive Admission Flyer
            </h1>
            <p className="text-slate-500 mt-1 max-w-xl text-sm md:text-base">
              Customize, preview, and export your gorgeous 2026/2027 admission campaign advert. Copy perfectly formatted social media captions or print physical posters!
            </p>
          </div>
          <div className="mt-6 md:mt-0 flex flex-wrap justify-center gap-3">
            <button
              onClick={handlePrint}
              className="px-5 py-3 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Printer size={16} /> Print Poster
            </button>
            <button
              onClick={() => copyToClipboard(advertText)}
              className="px-5 py-3 bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-950 text-white rounded-xl font-bold text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              {copiedText ? <Check size={16} className="text-amber-400 animate-pulse" /> : <Copy size={16} />}
              {copiedText ? 'Copied Ad Text!' : 'Copy Social Text'}
            </button>
          </div>
        </div>

        {/* Dashboard Layout */}
        <div className="grid lg:grid-cols-12 gap-8 print:block">
          {/* Left Column: Interactive Tools (Hidden on Print) */}
          <div className="lg:col-span-5 space-y-6 print:hidden">
            {/* Customizer Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Palette className="text-amber-500" size={20} /> Customize Theme
              </h3>
              <p className="text-slate-500 text-xs mb-4">
                Select from professionally crafted color schemes to match your targeted social campaign.
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {FLYER_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`p-3.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      selectedTheme.id === theme.id
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-600/10'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-tr ${theme.bgGrad} border border-white/20`} />
                      <span className="text-sm font-bold text-slate-800">{theme.name}</span>
                    </div>
                    {selectedTheme.id === theme.id && (
                      <span className="w-5 h-5 bg-emerald-900 text-white rounded-full flex items-center justify-center">
                        <Check size={12} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Steps & Quick Stats */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Eye className="text-emerald-900" size={20} /> Advert Target Specs
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Academic Session</span>
                  <span className="font-extrabold text-slate-800">2026/2027</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Admission Level</span>
                  <span className="font-extrabold text-slate-800">JSS 1 (Boys & Girls)</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Application Form Fee</span>
                  <span className="font-extrabold text-emerald-700">₦1,000.00</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-100 text-sm">
                  <span className="text-slate-500">Ad Deadline</span>
                  <span className="font-extrabold text-red-600">Within 2 Weeks!</span>
                </div>
                <div className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-500">Entrance Exam Date</span>
                  <span className="font-semibold text-amber-600 text-right">To Be Communicated</span>
                </div>
              </div>
            </div>

            {/* Social Media Copier */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-slate-100 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black uppercase tracking-wider text-xs text-amber-400">Social Media Advert Post</h3>
                  <button
                    onClick={() => copyToClipboard(advertText)}
                    className="p-1.5 hover:bg-slate-700/50 active:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors"
                    title="Copy post content to clipboard"
                  >
                    {copiedText ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                  </button>
                </div>
                <div className="bg-slate-950/60 rounded-xl p-4 h-48 overflow-y-auto text-xs font-mono text-slate-300 leading-relaxed custom-scrollbar">
                  {advertText}
                </div>
                <p className="text-[10px] text-slate-400 mt-3 text-center">
                  💡 Ready-to-use marketing copy. Tap the copy icon, paste on WhatsApp status, Instagram, or Facebook groups!
                </p>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            </div>
          </div>

          {/* Right Column: Visual Flyer Canvas (Visible in Print but sized to fit) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start print:block">
            {/* Aspect Ratio Switcher (Hidden in Print) */}
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6 w-fit print:hidden">
              <button
                onClick={() => setPreviewDevice('poster')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  previewDevice === 'poster'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone size={14} /> High-Res Flyer Poster (4:5)
              </button>
              <button
                onClick={() => setPreviewDevice('instagram')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  previewDevice === 'instagram'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Share2 size={14} /> Square Social Post (1:1)
              </button>
            </div>

            {/* Interactive Canvas Container */}
            <div 
              id="admission-flyer-canvas"
              className={`w-full max-w-lg overflow-hidden bg-gradient-to-b ${selectedTheme.bgGrad} rounded-3xl border-4 ${selectedTheme.borderCol} shadow-2xl relative transition-all duration-500 flex flex-col justify-between p-6 sm:p-8 print:border-none print:shadow-none print:rounded-none print:max-w-full print:p-8 print:w-[21cm] print:h-[29.7cm] ${
                previewDevice === 'instagram' ? 'aspect-square' : 'aspect-[4/5]'
              }`}
            >
              {/* Dynamic Design Watermarks / Graphic Shapes */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-emerald-500/5 rounded-full -ml-36 -mb-36 blur-3xl pointer-events-none" />

              {/* Flyer Top Header: Logo & School Name */}
              <div className="relative z-10 flex items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center bg-white/95 rounded-xl overflow-hidden p-1 shadow-md border border-white/20">
                    <img 
                      src="https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg" 
                      alt="IMSC Crest" 
                      className="w-full h-full object-cover rounded"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-tight leading-none">
                      Imam Malik
                    </h2>
                    <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.22em] text-amber-400 mt-0.5 leading-none">
                      Science & Tahfiz College
                    </p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[8px] text-slate-300 font-bold uppercase tracking-widest block">Est. 2016</span>
                  <span className="text-[10px] text-white font-extrabold tracking-wider block">KANO STATE</span>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="relative z-10 my-auto flex flex-col justify-center text-center space-y-4">
                {/* Session Stamp */}
                <div className="mx-auto">
                  <span className={`inline-block py-1 px-3.5 rounded-full text-[9px] sm:text-xs font-black uppercase tracking-widest ${selectedTheme.badgeBg} ${selectedTheme.badgeText}`}>
                    ADMISSION OPEN • 2026/2027 SESSION
                  </span>
                </div>

                {/* Main Heading */}
                <div>
                  <h3 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight tracking-tight uppercase">
                    JOIN THE PATH OF <br className="hidden sm:inline" />
                    <span className={`${selectedTheme.accentText} italic font-serif`}>KNOWLEDGE</span> & <span className="text-emerald-400">EXCELLENCE</span>
                  </h3>
                  <p className="text-[10px] sm:text-sm text-slate-200 mt-1 max-w-sm mx-auto leading-relaxed">
                    Nurturing strong moral Islamic values and academic mastery for future leaders.
                  </p>
                </div>

                {/* Target Admission Level */}
                <div className={`p-4 rounded-2xl border ${selectedTheme.borderCol} ${selectedTheme.cardBg} max-w-sm mx-auto w-full`}>
                  <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Now Registering Candidates for:</p>
                  <h4 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight mt-0.5">
                    JSS 1 <span className={`${selectedTheme.accentText}`}>(BOYS & GIRLS)</span>
                  </h4>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    <span className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase tracking-wider">Day & Boarding Options Available</span>
                  </div>
                </div>

                {/* Form Fee Highlight */}
                <div className="flex flex-col items-center justify-center bg-amber-500/10 border border-amber-500/20 py-2 px-6 rounded-2xl w-fit mx-auto shadow-inner">
                  <span className="text-[8px] sm:text-[10px] text-amber-300 font-black tracking-widest uppercase">Application Form Fee</span>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm sm:text-base font-extrabold text-amber-400">₦</span>
                    <span className="text-xl sm:text-3xl font-black text-amber-400 tracking-tight">1,000.00</span>
                  </div>
                </div>

                {/* Two Week warning & Exam notice */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 text-[9px] sm:text-xs">
                  <div className="flex items-center gap-1.5 text-red-400 font-bold bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20">
                    <Clock size={12} /> Deadline: Closes within 2 Weeks!
                  </div>
                  <div className="flex items-center gap-1.5 text-blue-300 font-bold bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
                    <Calendar size={12} /> Exam Date: Will be communicated
                  </div>
                </div>
              </div>

              {/* Steps to Register (Footer block / Left column depending on space) */}
              <div className="relative z-10 mt-4 border-t border-white/10 pt-4">
                <h5 className="text-[10px] sm:text-xs font-black text-white tracking-widest uppercase mb-2.5 text-center flex items-center justify-center gap-1.5">
                  <FileText size={12} className={`${selectedTheme.accentText}`} /> 5 Easy Steps to Register Online
                </h5>
                <div className="grid grid-cols-5 gap-1.5 text-center text-white">
                  {[
                    { nr: '1', title: 'VISIT PORTAL', desc: 'imammalikcollege.com.ng' },
                    { nr: '2', title: 'APPLY NOW', desc: 'Click registration link' },
                    { nr: '3', title: 'PAY ₦1,000', desc: 'Pay secure via Paystack' },
                    { nr: '4', title: 'FILL DETAILS', desc: 'Upload passport photo' },
                    { nr: '5', title: 'GET SLIP', desc: 'Print & bring for exam' }
                  ].map((step, idx) => (
                    <div key={idx} className="flex flex-col items-center bg-white/5 rounded-xl p-1.5 border border-white/5">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black ${selectedTheme.accentBg} text-slate-950 mb-1 shadow-sm`}>
                        {step.nr}
                      </span>
                      <p className="text-[7px] sm:text-[9px] font-black leading-none uppercase tracking-tight block max-w-[70px] truncate">{step.title}</p>
                      <p className="text-[6px] sm:text-[8px] text-slate-400 leading-none mt-0.5 hidden sm:block overflow-hidden overflow-ellipsis">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact strip */}
              <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[8px] sm:text-[10px] text-slate-300">
                <div className="flex items-center gap-1">
                  <MapPin size={10} className={`${selectedTheme.accentText}`} />
                  <span className="truncate max-w-[200px] sm:max-w-none">Karefa Rd, Tudun Wada Dankadai, Kano</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 font-bold text-white">
                    <Phone size={10} className="text-emerald-400" /> 07011748311
                  </span>
                  <span className="hidden sm:inline text-white/20">|</span>
                  <span className="flex items-center gap-1 truncate max-w-[120px] sm:max-w-none">
                    <Mail size={10} className="text-amber-400" /> maitechitservices6@gmail.com
                  </span>
                </div>
              </div>
            </div>

            {/* Print Help Banner (Hidden in Print) */}
            <div className="mt-4 text-center max-w-sm print:hidden">
              <p className="text-xs text-slate-400">
                🖨️ For physically printed banners: choose <strong className="text-slate-600">High-Res Flyer Poster (4:5)</strong> and click <strong className="text-slate-600">Print Poster</strong>. This layout will scale flawlessly to standard A4 or letter paper.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
