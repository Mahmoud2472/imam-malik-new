
import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { doc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'Class' | 'Subject' | 'Fee';
  item?: any;
}

export default function ConfigModal({ isOpen, onClose, type, item }: ConfigModalProps) {
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData(item);
    } else {
      if (type === 'Class') setFormData({ name: '', level: 'Junior Secondary' });
      else if (type === 'Fee') setFormData({ name: '', amount: 0, description: '' });
      else setFormData({ name: '', code: '' });
    }
  }, [item, type, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const collectionName = type.toLowerCase() + 's';
      const dataToSave = { ...formData };
      if (type === 'Fee') {
        dataToSave.amount = Number(dataToSave.amount);
      }
      
      if (item?.id) {
        await updateDoc(doc(db, collectionName, item.id), dataToSave);
      } else {
        await addDoc(collection(db, collectionName), dataToSave);
      }
      onClose();
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="flex justify-between items-center px-8 py-6 border-b border-slate-100 italic bg-slate-50/50">
              <h3 className="text-xl font-bold text-emerald-950">
                {item ? `Edit ${type}` : `Add New ${type}`}
              </h3>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{type} Name</label>
                <input 
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input-field" 
                  placeholder={`e.g. ${type === 'Class' ? 'JSS 1' : type === 'Fee' ? 'Term 1 Fee' : 'Mathematics'}`} 
                />
              </div>

              {type === 'Class' ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Academic Level</label>
                  <select 
                    value={formData.level || ''}
                    onChange={(e) => setFormData({...formData, level: e.target.value})}
                    className="input-field"
                  >
                    <option value="Junior Secondary">Junior Secondary</option>
                    <option value="Senior Secondary">Senior Secondary</option>
                  </select>
                </div>
              ) : type === 'Fee' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (NGN)</label>
                    <input 
                      required
                      type="number"
                      value={formData.amount || ''}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="input-field" 
                      placeholder="e.g. 12000" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea 
                      value={formData.description || ''}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="input-field min-h-[80px]" 
                      placeholder="e.g. Annual development levy" 
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject Code</label>
                  <input 
                    required
                    value={formData.code || ''}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                    className="input-field" 
                    placeholder="e.g. MTH" 
                  />
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-slate-400 hover:bg-slate-50 transition-all underline underline-offset-4"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-[2] btn-primary py-3 flex items-center justify-center gap-2 text-base shadow-lg shadow-emerald-900/10"
                >
                  {loading ? <Loader2 className="animate-spin" /> : item ? `Update ${type}` : `Register ${type}`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
