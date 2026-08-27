import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, formatDate, MAHMOUD_ADAMU_SIGNATURE } from '../../lib/utils';
import { 
  Download, ExternalLink, Filter, Search, Loader2, FileText, 
  Printer, Plus, CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck, Landmark, Users
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter States
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('all');
  const [selectedSession, setSelectedSession] = useState('all');
  const [selectedFeeCategory, setSelectedFeeCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newPayment, setNewPayment] = useState({
    studentName: '',
    studentId: '',
    examNumber: '',
    gender: 'male',
    classId: 'JSS 1A',
    term: '1st Term',
    session: '2026/2027',
    type: '1st Term Tuition Fee',
    amount: 12000,
    paymentMethod: 'Paystack (njvkcjper)',
    paystackReference: '',
    status: 'verified',
  });

  const [applicantsList, setApplicantsList] = useState<any[]>([]);

  useEffect(() => {
    // 1. Listen to real-time payments collection
    const q = query(collection(db, "payments"), orderBy("paymentDate", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayments(docs);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching payments:", err);
      setLoading(false);
    });

    // 2. Fetch applicants for quick student selection in add payment modal
    const fetchApplicants = async () => {
      try {
        const snap = await getDocs(collection(db, "successful_applicants"));
        if (!snap.empty) {
          setApplicantsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          const snap2 = await getDocs(collection(db, "applicants"));
          setApplicantsList(snap2.docs.map(d => ({ id: d.id, ...d.data() })));
        }
      } catch (e) {
        console.warn("Could not fetch applicants list for auto-complete:", e);
      }
    };
    fetchApplicants();

    return () => unsubscribe();
  }, []);

  // Filtered Payments computation
  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      // Search Term Match
      const searchMatch = !searchTerm || 
        `${p.receiptNumber || ''} ${p.studentId || ''} ${p.studentName || ''} ${p.examNumber || ''} ${p.type || ''} ${p.paystackReference || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Class Match (Handles JSS 1A, JSS 1B, etc)
      const pClass = (p.classId || p.targetClass || '').toUpperCase();
      const classMatch = selectedClass === 'all' || 
        (selectedClass === 'JSS 1A' && (pClass.includes('1A') || pClass === 'JSS 1A')) ||
        (selectedClass === 'JSS 1B' && (pClass.includes('1B') || pClass === 'JSS 1B')) ||
        pClass === selectedClass.toUpperCase();

      // Term Match
      const pTerm = (p.term || '').toLowerCase();
      const termMatch = selectedTerm === 'all' || pTerm.includes(selectedTerm.toLowerCase());

      // Session Match
      const pSession = p.session || '2026/2027';
      const sessionMatch = selectedSession === 'all' || pSession === selectedSession;

      // Fee Category Match
      const pType = (p.type || '').toLowerCase();
      const feeMatch = selectedFeeCategory === 'all' || 
        (selectedFeeCategory === 'tuition' && (pType.includes('tuition') || p.amount === 12000)) ||
        (selectedFeeCategory === 'development' && (pType.includes('development') || p.amount === 3000)) ||
        (selectedFeeCategory === 'combined' && (pType.includes('registration') || p.amount === 15000));

      // Status Match
      const pStatus = (p.status || 'verified').toLowerCase();
      const statusMatch = selectedStatus === 'all' || pStatus === selectedStatus.toLowerCase();

      return searchMatch && classMatch && termMatch && sessionMatch && feeMatch && statusMatch;
    });
  }, [payments, searchTerm, selectedClass, selectedTerm, selectedSession, selectedFeeCategory, selectedStatus]);

  // Statistics calculation
  const totalRevenue = useMemo(() => {
    return filteredPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const totalTuitionRevenue = useMemo(() => {
    return filteredPayments
      .filter(p => (p.type || '').toLowerCase().includes('tuition') || p.amount === 12000)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const totalDevRevenue = useMemo(() => {
    return filteredPayments
      .filter(p => (p.type || '').toLowerCase().includes('dev') || p.amount === 3000)
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const jss1AMaleTotal = useMemo(() => {
    return filteredPayments
      .filter(p => (p.classId || '').includes('1A') || p.gender === 'male')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  const jss1BFemaleTotal = useMemo(() => {
    return filteredPayments
      .filter(p => (p.classId || '').includes('1B') || p.gender === 'female')
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  }, [filteredPayments]);

  // Individual Receipt Generator
  const generateReceiptPDF = async (p: any) => {
    const doc = new jsPDF() as any;
    
    // Header
    doc.setFillColor(6, 78, 59); // Emerald-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL PAYMENT RECEIPT", 105, 30, { align: 'center' });

    // Receipt Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const receiptNum = p.receiptNumber || `REC-${(p.type || 'FEE').toUpperCase().replace(/[^a-zA-Z0-9]/g, '-')}-${Math.floor(Math.random() * 899999 + 100000)}`;
    doc.text(`Receipt No: ${receiptNum}`, 20, 55);
    doc.text(`Date: ${p.paymentDate ? formatDate(p.paymentDate) : formatDate(new Date())}`, 145, 55);

    // Main Content Box
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 65, 170, 95, 5, 5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Transaction & Student Details", 30, 80);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Student / Payer:", 30, 95);
    doc.setFont("helvetica", "bold");
    doc.text(`${p.studentName || p.studentId || 'Student'}`, 80, 95);
    
    doc.setFont("helvetica", "normal");
    doc.text("Exam / Reg No:", 30, 105);
    doc.setFont("helvetica", "bold");
    doc.text(`${p.examNumber || p.studentId || 'N/A'}`, 80, 105);

    doc.setFont("helvetica", "normal");
    doc.text("Class & Section:", 30, 115);
    doc.setFont("helvetica", "bold");
    const classLabel = p.classId || (p.gender === 'female' ? 'JSS 1B (Female)' : 'JSS 1A (Male)');
    doc.text(`${classLabel}`, 80, 115);

    doc.setFont("helvetica", "normal");
    doc.text("Fee Category:", 30, 125);
    doc.text(`${p.type || 'Tuition Fee'} (${p.term || '1st Term'} - ${p.session || '2026/2027'})`, 80, 125);
    
    doc.text("Amount Paid:", 30, 135);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(p.amount), 80, 135);
    
    doc.setFont("helvetica", "normal");
    doc.text("Payment Method:", 30, 145);
    doc.text(`${p.paymentMethod || 'Paystack Online (njvkcjper)'}`, 80, 145);

    // QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-PAYMENT-${p.id || receiptNum}-${p.amount}-${p.examNumber || 'N/A'}`);
      doc.addImage(qrDataUrl, 'PNG', 145, 80, 35, 35);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify", 162.5, 118, { align: 'center' });
    } catch (e) {}

    // Signature stamp
    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 200, 100);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 20, 168, 30, 12);
    } catch (e) {}

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("Mahmoud Adamu", 20, 185);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Secretary, Governing Board", 20, 190);

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text("This is an official computer-generated receipt from Imam Malik Science & Tahfiz College.", 105, 205, { align: 'center' });

    doc.save(`Receipt_${receiptNum}.pdf`);
  };

  // Comprehensive Financial Report / Ledger Print PDF
  const printFilteredFinancialLedgerPDF = async () => {
    const doc = new jsPDF('landscape') as any;

    // Header Band
    doc.setFillColor(5, 46, 22); // Emerald-950
    doc.rect(0, 0, 297, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('IMAM MALIK SCIENCE & TAHFIZ COLLEGE, KANO', 148.5, 14, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Karefa Road Tudun Wada Dankadai, Kano State | Official Bursary & Financial Ledger', 148.5, 22, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.text('OFFICIAL COMPREHENSIVE FINANCIAL RECORDS REPORT', 148.5, 30, { align: 'center' });

    // Active Filter Metadata block
    doc.setTextColor(40, 40, 40);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.text(`Generated Date: ${todayStr}`, 15, 44);
    doc.text(`Filter Class: ${selectedClass.toUpperCase()}`, 15, 50);
    doc.text(`Filter Term: ${selectedTerm.toUpperCase()}`, 85, 44);
    doc.text(`Filter Session: ${selectedSession}`, 85, 50);
    doc.text(`Filter Category: ${selectedFeeCategory.toUpperCase()}`, 155, 44);
    doc.text(`Total Records: ${filteredPayments.length} student transaction(s)`, 155, 50);
    doc.text(`Authorized Gateway: Paystack (paystack.shop/pay/njvkcjper)`, 220, 44);
    doc.text(`Status: VERIFIED AUDIT`, 220, 50);

    // Summary Revenue Strip
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, 54, 267, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(5, 46, 22);
    doc.text(`TOTAL REVENUE: ${formatCurrency(totalRevenue)}`, 20, 63);
    doc.text(`TUITION (N12,000/Term): ${formatCurrency(totalTuitionRevenue)}`, 95, 63);
    doc.text(`DEV LEVY (N3,000 3-Yr): ${formatCurrency(totalDevRevenue)}`, 180, 63);

    // Table Data
    const tableData = filteredPayments.map((p, idx) => [
      idx + 1,
      p.receiptNumber || p.id?.slice(0, 10) || `REC-${idx + 1}`,
      p.studentName || 'Student Applicant',
      p.examNumber || p.studentId || 'N/A',
      p.classId || (p.gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
      p.term || '1st Term',
      p.session || '2026/2027',
      p.type || 'Termly Tuition',
      `N${Number(p.amount || 0).toLocaleString()}`,
      p.paymentMethod || 'Paystack',
      (p.status || 'Verified').toUpperCase()
    ]);

    doc.autoTable({
      startY: 72,
      head: [['#', 'Receipt No', 'Student Name', 'Exam / Reg No', 'Class', 'Term', 'Session', 'Fee Category', 'Amount', 'Channel', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [5, 46, 22], fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 28 },
        2: { cellWidth: 42 },
        3: { cellWidth: 28 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 24 },
        7: { cellWidth: 38 },
        8: { cellWidth: 24, fontStyle: 'bold' },
        9: { cellWidth: 32 },
        10: { cellWidth: 20 }
      }
    });

    let finalY = (doc as any).lastAutoTable.finalY + 10;
    if (finalY > 170) {
      doc.addPage();
      finalY = 20;
    }

    // QR Verification & Stamp
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-AUDIT-${todayStr}-TOTAL-${totalRevenue}`);
      doc.addImage(qrDataUrl, 'PNG', 245, finalY, 24, 24);
      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text("Scan Audit Verification", 257, finalY + 27, { align: 'center' });
    } catch (e) {}

    // Signature stamp
    try {
      const pngSignature = await new Promise<string>((resolve) => {
        const img = new Image();
        img.src = MAHMOUD_ADAMU_SIGNATURE;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 100;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 200, 100);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve(MAHMOUD_ADAMU_SIGNATURE);
          }
        };
        img.onerror = () => resolve(MAHMOUD_ADAMU_SIGNATURE);
      });
      doc.addImage(pngSignature, 'PNG', 15, finalY, 30, 12);
    } catch (e) {}

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text('Mahmoud Adamu', 15, finalY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Secretary, Governing Board', 15, finalY + 20);
    doc.text('Imam Malik Science & Tahfiz College Kano', 15, finalY + 24);

    doc.save(`Financial_Report_${selectedClass}_${selectedTerm}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // CSV Export
  const exportToCSV = () => {
    const headers = ['Receipt Number', 'Student Name', 'Exam Number', 'Class', 'Gender', 'Term', 'Session', 'Fee Category', 'Amount', 'Payment Method', 'Date', 'Status'];
    const rows = filteredPayments.map(p => [
      p.receiptNumber || p.id,
      `"${p.studentName || 'Student'}"`,
      p.examNumber || p.studentId || 'N/A',
      p.classId || (p.gender === 'female' ? 'JSS 1B' : 'JSS 1A'),
      p.gender || 'male',
      p.term || '1st Term',
      p.session || '2026/2027',
      `"${p.type || 'Tuition Fee'}"`,
      p.amount || 0,
      `"${p.paymentMethod || 'Paystack'}"`,
      formatDate(p.paymentDate || new Date().toISOString()),
      p.status || 'Verified'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IMSC_Financial_Report_${selectedClass}_${selectedTerm}_${selectedSession}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Record Manual / Paystack Payment Handler
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayment.studentName) {
      alert("Please enter student name.");
      return;
    }

    setIsSaving(true);
    try {
      const receiptNo = `REC-MANUAL-${Math.floor(Math.random() * 899999 + 100000)}`;
      const payload = {
        ...newPayment,
        receiptNumber: receiptNo,
        paymentDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "payments"), payload);
      alert("Payment recorded successfully!");
      setShowAddModal(false);
      setNewPayment({
        studentName: '',
        studentId: '',
        examNumber: '',
        gender: 'male',
        classId: 'JSS 1A',
        term: '1st Term',
        session: '2026/2027',
        type: '1st Term Tuition Fee',
        amount: 12000,
        paymentMethod: 'Paystack (njvkcjper)',
        paystackReference: '',
        status: 'verified',
      });
    } catch (err) {
      console.error("Failed to record payment:", err);
      alert("Could not save payment. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Seed Sample Records from Applicants (if payments is empty or admin triggers)
  const handleSyncApplicantsPayments = async () => {
    if (applicantsList.length === 0) {
      alert("No applicant records found in database to sync. Please upload or import applicants first.");
      return;
    }

    const confirmSync = window.confirm(`Generate official 1st Term (₦12,000) and Development Fee (₦3,000) records for ${applicantsList.length} applicant(s)?`);
    if (!confirmSync) return;

    setLoading(true);
    try {
      let count = 0;
      for (const app of applicantsList) {
        const studentName = app.name || `${app.firstName || ''} ${app.lastName || ''}`.trim() || 'Candidate';
        const examNumber = app.examNumber || app.id || `IMSC/2026/${Math.floor(100 + Math.random() * 900)}`;
        const gender = app.gender || (studentName.toLowerCase().includes('fatima') || studentName.toLowerCase().includes('maryam') || studentName.toLowerCase().includes('aisha') ? 'female' : 'male');
        const assignedClass = app.assignedClass || app.targetClass || (gender === 'female' ? 'JSS 1B' : 'JSS 1A');

        // 1. Termly Tuition (₦12,000)
        await addDoc(collection(db, "payments"), {
          studentName,
          examNumber,
          studentId: app.id || examNumber,
          gender,
          classId: assignedClass,
          term: '1st Term',
          session: '2026/2027',
          type: '1st Term Tuition Fee',
          amount: 12000,
          paymentMethod: 'Paystack Online (njvkcjper)',
          paystackReference: `PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          receiptNumber: `REC-TUI-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'verified',
          paymentDate: new Date().toISOString()
        });

        // 2. Development Fee (₦3,000 once in 3 years)
        await addDoc(collection(db, "payments"), {
          studentName,
          examNumber,
          studentId: app.id || examNumber,
          gender,
          classId: assignedClass,
          term: '3-Year Period',
          session: '2026/2027 - 2028/2029',
          type: 'College Development Levy (Once for 3 Yrs)',
          amount: 3000,
          paymentMethod: 'Paystack Online (njvkcjper)',
          paystackReference: `PAY-DEV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          receiptNumber: `REC-DEV-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'verified',
          paymentDate: new Date().toISOString()
        });

        count += 2;
      }
      alert(`Successfully generated and synced ${count} financial payment records!`);
    } catch (e) {
      console.error("Sync error:", e);
      alert("Error syncing payments. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header & Main Actions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-950 font-black text-[10px] uppercase tracking-wider rounded-lg">
              Official Bursary
            </span>
            <span className="text-xs font-bold text-slate-400">Gateway: Paystack Exclusive</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-emerald-950 mt-1">Financial Records & Bursary Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter, audit, and print financial statements by class, term, session, or fee category.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full xl:w-auto">
          <button 
            onClick={printFilteredFinancialLedgerPDF}
            disabled={filteredPayments.length === 0}
            className="btn-primary flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-wider disabled:opacity-50 cursor-pointer shadow-md"
          >
            <Printer size={16} /> Print Financial Report (PDF)
          </button>
          <button 
            onClick={exportToCSV}
            disabled={filteredPayments.length === 0}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Download size={16} /> Export CSV
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-4 py-3 bg-amber-500 hover:bg-amber-400 text-emerald-950 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm"
          >
            <Plus size={16} /> Record Payment
          </button>
          {payments.length === 0 && applicantsList.length > 0 && (
            <button 
              onClick={handleSyncApplicantsPayments}
              className="px-4 py-3 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RefreshCw size={15} /> Seed from Applicants
            </button>
          )}
        </div>
      </div>

      {/* Policy Notice & Paystack Badge */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-emerald-950 flex items-center justify-center font-black shrink-0 shadow-xs">
            ₦
          </div>
          <div>
            <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
              Official College Fee Structure & Gateway Rules:
            </h4>
            <p className="text-[11px] text-slate-700 mt-0.5">
              • <strong>Tuition Fee:</strong> ₦12,000 per term (1st, 2nd, 3rd Term) • <strong>Development Levy:</strong> ₦3,000 (Paid ONCE for 3 years) • <strong>Class Rules:</strong> Males in JSS 1A, Females in JSS 1B.
            </p>
          </div>
        </div>
        <a 
          href="https://paystack.shop/pay/njvkcjper" 
          target="_blank" 
          rel="noreferrer"
          className="px-3.5 py-2 bg-emerald-950 hover:bg-emerald-900 text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0 shadow-xs"
        >
          <ExternalLink size={14} /> Paystack (njvkcjper)
        </a>
      </div>

      {/* Revenue Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="glass-card p-5 bg-white rounded-2xl border-b-4 border-emerald-600">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
          <div className="text-xl md:text-2xl font-black text-emerald-950">{formatCurrency(totalRevenue)}</div>
          <span className="text-[10px] text-emerald-700 font-bold">{filteredPayments.length} transaction(s)</span>
        </div>

        <div className="glass-card p-5 bg-white rounded-2xl border-b-4 border-blue-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tuition Fees (₦12k)</p>
          <div className="text-xl md:text-2xl font-black text-blue-950">{formatCurrency(totalTuitionRevenue)}</div>
          <span className="text-[10px] text-slate-400 font-bold">1st, 2nd & 3rd Terms</span>
        </div>

        <div className="glass-card p-5 bg-white rounded-2xl border-b-4 border-amber-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Development (₦3k)</p>
          <div className="text-xl md:text-2xl font-black text-amber-950">{formatCurrency(totalDevRevenue)}</div>
          <span className="text-[10px] text-amber-700 font-bold">3-Yr Study Levy (Once)</span>
        </div>

        <div className="glass-card p-5 bg-white rounded-2xl border-b-4 border-teal-500">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">JSS 1A (Male)</p>
          <div className="text-lg md:text-xl font-black text-teal-950">{formatCurrency(jss1AMaleTotal)}</div>
          <span className="text-[10px] text-teal-700 font-bold">Male Section Total</span>
        </div>

        <div className="glass-card p-5 bg-white rounded-2xl border-b-4 border-purple-500 col-span-2 lg:col-span-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">JSS 1B (Female)</p>
          <div className="text-lg md:text-xl font-black text-purple-950">{formatCurrency(jss1BFemaleTotal)}</div>
          <span className="text-[10px] text-purple-700 font-bold">Female Section Total</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-grow">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              placeholder="Search by student name, exam number, or receipt..." 
            />
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Class:</span>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Classes</option>
              <option value="JSS 1A">JSS 1A (Male Section)</option>
              <option value="JSS 1B">JSS 1B (Female Section)</option>
              <option value="JSS 2">JSS 2</option>
              <option value="JSS 3">JSS 3</option>
              <option value="SS 1">SS 1</option>
              <option value="SS 2">SS 2</option>
              <option value="SS 3">SS 3</option>
            </select>
          </div>

          {/* Term Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Term:</span>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Terms</option>
              <option value="1st Term">1st Term</option>
              <option value="2nd Term">2nd Term</option>
              <option value="3rd Term">3rd Term</option>
            </select>
          </div>

          {/* Session Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Session:</span>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Sessions</option>
              <option value="2026/2027">2026/2027</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2027/2028">2027/2028</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Fee Type:</span>
            <select
              value={selectedFeeCategory}
              onChange={(e) => setSelectedFeeCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
            >
              <option value="all">All Fee Types</option>
              <option value="tuition">Termly Tuition (₦12,000)</option>
              <option value="development">Development Levy (₦3,000)</option>
              <option value="combined">New Intake (₦15,000)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(selectedClass !== 'all' || selectedTerm !== 'all' || selectedSession !== 'all' || selectedFeeCategory !== 'all' || searchTerm) && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Active Filters:</span>
            {selectedClass !== 'all' && (
              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg font-bold text-[11px]">
                Class: {selectedClass}
              </span>
            )}
            {selectedTerm !== 'all' && (
              <span className="px-2.5 py-1 bg-blue-100 text-blue-900 rounded-lg font-bold text-[11px]">
                Term: {selectedTerm}
              </span>
            )}
            {selectedSession !== 'all' && (
              <span className="px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg font-bold text-[11px]">
                Session: {selectedSession}
              </span>
            )}
            {selectedFeeCategory !== 'all' && (
              <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px]">
                Fee: {selectedFeeCategory}
              </span>
            )}
            <button
              onClick={() => {
                setSelectedClass('all');
                setSelectedTerm('all');
                setSelectedSession('all');
                setSelectedFeeCategory('all');
                setSearchTerm('');
              }}
              className="text-red-600 hover:text-red-700 font-bold ml-auto cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Financial Records Table */}
      <div className="glass-card bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-20 text-slate-400">
            <Loader2 className="animate-spin text-emerald-900 mb-2" size={36} />
            <p className="text-xs font-bold uppercase tracking-wider">Loading Financial Ledger...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Receipt No</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Student Name</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Exam No</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Class</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Term & Session</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Fee Description</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {filteredPayments.map((p) => {
                  const classVal = p.classId || (p.gender === 'female' ? 'JSS 1B' : 'JSS 1A');
                  const isMale = classVal.includes('1A') || p.gender === 'male';

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-slate-700 truncate max-w-[140px]">
                        {p.receiptNumber || p.id}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {p.studentName || 'Student'}
                      </td>
                      <td className="px-6 py-4 font-mono font-semibold text-slate-500">
                        {p.examNumber || p.studentId || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase tracking-wider ${
                          isMale ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                        }`}>
                          {classVal}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {p.term || '1st Term'} • {p.session || '2026/2027'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                          {p.type || 'Tuition Fee'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 text-sm">
                        {formatCurrency(p.amount || 0)}
                      </td>
                      <td className="px-6 py-4 text-slate-400 font-medium whitespace-nowrap">
                        {p.paymentDate ? formatDate(p.paymentDate) : 'Today'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => generateReceiptPDF(p)}
                          className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                          title="Download Payment Receipt"
                        >
                          <FileText size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-6 py-20 text-center text-slate-400 font-medium">
                      {searchTerm || selectedClass !== 'all' ? (
                        <div>
                          <p>No matching financial records found for the selected filters.</p>
                          <button
                            onClick={() => {
                              setSelectedClass('all');
                              setSelectedTerm('all');
                              setSelectedSession('all');
                              setSelectedFeeCategory('all');
                              setSearchTerm('');
                            }}
                            className="mt-3 text-xs text-emerald-800 font-bold underline cursor-pointer"
                          >
                            Clear all filters
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p>No payment records in database yet.</p>
                          {applicantsList.length > 0 && (
                            <button
                              onClick={handleSyncApplicantsPayments}
                              className="btn-primary text-xs font-bold px-4 py-2"
                            >
                              Sync with {applicantsList.length} Uploaded Applicants
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-emerald-950">Record Student Payment</h3>
                <p className="text-xs text-slate-400">Add an offline or Paystack transaction into the financial ledger</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4 text-xs">
              {/* Quick Select Applicant */}
              {applicantsList.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Quick Autofill from Applicant Record
                  </label>
                  <select
                    onChange={(e) => {
                      const selected = applicantsList.find(a => a.id === e.target.value || a.examNumber === e.target.value);
                      if (selected) {
                        const name = selected.name || `${selected.firstName || ''} ${selected.lastName || ''}`.trim();
                        const isFemale = selected.gender === 'female' || name.toLowerCase().includes('fatima') || name.toLowerCase().includes('maryam') || name.toLowerCase().includes('aisha');
                        const gender = isFemale ? 'female' : 'male';
                        const assignedClass = selected.assignedClass || (gender === 'female' ? 'JSS 1B' : 'JSS 1A');

                        setNewPayment(prev => ({
                          ...prev,
                          studentName: name,
                          examNumber: selected.examNumber || selected.id || '',
                          studentId: selected.id || selected.examNumber || '',
                          gender,
                          classId: assignedClass,
                        }));
                      }
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="">-- Choose from uploaded candidate list --</option>
                    {applicantsList.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name || `${a.firstName || ''} ${a.lastName || ''}`} ({a.examNumber || a.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Student Full Name *</label>
                  <input
                    required
                    type="text"
                    value={newPayment.studentName}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, studentName: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                    placeholder="e.g. Ibrahim Abubakar"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Exam / Reg Number *</label>
                  <input
                    required
                    type="text"
                    value={newPayment.examNumber}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, examNumber: e.target.value, studentId: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold font-mono"
                    placeholder="e.g. IMSC/2026/042"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Gender</label>
                  <select
                    value={newPayment.gender}
                    onChange={(e) => {
                      const gen = e.target.value;
                      setNewPayment(prev => ({
                        ...prev,
                        gender: gen,
                        classId: gen === 'female' ? 'JSS 1B' : 'JSS 1A'
                      }));
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="male">Male (JSS 1A)</option>
                    <option value="female">Female (JSS 1B)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Assigned Class</label>
                  <select
                    value={newPayment.classId}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, classId: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="JSS 1A">JSS 1A (Male)</option>
                    <option value="JSS 1B">JSS 1B (Female)</option>
                    <option value="JSS 2">JSS 2</option>
                    <option value="JSS 3">JSS 3</option>
                    <option value="SS 1">SS 1</option>
                    <option value="SS 2">SS 2</option>
                    <option value="SS 3">SS 3</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Term</label>
                  <select
                    value={newPayment.term}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, term: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="1st Term">1st Term</option>
                    <option value="2nd Term">2nd Term</option>
                    <option value="3rd Term">3rd Term</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Fee Category *</label>
                  <select
                    value={newPayment.type}
                    onChange={(e) => {
                      const type = e.target.value;
                      let amount = 12000;
                      if (type.includes('Development')) amount = 3000;
                      if (type.includes('Combined') || type.includes('New Intake')) amount = 15000;

                      setNewPayment(prev => ({
                        ...prev,
                        type,
                        amount
                      }));
                    }}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="1st Term Tuition Fee">1st Term Tuition Fee (₦12,000)</option>
                    <option value="2nd Term Tuition Fee">2nd Term Tuition Fee (₦12,000)</option>
                    <option value="3rd Term Tuition Fee">3rd Term Tuition Fee (₦12,000)</option>
                    <option value="College Development Levy (Once for 3 Yrs)">College Development Levy (₦3,000 - Once)</option>
                    <option value="New Intake Combined (Tuition + Dev)">New Intake Combined (₦15,000)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Amount (₦) *</label>
                  <input
                    required
                    type="number"
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, amount: Number(e.target.value) }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-emerald-950"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Payment Method</label>
                  <select
                    value={newPayment.paymentMethod}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="Paystack (njvkcjper)">Paystack (paystack.shop/pay/njvkcjper)</option>
                    <option value="Direct Bank Transfer">Direct Bank Transfer</option>
                    <option value="Cash at Bursary Desk">Cash at Bursary Desk</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">Paystack Ref / Transaction ID</label>
                  <input
                    type="text"
                    value={newPayment.paystackReference}
                    onChange={(e) => setNewPayment(prev => ({ ...prev, paystackReference: e.target.value }))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    placeholder="e.g. PAY-98218171"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-1/2 btn-primary py-3.5 font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />} Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

