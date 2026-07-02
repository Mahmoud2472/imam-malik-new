import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { CheckCircle, XCircle, Search, Filter, Loader2, Trash2, Eye, X } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminApplications() {
  const [apps, setApps] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [transactionId, setTransactionId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [updatingPayment, setUpdatingPayment] = useState(false);

  useEffect(() => {
    if (selectedApp) {
      setTransactionId(selectedApp.transactionId || '');
      setPaymentStatus(selectedApp.paymentStatus || 'pending');
    }
  }, [selectedApp]);

  const handleSaveTransaction = async () => {
    if (!selectedApp) return;
    setUpdatingPayment(true);
    try {
      const updates = {
        transactionId: transactionId,
        paymentStatus: paymentStatus
      };

      if (isSupabaseConfigured) {
        try {
          await supabase.from('applications').update(updates).eq('id', selectedApp.id);
        } catch (supErr) {
          console.warn("Supabase payment update error:", supErr);
        }
      }

      await updateDoc(doc(db, "applications", selectedApp.id), updates);

      setSelectedApp((prev: any) => ({
        ...prev,
        transactionId: transactionId,
        paymentStatus: paymentStatus
      }));
      alert("Application payment and transaction ID updated successfully!");
    } catch (err) {
      console.error("Error updating transaction details:", err);
      alert("Failed to update transaction details. Please try again.");
    } finally {
      setUpdatingPayment(false);
    }
  };

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;
    let supabaseChannel: any = null;

    if (isSupabaseConfigured) {
      const fetchAppsFromSupabase = async () => {
        try {
          const { data, error } = await supabase
            .from('applications')
            .select('*')
            .order('appliedDate', { ascending: false });
          if (error) throw error;
          setApps(data || []);
        } catch (err) {
          console.error("Error fetching applications from Supabase:", err);
        } finally {
          setLoading(false);
        }
      };

      fetchAppsFromSupabase();

      // Subscribe to real-time changes on applications table
      supabaseChannel = supabase
        .channel('admin-applications-realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'applications' },
          (payload: any) => {
            console.log("Real-time update from Supabase applications table:", payload);
            fetchAppsFromSupabase();
          }
        )
        .subscribe();
    } else {
      const q = query(collection(db, "applications"), orderBy("appliedDate", "desc"));
      unsubscribeFirestore = onSnapshot(q, (snapshot) => {
        setApps(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        console.error("Firestore applications onSnapshot error:", error);
        setLoading(false);
      });
    }

    const qClasses = query(collection(db, "classes"));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      if (unsubscribeFirestore) unsubscribeFirestore();
      if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel).catch((err: any) => {
          console.warn("Error removing supabase channel:", err);
        });
      }
      unsubClasses();
    };
  }, []);

  const approveApp = async (app: any) => {
    if (window.confirm(`Approve application for ${app.firstName}? This will grant them official admission status.`)) {
      try {
        // 1. Update Application status
        if (isSupabaseConfigured) {
          try {
            await supabase.from('applications').update({
              status: 'approved',
              approvedDate: new Date().toISOString()
            }).eq('id', app.id);
          } catch (supErr) {
            console.warn("Supabase approval sync error:", supErr);
          }
        }

        await updateDoc(doc(db, "applications", app.id), { 
          status: 'approved',
          approvedDate: serverTimestamp() 
        });

        // 2. Update User record to mark as admitted / transition to student role if needed
        // We look up the user by the userId stored in the application
        if (app.userId) {
          const userRef = doc(db, "users", app.userId);
          await updateDoc(userRef, { 
            admissionStatus: 'approved',
            targetClass: app.targetClassId,
            role: 'student' 
          });
        }

        // 3. Store Dashboard Notification for the applicant
        await addDoc(collection(db, "notifications"), {
          userId: app.userId || 'guest',
          applicantEmail: app.email,
          title: "Admission Status: Approved! 🎉",
          message: `Congratulations ${app.firstName}! Your admission application for class ${getClassName(app.targetClassId)} has been approved. You are now promoted and can view your full student records.`,
          type: "admission_status",
          status: "unread",
          createdAt: new Date().toISOString()
        });

        // 4. Store Automated Outgoing Email Trigger Log
        await addDoc(collection(db, "email_logs"), {
          userId: app.userId || 'guest',
          to: app.email,
          subject: "Imam Malik Science & Tahfiz College - Admission Approved! 🎉",
          body: `Dear ${app.firstName} ${app.lastName},\n\nCongratulations!\n\nWe are extremely pleased to inform you that your application for admission to Imam Malik Science & Tahfiz College has been APPROVED for class: ${getClassName(app.targetClassId)}.\n\nYou have been promoted to the Student role in our system. You can now log back into the portal at https://imsc.edu/auth using your registered student credentials.\n\nBest regards,\nAdmission Office\nImam Malik Science & Tahfiz College`,
          sentAt: new Date().toISOString(),
          status: "delivered"
        });
        
        alert("Application Approved! Realtime notification sent and automated email logged.");
      } catch (error) {
        console.error("Approval error:", error);
        alert("Failed to approve application.");
      }
    }
  };

  const rejectApp = async (app: any) => {
    if (window.confirm(`Are you sure you want to reject ${app.firstName}'s application?`)) {
      try {
        if (isSupabaseConfigured) {
          try {
            await supabase.from('applications').update({
              status: 'rejected'
            }).eq('id', app.id);
          } catch (supErr) {
            console.warn("Supabase rejection sync error:", supErr);
          }
        }

        await updateDoc(doc(db, "applications", app.id), { 
          status: 'rejected' 
        });

        if (app.userId) {
          const userRef = doc(db, "users", app.userId);
          await updateDoc(userRef, {
            admissionStatus: 'rejected'
          });
        }

        // 3. Store Dashboard Notification for the applicant
        await addDoc(collection(db, "notifications"), {
          userId: app.userId || 'guest',
          applicantEmail: app.email,
          title: "Admission Status Update ⚠️",
          message: `Hello. Your admission application to class ${getClassName(app.targetClassId)} has been rejected. Please contact the admissions office if you would like to seek more feedback.`,
          type: "admission_status",
          status: "unread",
          createdAt: new Date().toISOString()
        });

        // 4. Store Automated Outgoing Email Trigger Log
        await addDoc(collection(db, "email_logs"), {
          userId: app.userId || 'guest',
          to: app.email,
          subject: "Imam Malik Science & Tahfiz College - Application Status Update",
          body: `Dear ${app.firstName} ${app.lastName},\n\nThank you for your application to Imam Malik Science & Tahfiz College.\n\nWe regret to inform you that we are unable to offer you admission for the selected class ${getClassName(app.targetClassId)} at this time. Please log in or contact our administration for more details.\n\nBest regards,\nAdmission Board\nImam Malik Science & Tahfiz College`,
          sentAt: new Date().toISOString(),
          status: "delivered"
        });

        alert("Application Rejected! Notification sent and automated email logged.");
      } catch (error) {
        console.error("Rejection error:", error);
        alert("Failed to reject application.");
      }
    }
  };

  const deleteApp = async (id: string) => {
    if (window.confirm("Permanently delete this application record?")) {
      if (isSupabaseConfigured) {
        try {
          await supabase.from('applications').delete().eq('id', id);
        } catch (supErr) {
          console.warn("Supabase delete sync error:", supErr);
        }
      }
      await deleteDoc(doc(db, "applications", id));
    }
  };

  const getClassName = (classId: string) => {
    return classes.find(c => c.id === classId)?.name || classId || 'N/A';
  };

  const filteredApps = apps.filter(app => 
    `${app.firstName} ${app.lastName} ${app.email}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-900" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 input-field" 
            placeholder="Search by name or email..." 
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 border rounded-xl font-bold text-xs text-slate-600 hover:bg-white transition-colors bg-slate-50/50">
          <Filter size={16} /> Filter Results
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Applicant</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Target Class</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Payment</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">{app.firstName} {app.lastName}</div>
                    <div className="text-xs text-slate-400 font-medium">{app.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-black uppercase whitespace-nowrap">
                      {getClassName(app.targetClassId)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", app.paymentStatus === 'verified' ? "bg-emerald-500" : "bg-amber-500")} />
                      <span className="text-xs font-bold uppercase text-slate-600">{app.paymentStatus}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">{app.transactionId}</div>
                  </td>
                  <td className="px-6 py-4">
                     <span className={cn(
                       "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                       app.status === 'approved' ? "bg-emerald-100 text-emerald-700" : 
                       app.status === 'rejected' ? "bg-red-100 text-red-700" :
                       "bg-slate-100 text-slate-500"
                     )}>
                       {app.status || 'pending'}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setSelectedApp(app)} 
                        title="View Details"
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                      >
                        <Eye size={20} />
                      </button>
                      {app.status !== 'approved' && (
                        <button 
                          onClick={() => approveApp(app)} 
                          title="Approve"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        >
                          <CheckCircle size={20} />
                        </button>
                      )}
                      {app.status === 'pending' && (
                        <button 
                          onClick={() => rejectApp(app)} 
                          title="Reject"
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                        >
                          <XCircle size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteApp(app.id)} 
                        title="Delete Permanently"
                        className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">No applications found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedApp(null)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-emerald-950 uppercase tracking-tight">Application Details</h3>
                <button onClick={() => setSelectedApp(null)} className="p-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
              </div>
              <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Full Name</p>
                     <p className="font-bold text-slate-800">{selectedApp.firstName} {selectedApp.lastName}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Target Class</p>
                     <p className="font-bold text-emerald-700">{getClassName(selectedApp.targetClassId)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Email Address</p>
                     <p className="font-medium text-slate-700">{selectedApp.email}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phone Number</p>
                     <p className="font-medium text-slate-700">{selectedApp.phone}</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100 grid grid-cols-2 gap-8">
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Guardian Name</p>
                     <p className="font-bold text-slate-800">{selectedApp.guardianName}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Guardian Phone</p>
                     <p className="font-medium text-slate-700">{selectedApp.guardianPhone}</p>
                   </div>
                   <div className="col-span-2 space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Residential Address</p>
                     <p className="text-sm font-medium text-slate-600 leading-relaxed">{selectedApp.address}</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                   <div className="space-y-1">
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Payment Status</p>
                     <p className="font-black text-emerald-600 uppercase text-xs">{selectedApp.paymentStatus || 'Verified'}</p>
                     {selectedApp.transactionId && (
                       <p className="text-[10px] font-mono font-bold text-slate-500 mt-1">Ref: {selectedApp.transactionId}</p>
                     )}
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Current Status</p>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                        selectedApp.status === 'approved' ? "bg-emerald-100 text-emerald-700" : 
                        selectedApp.status === 'rejected' ? "bg-red-100 text-red-700" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {selectedApp.status || 'pending'}
                      </span>
                   </div>
                </div>
              </div>
                 <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-4">
                     <div className="flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                       <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">Manual Payment Verification</h4>
                     </div>
                     <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                       Manually verify application fees or record offline references. Applicants will instantly be able to access their registration form or download/print their Application Slip from their dashboard.
                     </p>
                     <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                         <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Transaction ID / Reference</label>
                         <input
                           type="text"
                           value={transactionId}
                           onChange={(e) => setTransactionId(e.target.value)}
                           placeholder="e.g. TXN-10293847"
                           className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                         />
                       </div>
                       <div className="space-y-1.5">
                         <label className="text-[9px] text-slate-400 font-bold uppercase tracking-widest block">Payment Status</label>
                         <select
                           value={paymentStatus}
                           onChange={(e) => setPaymentStatus(e.target.value)}
                           className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                         >
                           <option value="pending">Pending</option>
                           <option value="verified">Verified</option>
                           <option value="failed">Failed</option>
                         </select>
                       </div>
                     </div>
                     <div className="flex justify-end pt-2">
                       <button
                         type="button"
                         onClick={handleSaveTransaction}
                         disabled={updatingPayment}
                         className="px-4 py-2 bg-emerald-900 text-white hover:bg-emerald-800 disabled:opacity-50 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                       >
                         {updatingPayment ? <Loader2 className="animate-spin" size={14} /> : null}
                         Save Payment Info
                       </button>
                     </div>
                 </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                 {selectedApp.status !== 'approved' && (
                   <button 
                    onClick={() => { approveApp(selectedApp); setSelectedApp(null); }} 
                    className="btn-primary"
                   >
                     Approve Application
                   </button>
                 )}
                 <button onClick={() => setSelectedApp(null)} className="px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

