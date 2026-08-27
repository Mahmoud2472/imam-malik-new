import React from 'react';
import { Landmark, Download, Printer, Award, School, CheckCircle2, ShieldCheck } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate, formatCurrency, MAHMOUD_ADAMU_SIGNATURE } from '../../lib/utils';
import QRCode from 'qrcode';

interface AdmissionLetterProps {
  application: any;
}

export default function AdmissionLetter({ application }: AdmissionLetterProps) {
  const candidateName =
    application.name ||
    `${application.firstName || 'Candidate'} ${application.lastName || ''}`.trim();
  const examNumber = application.examNumber || application.id || 'IMSC/2026/001';
  const targetClass = application.targetClass || application.targetClassId || 'JSS 1';
  const entranceScore = application.entranceScore || application.score || null;
  const schoolName = application.schoolName || application.previousSchool || null;

  const downloadLetter = async () => {
    const doc = new jsPDF();

    // Header Bar
    doc.setFillColor(5, 46, 22); // emerald-950
    doc.rect(0, 0, 210, 42, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE', 105, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Karefa Road Tudun Wada Dankadai, Kano State | Tel: 07011748311', 105, 28, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL PROVISIONAL ADMISSION OFFER', 105, 36, { align: 'center' });

    // Document Meta
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Date: ${dateStr}`, 20, 52);
    doc.text(`Exam / Reg No: ${examNumber}`, 20, 58);
    doc.text(`Session: 2026/2027 Academic Session`, 130, 52);
    doc.text(`Status: APPROVED`, 130, 58);

    // Salutation
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dear ${candidateName},`, 20, 72);

    // Body
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    const body = `We are pleased to formally inform you that following your performance in the entrance examination and screening exercise, you have been OFFERED PROVISIONAL ADMISSION into Imam Malik Science & Tahfiz College, Kano for the 2026/2027 Academic Session.`;
    const splitBody = doc.splitTextToSize(body, 170);
    doc.text(splitBody, 20, 80);

    // Placement & Score Box
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, 96, 170, 42, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(5, 46, 22);
    doc.text('CANDIDATE ADMISSION & PLACEMENT RECORD', 25, 104);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`Assigned Class:`, 25, 114);
    doc.setFont('helvetica', 'bold');
    doc.text(`${targetClass.toUpperCase()}`, 65, 114);

    doc.setFont('helvetica', 'normal');
    doc.text(`Entrance Exam Score:`, 25, 122);
    doc.setFont('helvetica', 'bold');
    doc.text(`${entranceScore ? entranceScore + ' / 100 (Passed)' : 'Passed'}`, 65, 122);

    doc.setFont('helvetica', 'normal');
    doc.text(`Previous School:`, 25, 130);
    doc.setFont('helvetica', 'bold');
    doc.text(`${schoolName || 'Not Specified'}`, 65, 130);

    // Fee Schedule & Directives
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Registration & Acceptance Fee Requirements:', 20, 148);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('To accept this provisional offer and secure your enrollment, proceed with registration:', 20, 155);
    doc.text('• Registration Fee: N12,000', 25, 162);
    doc.text('• Development Levy: N3,000', 25, 168);
    doc.setFont('helvetica', 'bold');
    doc.text('• Total Payable: N15,000 (Payable via Student Portal or School Paystack)', 25, 174);

    doc.setFont('helvetica', 'normal');
    const instructions = `You are required to complete your registration payment and bring along original copies of your credentials, birth certificate, and two passport photographs for physical verification within two weeks of this offer.`;
    const splitInstructions = doc.splitTextToSize(instructions, 170);
    doc.text(splitInstructions, 20, 185);

    doc.text('Congratulations on your admission.', 20, 204);

    doc.text('Yours faithfully,', 20, 215);
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
      doc.addImage(pngSignature, 'PNG', 20, 218, 35, 14);
    } catch (e) {
      console.warn('Signature addition failed in PDF:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Mahmoud Adamu', 20, 240);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Secretary, Governing Board', 20, 245);
    doc.text('Imam Malik Science & Tahfiz College Kano', 20, 250);

    // Embedded Verification QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-IMSC-OFFER-${examNumber}`);
      doc.addImage(qrDataUrl, 'PNG', 155, 212, 32, 32);
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text('Scan to Verify Offer', 171, 248, { align: 'center' });
    } catch (e) {
      console.warn('QR code generation failed:', e);
    }

    // Gold Footer line
    doc.setDrawColor(245, 158, 11);
    doc.setLineWidth(2);
    doc.line(20, 260, 190, 260);

    doc.save(`Admission_Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="bg-white p-6 md:p-12 rounded-3xl shadow-xl border border-slate-100 max-w-4xl mx-auto my-6 print:shadow-none print:border-none print:p-0 text-left">
      {/* Letterhead */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-950 rounded-2xl flex items-center justify-center shadow-md">
            <Landmark className="text-amber-400" size={32} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-emerald-950 uppercase tracking-tight">
              Imam Malik Science & Tahfiz College
            </h1>
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">
              Karefa Road Tudun Wada Dankadai, Kano State | 07011748311
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Offer Status</p>
          <div className="px-3.5 py-1.5 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs uppercase tracking-wider inline-flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Approved
          </div>
        </div>
      </div>

      <div className="space-y-6 text-slate-700 leading-relaxed text-sm">
        <div className="flex justify-between items-end text-xs border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <p className="font-bold text-slate-800">
              Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-slate-500 font-mono">
              Ref: IMSC/ADM/2026/{examNumber.replace(/[^a-zA-Z0-9]/g, '')}
            </p>
          </div>
          <div className="text-right font-mono text-slate-600 font-bold">
            Exam No: <span className="text-emerald-950">{examNumber}</span>
          </div>
        </div>

        <div>
          <p className="font-bold text-slate-900 mb-2 text-base">Dear {candidateName},</p>
          <h2 className="text-xl md:text-2xl font-black text-emerald-950 mb-4 uppercase tracking-tight border-b-2 border-amber-400 inline-block pb-1">
            Provisional Admission Offer (2026/2027)
          </h2>

          <p className="mb-6 text-slate-700">
            We are pleased to inform you that your performance in the entrance examination has been reviewed and{' '}
            <strong className="text-emerald-950">APPROVED</strong>. You have been offered provisional admission into{' '}
            <strong>Imam Malik Science & Tahfiz College</strong> for the 2026/2027 Academic Session.
          </p>

          {/* Placement Details Card */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-6">
            <h3 className="text-xs font-black text-emerald-950 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Award size={16} className="text-amber-500" /> Candidate Placement & Result Record
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Class</p>
                <p className="font-bold text-slate-800 text-sm">{targetClass.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Entrance Exam Score</p>
                <p className="font-bold text-emerald-800 text-sm">
                  {entranceScore ? `${entranceScore} / 100 (Passed)` : 'Passed (Eligible)'}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Previous School</p>
                <p className="font-bold text-slate-800 text-sm truncate" title={schoolName || ''}>
                  {schoolName || 'Primary School'}
                </p>
              </div>
            </div>
          </div>

          {/* Fee Schedule Box */}
          <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200/80 mb-6 space-y-2">
            <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
              Registration & Development Fee Schedule:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-amber-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Registration Fee</span>
                <span className="font-black text-emerald-950 text-sm">₦12,000</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Development Levy</span>
                <span className="font-black text-emerald-950 text-sm">₦3,000</span>
              </div>
              <div className="bg-emerald-900 text-white p-3 rounded-xl">
                <span className="text-emerald-200 block text-[10px] uppercase font-bold">Total Required</span>
                <span className="font-black text-amber-400 text-sm">₦15,000</span>
              </div>
            </div>
          </div>

          <p className="mb-8 text-xs text-slate-600">
            You are required to complete your registration payment and proceed to the school premises for physical
            verification and screening within two weeks of this offer. Please bring along original copies of your
            credentials, birth certificate, and two passport photographs.
          </p>

          {/* Governing Board Signature Block & QR Code */}
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
            <div>
              <p className="font-medium text-slate-500 text-xs mb-1">Yours faithfully,</p>
              <div className="h-16 flex items-center mb-1">
                <img
                  src={MAHMOUD_ADAMU_SIGNATURE}
                  alt="Mahmoud Adamu Signature"
                  className="h-12 object-contain"
                />
              </div>
              <p className="font-black text-slate-900 text-sm">Mahmoud Adamu</p>
              <p className="text-xs text-slate-500 font-bold uppercase">Secretary, Governing Board</p>
              <p className="text-[10px] text-slate-400 font-medium uppercase">
                Imam Malik Science & Tahfiz College Kano
              </p>
            </div>

            <div className="text-center sm:text-right flex flex-col items-center sm:items-end">
              <div className="w-20 h-20 bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex items-center justify-center">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=VERIFY-IMSC-OFFER-${examNumber}`}
                  alt="Admission QR Code"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Official Security Code
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap gap-4 no-print">
        <button onClick={downloadLetter} className="btn-primary flex items-center gap-2 text-xs font-bold px-6 py-3 cursor-pointer">
          <Download size={16} /> Download Official PDF
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs font-bold px-6 py-3 cursor-pointer">
          <Printer size={16} /> Print Letter
        </button>
      </div>
    </div>
  );
}
