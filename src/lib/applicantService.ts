import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { safeStorage } from './safeStorage';
import { supabase, isSupabaseConfigured } from './supabase';
import { addDebugLog } from './debug';

export interface ParsedApplicant {
  id?: string;
  serialNumber: string | number;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  examNumber: string;
  schoolName: string;
  entranceScore: string | number;
  remark: 'passed' | 'failed';
  admissionStatus: 'approved' | 'rejected';
  targetClass: string; // JSS 1A for males, JSS 1B for females
  uploadedAt?: string;
  hasPaidRegistration?: boolean;
  registrationPaymentRef?: string;
}

// Normalize key names for flexible column matching
function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Helper to determine gender if not explicitly supplied
export function inferGender(nameStr: string, rawGender?: string): 'male' | 'female' {
  if (rawGender) {
    const g = rawGender.trim().toLowerCase();
    if (g.startsWith('f') || g === 'female' || g === 'girl' || g === 'woman') return 'female';
    if (g.startsWith('m') || g === 'male' || g === 'boy' || g === 'man') return 'male';
  }

  const femaleNames = new Set([
    'amina', 'fatima', 'khadija', 'aisha', 'aishat', 'zainab', 'maryam', 'hauwa',
    'halima', 'hafsat', 'rukayya', 'bilkisu', 'hadiza', 'rahama', 'nafisa', 'sadiya',
    'asmau', 'farida', 'munira', 'jamila', 'sarah', 'mary', 'grace', 'blessing', 'mercy',
    'joy', 'peace', 'faith', 'zubaida', 'lubabatu', 'sumayya', 'safiya', 'samira',
    'sakina', 'firdausi', 'habiba', 'rabi', 'rabiatu', 'maimuna', 'sahadatu', 'fadila',
    'faiza', 'asma', 'khairat', 'najaatu', 'hasana', 'hussaina', 'kande', 'larai', 'jummai'
  ]);

  const tokens = nameStr.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  for (const token of tokens) {
    if (femaleNames.has(token)) return 'female';
  }

  // Default to male
  return 'male';
}

