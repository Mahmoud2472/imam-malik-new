import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency, formatDate } from '../../lib/utils';
import { Download, ExternalLink, Filter, Search, Loader2, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, "payments"), orderBy("paymentDate", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPayments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const generateReceiptPDF = async (p: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(6, 78, 59); // Emerald-900
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("IMAM MALIK SCIENCE & TAHFIZ COLLEGE", 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL PAYMENT RECEIPT", 105, 30, { align: 'center' });

    // Receipt Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Receipt No: ${p.receiptNumber || p.id}`, 20, 55);
    doc.text(`Date: ${p.paymentDate ? formatDate(p.paymentDate) : 'N/A'}`, 150, 55);

    // Main Content Box
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, 65, 170, 80, 5, 5, 'FD');

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Transaction Details", 30, 80);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Payer (Student ID):", 30, 95);
    doc.text(String(p.studentId), 80, 95);
    
    doc.text("Payment Type:", 30, 105);
    doc.text(String(p.type), 80, 105);
    
    doc.text("Amount Paid:", 30, 115);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(p.amount), 80, 115);
    
    doc.setFont("helvetica", "normal");
    doc.text("Status:", 30, 125);
    doc.setTextColor(6, 78, 59);
    doc.text(String(p.status).toUpperCase(), 80, 125);

    // Add security verification QR Code (right-aligned in transaction card)
    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-PAYMENT-${p.id}-${p.receiptNumber || p.id}`);
      doc.addImage(qrDataUrl, 'PNG', 145, 75, 35, 35);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify", 162.5, 112, { align: 'center' });
    } catch (e) {
      console.warn("QR code generation failed:", e);
    }

    // Footer
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text("This is a computer-generated receipt. No signature required.", 105, 160, { align: 'center' });
    doc.text("© 2026 Imam Malik Science & Tahfiz College", 105, 165, { align: 'center' });

    doc.save(`Receipt_${p.receiptNumber || p.id}.pdf`);
  };

  const exportToCSV = () => {
    const headers = ['Receipt Number', 'Type', 'Student ID', 'Amount', 'Date', 'Status'];
    const rows = filteredPayments.map(p => [
      p.receiptNumber || p.id,
      p.type,
      p.studentId,
      p.amount,
      formatDate(p.paymentDate),
      p.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payments_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredPayments = payments.filter(p => 
    `${p.receiptNumber} ${p.studentId} ${p.type}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMTD = payments.reduce((acc, p) => acc + (p.amount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-center gap-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-3xl">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 input-field" 
              placeholder="Search by receipt or student ID..." 
            />
          </div>
          <div className="grid grid-cols-2 gap-4 shrink-0">
             <div className="glass-card px-6 py-3 min-w-[140px]">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Revenue</p>
               <div className="text-lg font-bold text-emerald-950">{formatCurrency(totalMTD)}</div>
             </div>
             <div className="glass-card px-6 py-3 min-w-[140px]">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Outstanding</p>
              <div className="text-lg font-bold text-amber-600">₦240k</div>
            </div>
          </div>
        </div>
        <button 
          onClick={exportToCSV}
          className="w-full xl:w-auto btn-primary flex items-center justify-center gap-2 px-8 py-3.5 shadow-lg shadow-emerald-900/10"
        >
          <Download size={18} /> Export CSV Records
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-900" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-slate-50 border-b border-slate-100">
                 <tr>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Transaction</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Type</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student ID</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Date</th>
                   <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Receipt</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                 {filteredPayments.map((p) => (
                   <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-600 truncate max-w-[150px]">{p.receiptNumber || p.id}</td>
                      <td className="px-6 py-4"><span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase">{p.type}</span></td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-tight">{p.studentId}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(p.amount)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-medium">{p.paymentDate ? formatDate(p.paymentDate) : 'Processing'}</td>
                      <td className="px-6 py-4 text-right">
                         <button 
                           onClick={() => generateReceiptPDF(p)}
                           className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                           title="Download Receipt"
                         >
                           <FileText size={18} />
                         </button>
                      </td>
                   </tr>
                 ))}
                 {filteredPayments.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                       {searchTerm ? 'No matches found.' : 'No payment records found.'}
                     </td>
                   </tr>
                 )}
               </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

