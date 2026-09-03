
import React, { useState, useEffect } from 'react';
import { X, Loader2, UserCheck, Sparkles, BookOpen } from 'lucide-react';
import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { safeStorage, ParsedApplicant } from '../../../lib/applicantService';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: any;
  classes: any[];
}

export default function StudentModal({ isOpen, onClose, student, classes }: StudentModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    admissionNumber: '',
    currentClassId: '',
    gender: 'Male',
    formerSchool: 'Imam Malik Model Primary School',
    entranceScore: 80,
    guardianName: '',
    guardianPhone: '',
    address: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        admissionNumber: student.admissionNumber || student.examNumber || '',
        currentClassId: student.currentClassId || (student.gender === 'Female' ? 'JSS 1B' : 'JSS 1A'),
        gender: student.gender || 'Male',
        formerSchool: student.formerSchool || student.schoolName || 'Imam Malik Model Primary School',
        entranceScore: student.entranceScore || student.score || 80,
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        address: student.address || '',
        status: student.status || 'active'
      });
    } else {
      const randomNum = Math.floor(Math.random() * 900) + 100;
      setFormData({
        firstName: '',
        lastName: '',
        admissionNumber: `IMSC/2026/${randomNum}`,
        currentClassId: 'JSS 1A',
        gender: 'Male',
        formerSchool: 'Imam Malik Model Primary School',
        entranceScore: 80,
        guardianName: '',
        guardianPhone: '',
        address: '',
        status: 'active'
      });
    }
    setSuccessMsg(null);
  }, [student, isOpen]);

  // Handle Gender change with automatic class suggestion (Male: JSS 1A, Female: JSS 1B)
  const handleGenderChange = (newGender: string) => {
    const suggestedClass = newGender === 'Female' ? 'JSS 1B' : 'JSS 1A';
    setFormData(prev => ({
      ...prev,
      gender: newGender,
      currentClassId: prev.currentClassId === 'JSS 1A' || prev.currentClassId === 'JSS 1B' || !prev.currentClassId 
        ? suggestedClass 
        : prev.currentClassId
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccessMsg(null);
    try {
      const score = Number(formData.entranceScore) || 0;
      const isPassed = score >= 40;
      const docId = `app_${formData.admissionNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      const studentRecord = {
        ...formData,
        entranceScore: score,
        score: score,
        remark: isPassed ? 'Passed' : 'Failed',
        admissionStatus: isPassed ? 'approved' : 'rejected',
        updatedAt: new Date().toISOString(),
        createdAt: student?.createdAt || new Date().toISOString(),
        role: 'student'
      };

      // 1. Save to students collection
      if (student?.id) {
        await updateDoc(doc(db, "students", student.id), studentRecord);
      } else {
        await addDoc(collection(db, "students"), studentRecord);
      }

      // 2. Also register in 'applicants', 'successful_applicants', and 'applications' so candidate can log in seamlessly
      const applicantRecord = {
        id: docId,
        serialNumber: 1,
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gender: formData.gender.toLowerCase() === 'female' ? 'female' : 'male',
        examNumber: formData.admissionNumber.trim(),
        schoolName: formData.formerSchool,
        entranceScore: score,
        score: score,
        remark: isPassed ? 'passed' : 'failed',
        admissionStatus: isPassed ? 'approved' : 'rejected',
        targetClass: formData.currentClassId || (formData.gender === 'Female' ? 'JSS 1B' : 'JSS 1A'),
        uploadedAt: new Date().toISOString(),
        status: isPassed ? 'approved' : 'rejected',
        appliedDate: new Date().toISOString()
      };

      await setDoc(doc(db, 'applicants', docId), applicantRecord, { merge: true });
      if (isPassed) {
        await setDoc(doc(db, 'successful_applicants', docId), applicantRecord, { merge: true });
      }
      await setDoc(doc(db, 'applications', docId), applicantRecord, { merge: true });

      // 3. Update local cache
      const cached = safeStorage.getItem('imsc_applicants') || safeStorage.getItem('imsc_successful_applicants');
      let currentList: any[] = [];
      if (cached) {
        try { currentList = JSON.parse(cached); } catch (e) {}
      }
      const existingIdx = currentList.findIndex((a: any) => (a.examNumber || '').toLowerCase() === formData.admissionNumber.trim().toLowerCase());
      if (existingIdx >= 0) {
        currentList[existingIdx] = applicantRecord;
      } else {
        currentList.push(applicantRecord);
      }
      safeStorage.setItem('imsc_applicants', JSON.stringify(currentList));
      safeStorage.setItem('imsc_successful_applicants', JSON.stringify(currentList));

      setSuccessMsg(`Student "${formData.firstName} ${formData.lastName}" registered successfully! Login with Exam No: ${formData.admissionNumber} and Password: ${formData.firstName}`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Failed to save student record. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-emerald-950">
                  {student ? 'Edit Student Record' : 'Register New Student'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Direct student registration with automatic login access & class assignment
                </p>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            {successMsg && (
              <div className="mx-8 mt-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-700 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name (Login Password)</label>
                  <input 
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="input-field font-semibold" 
                    placeholder="e.g. Amina" 
                  />
                  <span className="text-[10px] text-slate-400 block ml-1">Used as candidate login password</span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name / Surname</label>
                  <input 
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="input-field" 
                    placeholder="e.g. Ibrahim" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admission / Exam Number (Username)</label>
                  <input 
                    required
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({...formData, admissionNumber: e.target.value})}
                    className="input-field font-mono font-bold text-emerald-900" 
                    placeholder="IMSC/2026/001" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => handleGenderChange(e.target.value)}
                    className="input-field font-bold"
                  >
                    <option value="Male">Male (Auto: JSS 1A)</option>
                    <option value="Female">Female (Auto: JSS 1B)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Class</label>
                  <select 
                    required
                    value={formData.currentClassId}
                    onChange={(e) => setFormData({...formData, currentClassId: e.target.value})}
                    className="input-field font-bold text-slate-800"
                  >
                    <option value="JSS 1A">JSS 1A (Boys Class)</option>
                    <option value="JSS 1B">JSS 1B (Girls Class)</option>
                    {classes.filter(c => c.name !== 'JSS 1A' && c.name !== 'JSS 1B').map(c => (
                      <option key={c.id || c.name} value={c.name || c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Entrance Exam Score (Cutoff: 40)</label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={formData.entranceScore}
                    onChange={(e) => setFormData({...formData, entranceScore: Number(e.target.value)})}
                    className="input-field font-bold" 
                    placeholder="80" 
                  />
                  <span className={`text-[10px] font-bold block ml-1 ${formData.entranceScore >= 40 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formData.entranceScore >= 40 ? '✓ Score ≥ 40: Admitted / Passed' : '✗ Score < 40: Not Admitted / Failed'}
                  </span>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Former Primary School</label>
                  <input 
                    value={formData.formerSchool}
                    onChange={(e) => setFormData({...formData, formerSchool: e.target.value})}
                    className="input-field" 
                    placeholder="e.g. Al-Huda Model Primary School" 
                  />
                </div>
              </div>

              <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100 flex items-start gap-3">
                <Sparkles size={18} className="text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-emerald-950 leading-relaxed">
                  <strong>Student Portal Login Details:</strong>
                  <div className="mt-1 flex flex-wrap gap-3 font-mono">
                    <span className="bg-white px-2 py-0.5 rounded border border-emerald-200">Username: <strong>{formData.admissionNumber || 'Admission No'}</strong></span>
                    <span className="bg-white px-2 py-0.5 rounded border border-emerald-200">Password: <strong>{formData.firstName || 'First Name'}</strong></span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Tuition Fee: ₦12,000 / term + ₦3,000 Dev Levy (Once for 3 years).
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-6">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Guardian Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Name</label>
                    <input 
                      value={formData.guardianName}
                      onChange={(e) => setFormData({...formData, guardianName: e.target.value})}
                      className="input-field" 
                      placeholder="Parent / Guardian Full Name" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Phone</label>
                    <input 
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({...formData, guardianPhone: e.target.value})}
                      className="input-field" 
                      placeholder="08012345678" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Address</label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="input-field min-h-[80px]" 
                    placeholder="Residential address in Kano..." 
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 text-base shadow-xl shadow-emerald-900/20 cursor-pointer disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" /> : student ? 'Update Student Record' : 'Register Student & Grant Access'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
