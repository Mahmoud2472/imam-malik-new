import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { BookOpen, Microscope, ArrowRight, Bell, ChevronLeft, ChevronRight, Play, Pause, Maximize2 } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatDate } from '../../lib/utils';

export default function HomePage() {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [imageMode, setImageMode] = useState<'cover' | 'contain'>('cover');
  const [isPlaying, setIsPlaying] = useState(true);

  const heroSlides = [
    "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/staff.jpg_bigazu.jpg",
    "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901132/student_hero.jpg_1_ayqjee.jpg",
    "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/assembly.jpg_1_yeshtk.jpg",
    "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/IMG-20190209-WA0009_p17n7f.jpg",
    "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/IMG-20181215-WA0006_psgvaq.jpg"
  ];

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPlaying, heroSlides.length]);

  useEffect(() => {
    async function fetchAnnouncements() {
      const q = query(collection(db, "announcements"), orderBy("date", "desc"), limit(3));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAnnouncements(data);
    }
    fetchAnnouncements();
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center overflow-hidden bg-emerald-950">
        <div className="absolute inset-0 z-0 bg-emerald-950 flex items-center justify-center">
          {heroSlides.map((slide, idx) => (
            <motion.img 
              key={slide}
              src={slide} 
              alt={`Slide ${idx + 1}`} 
              initial={{ opacity: 0, scale: imageMode === 'cover' ? 1.08 : 1.0 }}
              animate={{ 
                opacity: activeSlide === idx ? 1.0 : 0, 
                scale: activeSlide === idx ? 1.0 : (imageMode === 'cover' ? 1.08 : 1.0) 
              }}
              transition={{ duration: 1.0, ease: "easeInOut" }}
              className={`absolute inset-0 w-full h-full transition-all duration-300 ${
                imageMode === 'cover' ? 'object-cover' : 'object-contain p-4 md:p-8'
              }`}
              referrerPolicy="no-referrer"
            />
          ))}
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10 w-full flex flex-col justify-end h-full py-6 md:py-12">
          {/* Premium Gallery Controls / Interactive Toolbar for live adjustments */}
          <div 
            className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-4 bg-emerald-950/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-emerald-800/60 shadow-2xl relative z-20 w-full"
          >
            {/* Index Display */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Catalog ({activeSlide + 1}/{heroSlides.length})</span>
              <div className="flex gap-1.5 ml-2">
                {heroSlides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveSlide(idx)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      activeSlide === idx ? 'w-6 bg-amber-500' : 'w-2 bg-emerald-800 hover:bg-emerald-700'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Slider Adjustments & Image Mode Choice */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Manual navigation play/pause buttons */}
              <div className="flex items-center bg-emerald-900/40 rounded-lg p-0.5 border border-emerald-800/40">
                <button
                  type="button"
                  onClick={() => setActiveSlide(prev => (prev - 1 + heroSlides.length) % heroSlides.length)}
                  className="p-1.5 hover:bg-emerald-800 hover:text-white rounded text-slate-300 transition-colors"
                  title="Previous Photo"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 hover:bg-emerald-800 hover:text-amber-400 rounded text-slate-300 transition-colors"
                  title={isPlaying ? "Pause automatic slide presentation" : "Play automatic slide presentation"}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSlide(prev => (prev + 1) % heroSlides.length)}
                  className="p-1.5 hover:bg-emerald-800 hover:text-white rounded text-slate-300 transition-colors"
                  title="Next Photo"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Complete Fit Toggle Button */}
              <div className="flex flex-wrap items-center bg-emerald-900/45 rounded-xl px-2.5 py-1.5 border border-emerald-800/30 gap-2">
                <span className="text-[9px] font-black uppercase text-slate-300 tracking-wider">Image View:</span>
                <button
                  type="button"
                  onClick={() => setImageMode('cover')}
                  className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                    imageMode === 'cover' 
                      ? 'bg-amber-500 text-emerald-950 shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-emerald-800/30'
                  }`}
                  title="Crop to fill container"
                >
                  Fill Banner
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('contain')}
                  className={`px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    imageMode === 'contain' 
                      ? 'bg-amber-500 text-emerald-950 shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-emerald-800/30'
                  }`}
                  title="Show complete original uncropped photo"
                >
                  <Maximize2 size={10} /> Complete Fit
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Announcements Scroller */}
      {announcements.length > 0 && (
        <div className="bg-amber-50 border-y border-amber-100 py-3 overflow-hidden whitespace-nowrap">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
            <span className="flex items-center gap-2 text-amber-700 font-bold text-sm shrink-0">
              <Bell size={16} /> LATEST UPDATES:
            </span>
            <div className="flex gap-12 animate-marquee">
              {announcements.map((ann, idx) => (
                <span key={idx} className="text-amber-900 text-sm font-medium">
                  • {ann.title} ({formatDate(ann.date)})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Philosophy Section */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                <img src="https://picsum.photos/seed/students-studying/600/800" alt="Students" className="rounded-2xl h-96 w-full object-cover shadow-2xl" referrerPolicy="no-referrer" />
                <div className="pt-12">
                  <img src="https://picsum.photos/seed/science-lab/600/800" alt="Laboratory" className="rounded-2xl h-96 w-full object-cover shadow-2xl" referrerPolicy="no-referrer" />
                </div>
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-emerald-900 rounded-3xl -z-10" />
            </div>

            <div>
              <span className="text-emerald-700 font-bold tracking-widest text-sm uppercase mb-4 block">Our Philosophy</span>
              <h2 className="text-3xl md:text-5xl font-bold text-emerald-950 mb-8 leading-tight">
                Integrity, Excellence & Islamic Values
              </h2>
              <p className="text-slate-600 mb-8 leading-relaxed text-lg">
                At Imam Malik Science & Tahfiz College, we believe that education is incomplete without character building. Our curriculum is carefully balanced to provide deep scientific knowledge while fostering a profound connection with the Holy Quran.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-900 shrink-0">
                    <BookOpen />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 mb-2">Hifz Program</h4>
                    <p className="text-sm text-slate-500">Structured Quranic memorization under expert scholars.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                    <Microscope />
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 mb-2">Modern Science</h4>
                    <p className="text-sm text-slate-500">Standard labs and modern teaching methodologies.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-emerald-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 lg:grid-cols-4 gap-12 text-center relative z-10">
          {[
            { value: '500+', label: 'Active Students' },
            { value: '45+', label: 'Expert Teachers' },
            { value: '98%', label: 'Science & Technical Exam Success Rate' },
            { value: '150+', label: 'Huffaz Graduated' },
          ].map((stat, idx) => (
            <div key={idx}>
              <div className="text-4xl md:text-5xl font-bold text-amber-400 mb-2">{stat.value}</div>
              <div className="text-emerald-200 uppercase tracking-widest text-xs font-semibold">{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -mr-48 -mt-48 blur-3xl" />
      </section>
    </div>
  );
}
