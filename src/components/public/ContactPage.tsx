import React from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="school-gradient py-24 text-white text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Our Team</h1>
        <p className="opacity-70 max-w-xl mx-auto px-4">Have questions about admissions or school events? We're here to help.</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-20 -mt-16">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Info cards */}
          <div className="space-y-6">
            <div className="glass-card p-8 group hover:border-emerald-500 transition-colors">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-900 rounded-xl flex items-center justify-center mb-6 group-hover:bg-emerald-900 group-hover:text-white transition-colors">
                <Phone size={24} />
              </div>
              <h4 className="font-bold text-lg mb-2">Phone</h4>
              <p className="text-slate-500 text-sm">Main Office: 07011748311</p>
            </div>
            <div className="glass-card p-8 group hover:border-amber-500 transition-colors">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Mail size={24} />
              </div>
              <h4 className="font-bold text-lg mb-2">Email</h4>
              <p className="text-slate-500 text-sm">maitechitservices6@gmail.com</p>
            </div>
            <div className="glass-card p-8 group hover:border-blue-500 transition-colors">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <MapPin size={24} />
              </div>
              <h4 className="font-bold text-lg mb-2">Location</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Karefa Road Tudun Wada Dankadai, Kano State</p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 glass-card p-8 md:p-12 shadow-2xl">
            <div className="flex items-center gap-3 mb-10">
              <MessageSquare className="text-emerald-950" size={28} />
              <h2 className="text-2xl font-bold text-slate-800">Send us a Message</h2>
            </div>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Full Name</label>
                <input className="input-field" placeholder="Full Name" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Address</label>
                <input className="input-field" placeholder="Email" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subject</label>
                <input className="input-field" placeholder="How can we help?" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Message</label>
                <textarea className="input-field h-40" placeholder="Type your message here..." />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="w-full btn-primary py-4 flex items-center justify-center gap-3">
                  Send Message <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
