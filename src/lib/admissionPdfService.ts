import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { MAHMOUD_ADAMU_SIGNATURE } from './utils';
import { getSuccessfulApplicants, ParsedApplicant } from './applicantService';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { supabase, isSupabaseConfigured } from './supabase';

export interface AdmissionLetterData {
  name: string;
  firstName?: string;
  lastName?: string;
  examNumber: string;
  targetClass: string;
  entranceScore?: string | number | null;
  schoolName?: string | null;
  gender?: 'male' | 'female' | string;
  admissionStatus?: string;
  date?: string;
}

/**
 * Generates a clean, straightforward QR Code payload with candidate Name and Exam Number.
 */
export function getAdmissionVerificationPayload(details: {
  candidateName: string;
  examNumber: string;
  targetClass?: string;
  entranceScore?: string | number | null;
  schoolName?: string | null;
  issueDate?: string;
  registrationFee?: string;
  developmentLevy?: string;
  totalPayable?: string;
}): string {
  return `Candidate Name: ${details.candidateName}\nExam Number: ${details.examNumber}`;
}

let cachedSignaturePng: string | null = null;

async function getSignaturePngDataUrl(): Promise<string> {
  if (cachedSignaturePng) return cachedSignaturePng;

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = MAHMOUD_ADAMU_SIGNATURE;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320;
          canvas.height = 140;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 320, 140);
            ctx.drawImage(img, 0, 0, 320, 140);
            cachedSignaturePng = canvas.toDataURL('image/png');
            resolve(cachedSignaturePng);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas conversion failed, fallback to raw signature', canvasErr);
        }
        resolve(MAHMOUD_ADAMU_SIGNATURE);
      };
      img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
    } catch (e) {
      resolve(MAHMOUD_ADAMU_SIGNATURE);
    }
  });
}

/**
 * Fetch all admitted students from all available stores (Cache, Firestore, Supabase)
 * If number clashes exist, appends 'E' (error) to differentiate each candidate so all 140 are preserved.
 */
