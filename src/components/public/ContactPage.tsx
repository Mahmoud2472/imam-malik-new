import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { sendContactFormEmail } from '../../lib/emailService';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      alert("Please fill in your name, email, and message.");
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await sendContactFormEmail({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        subject: formData.subject || 'Website Inquiry',
        message: formData.message
      });

      if (result.success) {
        setStatus({
          success: true,
          message: "Thank you! Your message has been sent to our administrative team. A confirmation email was sent to your inbox."
        });
        setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      } else {
        setStatus({
          success: false,
          message: result.message || "Failed to send message. Please try again or call us directly."
        });
      }
    } catch (err: any) {
      setStatus({
        success: false,
        message: err?.message || "An unexpected error occurred. Please try again."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="school-gradient py-24 text-white text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Contact Our Team</h1>
        <p className="opacity-70 max-w-xl mx-auto px-4">Have questions about admissions, academic programs, or tahfiz sessions? We're here to help.</p>
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
              <p className="text-slate-500 text-sm">Main Desk: 07011748311, 08032765759</p>
              <p className="text-slate-400 text-xs mt-1">Mon - Fri (8:00 AM - 4:00 PM)</p>
            </div>
            <div className="glass-card p-8 group hover:border-amber-500 transition-colors">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <Mail size={24} />
              </div>
              <h4 className="font-bold text-lg mb-2">Email</h4>
              <p className="text-slate-500 text-sm">maitechitservices6@gmail.com</p>
              <p className="text-slate-400 text-xs mt-1">Automatic acknowledgement dispatched</p>
            </div>
            <div className="glass-card p-8 group hover:border-blue-500 transition-colors">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <MapPin size={24} />
              </div>
              <h4 className="font-bold text-lg mb-2">Location</h4>
              <p className="text-slate-500 text-sm leading-relaxed">Karefa Road Tudun Wada Dankadai, Kano State, Nigeria</p>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2 glass-card p-8 md:p-12 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <MessageSquare className="text-emerald-950" size={28} />
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Send us a Message</h2>
                <p className="text-xs text-slate-400">Our administration receives and processes inquiries directly via Brevo transactional mail</p>
              </div>
            </div>

            {status && (
              <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-xs leading-relaxed ${
                status.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-red-50 text-red-900 border border-red-200'
              }`}>
                {status.success ? <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} /> : <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />}
                <div>
                  <strong className="block font-bold">{status.success ? "Message Dispatched!" : "Submission Notice"}</strong>
                  {status.message}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Full Name *</label>
                <input 
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field" 
                  placeholder="e.g. Ibrahim Adamu" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address *</label>
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="input-field" 
                  placeholder="name@domain.com" 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Number</label>
                <input 
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input-field" 
                  placeholder="080..." 
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subject</label>
                <input 
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="input-field" 
                  placeholder="e.g. Admission Requirements" 
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Message *</label>
                <textarea 
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="input-field h-36" 
                  placeholder="Type your message or inquiry here..." 
                />
              </div>
              <div className="md:col-span-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full btn-primary py-4 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Sending via Brevo..." : "Send Message"} <Send size={18} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
