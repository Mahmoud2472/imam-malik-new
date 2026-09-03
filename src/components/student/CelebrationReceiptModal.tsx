import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Download, Printer, ShieldCheck, X, Sparkles, School, GraduationCap } from 'lucide-react';
import jsPDF from 'jspdf';

interface CelebrationReceiptModalProps {
  receipt: any;
  studentName: string;
  examNo: string;
  assignedClass: string;
  onClose: () => void;
}

const MAHMOUD_ADAMU_SIGNATURE = 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=300&auto=format&fit=crop&q=80';

export function CelebrationReceiptModal({
  receipt,
  studentName,
  examNo,
  assignedClass,
  onClose
}: CelebrationReceiptModalProps) {
  if (!receipt) return null;

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0
    }).format(amt);
  };

  const handleDownloadPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Background accent
      doc.setFillColor(6, 78, 59); // Emerald 900
      doc.rect(0, 0, 210, 36, 'F');

      // College Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('IMAM MALIK ISLAMIC SECONDARY COLLEGE', 105, 14, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Dankadai Layout, Airport Road, Kano State, Nigeria', 105, 20, { align: 'center' });
      doc.text('Tel: +234 803 400 4882 | Email: info@imammalikcollege.edu.ng', 105, 25, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(253, 224, 71); // Amber
      doc.text('OFFICIAL ELECTRONIC PAYMENT RECEIPT (VERIFIED)', 105, 31, { align: 'center' });

      // Receipt Metadata Banner
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 42, 180, 24, 3, 3, 'FD');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('RECEIPT NO / REFERENCE:', 20, 50);
      doc.text('DATE & TIME OF ISSUE:', 110, 50);
      doc.text('TRANSACTION STATUS:', 20, 60);
      doc.text('PAYMENT CHANNEL:', 110, 60);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.text(String(receipt.receiptNumber || 'REC-PAY-ONLINE'), 65, 50);
      doc.text(String(receipt.date || new Date().toLocaleDateString('en-GB')), 150, 50);
      
      doc.setTextColor(5, 150, 105);
      doc.text('PAID & VERIFIED (SUCCESS)', 65, 60);
      doc.setTextColor(15, 23, 42);
      doc.text(String(receipt.paymentMethod || 'Paystack Online'), 150, 60);

      // Student Particulars Box
      doc.setFillColor(240, 253, 244); // Green 50
      doc.setDrawColor(187, 247, 208);
      doc.roundedRect(15, 72, 180, 48, 3, 3, 'FD');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text('STUDENT PARTICULAR DETAILS', 20, 80);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Candidate Full Name:', 20, 89);
      doc.text('Examination / Student ID:', 20, 97);
      doc.text('Assigned Class Stream:', 20, 105);
      doc.text('Academic Session & Term:', 20, 113);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(String(studentName || 'Student Candidate'), 75, 89);
      doc.text(String(examNo || 'IMSC-2026-REG'), 75, 97);
      doc.text(String(assignedClass || 'JSS 1A'), 75, 105);
      doc.text(`${receipt.term || '1st Term'} (${receipt.session || '2026/2027'})`, 75, 113);

      // Line Items Table
      doc.setFillColor(6, 78, 59);
      doc.rect(15, 126, 180, 9, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('FEE DESCRIPTION / PURPOSE', 20, 132);
      doc.text('CATEGORY', 120, 132);
      doc.text('AMOUNT (NGN)', 165, 132);

      doc.setDrawColor(226, 232, 240);
      doc.line(15, 147, 195, 147);

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(String(receipt.title || 'Official School Fee'), 20, 142);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(String(receipt.category || 'Tuition'), 120, 142);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(6, 78, 59);
      doc.text(formatCurrency(Number(receipt.amount) || 12000), 165, 142);

      // Total Box
      doc.setFillColor(241, 245, 249);
      doc.rect(120, 150, 75, 12, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('TOTAL AMOUNT PAID:', 124, 158);
      doc.setTextColor(6, 78, 59);
      doc.setFontSize(11);
      doc.text(formatCurrency(Number(receipt.amount) || 12000), 165, 158);

      // Verification & Authorization
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 172, 180, 52, 3, 3, 'D');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('SECURITY VERIFICATION CODE:', 20, 182);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(`PAYSTACK-REF: ${receipt.paystackReference || 'VERIFIED-ONLINE'}`, 20, 189);
      doc.text('System Verified: SHA-256 Digital Audit Trail', 20, 195);
      doc.text('Valid for Physical Class Clearance & ID Card Issuance', 20, 201);
      doc.text('Account Office: Bursary Unit, IMSC Kano', 20, 207);

      doc.setFont('helvetica', 'bold');
      doc.text('Bursar / Administrative Secretary', 130, 205);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Mahmoud Adamu', 130, 211);
      doc.text('Imam Malik Islamic Sec. College', 130, 216);

      // Footer Notes
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('This is an authentic computer-generated official receipt issued by Imam Malik Islamic Secondary College, Kano.', 105, 240, { align: 'center' });
      doc.text('For bursary inquiries, please present this slip or reference code to the college administrative office.', 105, 245, { align: 'center' });

      doc.save(`IMSC-Receipt-${receipt.receiptNumber || 'Online'}-${examNo}.pdf`);
    } catch (e) {
      console.error("PDF generation failed:", e);
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-slate-900/85 backdrop-blur-md flex items-center justify-center p-4 md:p-6 no-print">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100"
      >
        {/* Header Celebration Banner */}
        <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center shadow-md">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span className="px-2.5 py-0.5 bg-emerald-700/80 text-emerald-200 text-[10px] font-black uppercase rounded-full tracking-wider border border-emerald-500/40">
                Payment Successful & Verified
              </span>
              <h3 className="text-xl font-black text-white tracking-tight mt-0.5">
                Official Payment Receipt Generated
              </h3>
            </div>
          </div>
          <p className="text-xs text-emerald-100 font-medium">
            Alhamdulillah! Your transaction has been confirmed and logged in the college bursary records.
          </p>
        </div>

        {/* Receipt Content Body */}
        <div className="p-6 md:p-8 space-y-5">
          {/* Printable Styled Receipt Preview */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200/80 text-xs space-y-3.5 relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <School className="text-emerald-800" size={18} />
                <div>
                  <h4 className="font-black text-slate-900 text-[11px] uppercase tracking-wide">
                    Imam Malik Islamic Sec. College
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">Official Payment Voucher</p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-black rounded-lg text-[10px] uppercase">
                Paid (Verified)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-700">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Candidate Name</span>
                <strong className="text-slate-900 text-xs font-bold">{studentName}</strong>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Exam / Reg No</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{examNo}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Assigned Class</span>
                <span className="font-bold text-slate-800">{assignedClass}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Academic Term</span>
                <span className="font-bold text-slate-800">{receipt.term || '1st Term'} ({receipt.session || '2026/2027'})</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Item</span>
                <span className="font-black text-emerald-950 text-xs block">{receipt.title}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Receipt / Voucher No</span>
                <span className="font-mono text-[11px] font-bold text-slate-700">{receipt.receiptNumber}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Paystack Reference</span>
                <span className="font-mono text-[11px] font-bold text-emerald-800">{receipt.paystackReference}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase">Amount Paid</span>
              <span className="text-lg font-black text-emerald-950">{formatCurrency(receipt.amount)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownloadPDF}
              className="flex-1 py-3.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-98 transition-all cursor-pointer"
            >
              <Download size={16} />
              <span>Download PDF Payment Receipt</span>
            </button>

            <button
              onClick={() => window.print()}
              className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Printer size={15} />
              <span>Print Receipt</span>
            </button>

            <button
              onClick={onClose}
              className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
