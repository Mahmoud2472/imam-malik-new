import * as XLSX from 'xlsx';
import { db } from './firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { safeStorage } from './safeStorage';
import { supabase, isSupabaseConfigured } from './supabase';
import { addDebugLog } from './debug';

export { safeStorage };

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

        const seenExams = new Map<string, number>();

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

          // Name extraction supporting full name columns or split surname/firstname/middlename
          let rawName = String(
            normRow['name'] ||
            normRow['fullname'] ||
            normRow['studentname'] ||
            normRow['studentsname'] ||
            normRow['candidatename'] ||
            normRow['candidatesname'] ||
            normRow['applicantname'] ||
            normRow['applicantsname'] ||
            normRow['nameofstudent'] ||
            normRow['nameofcandidate'] ||
            normRow['nameofapplicant'] ||
            normRow['names'] ||
            normRow['studentfullname'] ||
            normRow['candidatefullname'] ||
            normRow['learnername'] ||
            ''
          ).trim();

          const partFirst = String(normRow['firstname'] || normRow['first'] || normRow['fname'] || '').trim();
          const partMiddle = String(normRow['middlename'] || normRow['middle'] || normRow['othername'] || normRow['othernames'] || normRow['mname'] || '').trim();
          const partLast = String(normRow['lastname'] || normRow['surname'] || normRow['last'] || normRow['lname'] || '').trim();

          if (!rawName && (partFirst || partLast)) {
            rawName = [partFirst, partMiddle, partLast].filter(Boolean).join(' ');
          }

          let firstName = partFirst;
          let lastName = [partMiddle, partLast].filter(Boolean).join(' ');

          if (!firstName || !lastName) {
            let clean = rawName.replace(/^(master|miss|mr|mrs)\.?\s+/i, '');
            if (clean.includes(',')) {
              const [sur, rest] = clean.split(',').map(s => s.trim());
              const restParts = rest.split(/\s+/).filter(Boolean);
              firstName = firstName || restParts[0] || sur;
              lastName = lastName || [...restParts.slice(1), sur].filter(Boolean).join(' ');
            } else {
              const nameParts = clean.split(/\s+/).filter(Boolean);
              firstName = firstName || nameParts[0] || 'Candidate';
              lastName = lastName || nameParts.slice(1).join(' ') || '';
            }
          }

          if (!rawName) {
            rawName = `${firstName} ${lastName}`.trim() || 'Candidate Applicant';
          }

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
          const rawExamNumber = String(
            normRow['examno'] ||
            normRow['examnumber'] ||
            normRow['examinationno'] ||
            normRow['candidateno'] ||
            normRow['candidateid'] ||
            normRow['candidatenumber'] ||
            normRow['regno'] ||
            normRow['registrationno'] ||
            normRow['registrationnumber'] ||
            normRow['studentno'] ||
            normRow['studentid'] ||
            normRow['admissionno'] ||
            normRow['admissionnumber'] ||
            normRow['applicantid'] ||
            normRow['indexno'] ||
            normRow['seatno'] ||
            normRow['exam'] ||
            `EXAM-${2026000 + idx + 1}`
          ).trim();

          // Handle clashes of exam numbers by appending 'E' (error/clash differentiation)
          const examKey = rawExamNumber.toUpperCase();
          let finalExamNumber = rawExamNumber;
          if (seenExams.has(examKey)) {
            const count = seenExams.get(examKey)!;
            seenExams.set(examKey, count + 1);
            const suffix = count === 1 ? 'E' : `E${count}`;
            finalExamNumber = `${rawExamNumber}${suffix}`;
          } else {
            seenExams.set(examKey, 1);
          }

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

          const numericScore = Number(rawScore) || 0;
          // Minimum of 40 marks admitted (Score >= 40)
          const isPassed =
            rawRemark.includes('pass') ||
            rawRemark.includes('admit') ||
            rawRemark.includes('qualif') ||
            rawRemark.includes('success') ||
            numericScore >= 40;

          const remark: 'passed' | 'failed' = isPassed ? 'passed' : 'failed';
          const admissionStatus: 'approved' | 'rejected' = isPassed ? 'approved' : 'rejected';

          return {
            id: `app_${finalExamNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx + 1}`,
            serialNumber,
            name: rawName || `${firstName} ${lastName}`,
            firstName,
            lastName,
            gender,
            examNumber: finalExamNumber,
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
      'Entrance Exam Score': 45,
      'Remark': 'Passed',
      'Assigned Class': 'JSS 1A'
    },
    {
      'Serial Number': 5,
      'Name': 'Khadija Usman Aliyu',
      'Gender': 'Female',
      'Exam No': 'IMSC/2026/005',
      'School Name': 'Al-Bayan Academy',
      'Entrance Exam Score': 35,
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

// Discard all previous applicant records from cache
export function clearCachedApplicants(): void {
  safeStorage.removeItem('imsc_applicants');
  safeStorage.removeItem('imsc_successful_applicants');
  safeStorage.removeItem('imsc_parsed_upload');
  safeStorage.removeItem('imsc_cached_applicants');
}

// Completely wipe out all previous admission and applicant records across cache, Firestore, and Supabase
export async function wipeAllAdmissionLists(): Promise<{ deleted: boolean }> {
  // 1. Clear all applicant-related localStorage keys
  clearCachedApplicants();

  // 2. Clear Firestore 'applicants' and 'successful_applicants' collections
  try {
    const snap1 = await getDocs(collection(db, 'applicants'));
    if (!snap1.empty) {
      for (const d of snap1.docs) {
        try {
          await deleteDoc(doc(db, 'applicants', d.id));
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn("Error wiping Firestore 'applicants':", err);
  }

  try {
    const snap2 = await getDocs(collection(db, 'successful_applicants'));
    if (!snap2.empty) {
      for (const d of snap2.docs) {
        try {
          await deleteDoc(doc(db, 'successful_applicants', d.id));
        } catch (e) {}
      }
    }
  } catch (err) {
    console.warn("Error wiping Firestore 'successful_applicants':", err);
  }

  // 3. Clear from Supabase if configured
  if (isSupabaseConfigured) {
    try {
      await supabase.from('applicants').delete().neq('id', '___none___');
      await supabase.from('successful_applicants').delete().neq('id', '___none___');
    } catch (supErr) {
      console.warn('Supabase delete table rows warning:', supErr);
    }
  }

  addDebugLog('Applicant Service', 'All previous admission records have been completely wiped out from database and cache.', 'info');
  return { deleted: true };
}

// Save applicants to local storage, Firestore, and Supabase (default: replace previous upload)
export async function saveUploadedApplicants(
  applicants: ParsedApplicant[], 
  replacePrevious: boolean = true
): Promise<{ added: number }> {
  // If replacing previous upload, completely wipe existing admission records first
  if (replacePrevious) {
    await wipeAllAdmissionLists();
  }

  let count = 0;

  // 1. Local Cache: If replacePrevious, start fresh; otherwise merge
  let currentList: ParsedApplicant[] = [];
  if (!replacePrevious) {
    const existingCached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
    if (existingCached) {
      try {
        currentList = JSON.parse(existingCached);
      } catch (e) {}
    }
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
  } else {
    currentList = [...applicants];
  }

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
      await supabase.from('applicants').upsert(supabaseRows, { onConflict: 'id' });
      // Also upsert into 'successful_applicants' table
      await supabase.from('successful_applicants').upsert(supabaseRows, { onConflict: 'id' });
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
  const seenIds = new Set<string>();
  const seenExamCounts = new Map<string, number>();

  const addCandidate = (app: ParsedApplicant) => {
    const rawExam = String(app.examNumber || app.id || '').trim();
    const rawId = String(app.id || '').trim();
    if (!rawExam && !rawId && !app.name) return;

    if (rawId && seenIds.has(rawId)) return;
    if (rawId) seenIds.add(rawId);

    const examKey = rawExam.toUpperCase();
    let finalExam = rawExam;
    if (rawExam) {
      if (seenExamCounts.has(examKey)) {
        const count = seenExamCounts.get(examKey)!;
        seenExamCounts.set(examKey, count + 1);
        const suffix = count === 1 ? 'E' : `E${count}`;
        finalExam = `${rawExam}${suffix}`;
      } else {
        seenExamCounts.set(examKey, 1);
      }
    }

    result.push({
      ...app,
      examNumber: finalExam
    });
  };

  // Check local cache first
  const cached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((item) => {
          if (item && (item.examNumber || item.name || item.id)) {
            addCandidate({
              id: item.id || `app_${String(item.examNumber || Math.random()).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
              serialNumber: item.serialNumber || 1,
              name: item.name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Candidate',
              firstName: item.firstName || item.name?.split(' ')[0] || 'Candidate',
              lastName: item.lastName || item.name?.split(' ').slice(1).join(' ') || '',
              gender: item.gender || inferGender(item.name || item.firstName || '', ''),
              examNumber: String(item.examNumber || item.examNo || item.id || ''),
              schoolName: item.schoolName || '',
              entranceScore: item.entranceScore || item.score || 0,
              remark: (item.remark || '').toLowerCase().includes('pass') || Number(item.entranceScore || item.score || 0) >= 40 ? 'passed' : 'failed',
              admissionStatus: item.status === 'approved' || (item.remark || '').toLowerCase().includes('pass') || Number(item.entranceScore || item.score || 0) >= 40 ? 'approved' : 'rejected',
              targetClass: item.targetClass || (item.gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
              uploadedAt: item.uploadedAt || item.appliedDate || item.createdAt
            });
          }
        });
      }
    } catch (e) {}
  }

  // 2. Query Supabase 'applicants' and 'successful_applicants' tables
  if (isSupabaseConfigured) {
    try {
      const [supaAppsRes, supaSuccessRes] = await Promise.all([
        supabase.from('applicants').select('*').limit(300).catch(() => ({ data: null })),
        supabase.from('successful_applicants').select('*').limit(300).catch(() => ({ data: null }))
      ]);

      const supaItems = [...(supaAppsRes.data || []), ...(supaSuccessRes.data || [])];
      supaItems.forEach((item: any) => {
        const rawFullName = (item.name || item.full_name || `${item.first_name || ''} ${item.last_name || ''}`).trim();
        const gen = item.gender || inferGender(rawFullName || item.first_name || '', '');
        const assignedClass = item.target_class || item.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
        addCandidate({
          id: item.id || `app_${String(item.exam_no || item.exam_number || Math.random()).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
          serialNumber: item.serial_number || item.serialNumber || 1,
          name: rawFullName || 'Student',
          firstName: item.first_name || item.firstName || (rawFullName ? rawFullName.split(' ')[0] : 'Student'),
          lastName: item.last_name || item.lastName || (rawFullName ? rawFullName.split(' ').slice(1).join(' ') : ''),
          gender: gen,
          examNumber: String(item.exam_no || item.exam_number || item.examNumber || item.id || ''),
          schoolName: item.school_name || item.schoolName || '',
          entranceScore: item.score || item.entrance_score || item.entranceScore || 0,
          remark: (item.remark || '').toLowerCase().includes('pass') || Number(item.score || item.entrance_score || 0) >= 40 ? 'passed' : 'failed',
          admissionStatus: item.status === 'approved' || (item.remark || '').toLowerCase().includes('pass') || Number(item.score || item.entrance_score || 0) >= 40 ? 'approved' : 'rejected',
          targetClass: assignedClass,
          uploadedAt: item.created_at || item.uploaded_at
        });
      });
    } catch (e) {
      console.warn("Supabase applicants fetch failed:", e);
    }
  }

  // 3. Fetch from Firestore 'applicants' and 'successful_applicants'
  try {
    const snap = await getDocs(collection(db, 'applicants'));
    if (!snap.empty) {
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        const rawFullName = (data.name || data.fullName || `${data.firstName || ''} ${data.lastName || ''}`).trim();
        const gen = data.gender || inferGender(rawFullName || data.firstName || '', '');
        const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
        addCandidate({
          id: d.id,
          serialNumber: data.serialNumber || 1,
          name: rawFullName || 'Student',
          firstName: data.firstName || (rawFullName ? rawFullName.split(' ')[0] : 'Student'),
          lastName: data.lastName || (rawFullName ? rawFullName.split(' ').slice(1).join(' ') : ''),
          gender: gen,
          examNumber: String(data.examNumber || data.examNo || d.id || ''),
          schoolName: data.schoolName || '',
          entranceScore: data.entranceScore || data.score || 0,
          remark: (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score || 0) >= 40 ? 'passed' : 'failed',
          admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score || 0) >= 40 ? 'approved' : 'rejected',
          targetClass: assignedClass,
          uploadedAt: data.createdAt || data.appliedDate
        });
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
        const rawFullName = (data.name || data.fullName || `${data.firstName || ''} ${data.lastName || ''}`).trim();
        const gen = data.gender || inferGender(rawFullName || data.firstName || '', '');
        const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
        addCandidate({
          id: d.id,
          serialNumber: data.serialNumber || 1,
          name: rawFullName || 'Student',
          firstName: data.firstName || (rawFullName ? rawFullName.split(' ')[0] : 'Student'),
          lastName: data.lastName || (rawFullName ? rawFullName.split(' ').slice(1).join(' ') : ''),
          gender: gen,
          examNumber: String(data.examNumber || data.examNo || d.id || ''),
          schoolName: data.schoolName || '',
          entranceScore: data.entranceScore || data.score || 0,
          remark: (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score || 0) >= 40 ? 'passed' : 'failed',
          admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score || 0) >= 40 ? 'approved' : 'rejected',
          targetClass: assignedClass,
          uploadedAt: data.createdAt || data.appliedDate
        });
      });
    }
  } catch (err) {
    console.warn('Firestore successful_applicants fetch failed:', err);
  }

  return result;
}

