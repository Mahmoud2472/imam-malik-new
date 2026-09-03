import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Printer, CheckCircle2, Loader2, 
  X, Filter, Users, Award, ShieldCheck, Sparkles, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getAllAdmittedCandidates, 
  generateBulkAdmissionLettersPdf, 
  AdmissionLetterData 
} from '../../../lib/admissionPdfService';

interface BulkAdmissionLettersModalProps {
  isOpen: boolean;
  onClose: () => void;
  preloadedCandidates?: AdmissionLetterData[];
  defaultClassFilter?: string;
}

export default function BulkAdmissionLettersModal({
  isOpen,
  onClose,
  preloadedCandidates,
  defaultClassFilter = 'all'
}: BulkAdmissionLettersModalProps) {
  const [candidates, setCandidates] = useState<AdmissionLetterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [classFilter, setClassFilter] = useState<string>(defaultClassFilter);
  const [successInfo, setSuccessInfo] = useState<{ count: number; fileName: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessInfo(null);
      setProgress(null);
      const dedupeList = (raw: AdmissionLetterData[]) => {
        const seen = new Set<string>();
        return raw.filter((c, idx) => {
          const k = String(c.examNumber || c.name || `cand_${idx}`).trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      };

      if (preloadedCandidates && preloadedCandidates.length > 0) {
        setCandidates(dedupeList(preloadedCandidates));
        setLoading(false);
      } else {
        setLoading(true);
        getAllAdmittedCandidates()
          .then((list) => {
            setCandidates(dedupeList(list));
          })
          .catch((err) => {
            console.error('Error fetching admitted candidates:', err);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }
  }, [isOpen, preloadedCandidates]);

  if (!isOpen) return null;

  const filteredCandidates = candidates.filter((c) => {
    if (classFilter === 'all') return true;
    return (c.targetClass || '').toLowerCase().includes(classFilter.toLowerCase());
  });

  const maleCount = filteredCandidates.filter((c) => (c.gender || '').toLowerCase() === 'male' || (c.targetClass || '').toLowerCase().includes('1a')).length;
  const femaleCount = filteredCandidates.filter((c) => (c.gender || '').toLowerCase() === 'female' || (c.targetClass || '').toLowerCase().includes('1b')).length;

  const handleGenerate = async (openInNewTab = false) => {
    if (filteredCandidates.length === 0) return;
    setGenerating(true);
    setSuccessInfo(null);
    try {
      const result = await generateBulkAdmissionLettersPdf({
        candidates: filteredCandidates,
        classFilter,
        openInNewWindow: openInNewTab,
        onProgress: (current, total, name) => {
          setProgress({ current, total, name });
        }
      });
      setSuccessInfo({
        count: result.totalCount,
        fileName: result.fileName
      });
    } catch (err: any) {
      console.error('Bulk PDF generation error:', err);
      alert(`Failed to generate admission letters PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="bg-emerald-950 text-white p-6 relative flex justify-between items-start">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <FileText size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-lg text-white">Generate Bulk Admission Letters (1-Click PDF)</h3>
                <span className="px-2.5 py-0.5 bg-amber-400 text-emerald-950 text-[10px] font-black uppercase tracking-wider rounded-full">
                  Manual Collection
                </span>
              </div>
              <p className="text-xs text-emerald-200 mt-0.5">
                Combines official provisional admission letters for all admitted students into a single multi-page PDF.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={generating}
            className="p-2 rounded-xl text-emerald-300 hover:text-white hover:bg-emerald-900/60 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="animate-spin text-emerald-900" size={36} />
              <p className="text-sm font-bold text-slate-600">Gathering admitted students from database...</p>
            </div>
          ) : (
            <>
              {/* Filter Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter size={14} className="text-emerald-700" /> Select Target Group or Class:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'all', label: 'All Admitted', badge: candidates.length },
                    { id: '1a', label: 'JSS 1A (Males)', badge: candidates.filter(c => (c.targetClass || '').toLowerCase().includes('1a')).length },
                    { id: '1b', label: 'JSS 1B (Females)', badge: candidates.filter(c => (c.targetClass || '').toLowerCase().includes('1b')).length },
                    { id: 'jss 2', label: 'JSS 2', badge: candidates.filter(c => (c.targetClass || '').toLowerCase().includes('jss 2') || (c.targetClass || '').toLowerCase().includes('jss2')).length }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setClassFilter(tab.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        classFilter === tab.id
                          ? 'border-emerald-700 bg-emerald-50/60 text-emerald-950 ring-2 ring-emerald-700/20 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      <div className="text-xs font-bold">{tab.label}</div>
                      <div className="text-[11px] font-black text-emerald-800 mt-1">{tab.badge} Students</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary Stats Box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 grid grid-cols-3 gap-3 text-center">
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Selected Letters</span>
                  <span className="text-lg font-black text-emerald-950">{filteredCandidates.length} Pages</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Cutoff Requirement</span>
                  <span className="text-xs font-black text-amber-700 block mt-1">Score ≥ 40 (Passed)</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Features Included</span>
                  <span className="text-xs font-bold text-slate-700 block mt-1">QR Code & Signature</span>
                </div>
              </div>

              {/* Candidates Preview List */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Included Candidates ({filteredCandidates.length})
                  </span>
                  <span className="text-[11px] text-slate-400">1 candidate per A4 page in single PDF</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white p-1">
                  {filteredCandidates.map((c, idx) => (
                    <div key={`${c.examNumber || 'cand'}-${idx}`} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800">{c.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.examNumber}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-bold text-[10px]">
                          {c.targetClass}
                        </span>
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-md">
                          Score: {c.entranceScore || 'Passed'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      No admitted candidate records match the selected class filter.
                    </div>
                  )}
                </div>
              </div>

              {/* Generation Progress Bar */}
              {generating && progress && (
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-2">
                      <Loader2 size={14} className="animate-spin text-emerald-700" />
                      Generating letter {progress.current} of {progress.total}...
                    </span>
                    <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                  </div>
                  <div className="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-emerald-700 h-full rounded-full transition-all duration-200"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-emerald-800 truncate">
                    Rendering: <strong className="font-semibold">{progress.name}</strong> (with security QR code & official signature)
                  </p>
                </div>
              )}

              {/* Success Notification */}
              {successInfo && (
                <div className="bg-emerald-100/70 p-4 rounded-2xl border border-emerald-300 text-emerald-950 flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-emerald-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-black text-sm">Combined PDF Generated Successfully!</div>
                    <p className="text-emerald-800 mt-0.5">
                      Downloaded <strong>{successInfo.fileName}</strong> containing <strong>{successInfo.count} official admission letters</strong> ready for printing and manual collection.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 p-5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            disabled={generating}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            Close
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleGenerate(true)}
              disabled={generating || filteredCandidates.length === 0}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-emerald-800/30 text-emerald-950 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              title="Open in new window for direct browser printing"
            >
              <Printer size={16} /> Open & Print
            </button>

            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || filteredCandidates.length === 0}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 text-xs font-bold shadow-lg shadow-emerald-950/20 disabled:opacity-50 cursor-pointer"
            >
              {generating ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Generating PDF...
                </>
              ) : (
                <>
                  <Download size={16} /> Download All Admitted Letters (1-Click PDF)
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
