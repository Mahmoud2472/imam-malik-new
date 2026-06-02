
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { doc, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

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
    guardianName: '',
    guardianPhone: '',
    address: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.firstName || '',
        lastName: student.lastName || '',
        admissionNumber: student.admissionNumber || '',
        currentClassId: student.currentClassId || '',
        gender: student.gender || 'Male',
        guardianName: student.guardianName || '',
        guardianPhone: student.guardianPhone || '',
        address: student.address || '',
        status: student.status || 'active'
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        admissionNumber: `IMC/${new Date().getFullYear()}/${Math.floor(Math.random() * 9000) + 1000}`,
        currentClassId: '',
        gender: 'Male',
        guardianName: '',
        guardianPhone: '',
        address: '',
        status: 'active'
      });
    }
  }, [student, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (student?.id) {
        await updateDoc(doc(db, "students", student.id), formData);
      } else {
        await addDoc(collection(db, "students"), formData);
      }
      onClose();
    } catch (error) {
      console.error("Error saving student:", error);
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
              <h3 className="text-xl font-bold text-emerald-950">
                {student ? 'Edit Student' : 'Add New Student'}
              </h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                  <input 
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    className="input-field" 
                    placeholder="e.g. Zainab" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                  <input 
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    className="input-field" 
                    placeholder="e.g. Abubakar" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Admission Number</label>
                  <input 
                    required
                    value={formData.admissionNumber}
                    onChange={(e) => setFormData({...formData, admissionNumber: e.target.value})}
                    className="input-field" 
                    placeholder="IMC/2026/0001" 
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Class</label>
                  <select 
                    required
                    value={formData.currentClassId}
                    onChange={(e) => setFormData({...formData, currentClassId: e.target.value})}
                    className="input-field"
                  >
                    <option value="">Select Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                  <select 
                    value={formData.gender}
                    onChange={(e) => setFormData({...formData, gender: e.target.value})}
                    className="input-field"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="input-field"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="graduated">Graduated</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-50 space-y-6">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Guardian Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Name</label>
                    <input 
                      value={formData.guardianName}
                      onChange={(e) => setFormData({...formData, guardianName: e.target.value})}
                      className="input-field" 
                      placeholder="Full Name" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Phone</label>
                    <input 
                      value={formData.guardianPhone}
                      onChange={(e) => setFormData({...formData, guardianPhone: e.target.value})}
                      className="input-field" 
                      placeholder="080..." 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Home Address</label>
                  <textarea 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                    className="input-field min-h-[100px]" 
                    placeholder="Residential address..." 
                  />
                </div>
              </div>

              <div className="pt-8 flex gap-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-8 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-all border border-slate-200"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 text-lg shadow-xl shadow-emerald-900/20"
                >
                  {loading ? <Loader2 className="animate-spin" /> : student ? 'Update Student' : 'Register Student'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