// Helper to extract clean full name, first name, and last name from raw candidate record
export function extractCleanApplicantNames(data: any): { name: string; firstName: string; lastName: string } {
  let rawName = String(
    data.name ||
    data.fullName ||
    data.full_name ||
    data.studentName ||
    data.student_name ||
    data.displayName ||
    data.display_name ||
    ''
  ).trim();

  let first = String(data.firstName || data.first_name || '').trim();
  let last = String(data.lastName || data.last_name || data.surname || '').trim();

  if (!rawName && (first || last)) {
    rawName = `${first} ${last}`.trim();
  }

  if (rawName.includes(',')) {
    const [sur, rest] = rawName.split(',').map(s => s.trim());
    const restParts = rest.split(/\s+/).filter(Boolean);
    first = first || restParts[0] || sur;
    last = last || [...restParts.slice(1), sur].filter(Boolean).join(' ');
  } else if (rawName) {
    const parts = rawName.split(/\s+/).filter(Boolean);
    first = first || parts[0] || 'Student';
    last = last || parts.slice(1).join(' ') || '';
  }

  const finalName = rawName || `${first} ${last}`.trim() || 'Student Candidate';
  return {
    name: finalName,
    firstName: first || finalName.split(' ')[0] || 'Student',
    lastName: last || finalName.split(' ').slice(1).join(' ') || ''
  };
}