export async function getAllAdmittedCandidates(): Promise<AdmissionLetterData[]> {
  const list: AdmissionLetterData[] = [];
  const seenKeys = new Map<string, number>();

  const registerCandidate = (c: AdmissionLetterData) => {
    const rawKey = String(c.examNumber || c.name || `cand_${list.length}`).trim().toUpperCase();
    if (!seenKeys.has(rawKey)) {
      seenKeys.set(rawKey, 1);
      list.push(c);
    } else {
      // Clashed number: extract and append 'E' to differentiate as requested
      const count = seenKeys.get(rawKey)!;
      seenKeys.set(rawKey, count + 1);
      const suffix = count === 1 ? 'E' : `E${count}`;
      const uniqueExam = `${c.examNumber}${suffix}`;
      const differentiated: AdmissionLetterData = {
        ...c,
        examNumber: uniqueExam
      };
      list.push(differentiated);
    }
  };

  // 1. From applicant service (Excel upload / cache)
  try {
    const fromService = await getSuccessfulApplicants();
    fromService.forEach((app) => {
      const isAdmitted =
        app.admissionStatus === 'approved' ||
        app.remark === 'passed' ||
        Number(app.entranceScore) >= 40;

      if (isAdmitted && (app.examNumber || app.name)) {
        registerCandidate({
          name: app.name || `${app.firstName || ''} ${app.lastName || ''}`.trim(),
          firstName: app.firstName,
          lastName: app.lastName,
          examNumber: app.examNumber || `IMSC/2026/${list.length + 1}`,
          targetClass: app.targetClass || (app.gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
          entranceScore: app.entranceScore,
          schoolName: app.schoolName,
          gender: app.gender,
          admissionStatus: 'approved'
        });
      }
    });
  } catch (err) {
    console.warn('Error fetching from applicant service:', err);
  }

  // 2. From Firestore 'applications' where status is approved
  try {
    const qApps = query(collection(db, 'applications'));
    const snapApps = await getDocs(qApps);
    snapApps.docs.forEach((d) => {
      const data = d.data() as any;
      const isApproved = data.status === 'approved' || data.remark === 'Passed' || Number(data.score || data.entranceScore) >= 40;
      if (isApproved) {
        const examNo = data.examNumber || data.examNo || data.id || `IMSC/2026/${d.id.slice(0, 4)}`;
        const fullName = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Candidate';
        const gender = data.gender || (fullName.toLowerCase().includes('fatima') || fullName.toLowerCase().includes('amina') ? 'female' : 'male');
        registerCandidate({
          name: fullName,
          firstName: data.firstName,
          lastName: data.lastName,
          examNumber: examNo,
          targetClass: data.targetClass || data.targetClassId || (gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
          entranceScore: data.entranceScore || data.score || 75,
          schoolName: data.schoolName || data.previousSchool || 'Imam Malik School',
          gender,
          admissionStatus: 'approved'
        });
      }
    });
  } catch (err) {
    console.warn('Error fetching from Firestore applications:', err);
  }

  // 3. From Firestore 'students' collection
  try {
    const snapStudents = await getDocs(collection(db, 'students'));
    snapStudents.docs.forEach((d) => {
      const data = d.data() as any;
      const examNo = data.admissionNumber || data.examNumber || data.studentId || `IMSC/2026/${d.id.slice(0, 4)}`;
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Student';
      const gender = data.gender || 'male';
      registerCandidate({
        name: fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        examNumber: examNo,
        targetClass: data.currentClassId || (gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
        entranceScore: data.entranceScore || 80,
        schoolName: data.formerSchool || 'Imam Malik Primary School',
        gender,
        admissionStatus: 'approved'
      });
    });
  } catch (err) {
    console.warn('Error fetching from Firestore students:', err);
  }

  // 4. From Supabase if available
  if (isSupabaseConfigured) {
    try {
      const { data: supaApps } = await supabase
        .from('applications')
        .select('*')
        .eq('status', 'approved');

      if (supaApps && supaApps.length > 0) {
        supaApps.forEach((item: any) => {
          const examNo = item.exam_number || item.exam_no || item.id;
          const fullName = item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim();
          registerCandidate({
            name: fullName,
            firstName: item.first_name,
            lastName: item.last_name,
            examNumber: examNo,
            targetClass: item.target_class || 'JSS 1',
            entranceScore: item.entrance_score || item.score || 70,
            schoolName: item.school_name || 'Imam Malik School',
            gender: 'male',
            admissionStatus: 'approved'
          });
        });
      }
    } catch (supErr) {
      console.warn('Supabase admitted fetch skipped:', supErr);
    }
  }

  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export interface BulkPdfOptions {
  candidates?: AdmissionLetterData[];
  classFilter?: string; // 'all' or specific class e.g. 'JSS 1A'
  onProgress?: (current: number, total: number, candidateName: string) => void;
  fileName?: string;
  openInNewWindow?: boolean;
}

/**
 * Generates a unified multi-page PDF with all admitted students' admission letters
 */
export async function generateBulkAdmissionLettersPdf(options: BulkPdfOptions = {}): Promise<{
  totalCount: number;
  fileName: string;
  blobUrl: string;
}> {
  let list = options.candidates;
  if (!list || list.length === 0) {
    list = await getAllAdmittedCandidates();
  }

  if (options.classFilter && options.classFilter !== 'all') {
    const filter = options.classFilter.toLowerCase().trim();
    list = list.filter((c) => (c.targetClass || '').toLowerCase().includes(filter));
  }

  if (list.length === 0) {
    throw new Error('No admitted student records found to generate admission letters.');
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const signatureDataUrl = await getSignaturePngDataUrl();
  const total = list.length;
  const dateFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  for (let i = 0; i < total; i++) {
    const candidate = list[i];
    const candidateName = (candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`).trim() || 'Admitted Candidate';
    const examNumber = candidate.examNumber || `IMSC/2026/${String(i + 1).padStart(3, '0')}`;
    const targetClass = (candidate.targetClass || (candidate.gender === 'female' ? 'JSS 1B' : 'JSS 1A')).toUpperCase();
    const entranceScore = candidate.entranceScore != null ? String(candidate.entranceScore) : 'Passed';
    const schoolName = candidate.schoolName || 'Imam Malik Model Primary School';

    if (options.onProgress) {
      options.onProgress(i + 1, total, candidateName);
    }

    if (i > 0) {
      doc.addPage('a4', 'portrait');
    }

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

    doc.text(`Date of Issue: ${dateFormatted}`, 20, 46);
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
    doc.text(`${targetClass}`, 75, 94);

    doc.setFont('helvetica', 'normal');
    doc.text('Entrance Exam Score:', 25, 100);
    doc.setFont('helvetica', 'bold');
    doc.text(`${entranceScore} / 100 (Passed - Eligible)`, 75, 100);

    doc.setFont('helvetica', 'normal');
    doc.text('Previous School:', 25, 106);
    doc.setFont('helvetica', 'bold');
    const splitSchool = doc.splitTextToSize(schoolName, 110);
    doc.text(splitSchool, 75, 106);

    // 5. Fee Schedule & Acceptance Requirements (Clean B&W Border)
    doc.rect(20, 114, 170, 24, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('REGISTRATION & DEVELOPMENT LEVY SCHEDULE:', 25, 120);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('• Registration & Prospectus Fee: N12,000', 25, 126);
    doc.text('• PTA & School Development Levy: N3,000', 25, 131);
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
    doc.text('Congratulations on your admission to Imam Malik Science & Tahfiz College, Tudun Wada.', 20, 192);

    // 7. Signature Block
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Yours faithfully,', 20, 201);

    try {
      if (signatureDataUrl) {
        doc.addImage(signatureDataUrl, 'PNG', 20, 203, 46, 18);
      }
    } catch (e) {
      console.warn('Signature insertion failed:', e);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('Mahmoud Adamu', 20, 226);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text('Secretary, Governing Board', 20, 230);
    doc.text('Imam Malik Science & Tahfiz College Tudun Wada', 20, 235);

    // 8. Individual Verification QR Code (Name and Exam Number)
    try {
      const qrPayload = getAdmissionVerificationPayload({
        candidateName,
        examNumber,
        targetClass,
        entranceScore,
        schoolName,
        issueDate: dateFormatted
      });

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
    } catch (qrErr) {
      console.warn('QR Code generation error:', qrErr);
    }

    // 9. Footer Divider & Security Note (Clean Black)
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

    doc.setFont('helvetica', 'bold');
    doc.text(`Sheet ${i + 1} of ${total} | Candidate: ${candidateName} (${examNumber})`, 105, 259, { align: 'center' });
  }

  const generatedFileName =
    options.fileName ||
    `IMSC_All_Admitted_Students_Admission_Letters_${options.classFilter && options.classFilter !== 'all' ? options.classFilter.replace(/\s+/g, '_') + '_' : ''}${new Date().toISOString().split('T')[0]}.pdf`;

  // Create blob and trigger download
  const blob = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  if (options.openInNewWindow) {
    window.open(blobUrl, '_blank');
  } else {
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = generatedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return {
    totalCount: total,
    fileName: generatedFileName,
    blobUrl
  };
}
