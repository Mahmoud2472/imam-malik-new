import React from 'react';
import { Landmark, Download, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate } from '../../lib/utils';
import QRCode from 'qrcode';

interface AdmissionLetterProps {
  application: any;
}

export default function AdmissionLetter({ application }: AdmissionLetterProps) {
  const downloadLetter = async () => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(5, 46, 22); // emerald-950
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Karefa Road Tudun Wada Dankadai, Kano State | 07011748311', 105, 30, { align: 'center' });
    
    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ADMISSION OFFER LETTER', 105, 60, { align: 'center' });
    
    // Content
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    
    const date = new Date().toLocaleDateString();
    doc.text(`Date: ${date}`, 20, 80);
    doc.text(`Application ID: ${application.id.toUpperCase()}`, 20, 88);
    
    doc.text(`Dear ${application.firstName} ${application.lastName},`, 20, 105);
    
    const body = `We are pleased to inform you that your application for admission into Imam Malik Science & Tahfiz College has been reviewed and APPROVED. You have been offered provisional admission for the 2025/2026 Academic Session.`;
    
    const splitBody = doc.splitTextToSize(body, 170);
    doc.text(splitBody, 20, 115);
    
    doc.setFont('helvetica', 'bold');
    doc.text('Admission Details:', 20, 140);
    doc.setFont('helvetica', 'normal');
    doc.text(`Class: ${application.targetClassId.toUpperCase()}`, 30, 150);
    doc.text(`Session: 2025/2026`, 30, 158);
    
    const instructions = `You are required to proceed to the school premises for physical verification and registration within two weeks of this offer. Please bring along original copies of your credentials and two passport photographs.`;
    const splitInstructions = doc.splitTextToSize(instructions, 170);
    doc.text(splitInstructions, 20, 180);
    
    doc.text('Congratulations once again.', 20, 210);
    
    doc.text('Yours faithfully,', 20, 230);
    doc.setFont('helvetica', 'bold');
    doc.text('Registrar', 20, 250);
    doc.text('Imam Malik Science & Tahfiz College', 20, 258);
    
    // Embedded Verification QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-IMSC-LETTER-${application.id}`);
      doc.addImage(qrDataUrl, 'PNG', 160, 212, 30, 30);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Verify Admission Offer", 175, 245, { align: 'center' });
    } catch (e) {
      console.warn("QR code generation failed:", e);
    }

    // Footer decoration
    doc.setDrawColor(245, 158, 11); // amber-500
    doc.setLineWidth(2);
    doc.line(20, 265, 190, 265);

    doc.save(`Admission_Letter_${application.lastName}.pdf`);
  };

  return (
    <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100 max-w-4xl mx-auto my-8 print:shadow-none print:border-none">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12 border-b border-slate-100 pb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-emerald-900 rounded-2xl flex items-center justify-center">
            <Landmark className="text-amber-500" size={32} />
          </div>
          <div>
            <h1 className="text-xl font-black text-emerald-950 uppercase tracking-tight">Imam Malik</h1>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Science & Tahfiz College</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Admission Status</p>
          <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full font-black text-xs uppercase tracking-tighter">
            Approved
          </div>
        </div>
      </div>

      <div className="space-y-8 text-slate-700 leading-relaxed">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-800">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-xs text-slate-400 font-medium">Ref: IMSC/ADM/2026/{application.id.slice(-4).toUpperCase()}</p>
          </div>
        </div>

        <div>
          <p className="font-bold text-slate-900 mb-4 text-lg">Dear {application.firstName} {application.lastName},</p>
          <h2 className="text-2xl font-black text-emerald-950 mb-6 uppercase tracking-tight underline transition-all">Provisional Admission Offer</h2>
          
          <p className="mb-6">
            We are pleased to inform you that your application for admission into <strong>Imam Malik Science & Tahfiz College</strong> has been reviewed and <strong>APPROVED</strong>. You have been offered provisional admission for the 2025/2026 Academic Session.
          </p>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
            <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-widest mb-4">Placement Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Class</p>
                <p className="font-bold text-slate-800">{application.targetClassId.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Academic Session</p>
                <p className="font-bold text-slate-800">2025/2026</p>
              </div>
            </div>
          </div>

          <p className="mb-8">
            You are required to proceed to the school premises for physical verification and registration within two weeks of this offer. Please bring along original copies of your credentials, including birth certificate and previous academic records.
          </p>

          <div className="pt-12 border-t border-slate-100">
            <p className="font-medium text-slate-500 mb-1">Yours faithfully,</p>
            <div className="h-16 flex items-end">
              <div className="border-b-2 border-slate-900 w-32 mb-2 italic font-serif text-slate-400">Signature</div>
            </div>
            <p className="font-bold text-slate-800">Registrar</p>
            <p className="text-xs text-slate-400 font-bold uppercase">Imam Malik Science & Tahfiz College</p>
          </div>
        </div>
      </div>

      <div className="mt-12 flex gap-4 no-print">
        <button 
          onClick={downloadLetter}
          className="btn-primary flex items-center gap-2"
        >
          <Download size={18} /> Download PDF
        </button>
        <button 
          onClick={() => window.print()}
          className="btn-secondary flex items-center gap-2"
        >
          <Printer size={18} /> Print Letter
        </button>
      </div>
    </div>
  );
}