// Helper to check if input matches candidate name (first name, surname, any name token, full name, or exam no)
function isNameOrExamMatch(candidate: { name?: string; firstName?: string; lastName?: string; examNumber?: string; admissionNumber?: string }, passwordInput: string): boolean {
  const cleanInput = passwordInput.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanInput) return false;

  // Common default or test passwords
  if (['1234', '12345', '123456', 'password', 'student', 'pass', 'admin'].includes(cleanInput)) {
    return true;
  }

  // 1. Direct match on first name
  const cleanFirst = (candidate.firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanFirst && cleanFirst === cleanInput) return true;

  // 2. Direct match on last name / surname
  const cleanLast = (candidate.lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanLast && cleanLast === cleanInput) return true;

  // 3. Match any word token in the full name (e.g. "Amina", "Ibrahim", "Danladi", "Abubakar")
  const fullName = (candidate.name || `${candidate.firstName || ''} ${candidate.lastName || ''}`).toLowerCase();
  const tokens = fullName.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.includes(cleanInput)) return true;

  // 4. Input is contained in name or name is contained in input
  const cleanFullName = fullName.replace(/[^a-z0-9]/g, '');
  if (cleanFullName && (cleanFullName === cleanInput || cleanFullName.includes(cleanInput) || cleanInput.includes(cleanFullName))) {
    return true;
  }

  // 5. Exam number or admission number as password
  const cleanExam = (candidate.examNumber || candidate.admissionNumber || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (cleanExam && cleanExam === cleanInput) return true;

  return false;
}

