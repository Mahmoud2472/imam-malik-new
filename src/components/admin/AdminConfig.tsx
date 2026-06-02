import React, { useState, useEffect } from 'react';
import { Book, Users, GraduationCap, ChevronRight, Plus, Trash2, Edit, Loader2, BookOpen, Wallet, Database, Sparkles, RefreshCw, ShieldAlert } from 'lucide-react';
import { collection, query, onSnapshot, deleteDoc, doc, getDocs, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../lib/utils';
import ConfigModal from './modals/ConfigModal';

export default function AdminConfig() {
  const [activeTab, setActiveTab] = useState<'Classes' | 'Subjects' | 'Teachers' | 'Fees' | 'System'>('Classes');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const [purging, setPurging] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [systemMessage, setSystemMessage] = useState<string | null>(null);

  const handlePurgeDatabase = async () => {
    if (!window.confirm("CRITICAL ACTION: Are you absolutely sure you want to WIPEOUT all trial student records, admission applications, payment receipts, academic results, and announcements from your Firestore database? This action is permanent and cannot be undone.")) {
      return;
    }
    
    setPurging(true);
    setSystemMessage("Wiping out old collections...");
    try {
      const collectionsToWipe = ['applications', 'payments', 'students', 'results', 'announcements'];
      let totalDeleted = 0;
      
      for (const collName of collectionsToWipe) {
        const snap = await getDocs(collection(db, collName));
        for (const docObj of snap.docs) {
          await deleteDoc(doc(db, collName, docObj.id));
          totalDeleted++;
        }
      }
      
      setSystemMessage(`Success! Cleaned up ${totalDeleted} documents. Your database is now completely clean and ready.`);
    } catch (e: any) {
      console.error(e);
      setSystemMessage(`Error wiping database: ${e.message || String(e)}`);
    } finally {
      setPurging(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    setSystemMessage("Seeding default school configuration...");
    try {
      // 1. Seed Classes
      const classesData = [
        { id: 'jss1', name: 'JSS 1', level: 'Junior Secondary' },
        { id: 'jss2', name: 'JSS 2', level: 'Junior Secondary' },
        { id: 'jss3', name: 'JSS 3', level: 'Junior Secondary' },
        { id: 'ss1', name: 'SS 1', level: 'Senior Secondary' },
        { id: 'ss2', name: 'SS 2', level: 'Senior Secondary' },
        { id: 'ss3', name: 'SS 3', level: 'Senior Secondary' }
      ];
      
      for (const cls of classesData) {
        await setDoc(doc(db, 'classes', cls.id), { name: cls.name, level: cls.level });
      }

      // 2. Seed Subjects
      const subjectsData = [
        { name: 'Islamic Studies', code: 'IRK' },
        { name: 'Holy Quran Memorization (Tahfiz)', code: 'QTZ' },
        { name: 'English Language', code: 'ENG' },
        { name: 'Mathematics', code: 'MTH' },
        { name: 'Physics', code: 'PHY' },
        { name: 'Chemistry', code: 'CHM' },
        { name: 'Biology', code: 'BIO' },
        { name: 'Computer Science', code: 'CMP' }
      ];
      
      for (const sub of subjectsData) {
        await addDoc(collection(db, 'subjects'), sub);
      }

      // 3. Seed Fees
      const feesData = [
        { name: 'Admission & Prospectus Fee', amount: 15000, description: 'Mandatory registration fee for new applicants' },
        { name: '1st Term School Fees', amount: 35000, description: 'Tuition and learning materials' },
        { name: 'School Uniform Pack', amount: 10000, description: 'Custom college uniform and sportswear' }
      ];
      
      for (const fee of feesData) {
        await addDoc(collection(db, 'fees'), fee);
      }

      // 4. Seed Announcements
      const announcementsData = [
        { title: 'New Academic Session Registrations Open', content: 'Imam Malik Science & Tahfiz College is now accepting applications of prospective students. Please login to get started.', date: new Date().toISOString(), priority: 'high' },
        { title: 'Quranic Tahfiz Excellence Award', content: 'Congratulations to our students who completed memorization of the Quran this term!', date: new Date().toISOString(), priority: 'normal' }
      ];
      
      for (const ann of announcementsData) {
        await addDoc(collection(db, 'announcements'), ann);
      }

      setSystemMessage("Success! Standard School parameter config, subjects, fees structure, and initial announcements seeded perfectly.");
    } catch (e: any) {
      console.error(e);
      setSystemMessage(`Error seeding database: ${e.message || String(e)}`);
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'Teachers' || activeTab === 'System') {
       setData([]);
       setLoading(false);
       return;
    }

    const collectionName = activeTab.toLowerCase();
    setLoading(true);
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeTab]);

  const handleDelete = async (id: string) => {
    if (window.confirm(`Are you sure you want to delete this ${activeTab.slice(0, -1)}?`)) {
      await deleteDoc(doc(db, activeTab.toLowerCase(), id));
    }
  };

  const menuItems = [
    { title: 'Classes', icon: GraduationCap, label: 'Manage Rooms' },
    { title: 'Subjects', icon: Book, label: 'Curriculum' },
    { title: 'Teachers', icon: Users, label: 'Staffing' },
    { title: 'Fees', icon: Wallet, label: 'Fee Structures' },
    { title: 'System', icon: Database, label: 'Database Reset' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {menuItems.map(item => (
          <button 
            key={item.title} 
            onClick={() => setActiveTab(item.title as any)}
            className={`glass-card p-5 flex items-center gap-4 text-left transition-all group ${activeTab === item.title ? 'ring-2 ring-emerald-500 border-emerald-500' : 'hover:bg-slate-50'}`}
          >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${activeTab === item.title ? 'bg-emerald-900 text-amber-500' : 'bg-emerald-50 text-emerald-900 group-hover:scale-110'}`}>
              <item.icon size={20} />
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{item.label}</p>
            </div>
            <ChevronRight className={`transition-transform ${activeTab === item.title ? 'text-emerald-500 translate-x-1' : 'text-slate-300'}`} size={14} />
          </button>
        ))}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
          <div>
            <h3 className="text-xl font-bold text-emerald-950 flex items-center gap-2">
              {activeTab} {activeTab === 'System' ? 'Controls' : 'Registry'}
              {activeTab !== 'System' && (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] rounded-md">{data.length} Total</span>
              )}
            </h3>
            <p className="text-sm text-slate-500">
              {activeTab === 'System' ? 'Wipe or seed the school environment database' : 'Add, edit or remove academic parameters'}
            </p>
          </div>
          {activeTab !== 'Teachers' && activeTab !== 'System' && (
            <button 
              onClick={() => { setSelectedItem(null); setIsModalOpen(true); }}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 shadow-lg shadow-emerald-900/10"
            >
              <Plus size={18} /> New {activeTab.slice(0, -1)}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-emerald-900" /></div>
        ) : activeTab === 'System' ? (
          <div className="p-8 space-y-8">
            <div className="p-6 bg-amber-50 rounded-3xl border border-amber-200 flex gap-4 items-start">
              <ShieldAlert className="text-amber-600 shrink-0 mt-1 animate-pulse" size={28} />
              <div className="space-y-1">
                <h4 className="font-extrabold text-amber-900 text-sm uppercase tracking-wider">Database Maintenance Dashboard</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  These operations write directly to your live companion Firestore database. Use these tools to reset intermediate mockup data, wipe stale payments/applicants, or restore fresh parameters during demo loops.
                </p>
              </div>
            </div>

            {systemMessage && (
              <div className="p-5 bg-emerald-950 text-white rounded-2xl flex items-center justify-between border border-emerald-900 shadow-lg">
                <div className="text-xs font-bold font-mono flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  {systemMessage}
                </div>
                <button onClick={() => setSystemMessage(null)} className="text-[10px] font-black uppercase text-amber-400 hover:text-white tracking-wider">
                  Dismiss
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purge Section */}
              <div className="p-8 bg-white border border-rose-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mb-6 font-bold">
                    <Trash2 size={24} />
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800 mb-2">Wipe Out Core Collections</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    Completely purges all documents inside <strong className="font-mono">applications</strong>, <strong className="font-mono">payments</strong>, <strong className="font-mono">students</strong>, <strong className="font-mono">results</strong>, and <strong className="font-mono">announcements</strong>. Profile login credentials are kept so you remain signed in.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePurgeDatabase}
                  disabled={purging || seeding}
                  className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-rose-600/15 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {purging ? <Loader2 className="animate-spin" size={16} /> : <><Trash2 size={14} /> Wipe Previous Database</>}
                </button>
              </div>

              {/* Seed Section */}
              <div className="p-8 bg-white border border-emerald-100 rounded-3xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-650 mb-6 font-bold">
                    <Sparkles size={24} />
                  </div>
                  <h4 className="text-lg font-extrabold text-slate-800 mb-2">Seed Default School Config</h4>
                  <p className="text-xs text-slate-500 leading-relaxed mb-6">
                    Instantly populates standard school parameters: includes academic levels <strong className="font-mono">JSS 1-3 & SS 1-3</strong>, traditional subjects curriculum, dynamic admission fee tables, and initial welcome announcements.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSeedData}
                  disabled={purging || seeding}
                  className="w-full py-3.5 hover:text-white bg-amber-500 hover:bg-amber-600 text-emerald-950 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {seeding ? <Loader2 className="animate-spin" size={16} /> : <><RefreshCw size={14} /> Seed Default Configuration</>}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((item) => (
              <div key={item.id} className="p-6 border border-slate-100 rounded-3xl hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group relative overflow-hidden">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl shadow-sm border border-slate-50 ${activeTab === 'Fees' ? 'bg-amber-50 text-amber-600' : 'bg-white text-emerald-900'}`}>
                    {activeTab === 'Classes' ? <GraduationCap size={24} /> : activeTab === 'Fees' ? <Wallet size={24} /> : <BookOpen size={24} />}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-y-1 group-hover:translate-y-0 duration-300">
                    <button 
                      onClick={() => { setSelectedItem(item); setIsModalOpen(true); }}
                      className="p-2.5 bg-white text-slate-400 hover:text-emerald-900 rounded-xl shadow-sm border border-slate-100"
                    >
                      <Edit size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(item.id)}
                      className="p-2.5 bg-white text-slate-400 hover:text-red-500 rounded-xl shadow-sm border border-slate-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <h4 className="font-bold text-slate-800 text-lg mb-1">{item.name}</h4>
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {activeTab === 'Classes' ? item.level : activeTab === 'Fees' ? 'Payment Item' : `Code: ${item.code}`}
                  </p>
                  {activeTab === 'Fees' && (
                    <div className="text-emerald-700 font-black text-lg">{formatCurrency(item.amount)}</div>
                  )}
                </div>
                {item.description && (
                  <p className="mt-3 text-xs text-slate-500 italic line-clamp-2">{item.description}</p>
                )}
              </div>
            ))}
            {data.length === 0 && (
              <div className="col-span-full py-20 text-center text-slate-400 font-medium">
                No {activeTab.toLowerCase()} configured. Click the button above to add one.
              </div>
            )}
          </div>
        )}
      </div>

      <ConfigModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        type={activeTab === 'Classes' ? 'Class' : activeTab === 'Fees' ? 'Fee' : 'Subject'}
        item={selectedItem}
      />
    </div>
  );
}

