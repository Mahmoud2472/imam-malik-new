import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Landmark, GraduationCap, Phone, MapPin, Mail, ChevronRight, Home, ArrowUp } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PublicLayout() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'About', href: '/about' },
    { name: 'Admission', href: '/admission' },
    { name: 'Campaign Flyer', href: '/flyer' },
    { name: 'Gallery', href: '/gallery' },
    { name: 'Contact', href: '/contact' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top Banner */}
      <div className="bg-emerald-950 text-emerald-50 py-2 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center text-xs font-medium">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><Phone size={14} className="text-amber-500" /> 07011748311</span>
            <span className="flex items-center gap-1.5"><Mail size={14} className="text-amber-500" /> maitechitservices6@gmail.com</span>
          </div>
          <div className="flex gap-4">
            <Link to="/auth" className="hover:text-amber-500 transition-colors uppercase font-black tracking-widest text-[10px]">Portal Login</Link>
          </div>
        </div>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-14 h-14 flex items-center justify-center bg-emerald-900 rounded-2xl overflow-hidden border-2 border-emerald-800 shadow-md transform group-hover:scale-105 transition-transform duration-300">
              <img 
                src="https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg" 
                alt="Logo" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-black text-emerald-950 leading-none tracking-tight uppercase group-hover:text-emerald-900 transition-colors">Imam Malik</h1>
              <p className="text-[9px] md:text-xs font-serif font-black text-amber-600 uppercase tracking-[0.25em] mt-0.5 leading-none">Science & Tahfiz College</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className={cn(
                  "text-sm font-bold transition-all duration-200 flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-transparent",
                  location.pathname === link.href 
                    ? "bg-emerald-50 text-emerald-950 border-emerald-100 shadow-sm" 
                    : "text-slate-600 hover:text-emerald-900 hover:bg-slate-50"
                )}
              >
                {link.name === 'Home' && <Home size={15} className="text-amber-500" />}
                {link.name}
              </Link>
            ))}
            <Link to="/admission" className="btn-primary flex items-center gap-2 text-sm shadow-md hover:bg-emerald-850 transform active:scale-95 transition-all">
              Apply Now <ChevronRight size={16} />
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="lg:hidden p-2 text-emerald-950">
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden border-t border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-4 py-6 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-base font-medium text-slate-700 active:text-emerald-900"
                  >
                    {link.name}
                  </Link>
                ))}
                <Link to="/auth" className="text-base font-medium text-emerald-900 py-2">Portal Login</Link>
                <Link to="/admission" className="btn-primary text-center">Apply Now</Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-emerald-950 text-emerald-100 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Landmark className="text-amber-500" size={32} />
              <h2 className="text-xl font-bold text-white">IMSC</h2>
            </div>
            <p className="text-sm leading-relaxed text-emerald-200/80 mb-6">
              Empowering the next generation with scientific excellence and Islamic values. Dedicated to nurturing leaders of tomorrow.
            </p>
          </div>

          <div>
            <h3 className="text-white font-bold mb-6">Quick Links</h3>
            <ul className="space-y-3 text-sm">
              {navLinks.map(link => (
                <li key={link.name}><Link to={link.href} className="hover:text-amber-500 transition-colors">{link.name}</Link></li>
              ))}
              <li><Link to="/auth" className="hover:text-amber-500 transition-colors">Staff Portal</Link></li>
              <li><Link to="/auth" className="hover:text-amber-500 transition-colors">Student Portal</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-6">Contact Us</h3>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3 items-start">
                <MapPin size={18} className="text-amber-500 shrink-0" />
                <span>Karefa Road Tudun Wada Dankadai, Kano State</span>
              </li>
              <li className="flex gap-3 items-center">
                <Phone size={18} className="text-amber-500 shrink-0" />
                <span>07011748311</span>
              </li>
              <li className="flex gap-3 items-center">
                <Mail size={18} className="text-amber-500 shrink-0" />
                <span>maitechitservices6@gmail.com</span>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-bold mb-6">Newsletter</h3>
            <p className="text-xs text-emerald-200/60 mb-4">Stay updated with our latest school news and events.</p>
            <div className="flex gap-2">
              <input type="email" placeholder="Email" className="bg-emerald-900 border-none rounded-lg px-3 py-2 text-sm w-full focus:ring-1 focus:ring-amber-500" />
              <button className="bg-amber-600 p-2 rounded-lg hover:bg-amber-500"><ChevronRight size={20} /></button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 border-t border-emerald-900 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] md:text-sm text-emerald-200/40">
          <div className="flex flex-col gap-1">
            <p>© 2026 Imam Malik Science & Tahfiz College. All rights reserved.</p>
            <p className="font-bold text-amber-500/60 uppercase tracking-widest text-[9px]">Powered by Maitech I.T. Services</p>
          </div>
          <div className="flex gap-6">
            <Link to="#">Privacy Policy</Link>
            <Link to="#">Terms of Service</Link>
          </div>
        </div>
      </footer>

      {/* Persistent Beautiful Navigation Assist Bar (Bottom Right) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col sm:flex-row gap-3 items-center print:hidden">
        {/* Quick Home navigation button */}
        <Link 
          to="/"
          title="Go to Homepage"
          className="p-3.5 bg-amber-500 text-emerald-950 font-black rounded-full shadow-2xl hover:bg-amber-400 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-white flex items-center justify-center group"
        >
          <Home size={20} className="group-hover:rotate-12 transition-transform duration-200" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs group-hover:ml-2 transition-all duration-300 text-xs uppercase tracking-wider font-extrabold whitespace-nowrap">
            Go Home
          </span>
        </Link>
        
        {/* Scroll back to top */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            title="Scroll to Top"
            className="p-3.5 bg-emerald-900 text-white rounded-full shadow-2xl hover:bg-emerald-800 hover:scale-110 active:scale-95 transition-all duration-200 border-2 border-emerald-950/20 flex items-center justify-center"
          >
            <ArrowUp size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
