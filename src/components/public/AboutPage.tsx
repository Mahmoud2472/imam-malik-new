import React from 'react';
import { motion } from 'motion/react';
import { User, Book, Heart, Shield, Landmark } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="school-gradient py-24 text-white text-center">
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Our Legacy & Mission</h1>
        <p className="text-emerald-100 max-w-2xl mx-auto px-4 opacity-80 leading-relaxed">
          Established to bridge the gap between spiritual devotion and academic excellence, IMSC is a leading institution in Kano.
        </p>
      </section>

      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-amber-600 font-bold uppercase tracking-widest text-sm mb-4 block">History</span>
            <h2 className="text-3xl font-bold text-emerald-950 mb-6">Founded with a Vision</h2>
            <p className="text-slate-600 mb-6 leading-relaxed">
              Imam Malik Science & Tahfiz College was founded in 2016 with the goal of providing a safe environment for Muslim children to excel in both Western and Islamic education.
            </p>
            <div className="space-y-4">
              {[
                { title: 'The Mission', text: 'To produce well-rounded individuals who are academically sound and spiritually grounded.' },
                { title: 'The Vision', text: 'To be the premier institution for scientific innovation and Quranic mastery in Africa.' },
              ].map(item => (
                <div key={item.title} className="p-6 bg-slate-50 border border-slate-100 rounded-2xl">
                  <h4 className="font-bold text-emerald-900 mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-500">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src="https://picsum.photos/seed/about1/600/800" className="rounded-2xl shadow-xl" alt="About" referrerPolicy="no-referrer" />
            <div className="mt-12">
              <img src="https://picsum.photos/seed/about2/600/800" className="rounded-2xl shadow-xl" alt="About" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
