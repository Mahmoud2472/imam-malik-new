import React, { useState, useEffect } from 'react';
import { Landmark, Download, Printer, Award, BookOpen, CheckCircle2, ShieldCheck, QrCode } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { formatDate, formatCurrency, MAHMOUD_ADAMU_SIGNATURE } from '../../lib/utils';
import QRCode from 'qrcode';
import { getAdmissionVerificationPayload } from '../../lib/admissionPdfService';

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
  const [displayQrUrl, setDisplayQrUrl] = useState<string>('');

  const qrPayload = getAdmissionVerificationPayload({
    candidateName,
    examNumber,
    targetClass,
    entranceScore,
    schoolName,
    issueDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  });

  useEffect(() => {
    QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 180,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    })
      .then(url => setDisplayQrUrl(url))
      .catch(err => console.warn('QR code generation error:', err));
  }, [qrPayload]);

  const downloadLetter = async () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // 1. Header (Pure White Background for B&W Printers)
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE, TUDUN WADA', 105, 18, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Karefa Road Tudun Wada Dankadai | Tel: 07011748311, 08032765759', 105, 25, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL PROVISIONAL ADMISSION OFFER • 2026/2027 ACADEMIC SESSION', 105, 33, { align: 'center' });

    // Clean Black Header Divider Lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(20, 37, 190, 37);
    doc.setLineWidth(0.2);
    doc.line(20, 38.5, 190, 38.5);

    // 2. Document Meta Bar
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Date of Issue: ${dateStr}`, 20, 46);
    doc.text(`Exam / Reg No: ${examNumber}`, 20, 52);
    doc.text(`Academic Session: 2026/2027`, 130, 46);

    // Status Box (Black & White outline)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.rect(130, 48.5, 60, 6.5, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('OFFER STATUS: APPROVED', 160, 53, { align: 'center' });

    // 3. Salutation & Official Intro
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Dear ${candidateName},`, 20, 64);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const body = `We are pleased to formally inform you that following your performance in the entrance examination, you have been OFFERED PROVISIONAL ADMISSION into Imam Malik Science & Tahfiz College, Tudun Wada for the 2026/2027 Academic Session.`;
    const splitBody = doc.splitTextToSize(body, 170);
    doc.text(splitBody, 20, 70);

    // 4. Candidate Placement & Result Record Box (Clean B&W Border)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.rect(20, 81, 170, 29, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CANDIDATE ADMISSION & PLACEMENT RECORD', 25, 87);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Assigned Class / Placement:', 25, 94);
    doc.setFont('helvetica', 'bold');
    doc.text(`${targetClass.toUpperCase()}`, 75, 94);

    doc.setFont('helvetica', 'normal');
    doc.text('Entrance Exam Score:', 25, 100);
    doc.setFont('helvetica', 'bold');
    doc.text(`${entranceScore ? entranceScore + ' / 100 (Passed - Eligible)' : 'Passed (Eligible)'}`, 75, 100);

    doc.setFont('helvetica', 'normal');
    doc.text('Previous School:', 25, 106);
    doc.setFont('helvetica', 'bold');
    doc.text(`${schoolName || 'Primary School'}`, 75, 106);

    // 5. Fee Schedule Box (Clean B&W Border)
    doc.rect(20, 114, 170, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('REGISTRATION & DEVELOPMENT LEVY SCHEDULE:', 25, 120);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('• Registration & Prospectus Fee: N12,000', 25, 126);
    doc.text('• School Development Levy: N3,000', 25, 131);
    doc.setFont('helvetica', 'bold');
    doc.text('• Total Payable: N15,000 (Payable via Student Portal or School Desk)', 100, 128);

    // 6. Required Working Materials, Uniforms & Textbooks Directives
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('REQUIRED WORKING MATERIALS, UNIFORMS & TEXTBOOKS:', 20, 144);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    
    const mat1 = '• Working Materials: Parents/guardians are required to purchase all necessary working materials for their child, including exercise books, pens, a mathematical set, and a scientific calculator.';
    const splitMat1 = doc.splitTextToSize(mat1, 170);
    doc.text(splitMat1, 20, 150);

    const mat2 = '• School Uniforms: Students are strongly advised to have two (2) complete sets of the approved school uniform.';
    const splitMat2 = doc.splitTextToSize(mat2, 170);
    doc.text(splitMat2, 20, 161);

    const mat3 = '• Islamic & Core Textbooks: Prescribed Islamic textbooks and learning materials are readily available in the school for parents to purchase for their child.';
    const splitMat3 = doc.splitTextToSize(mat3, 170);
    doc.text(splitMat3, 20, 169);

    const mat4 = '• Registration Finalization: Parents should complete registration payment and submit credentials (birth certificate/age declaration and two passport photographs) to finalize enrollment.';
    const splitMat4 = doc.splitTextToSize(mat4, 170);
    doc.text(splitMat4, 20, 177);

    doc.setFont('helvetica', 'bold');
    doc.text('Congratulations on your admission to Imam Malik Science & Tahfiz College.', 20, 192);

    // 7. Signature Block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Yours faithfully,', 20, 201);

    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 140;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 320, 140);
            ctx.drawImage(img, 0, 0, 320, 140);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 20, 203, 46, 18);
    } catch (e) {
      console.warn('Signature addition failed in PDF:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Mahmoud Adamu', 20, 226);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Secretary, Governing Board', 20, 230);
    doc.text('Imam Malik Science & Tahfiz College Tudun Wada', 20, 235);

    // 8. High-Res B&W QR Code (Name and Exam Number)
    try {
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        margin: 1,
        width: 140,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      });
      doc.addImage(qrDataUrl, 'PNG', 152, 200, 34, 34);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('Scan for Name & Exam No.', 169, 238, { align: 'center' });
    } catch (e) {
      console.warn('QR code generation failed:', e);
    }

    // 9. Clean Black Footer Line
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.line(20, 248, 190, 248);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Imam Malik Science & Tahfiz College Tudun Wada • Academic Excellence & Qur\'anic Values • Official Admission Offer',
      105,
      254,
      { align: 'center' }
    );

    doc.save(`Admission_Offer_Letter_${candidateName.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="bg-white text-black p-6 md:p-12 rounded-2xl border border-black max-w-4xl mx-auto my-6 print:m-0 print:border-none print:p-0 print:shadow-none text-left font-sans shadow-none">
      {/* Letterhead (Pure White Background - No Colored Heading) */}
      <div className="bg-white text-center border-b-2 border-black pb-4 mb-6">
        <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">
          Imam Malik Science & Tahfiz College, Tudun Wada
        </h1>
        <p className="text-xs font-semibold text-black uppercase tracking-wider mt-1">
          Karefa Road Tudun Wada Dankadai | Tel: 07011748311, 08032765759
        </p>
        <p className="text-xs font-black uppercase tracking-widest mt-2 border-t border-black pt-2 inline-block">
          Official Provisional Admission Offer • 2026/2027 Academic Session
        </p>
      </div>

      <div className="space-y-5 text-black leading-relaxed text-sm">
        {/* Document Meta Row */}
        <div className="flex justify-between items-center text-xs border-b border-black pb-3 bg-white">
          <div className="space-y-1">
            <p className="font-bold">
              Date of Issue: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="font-mono">
              Ref: IMSC/ADM/2026/{examNumber.replace(/[^a-zA-Z0-9]/g, '')}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold">Exam / Reg No: {examNumber}</p>
            <div className="border border-black px-3 py-0.5 mt-1 inline-block font-black text-[11px] uppercase bg-white">
              Status: Approved
            </div>
          </div>
        </div>

        {/* Salutation & Body */}
        <div>
          <p className="font-bold text-base mb-2">Dear {candidateName},</p>
          <p className="mb-4 text-black text-sm">
            We are pleased to formally inform you that following your performance in the entrance examination, you have been{' '}
            <strong className="underline">OFFERED PROVISIONAL ADMISSION</strong> into{' '}
            <strong>Imam Malik Science & Tahfiz College, Tudun Wada</strong> for the 2026/2027 Academic Session.
          </p>

          {/* Candidate Placement Box */}
          <div className="border border-black p-4 mb-4 bg-white">
            <h3 className="text-xs font-black uppercase tracking-wider mb-3">
              Candidate Admission & Placement Record
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[10px] uppercase text-black font-semibold">Assigned Class</p>
                <p className="font-black text-sm">{targetClass.toUpperCase()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-black font-semibold">Entrance Exam Score</p>
                <p className="font-black text-sm">
                  {entranceScore ? `${entranceScore} / 100 (Passed)` : 'Passed (Eligible)'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-black font-semibold">Previous School</p>
                <p className="font-bold text-sm truncate" title={schoolName || ''}>
                  {schoolName || 'Primary School'}
                </p>
              </div>
            </div>
          </div>

          {/* Fee Schedule Box */}
          <div className="border border-black p-4 mb-4 bg-white">
            <h4 className="text-xs font-black uppercase tracking-wider mb-2">
              Registration & Development Levy Schedule:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="border border-black p-2.5 bg-white">
                <span className="block text-[10px] uppercase font-bold text-black">Registration Fee</span>
                <span className="font-black text-sm text-black">₦12,000</span>
              </div>
              <div className="border border-black p-2.5 bg-white">
                <span className="block text-[10px] uppercase font-bold text-black">Development Levy</span>
                <span className="font-black text-sm text-black">₦3,000</span>
              </div>
              <div className="border border-black p-2.5 bg-white">
                <span className="block text-[10px] uppercase font-bold text-black">Total Payable</span>
                <span className="font-black text-sm text-black">₦15,000</span>
              </div>
            </div>
          </div>

          {/* Working Materials, Uniforms & Islamic Textbooks Section */}
          <div className="border border-black p-4 mb-4 space-y-2 text-xs bg-white">
            <h4 className="text-xs font-black uppercase tracking-wider">
              Required Working Materials, Uniforms & Textbooks:
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-black">
              <li>
                <strong>Working Materials:</strong> Parents/guardians are required to purchase all necessary working materials for their child, including <strong>exercise books, pens, a mathematical set, and a scientific calculator</strong>.
              </li>
              <li>
                <strong>School Uniforms:</strong> Students are strongly advised to have <strong>two (2) complete sets</strong> of the approved school uniform.
              </li>
              <li>
                <strong>Islamic & Academic Textbooks:</strong> Prescribed Islamic textbooks and learning materials are readily <strong>available in the school</strong> for parents to purchase for their child.
              </li>
              <li>
                <strong>Registration Finalization:</strong> Parents are advised to complete registration payment and submit credentials (original copies of birth certificate/age declaration and two recent passport photographs) to finalize enrollment.
              </li>
            </ul>
          </div>

          <p className="text-xs font-bold text-black mb-4">
            Congratulations on your provisional admission to Imam Malik Science & Tahfiz College, Tudun Wada.
          </p>

          {/* Governing Board Signature Block & QR Code */}
          <div className="pt-4 border-t border-black flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 bg-white">
            <div>
              <p className="font-semibold text-xs mb-1">Yours faithfully,</p>
              <div className="h-16 flex items-center mb-1">
                <img
                  src={MAHMOUD_ADAMU_SIGNATURE}
                  alt="Mahmoud Adamu Signature"
                  className="h-14 w-auto object-contain filter grayscale contrast-200"
                />
              </div>
              <p className="font-black text-sm">Mahmoud Adamu</p>
              <p className="text-xs font-bold uppercase">Secretary, Governing Board</p>
              <p className="text-[11px] font-medium">
                Imam Malik Science & Tahfiz College Tudun Wada
              </p>
            </div>

            <div className="text-center sm:text-right flex flex-col items-center sm:items-end">
              <div className="w-24 h-24 bg-white p-1 border border-black flex items-center justify-center">
                {displayQrUrl ? (
                  <img
                    src={displayQrUrl}
                    alt="Admission Verification QR Code"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrPayload)}&color=0-0-0`}
                    alt="Admission Verification QR Code"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>
              <span className="text-[8.5px] font-bold uppercase tracking-widest mt-1 text-black">
                Scan for Name & Exam No.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-8 pt-6 border-t border-black flex flex-wrap gap-4 no-print">
        <button onClick={downloadLetter} className="btn-primary flex items-center gap-2 text-xs font-bold px-6 py-3 cursor-pointer bg-black text-white hover:bg-slate-800">
          <Download size={16} /> Download Official PDF (B&W Ready)
        </button>
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 text-xs font-bold px-6 py-3 cursor-pointer border border-black bg-white text-black hover:bg-slate-100">
          <Printer size={16} /> Print Letter (B&W)
        </button>
      </div>
    </div>
  );
}