export function parseExcelOrCsv(file: File): Promise<ParsedApplicant[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          resolve([]);
          return;
        }

        const parsed: ParsedApplicant[] = rawJson.map((row, idx) => {
          // Normalize row keys
          const normRow: { [key: string]: any } = {};
          Object.keys(row).forEach((key) => {
            normRow[normalizeKey(key)] = row[key];
          });

          // Serial Number
          const serialNumber =
            normRow['serialnumber'] ||
            normRow['serialno'] ||
            normRow['sn'] ||
            normRow['sno'] ||
            normRow['srno'] ||
            normRow['no'] ||
            idx + 1;

          // Name
          const rawName = String(
            normRow['name'] ||
            normRow['fullname'] ||
            normRow['studentname'] ||
            normRow['candidatename'] ||
            normRow['applicantname'] ||
            ''
          ).trim();

          const nameParts = rawName.split(/\s+/).filter(Boolean);
          const firstName = nameParts[0] || 'Candidate';
          const lastName = nameParts.slice(1).join(' ') || 'Applicant';

          // Gender detection (and rule: Male -> JSS 1A, Female -> JSS 1B)
          const rawGender = String(normRow['gender'] || normRow['sex'] || normRow['gend'] || '').trim();
          const gender = inferGender(rawName || firstName, rawGender);
          
          // Target Class assignment: Males in JSS 1A, Females in JSS 1B
          const explicitClass = String(normRow['class'] || normRow['targetclass'] || normRow['assignedclass'] || '').trim();
          let targetClass = gender === 'female' ? 'JSS 1B' : 'JSS 1A';
          if (explicitClass && !explicitClass.toLowerCase().startsWith('jss 1') && explicitClass.toLowerCase() !== 'jss1') {
            targetClass = explicitClass;
          }

          // Exam Number
          const examNumber = String(
            normRow['examno'] ||
            normRow['examnumber'] ||
            normRow['examinationno'] ||
            normRow['candidateno'] ||
            normRow['candidateid'] ||
            normRow['regno'] ||
            normRow['registrationno'] ||
            `EXAM-${2026000 + idx + 1}`
          ).trim();

          // School Name
          const schoolName = String(
            normRow['schoolname'] ||
            normRow['school'] ||
            normRow['previousschool'] ||
            normRow['primaryschool'] ||
            normRow['formerprimaryschool'] ||
            'Imam Malik Primary School'
          ).trim();

          // Entrance Exam Score
          const rawScore =
            normRow['entranceexamscore'] ||
            normRow['entrancescore'] ||
            normRow['examscore'] ||
            normRow['score'] ||
            normRow['marks'] ||
            0;

          // Remark
          const rawRemark = String(
            normRow['remark'] ||
            normRow['remarks'] ||
            normRow['status'] ||
            normRow['result'] ||
            'passed'
          ).trim().toLowerCase();

          const isPassed =
            rawRemark.includes('pass') ||
            rawRemark.includes('admit') ||
            rawRemark.includes('qualif') ||
            rawRemark.includes('success') ||
            Number(rawScore) >= 50;

          const remark: 'passed' | 'failed' = isPassed ? 'passed' : 'failed';
          const admissionStatus: 'approved' | 'rejected' = isPassed ? 'approved' : 'rejected';

          return {
            id: `app_${examNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            serialNumber,
            name: rawName || `${firstName} ${lastName}`,
            firstName,
            lastName,
            gender,
            examNumber,
            schoolName,
            entranceScore: rawScore,
            remark,
            admissionStatus,
            targetClass,
            uploadedAt: new Date().toISOString()
          };
        });

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

// Generate a downloadable sample Excel file
export function generateSampleExcelBlob(): Blob {
  const sampleData = [
    {
      'Serial Number': 1,
      'Name': 'Amina Ibrahim Danladi',
      'Gender': 'Female',
      'Exam No': 'IMSC/2026/001',
      'School Name': 'Al-Huda Model Primary School',
      'Entrance Exam Score': 84,
      'Remark': 'Passed',
      'Assigned Class': 'JSS 1B'
    },
    {
      'Serial Number': 2,
      'Name': 'Umar Farouk Bello',
      'Gender': 'Male',
      'Exam No': 'IMSC/2026/002',
      'School Name': 'Kano Capital Academy',
      'Entrance Exam Score': 78,
      'Remark': 'Passed',
      'Assigned Class': 'JSS 1A'
    },
    {
      'Serial Number': 3,
      'Name': 'Fatima Zahra Abubakar',
      'Gender': 'Female',
      'Exam No': 'IMSC/2026/003',
      'School Name': 'An-Nur Islamic Primary School',
      'Entrance Exam Score': 91,
      'Remark': 'Passed',
      'Assigned Class': 'JSS 1B'
    },
    {
      'Serial Number': 4,
      'Name': 'Mustapha Sani Garba',
      'Gender': 'Male',
      'Exam No': 'IMSC/2026/004',
      'School Name': 'Tudun Wada Central Primary',
      'Entrance Exam Score': 65,
      'Remark': 'Passed',
      'Assigned Class': 'JSS 1A'
    },
    {
      'Serial Number': 5,
      'Name': 'Khadija Usman Aliyu',
      'Gender': 'Female',
      'Exam No': 'IMSC/2026/005',
      'School Name': 'Al-Bayan Academy',
      'Entrance Exam Score': 42,
      'Remark': 'Failed',
      'Assigned Class': 'JSS 1B'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Successful Applicants');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Save applicants to local storage, Firestore, and Supabase
export async function saveUploadedApplicants(applicants: ParsedApplicant[]): Promise<{ added: number }> {
  let count = 0;

  // 1. Local Cache Backup for both 'imsc_applicants' and 'imsc_successful_applicants'
  const existingCached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
  let currentList: ParsedApplicant[] = [];
  if (existingCached) {
    try {
      currentList = JSON.parse(existingCached);
    } catch (e) {}
  }

  // Merge records by examNumber
  applicants.forEach((newApp) => {
    const idx = currentList.findIndex(
      (a) => a.examNumber.trim().toLowerCase() === newApp.examNumber.trim().toLowerCase()
    );
    if (idx >= 0) {
      currentList[idx] = { ...currentList[idx], ...newApp };
    } else {
      currentList.push(newApp);
    }
  });

  safeStorage.setItem('imsc_applicants', JSON.stringify(currentList));
  safeStorage.setItem('imsc_successful_applicants', JSON.stringify(currentList));

  // 2. Persist to Firestore: 'applicants', 'successful_applicants', 'applications', 'users'
  for (const app of applicants) {
    try {
      const docId = `app_${app.examNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      
      const appRecord = {
        ...app,
        id: docId,
        name: app.name,
        examNo: app.examNumber,
        examNumber: app.examNumber,
        score: Number(app.entranceScore) || app.entranceScore,
        entranceScore: app.entranceScore,
        remark: app.remark === 'passed' ? 'Passed' : 'Failed',
        schoolName: app.schoolName,
        serialNumber: app.serialNumber,
        firstName: app.firstName,
        lastName: app.lastName,
        studentId: app.examNumber,
        appliedDate: app.uploadedAt || new Date().toISOString(),
        status: app.admissionStatus,
        targetClass: app.targetClass || 'JSS 1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        role: 'student',
        hasPaidRegistration: false
      };

      // Bulk-insert into primary 'applicants' collection
      await setDoc(doc(db, 'applicants', docId), appRecord, { merge: true });

      // Save to 'successful_applicants' collection
      await setDoc(doc(db, 'successful_applicants', docId), appRecord, { merge: true });

      // Save to 'applications' collection for unified dashboard access
      await setDoc(
        doc(db, 'applications', docId),
        {
          id: docId,
          examNo: app.examNumber,
          examNumber: app.examNumber,
          firstName: app.firstName,
          lastName: app.lastName,
          name: app.name,
          previousSchool: app.schoolName,
          schoolName: app.schoolName,
          score: Number(app.entranceScore) || app.entranceScore,
          entranceScore: app.entranceScore,
          remark: app.remark === 'passed' ? 'Passed' : 'Failed',
          targetClassId: app.targetClass || 'jss1',
          targetClass: app.targetClass || 'JSS 1',
          status: app.admissionStatus,
          paymentStatus: 'pending',
          registrationFee: 12000,
          developmentFee: 3000,
          totalRegistrationFee: 15000,
          appliedDate: app.uploadedAt || new Date().toISOString(),
          isExcelImported: true
        },
        { merge: true }
      );

      // Create a user record stub for instant login
      await setDoc(
        doc(db, 'users', docId),
        {
          uid: docId,
          id: docId,
          role: 'student',
          displayName: app.name,
          email: `${app.examNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}@student.imsc.edu.ng`,
          studentId: app.examNumber,
          examNumber: app.examNumber,
          examNo: app.examNumber,
          firstName: app.firstName,
          lastName: app.lastName,
          schoolName: app.schoolName,
          score: Number(app.entranceScore) || app.entranceScore,
          entranceScore: app.entranceScore,
          remark: app.remark === 'passed' ? 'Passed' : 'Failed',
          admissionStatus: app.admissionStatus,
          targetClass: app.targetClass || 'JSS 1',
          hasPaidApplication: true
        },
        { merge: true }
      );

      count++;
    } catch (err) {
      console.warn('Error persisting applicant to Firestore:', err);
    }
  }

  // 3. Sync to Supabase if configured (bulk-insert into 'applicants' and 'successful_applicants')
  if (isSupabaseConfigured) {
    try {
      const supabaseRows = applicants.map((app) => ({
        id: `app_${app.examNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        exam_no: app.examNumber,
        exam_number: app.examNumber,
        name: app.name,
        first_name: app.firstName,
        last_name: app.lastName,
        school_name: app.schoolName,
        score: Number(app.entranceScore) || 0,
        entrance_score: Number(app.entranceScore) || 0,
        remark: app.remark === 'passed' ? 'Passed' : 'Failed',
        status: app.admissionStatus,
        created_at: new Date().toISOString()
      }));

      // Upsert into 'applicants' table
      await supabase.from('applicants').upsert(supabaseRows, { onConflict: 'id' }).catch(() => {});
      // Also upsert into 'successful_applicants' table
      await supabase.from('successful_applicants').upsert(supabaseRows, { onConflict: 'id' }).catch(() => {});
    } catch (supErr) {
      console.warn('Supabase bulk sync skipped:', supErr);
    }
  }

  addDebugLog('Applicant Service', `Successfully bulk-inserted ${count} applicants into 'applicants' database table.`, 'success');
  return { added: count };
}

// Fetch all uploaded applicants
export async function getSuccessfulApplicants(): Promise<ParsedApplicant[]> {
  const result: ParsedApplicant[] = [];

  // Check local cache first
  const cached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        result.push(...parsed);
      }
    } catch (e) {}
  }

  // Fetch from Firestore 'applicants' and 'successful_applicants'
  try {
    const snap = await getDocs(collection(db, 'applicants'));
    if (!snap.empty) {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const exists = result.some(
          (r) => r.examNumber.trim().toLowerCase() === (data.examNumber || data.examNo || '').trim().toLowerCase()
        );
        if (!exists) {
          const gen = data.gender || inferGender(data.name || data.firstName || '', '');
          const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
          result.push({
            id: d.id,
            serialNumber: data.serialNumber || 1,
            name: data.name,
            firstName: data.firstName || data.name?.split(' ')[0] || 'Candidate',
            lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
            gender: gen,
            examNumber: data.examNumber || data.examNo,
            schoolName: data.schoolName || '',
            entranceScore: data.entranceScore || data.score || 0,
            remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : 'failed',
            admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') ? 'approved' : 'rejected',
            targetClass: assignedClass,
            uploadedAt: data.createdAt || data.appliedDate
          });
        }
      });
    }
  } catch (err) {
    console.warn("Firestore 'applicants' fetch failed, checking fallback:", err);
  }

  // Also query 'successful_applicants'
  try {
    const snap = await getDocs(collection(db, 'successful_applicants'));
    if (!snap.empty) {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const exists = result.some(
          (r) => r.examNumber.trim().toLowerCase() === (data.examNumber || data.examNo || '').trim().toLowerCase()
        );
        if (!exists) {
          const gen = data.gender || inferGender(data.name || data.firstName || '', '');
          const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
          result.push({
            id: d.id,
            serialNumber: data.serialNumber || 1,
            name: data.name,
            firstName: data.firstName || data.name?.split(' ')[0] || 'Candidate',
            lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
            gender: gen,
            examNumber: data.examNumber || data.examNo,
            schoolName: data.schoolName || '',
            entranceScore: data.entranceScore || data.score || 0,
            remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : 'failed',
            admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') ? 'approved' : 'rejected',
            targetClass: assignedClass,
            uploadedAt: data.createdAt || data.appliedDate
          });
        }
      });
    }
  } catch (err) {
    console.warn('Firestore successful_applicants fetch failed:', err);
  }

  return result;
}

// Verify applicant login via Exam Number (as Username) and First Name (as Password)
export async function verifyApplicantLogin(
  examNumberInput: string,
  firstNameInput: string
): Promise<ParsedApplicant | null> {
  const cleanExamNo = examNumberInput.trim().toLowerCase();
  const cleanFirstName = firstNameInput.trim().toLowerCase();

  if (!cleanExamNo || !cleanFirstName) return null;

  // 1. Check local storage cache
  const cached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
  if (cached) {
    try {
      const list: ParsedApplicant[] = JSON.parse(cached);
      const match = list.find((a) => {
        const aExam = (a.examNumber || '').trim().toLowerCase();
        const aFirst = (a.firstName || a.name.split(' ')[0] || '').trim().toLowerCase();
        return aExam === cleanExamNo && (aFirst === cleanFirstName || a.name.toLowerCase().includes(cleanFirstName));
      });
      if (match) {
        addDebugLog('Applicant Login', `Applicant matched via local storage: ${match.name} (${match.examNumber})`, 'success');
        return match;
      }
    } catch (e) {}
  }

  // 2. Query Firestore 'applicants' collection
  try {
    const docId = `app_${cleanExamNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const directDoc = await getDoc(doc(db, 'applicants', docId));
    if (directDoc.exists()) {
      const data = directDoc.data() as any;
      const expectedFirst = (data.firstName || data.name?.split(' ')[0] || '').trim().toLowerCase();
      if (expectedFirst === cleanFirstName || (data.name && data.name.toLowerCase().includes(cleanFirstName))) {
        const gen = data.gender || inferGender(data.name || data.firstName || '', '');
        const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
        addDebugLog('Applicant Login', `Applicant matched via Firestore applicants table: ${data.name}`, 'success');
        return {
          id: directDoc.id,
          serialNumber: data.serialNumber || 1,
          name: data.name,
          firstName: data.firstName || data.name?.split(' ')[0] || 'Candidate',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          gender: gen,
          examNumber: data.examNumber || data.examNo,
          schoolName: data.schoolName || '',
          entranceScore: data.entranceScore || data.score || 0,
          remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : 'failed',
          admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') ? 'approved' : 'rejected',
          targetClass: assignedClass,
          uploadedAt: data.createdAt || data.appliedDate
        };
      }
    }

    const qApp = query(collection(db, 'applicants'), where('examNumber', '==', examNumberInput.trim()));
    const snapApp = await getDocs(qApp);
    if (!snapApp.empty) {
      const data = snapApp.docs[0].data() as any;
      const expectedFirst = (data.firstName || data.name?.split(' ')[0] || '').trim().toLowerCase();
      if (expectedFirst === cleanFirstName || (data.name && data.name.toLowerCase().includes(cleanFirstName))) {
        const gen = data.gender || inferGender(data.name || data.firstName || '', '');
        const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
        return {
          id: snapApp.docs[0].id,
          serialNumber: data.serialNumber || 1,
          name: data.name,
          firstName: data.firstName || data.name?.split(' ')[0] || 'Candidate',
          lastName: data.lastName || data.name?.split(' ').slice(1).join(' ') || '',
          gender: gen,
          examNumber: data.examNumber || data.examNo,
          schoolName: data.schoolName || '',
          entranceScore: data.entranceScore || data.score || 0,
          remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : 'failed',
          admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') ? 'approved' : 'rejected',
          targetClass: assignedClass,
          uploadedAt: data.createdAt || data.appliedDate
        };
      }
    }
  } catch (err) {
    console.warn("Firestore 'applicants' lookup error:", err);
  }

  // 3. Query Firestore 'successful_applicants'
  try {
    const docId = `app_${cleanExamNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const directDoc = await getDoc(doc(db, 'successful_applicants', docId));
    if (directDoc.exists()) {
      const data = directDoc.data() as ParsedApplicant;
      const expectedFirst = (data.firstName || data.name.split(' ')[0] || '').trim().toLowerCase();
      if (expectedFirst === cleanFirstName || data.name.toLowerCase().includes(cleanFirstName)) {
        addDebugLog('Applicant Login', `Applicant matched via Firestore: ${data.name}`, 'success');
        return data;
      }
    }

    // Query collection where examNumber == input
    const q = query(collection(db, 'successful_applicants'), where('examNumber', '==', examNumberInput.trim()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data() as ParsedApplicant;
      const expectedFirst = (data.firstName || data.name.split(' ')[0] || '').trim().toLowerCase();
      if (expectedFirst === cleanFirstName || data.name.toLowerCase().includes(cleanFirstName)) {
        addDebugLog('Applicant Login', `Applicant matched via Firestore query: ${data.name}`, 'success');
        return data;
      }
    }
  } catch (err) {
    console.warn('Firestore applicant login lookup failed:', err);
  }

  // 4. Query 'applications' collection as fallback
  try {
    const qApp = query(collection(db, 'applications'), where('examNumber', '==', examNumberInput.trim()));
    const snapApp = await getDocs(qApp);
    if (!snapApp.empty) {
      const data = snapApp.docs[0].data() as any;
      const expectedFirst = (data.firstName || (data.name ? data.name.split(' ')[0] : '')).trim().toLowerCase();
      if (expectedFirst === cleanFirstName || (data.name && data.name.toLowerCase().includes(cleanFirstName))) {
        const name = data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Candidate';
        const gender = data.gender || inferGender(name, data.gender);
        return {
          id: snapApp.docs[0].id,
          serialNumber: 1,
          name,
          firstName: data.firstName || name.split(' ')[0] || 'Candidate',
          lastName: data.lastName || name.split(' ').slice(1).join(' ') || 'Applicant',
          gender,
          examNumber: data.examNumber || examNumberInput.trim(),
          schoolName: data.schoolName || data.previousSchool || 'Imam Malik School',
          entranceScore: data.entranceScore || 80,
          remark: data.remark || 'passed',
          admissionStatus: data.status || 'approved',
          targetClass: data.targetClass || (gender === 'female' ? 'JSS 1B' : 'JSS 1A')
        };
      }
    }
  } catch (err) {
    console.warn('Applications fallback lookup error:', err);
  }

  return null;
}
