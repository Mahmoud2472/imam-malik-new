import React, { useState, useEffect, useRef } from 'react';
import { 
  FileSpreadsheet, Upload, Download, CheckCircle2, XCircle, 
  Search, Trash2, Eye, Printer, UserCheck, AlertCircle, 
  Loader2, RefreshCw, FileText, Check, Copy, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  parseExcelOrCsv, 
  saveUploadedApplicants, 
  getSuccessfulApplicants, 
  generateSampleExcelBlob, 
  ParsedApplicant 
} from '../../lib/applicantService';
import { formatCurrency, formatDate } from '../../lib/utils';
import AdmissionLetter from '../public/AdmissionLetter';

export default function AdminApplicantsUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedList, setParsedList] = useState<ParsedApplicant[]>([]);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingApplicants, setExistingApplicants] = useState<ParsedApplicant[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'passed' | 'failed'>('all');
  const [selectedLetterApplicant, setSelectedLetterApplicant] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedExamNo, setCopiedExamNo] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
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
            message: `Parsed ${results.length} applicants (${passedCount} passed entrance exam). Click 'Bulk Insert into Database' to persist.` 
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
            message: `Parsed ${results.length} applicants (${passedCount} passed entrance exam). Ready to import!` 
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
      const res = await saveUploadedApplicants(parsedList);
      setNotification({
        type: 'success',
        message: `Successfully imported ${res.added} applicants! Students can now log in immediately using their Exam No as Username and First Name as Password.`
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

  const displayList = parsedList.length > 0 ? parsedList : existingApplicants;
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <FileSpreadsheet size={24} />
            </span>
            <div>
              <h2 className="text-xl font-black text-emerald-950">Successful Applicants & Entrance Scores</h2>
              <p className="text-xs text-slate-500 font-medium">
                Upload entrance examination results spreadsheet. Students can log in instantly with their <strong className="text-emerald-900">Exam No</strong> and <strong className="text-emerald-900">First Name</strong>.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <Download size={15} /> Download Excel Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-900 hover:bg-emerald-850 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <Upload size={15} /> Upload Excel / CSV
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
                : 'bg-red-50 text-red-900 border-red-200'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
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
          <h3 className="font-bold text-sm text-emerald-950 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-amber-500" /> Excel Column Requirements
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ensure your Excel or CSV file includes the following columns:
          </p>

          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">1</span>
              <div><strong>Serial Number</strong> <span className="text-slate-400">(S/N)</span></div>
            </li>
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">2</span>
              <div><strong>Name</strong> <span className="text-slate-400">(Full Name)</span></div>
            </li>
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">3</span>
              <div><strong>Exam No</strong> <span className="text-slate-400">(e.g. IMSC/2026/001)</span></div>
            </li>
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">4</span>
              <div><strong>School Name</strong> <span className="text-slate-400">(Former Primary/School)</span></div>
            </li>
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">5</span>
              <div><strong>Entrance Exam Score</strong> <span className="text-slate-400">(e.g. 84)</span></div>
            </li>
            <li className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">6</span>
              <div><strong>Remark</strong> <span className="text-slate-400">(Passed / Failed)</span></div>
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
              {file ? file.name : 'Drag & Drop Excel File here or Click to Browse'}
            </p>
            <p className="text-[11px] text-slate-400">
              Supports .xlsx, .xls, and .csv formats
            </p>
          </div>

          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-normal space-y-1">
            <div>💡 <strong>Automatic Student Logins:</strong> Uploading students with remark <strong>"Passed"</strong> enables them to log in immediately with their <strong>Exam No</strong> as Username and <strong>First Name</strong> as Password.</div>
            <div className="text-emerald-900 font-semibold pt-1 border-t border-amber-200/60 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold">Males → JSS 1A</span>
              <span className="px-2 py-0.5 bg-pink-100 text-pink-900 rounded font-bold">Females → JSS 1B</span>
            </div>
            <div className="text-[10px] text-slate-600">
              Fee: ₦12,000 Termly (1st, 2nd, 3rd) + ₦3,000 Development Fee (Once for 3 years)
            </div>
          </div>
        </div>

        {/* Overview Stats & Import Actions */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                {parsedList.length > 0 ? 'Staged Upload' : 'Total in Portal'}
              </span>
              <div className="text-2xl font-black text-emerald-950">{displayList.length}</div>
              <span className="text-[10px] text-slate-500 font-medium">Applicants</span>
            </div>

            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Passed (Admitted)</span>
              <div className="text-2xl font-black text-emerald-900">{totalPassed}</div>
              <span className="text-[10px] text-emerald-700 font-medium">Eligible for letter</span>
            </div>

            <div className="p-5 bg-red-50 rounded-2xl border border-red-100 shadow-sm">
              <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block mb-1">Failed (Not Admitted)</span>
              <div className="text-2xl font-black text-red-900">{totalFailed}</div>
              <span className="text-[10px] text-red-700 font-medium">Score &lt; 50%</span>
            </div>

            <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">Pass Rate</span>
              <div className="text-2xl font-black text-blue-950">
                {displayList.length > 0 ? `${Math.round((totalPassed / displayList.length) * 100)}%` : '0%'}
              </div>
              <span className="text-[10px] text-blue-700 font-medium">Entrance success</span>
            </div>
          </div>

          {/* Staged File Action Banner */}
          {parsedList.length > 0 && (
            <div className="p-6 bg-gradient-to-r from-emerald-900 to-emerald-950 text-white rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  Ready to Publish ({parsedList.length} Records)
                </span>
                <h4 className="text-base font-bold text-white">Import and Grant Instant Student Portal Access</h4>
                <p className="text-xs text-emerald-200 mt-1">
                  All passed applicants will be added to the portal and can log in with Exam No + First Name to view/print their admission letter and make registration payment.
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
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-emerald-950">
              {parsedList.length > 0 ? 'Previewing Excel Data' : 'All Uploaded Applicants & Login Credentials'}
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
                Passed
              </button>
              <button
                onClick={() => setFilterTab('failed')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterTab === 'failed' ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                Failed
              </button>
            </div>
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
            <div className="py-16 text-center text-slate-400">
              <FileSpreadsheet size={40} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-600">No applicants found</p>
              <p className="text-xs text-slate-400 mt-1">
                Upload an Excel file above or click "Download Excel Template" to get started.
              </p>
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
                  <th className="px-3 py-3.5 text-center">Remark</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((app, index) => {
                  const firstName = app.firstName || app.name.split(' ')[0] || 'Candidate';
                  const isPassed = app.remark === 'passed';
                  const isMale = app.gender === 'male';
                  const assignedClass = app.targetClass || (isMale ? 'JSS 1A' : 'JSS 1B');

                  return (
                    <tr key={app.id || index} className="hover:bg-slate-50/70 transition-colors">
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
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded-lg font-bold text-[11px]">
                          {firstName}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 max-w-[180px] truncate" title={app.schoolName}>
                        {app.schoolName || 'N/A'}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-bold text-slate-800 px-2 py-1 bg-slate-100 rounded-lg">
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
                          {isPassed ? 'Passed' : 'Failed'}
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
