import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Bell, Send, History, Trash2, Loader2 } from 'lucide-react';

export default function AdminAnnouncements() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("date", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAnnouncements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const broadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await addDoc(collection(db, "announcements"), {
        title,
        content,
        date: new Date().toISOString(),
        priority: 'high'
      });
      setTitle('');
      setContent('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Remove this announcement from the system?")) {
      await deleteDoc(doc(db, "announcements", id));
    }
  };

  return (
    <div className="grid lg:grid-cols-2 gap-12 pb-12">
      <div className="glass-card p-10 ring-4 ring-emerald-50 bg-white shadow-xl shadow-emerald-900/5">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-amber-50 rounded-2xl">
            <Bell className="text-amber-600" size={28} />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-emerald-950 leading-tight">New Broadcast</h3>
            <p className="text-sm text-slate-500">Post updates to the website homepage</p>
          </div>
        </div>
        <form onSubmit={broadcast} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Headline</label>
            <input 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="input-field" 
              placeholder="e.g. 2nd Term Vacation Date" 
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Content</label>
            <textarea 
              value={content}
              onChange={e => setContent(e.target.value)}
              className="input-field h-40" 
              placeholder="Write detailed announcement..." 
              required
            />
          </div>
          <button disabled={sending} className="btn-primary w-full py-4 flex items-center justify-center gap-3 text-lg shadow-xl shadow-emerald-900/20 transition-all active:scale-95">
            {sending ? <Loader2 className="animate-spin" /> : <><Send size={20} /> Publish to Website</>}
          </button>
        </form>
      </div>

      <div className="space-y-6">
         <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-emerald-950 flex items-center gap-2">
              <History size={20} className="text-slate-400" /> Past Announcements
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{announcements.length} Published</span>
         </div>
         
         {loading ? (
           <div className="flex justify-center p-10"><Loader2 className="animate-spin text-emerald-900" /></div>
         ) : (
           <div className="space-y-4">
             {announcements.map((old) => (
               <div key={old.id} className="glass-card p-6 flex justify-between items-center group hover:border-emerald-200 transition-colors">
                 <div>
                   <h5 className="font-bold text-slate-800 mb-0.5">{old.title}</h5>
                   <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">
                     {new Date(old.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                   </p>
                 </div>
                 <button 
                  onClick={() => handleDelete(old.id)}
                  className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                 >
                   <Trash2 size={20} />
                 </button>
               </div>
             ))}
             {announcements.length === 0 && (
               <p className="text-center py-20 text-slate-400 font-medium">No announcements published yet.</p>
             )}
           </div>
         )}
      </div>
    </div>
  );
}