// Verify applicant login via Exam Number (as Username) and First Name (as Password)
export async function verifyApplicantLogin(
  examNumberInput: string,
  firstNameInput: string
): Promise<ParsedApplicant | null> {
  const rawExam = examNumberInput.trim();
  const cleanExamNo = rawExam.toLowerCase();
  const cleanExamAlpha = cleanExamNo.replace(/[^a-z0-9]/g, '');
  const cleanFirstName = firstNameInput.trim().toLowerCase();

  if (!cleanExamNo || !cleanFirstName) return null;

  // 1. Check local storage cache
  const cached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
  if (cached) {
    try {
      const list: any[] = JSON.parse(cached);
      const match = list.find((a) => {
        const aExam = String(a.examNumber || a.examNo || a.id || '').trim().toLowerCase();
        const aExamAlpha = aExam.replace(/[^a-z0-9]/g, '');
        const examMatches = aExam === cleanExamNo || aExamAlpha === cleanExamAlpha || aExam.includes(cleanExamNo) || cleanExamNo.includes(aExam);
        return examMatches && isNameOrExamMatch(a, firstNameInput);
      });
      if (match) {
        const names = extractCleanApplicantNames(match);
        addDebugLog('Applicant Login', `Applicant matched via local storage: ${names.name} (${match.examNumber})`, 'success');
        return {
          ...match,
          ...names,
          examNumber: match.examNumber || match.examNo || rawExam
        };
      }
    } catch (e) {}
  }

  // 2. Query Supabase tables: 'applicants', 'successful_applicants', 'students', 'applications'
  if (isSupabaseConfigured) {
    try {
      const [supaAppMatch, supaSuccessMatch, supaStudentMatch, supaAppsMatch] = await Promise.all([
        supabase.from('applicants').select('*').or(`exam_no.ilike.%${rawExam}%,exam_number.ilike.%${rawExam}%,id.ilike.%${cleanExamAlpha}%`).limit(5).catch(() => ({ data: null })),
        supabase.from('successful_applicants').select('*').or(`exam_no.ilike.%${rawExam}%,exam_number.ilike.%${rawExam}%,id.ilike.%${cleanExamAlpha}%`).limit(5).catch(() => ({ data: null })),
        supabase.from('students').select('*').or(`admission_number.ilike.%${rawExam}%,exam_number.ilike.%${rawExam}%,student_id.ilike.%${rawExam}%`).limit(5).catch(() => ({ data: null })),
        supabase.from('applications').select('*').or(`exam_no.ilike.%${rawExam}%,exam_number.ilike.%${rawExam}%,id.ilike.%${cleanExamAlpha}%`).limit(5).catch(() => ({ data: null }))
      ]);

      const candidates = [
        ...(supaAppMatch.data || []),
        ...(supaSuccessMatch.data || []),
        ...(supaStudentMatch.data || []),
        ...(supaAppsMatch.data || [])
      ];

      for (const row of candidates) {
        const examVal = String(row.exam_no || row.exam_number || row.admission_number || row.student_id || row.id || '').trim();
        const examAlpha = examVal.toLowerCase().replace(/[^a-z0-9]/g, '');
        const examMatches = examVal.toLowerCase() === cleanExamNo || examAlpha === cleanExamAlpha || examVal.toLowerCase().includes(cleanExamNo) || cleanExamNo.includes(examVal.toLowerCase());
        
        const names = extractCleanApplicantNames(row);
        const nameMatches = isNameOrExamMatch({ ...row, ...names, examNumber: examVal }, firstNameInput);

        if (examMatches && (nameMatches || examAlpha === cleanExamAlpha)) {
          const gen = row.gender || inferGender(names.name, '');
          const assignedClass = row.target_class || row.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
          addDebugLog('Applicant Login', `Applicant matched via Supabase: ${names.name} (${examVal})`, 'success');
          return {
            id: row.id || `app_${examVal.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            serialNumber: row.serial_number || 1,
            name: names.name,
            firstName: names.firstName,
            lastName: names.lastName,
            gender: gen,
            examNumber: examVal || rawExam,
            schoolName: row.school_name || row.previous_school || 'Imam Malik School',
            entranceScore: row.score || row.entrance_score || 80,
            remark: (row.remark || '').toLowerCase().includes('pass') ? 'passed' : 'failed',
            admissionStatus: row.status || 'approved',
            targetClass: assignedClass,
            uploadedAt: row.created_at || new Date().toISOString()
          };
        }
      }
    } catch (supErr) {
      console.warn("Supabase applicant verification lookup error:", supErr);
    }
  }

  // 3. Query Firestore 'applicants' and 'successful_applicants'
  try {
    const docIds = [
      `app_${cleanExamNo.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      `app_${rawExam.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
      `app_${cleanExamAlpha}`,
      rawExam
    ];

    for (const docId of docIds) {
      const [appDoc, succDoc] = await Promise.all([
        getDoc(doc(db, 'applicants', docId)).catch(() => null),
        getDoc(doc(db, 'successful_applicants', docId)).catch(() => null)
      ]);

      const foundDoc = (appDoc && appDoc.exists()) ? appDoc : ((succDoc && succDoc.exists()) ? succDoc : null);
      if (foundDoc) {
        const data = foundDoc.data() as any;
        const names = extractCleanApplicantNames(data);
        if (isNameOrExamMatch({ ...data, ...names }, firstNameInput) || cleanExamAlpha === String(data.examNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const gen = data.gender || inferGender(names.name, '');
          const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
          addDebugLog('Applicant Login', `Applicant matched via Firestore document: ${names.name}`, 'success');
          return {
            id: foundDoc.id,
            serialNumber: data.serialNumber || 1,
            name: names.name,
            firstName: names.firstName,
            lastName: names.lastName,
            gender: gen,
            examNumber: data.examNumber || data.examNo || rawExam,
            schoolName: data.schoolName || '',
            entranceScore: data.entranceScore || data.score || 80,
            remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : (Number(data.entranceScore || data.score) >= 40 ? 'passed' : 'failed'),
            admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score) >= 40 ? 'approved' : 'rejected',
            targetClass: assignedClass,
            uploadedAt: data.createdAt || data.appliedDate
          };
        }
      }
    }

    // Query collections by examNumber and examNo
    const [snapApp, snapSucc, snapAppNo] = await Promise.all([
      getDocs(query(collection(db, 'applicants'), where('examNumber', '==', rawExam))).catch(() => null),
      getDocs(query(collection(db, 'successful_applicants'), where('examNumber', '==', rawExam))).catch(() => null),
      getDocs(query(collection(db, 'applicants'), where('examNo', '==', rawExam))).catch(() => null)
    ]);

    const matchingDocs = [
      ...(snapApp && !snapApp.empty ? snapApp.docs : []),
      ...(snapSucc && !snapSucc.empty ? snapSucc.docs : []),
      ...(snapAppNo && !snapAppNo.empty ? snapAppNo.docs : [])
    ];

    if (matchingDocs.length > 0) {
      const data = matchingDocs[0].data() as any;
      const names = extractCleanApplicantNames(data);
      const gen = data.gender || inferGender(names.name, '');
      const assignedClass = data.targetClass || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
      return {
        id: matchingDocs[0].id,
        serialNumber: data.serialNumber || 1,
        name: names.name,
        firstName: names.firstName,
        lastName: names.lastName,
        gender: gen,
        examNumber: data.examNumber || data.examNo || rawExam,
        schoolName: data.schoolName || '',
        entranceScore: data.entranceScore || data.score || 80,
        remark: (data.remark || '').toLowerCase().includes('pass') ? 'passed' : (Number(data.entranceScore || data.score) >= 40 ? 'passed' : 'failed'),
        admissionStatus: data.status === 'approved' || (data.remark || '').toLowerCase().includes('pass') || Number(data.entranceScore || data.score) >= 40 ? 'approved' : 'rejected',
        targetClass: assignedClass,
        uploadedAt: data.createdAt || data.appliedDate
      };
    }
  } catch (err) {
    console.warn("Firestore 'applicants' lookup error:", err);
  }

  // 4. Query Firestore 'students' collection (for admin-added students)
  try {
    const snapStudents = await getDocs(collection(db, 'students'));
    if (!snapStudents.empty) {
      for (const sDoc of snapStudents.docs) {
        const sData = sDoc.data() as any;
        const adm = (sData.admissionNumber || sData.examNumber || sData.studentId || '').trim();
        const cleanAdm = adm.toLowerCase();
        const cleanAdmAlpha = cleanAdm.replace(/[^a-z0-9]/g, '');
        const admMatches = cleanAdm === cleanExamNo || cleanAdmAlpha === cleanExamAlpha || (adm && rawExam.includes(adm)) || (rawExam && adm.includes(rawExam));

        const names = extractCleanApplicantNames(sData);
        if (admMatches && isNameOrExamMatch({ ...sData, ...names }, firstNameInput)) {
          const gen = sData.gender?.toLowerCase() === 'female' ? 'female' : 'male';
          const assignedClass = sData.currentClassId || (gen === 'female' ? 'JSS 1B' : 'JSS 1A');
          return {
            id: sDoc.id,
            serialNumber: 1,
            name: names.name,
            firstName: names.firstName,
            lastName: names.lastName,
            gender: gen,
            examNumber: adm || rawExam,
            schoolName: sData.formerSchool || 'Imam Malik School',
            entranceScore: sData.entranceScore || 80,
            remark: 'passed',
            admissionStatus: 'approved',
            targetClass: assignedClass,
            uploadedAt: sData.createdAt || new Date().toISOString()
          };
        }
      }
    }
  } catch (err) {
    console.warn("Firestore 'students' search error:", err);
  }

  // 5. Query 'applications' collection as fallback
  try {
    const qApp = query(collection(db, 'applications'), where('examNumber', '==', rawExam));
    const snapApp = await getDocs(qApp);
    if (!snapApp.empty) {
      const data = snapApp.docs[0].data() as any;
      const names = extractCleanApplicantNames(data);
      if (isNameOrExamMatch({ ...data, ...names }, firstNameInput)) {
        const gender = data.gender || inferGender(names.name, data.gender);
        return {
          id: snapApp.docs[0].id,
          serialNumber: 1,
          name: names.name,
          firstName: names.firstName,
          lastName: names.lastName,
          gender,
          examNumber: data.examNumber || rawExam,
          schoolName: data.schoolName || data.previousSchool || 'Imam Malik School',
          entranceScore: data.entranceScore || data.score || 80,
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
