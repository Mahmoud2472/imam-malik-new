import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, XCircle, 
  Search, Trash2, Eye, Printer, UserCheck, AlertCircle, 
  Loader2, RefreshCw, FileText, Check, Copy, ArrowRight, Plus, RefreshCcw, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  parseExcelOrCsv, 
  saveUploadedApplicants, 
  getSuccessfulApplicants, 
  generateSampleExcelBlob,
  clearCachedApplicants,
  wipeAllAdmissionLists,
  ParsedApplicant 
} from '../../lib/applicantService';
import { formatCurrency, formatDate } from '../../lib/utils';
import AdmissionLetter from '../public/AdmissionLetter';
import StudentModal from './modals/StudentModal';
import BulkAdmissionLettersModal from './modals/BulkAdmissionLettersModal';
import { generateBulkAdmissionLettersPdf } from '../../lib/admissionPdfService';

export default function AdminApplicantsUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedList, setParsedList] = useState<ParsedApplicant[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [replacePrevious, setReplacePrevious] = useState(true);
  const [existingApplicants, setExistingApplicants] = useState<ParsedApplicant[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'passed' | 'failed'>('all');
  const [selectedLetterApplicant, setSelectedLetterApplicant] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [copiedExamNo, setCopiedExamNo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isBulkPdfModalOpen, setIsBulkPdfModalOpen] = useState(false);
  const [generatingQuickPdf, setGeneratingQuickPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
      setParsing(true);
      setNotification(null);
      try {
        const results = await parseExcelOrCsv(selected);
        setParsedList(results);
        if (results.length === 0) {
          setNotification({ type: 'error', message: 'No valid applicant records found in file. Please check column headers (Name, ExamNo, Score, Remark).' });
        } else {
          const passedCount = results.filter(r => r.remark === 'passed').length;
          setNotification({ 
            type: 'success', 
            message: `Parsed ${results.length} applicants (${passedCount} passed with minimum 40 marks). Ready to import!` 
          });
        }
      } catch (err: any) {
        console.error("File parse error:", err);
        setNotification({ type: 'error', message: `Failed to parse Excel file: ${err.message || 'Unknown format'}` });
      } finally {
        setParsing(false);
      }
    }
  };

  const loadExisting = async () => {
    setLoadingExisting(true);
    try {
      const data = await getSuccessfulApplicants();
      setExistingApplicants(data);
    } catch (e) {
      console.error("Error loading applicants:", e);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    loadExisting();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setParsing(true);
      setNotification(null);
      try {
        const results = await parseExcelOrCsv(selected);
        setParsedList(results);
        if (results.length === 0) {
          setNotification({ type: 'error', message: 'No valid applicant records found in file. Please check column headers.' });
        } else {
          const passedCount = results.filter(r => r.remark === 'passed').length;
          setNotification({ 
            type: 'success', 
            message: `Parsed ${results.length} applicants (${passedCount} passed with minimum 40 marks). Click 'Confirm & Import Now' to apply!` 
          });
        }
      } catch (err: any) {
        console.error("File parse error:", err);
        setNotification({ type: 'error', message: `Failed to parse Excel file: ${err.message || 'Unknown format'}` });
      } finally {
        setParsing(false);
      }
    }
  };

  const handleImport = async () => {
    if (parsedList.length === 0) return;
    setSaving(true);
    try {
      const res = await saveUploadedApplicants(parsedList, replacePrevious);
      setNotification({
        type: 'success',
        message: `Successfully imported ${res.added} applicants ${replacePrevious ? '(previous records wiped and updated)' : ''}! Admitted students (Score ≥ 40) can now log in immediately using their Exam No and First Name.`
      });
      setParsedList([]);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadExisting();
    } catch (err: any) {
      console.error("Import error:", err);
      setNotification({ type: 'error', message: `Import failed: ${err.message || 'Could not save data'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleWipeAllAdmissionLists = async () => {
    if (window.confirm("⚠️ ARE YOU SURE YOU WANT TO WIPE OUT ALL PREVIOUS ADMISSION LISTS?\n\nThis will completely delete all previous entrance exam applicants and admission records from the database and portal cache so you can upload your updated list fresh.")) {
      setIsWiping(true);
      setNotification(null);
      try {
        await wipeAllAdmissionLists();
        setExistingApplicants([]);
        setParsedList([]);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setNotification({
          type: 'success',
          message: 'All previous admission lists have been completely wiped out! You can now upload your updated Excel or CSV admission file.'
        });
      } catch (err: any) {
        console.error("Wipe error:", err);
        setNotification({
          type: 'error',
          message: `Failed to wipe previous records: ${err.message || 'Error occurred'}`
        });
      } finally {
        setIsWiping(false);
      }
    }
  };

  const handleDownloadSample = () => {
    const blob = generateSampleExcelBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IMSC_Successful_Applicants_Template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyExamNo = (examNo: string) => {
    navigator.clipboard.writeText(examNo);
    setCopiedExamNo(examNo);
    setTimeout(() => setCopiedExamNo(null), 2000);
  };

  const rawDisplayList = parsedList.length > 0 ? parsedList : existingApplicants;
  const displayList = React.useMemo(() => {
    const seen = new Set<string>();
    return rawDisplayList.filter((app, idx) => {
      const key = String(app.examNumber || app.id || `row_${idx}`).trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawDisplayList]);

  const filteredList = displayList.filter(app => {
    const matchesSearch = 
      (app.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.examNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (app.schoolName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filterTab === 'passed') return app.remark === 'passed';
    if (filterTab === 'failed') return app.remark === 'failed';
    return true;
  });

  const totalPassed = displayList.filter(a => a.remark === 'passed').length;
  const totalFailed = displayList.filter(a => a.remark === 'failed').length;

  return (
    <div className="space-y-8 text-left">
      {/* Top Banner & Title */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileSpreadsheet size={24} />
            </span>
            <div>
              <h2 className="text-xl font-black text-emerald-950">Entrance Examination Admissions & Scores</h2>
              <p className="text-xs text-slate-500 font-medium">
                Upload entrance results spreadsheet. Minimum cutoff is <strong className="text-emerald-800">40 marks</strong>. Students log in with <strong className="text-emerald-900">Exam No</strong> (Username) and <strong className="text-emerald-900">First Name</strong> (Password).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsBulkPdfModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
            title="Generate unified PDF containing admission letters for all admitted students"
          >
            <FileText size={16} /> Bulk Admission Letters (1-Click PDF)
          </button>
          <button
            onClick={() => setIsStudentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Plus size={15} /> Add Single Student
          </button>
          <button
            onClick={handleWipeAllAdmissionLists}
            disabled={isWiping}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 rounded-xl text-xs font-bold transition-all cursor-pointer border border-red-200 shadow-sm disabled:opacity-50"
            title="Wipe out all previous admission lists completely"
          >
            {isWiping ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Wiping Previous Lists...
              </>
            ) : (
              <>
                <Trash2 size={15} /> Wipe Out Previous Admission List
              </>
            )}
          </button>
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Download size={15} /> Sample Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-900 hover:bg-emerald-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <Upload size={15} /> Upload Latest File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx, .xls, .csv"
            className="hidden"
          />
        </div>
      </div>

      {/* Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-2xl border flex items-start gap-3 text-xs leading-relaxed ${
              notification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : notification.type === 'info'
                ? 'bg-blue-50 text-blue-900 border-blue-200'
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
            ) : notification.type === 'info' ? (
              <RefreshCcw size={18} className="text-blue-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{notification.message}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Zone / Drop Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-emerald-950 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet size={16} className="text-amber-500" /> Admission Requirements
            </h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 text-[10px] font-black rounded-md">
              Cutoff: 40 Marks
            </span>
          </div>

          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <CheckCircle2 size={14} className="text-emerald-700" />
              <span>Admission Rule: Score ≥ 40 Marks</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-normal">
              Any candidate with a minimum of <strong>40 marks</strong> is automatically marked <strong>Admitted / Passed</strong> and granted instant login access.
            </p>
          </div>

          <ul className="space-y-1.5 text-xs text-slate-600">
            <li className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-bold">Required Columns</span>
              <span className="text-slate-400 font-mono text-[10px]">Name, ExamNo, Score, Remark</span>
            </li>
            <li className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-bold">Male Class</span>
              <span className="text-blue-700 font-black px-2 py-0.5 bg-blue-50 rounded">JSS 1A</span>
            </li>
            <li className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-bold">Female Class</span>
              <span className="text-pink-700 font-black px-2 py-0.5 bg-pink-50 rounded">JSS 1B</span>
            </li>
            <li className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-bold">Termly Tuition</span>
              <span className="text-slate-800 font-bold">₦12,000 / term</span>
            </li>
            <li className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-bold">Development Levy</span>
              <span className="text-slate-800 font-bold">₦3,000 (Once for 3 years)</span>
            </li>
          </ul>

          {/* Drag and Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50 scale-[1.01]'
                : 'border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto mb-3">
              {parsing ? (
                <Loader2 size={24} className="animate-spin" />
              ) : (
                <Upload size={24} />
              )}
            </div>
            <p className="text-xs font-bold text-slate-800 mb-1">
              {file ? file.name : 'Upload Latest Admission File'}
            </p>
            <p className="text-[11px] text-slate-400">
              Drag & drop Excel (.xlsx, .xls, .csv) or click to browse
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <input 
              type="checkbox"
              id="replacePrevious"
              checked={replacePrevious}
              onChange={(e) => setReplacePrevious(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
            />
            <label htmlFor="replacePrevious" className="font-semibold text-slate-700 cursor-pointer text-[11px]">
              Discard old uploads & adopt latest admission list as active
            </label>
          </div>
        </div>

        {/* Overview Stats & Import Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {parsedList.length > 0 ? 'Staged Upload' : 'Total Candidates'}
              </span>
              <div className="text-2xl font-black text-emerald-950">{displayList.length}</div>
              <span className="text-[10px] text-slate-500 font-medium">Applicants</span>
            </div>

            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Admitted (Score ≥ 40)</span>
              <div className="text-2xl font-black text-emerald-900">{totalPassed}</div>
              <span className="text-[10px] text-emerald-700 font-medium">Eligible for login & letter</span>
            </div>

            <div className="p-5 bg-red-50 rounded-2xl border border-red-100 shadow-sm">
              <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block mb-1">Not Admitted (Score &lt; 40)</span>
              <div className="text-2xl font-black text-red-900">{totalFailed}</div>
              <span className="text-[10px] text-red-700 font-medium">Below cutoff</span>
            </div>

            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Admission Rate</span>
              <div className="text-2xl font-black text-blue-950">
                {displayList.length > 0 ? `${Math.round((totalPassed / displayList.length) * 100)}%` : '0%'}
              </div>
              <span className="text-[10px] text-blue-700 font-medium">Cutoff ≥ 40</span>
            </div>
          </div>

          {/* Staged File Action Banner */}
          {parsedList.length > 0 && (
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  Ready to Publish ({parsedList.length} Candidates)
                </span>
                <h4 className="text-base font-bold text-white">Import Latest Admission File & Discard Previous</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  All admitted candidates (Score ≥ 40) will have instant access to login using their Exam Number (Username) and First Name (Password).
                </p>
              </div>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setParsedList([]);
                    setFile(null);
                  }}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Discard
                </button>
                <button
                  onClick={handleImport}
                  disabled={saving}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Importing...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Confirm & Import Now
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Login Guide Callout */}
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <UserCheck size={20} />
              </div>
              <div>
                <strong className="text-slate-800 block">Student Login Credentials Advice:</strong>
                <span className="text-slate-500 text-[11px]">
                  <strong>Username:</strong> Exam Number (e.g. IMSC/2026/001) | <strong>Password:</strong> First Name (e.g. Amina - case-insensitive)
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsStudentModalOpen(true)}
              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg cursor-pointer whitespace-nowrap"
            >
              + Add Student Manually
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-emerald-950">
              {parsedList.length > 0 ? 'Previewing Latest Admission File' : 'Active Admission List & Student Access'}
            </h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
              {filteredList.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-grow sm:flex-grow-0 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by name, exam no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'all' ? 'bg-white text-emerald-950 shadow-sm' : 'text-slate-500'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterTab('passed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'passed' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Admitted (≥40)
              </button>
              <button
                onClick={() => setFilterTab('failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'failed' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Failed (&lt;40)
              </button>
            </div>

            {/* Quick Bulk PDF Download Button */}
            <button
              onClick={() => setIsBulkPdfModalOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-emerald-900 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
              title="Download all admitted candidate admission letters in one PDF"
            >
              <FileText size={14} className="text-amber-400" />
              Download All Letters (PDF)
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          {loadingExisting && parsedList.length === 0 ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
              <Loader2 size={32} className="animate-spin text-emerald-800" />
              <span className="text-xs font-medium">Loading applicant records...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center text-slate-400 max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <FileSpreadsheet size={36} />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">No Admission Records Found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Previous admission lists have been cleared. Ready for you to upload your updated Excel or CSV spreadsheet.
                </p>
              </div>
              <div className="flex justify-center items-center gap-3 pt-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 bg-emerald-900 hover:bg-emerald-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm flex items-center gap-2"
                >
                  <Upload size={14} /> Upload Updated Admission List
                </button>
                <button
                  onClick={handleDownloadSample}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Download size={14} /> Template
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-3 py-3.5">S/N</th>
                  <th className="px-4 py-3.5">Candidate Name</th>
                  <th className="px-3 py-3.5 text-center">Gender</th>
                  <th className="px-3 py-3.5 text-center">Assigned Class</th>
                  <th className="px-4 py-3.5">Exam No (Username)</th>
                  <th className="px-3 py-3.5">Password</th>
                  <th className="px-4 py-3.5">Former School</th>
                  <th className="px-3 py-3.5 text-center">Score</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((app, index) => {
                  const firstName = app.firstName || app.name.split(' ')[0] || 'Candidate';
                  const isPassed = app.remark === 'passed' || Number(app.entranceScore) >= 40;
                  const isMale = app.gender === 'male';
                  const assignedClass = app.targetClass || (isMale ? 'JSS 1A' : 'JSS 1B');

                  return (
                    <tr key={`${app.id || 'applicant'}-${app.examNumber || ''}-${index}`} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3.5 font-bold text-slate-400">{app.serialNumber || index + 1}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">
                        <div>{app.name}</div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isMale
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-pink-100 text-pink-800'
                          }`}
                        >
                          {isMale ? 'Male' : 'Female'}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-black ${
                            assignedClass === 'JSS 1A'
                              ? 'bg-blue-50 text-blue-900 border border-blue-200'
                              : assignedClass === 'JSS 1B'
                              ? 'bg-pink-50 text-pink-900 border border-pink-200'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {assignedClass}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-950 bg-emerald-50/70 px-2 py-1 rounded-lg w-fit">
                          <span>{app.examNumber}</span>
                          <button
                            onClick={() => handleCopyExamNo(app.examNumber)}
                            title="Copy Exam Number"
                            className="text-slate-400 hover:text-emerald-700 cursor-pointer"
                          >
                            {copiedExamNo === app.examNumber ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-bold text-[11px]" title="Case-insensitive login password">
                          {firstName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-[180px] truncate" title={app.schoolName}>
                        {app.schoolName || 'N/A'}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`font-bold px-2 py-1 rounded-lg ${Number(app.entranceScore) >= 40 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                          {app.entranceScore}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-black text-[10px] uppercase tracking-wider ${
                            isPassed
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {isPassed ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                          {isPassed ? 'Admitted' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {isPassed && (
                          <button
                            onClick={() =>
                              setSelectedLetterApplicant({
                                id: app.examNumber,
                                firstName: app.firstName,
                                lastName: app.lastName,
                                targetClassId: assignedClass,
                                appliedDate: app.uploadedAt || new Date().toISOString(),
                                schoolName: app.schoolName,
                                entranceScore: app.entranceScore
                              })
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg font-bold transition-all cursor-pointer"
                          >
                            <FileText size={12} /> Letter
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Student Add Modal */}
      <StudentModal 
        isOpen={isStudentModalOpen}
        onClose={() => {
          setIsStudentModalOpen(false);
          loadExisting();
        }}
        classes={[
          { id: 'JSS 1A', name: 'JSS 1A' },
          { id: 'JSS 1B', name: 'JSS 1B' },
          { id: 'JSS 2A', name: 'JSS 2A' },
          { id: 'JSS 2B', name: 'JSS 2B' },
          { id: 'JSS 3A', name: 'JSS 3A' },
          { id: 'JSS 3B', name: 'JSS 3B' }
        ]}
      />

      {/* Bulk Admission Letters PDF Modal */}
      <BulkAdmissionLettersModal
        isOpen={isBulkPdfModalOpen}
        onClose={() => setIsBulkPdfModalOpen(false)}
        preloadedCandidates={
          (parsedList.length > 0 ? parsedList : existingApplicants)
            .filter((a) => a.remark === 'passed' || Number(a.entranceScore) >= 40)
            .map((a) => ({
              name: a.name,
              firstName: a.firstName,
              lastName: a.lastName,
              examNumber: a.examNumber,
              targetClass: a.targetClass || (a.gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
              entranceScore: a.entranceScore,
              schoolName: a.schoolName,
              gender: a.gender,
              admissionStatus: 'approved'
            }))
        }
      />

      {/* Admission Letter Viewer Modal */}
      <AnimatePresence>
        {selectedLetterApplicant && (
          <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-4 md:p-8 no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-4 overflow-y-auto"
            >
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-bold text-emerald-950">Official Admission Letter Preview</h3>
                <button
                  onClick={() => setSelectedLetterApplicant(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
              <div className="p-4">
                <AdmissionLetter application={selectedLetterApplicant} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
