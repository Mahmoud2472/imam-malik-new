import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Search, Plus, Edit, Trash2, FileText, Loader2, Download } from 'lucide-react';
import StudentModal from './modals/StudentModal';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

export default function AdminStudents() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  useEffect(() => {
    // Fetch Students
    const qStudents = query(collection(db, "students"));
    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    // Fetch Classes for dropdown/display reference
    const qClasses = query(collection(db, "classes"));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubStudents();
      unsubClasses();
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this student record? This cannot be undone.")) {
      try {
        await deleteDoc(doc(db, "students", id));
      } catch (error) {
        console.error("Error deleting student:", error);
      }
    }
  };

  const handleEdit = (student: any) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedStudent(null);
    setIsModalOpen(true);
  };

  const generateReport = async () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text('Imam Malik Science & Tahfiz College', 105, 20, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Student List Report', 105, 30, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 105, 38, { align: 'center' });

    const tableData = filteredStudents.map(s => [
      s.admissionNumber,
      `${s.firstName} ${s.lastName}`,
      s.gender,
      classes.find(c => c.id === s.currentClassId)?.name || s.currentClassId || 'N/A',
      s.status || 'Active'
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['ID', 'Full Name', 'Gender', 'Class', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [6, 95, 70] },
    });

    const finalY = (doc as any).lastAutoTable.finalY || 100;
    let qrY = finalY + 15;
    if (qrY > 240) {
      doc.addPage();
      qrY = 20;
    }

    try {
      const qrDataUrl = await QRCode.toDataURL(`VERIFY-STUDENT-REPORT-${Date.now()}`);
      doc.addImage(qrDataUrl, 'PNG', 160, qrY, 30, 30);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text("Scan to Verify Admin Report", 175, qrY + 33, { align: 'center' });
    } catch (e) {
      console.warn("QR creation failed for student report:", e);
    }

    doc.save(`student_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredStudents = students.filter(student => 
    `${student.firstName} ${student.lastName} ${student.admissionNumber}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || classId || 'Unassigned';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 input-field" 
            placeholder="Search by name or admission ID..." 
          />
        </div>
        <div className="flex items-center gap-3 w-full xl:w-auto">
          <button 
            onClick={generateReport}
            className="flex-1 xl:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <FileText size={16} /> Export PDF Report
          </button>
          <button 
            onClick={handleAddNew}
            className="flex-1 xl:flex-none btn-primary flex items-center justify-center gap-2 px-6 py-2.5 shadow-lg shadow-emerald-900/10"
          >
            <Plus size={18} /> Add New Student
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-900" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Student Information</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Gender</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Class</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-900 text-amber-500 font-bold flex items-center justify-center">
                          {student.firstName[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{student.firstName} {student.lastName}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{student.admissionNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-600">{student.gender}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">
                        {getClassName(student.currentClassId)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                        student.status === 'active' ? 'bg-emerald-50 text-emerald-600' :
                        student.status === 'suspended' ? 'bg-red-50 text-red-600' :
                        'bg-slate-50 text-slate-400'
                      }`}>
                        {student.status || 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex justify-end gap-1">
                         <button 
                           onClick={() => handleEdit(student)}
                           className="p-2 text-slate-400 hover:text-emerald-900 hover:bg-emerald-50 rounded-lg transition-all"
                         >
                           <Edit size={18} />
                         </button>
                         <button 
                           onClick={() => handleDelete(student.id)}
                           className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                         >
                           <Trash2 size={18} />
                         </button>
                       </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">
                        {searchTerm ? 'No students match your search.' : 'No active students yet. Click "Add New" to get started.'}
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <StudentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        student={selectedStudent}
        classes={classes}
      />
    </div>
  );
}

