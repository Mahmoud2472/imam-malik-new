import React from 'react';
export default function GalleryPage() {
  const images = [
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/staff.jpg_bigazu.jpg", title: "Dedicated Teaching Staff" },
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901132/student_hero.jpg_1_ayqjee.jpg", title: "Student Learning Session" },
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/assembly.jpg_1_yeshtk.jpg", title: "Morning Assembly" },
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/IMG-20190209-WA0009_p17n7f.jpg", title: "Inter-House Sports Event" },
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901130/IMG-20181215-WA0006_psgvaq.jpg", title: "Graduation Ceremony" },
    { url: "https://res.cloudinary.com/dswuqqfuk/image/upload/v1768901131/logo.jpg_imoamc.jpg", title: "Official School Mascot" },
  ];

  return (
    <div className="py-24 max-w-7xl mx-auto px-4">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-black text-emerald-950 mb-4 tracking-tighter uppercase">School Gallery</h1>
        <p className="text-slate-500 font-medium">Capturing the vibrant life and excellence at Imam Malik College.</p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {images.map((img, i) => (
          <div key={i} className="group overflow-hidden rounded-3xl relative aspect-square shadow-xl hover:shadow-2xl transition-all">
            <img 
              src={img.url} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
              alt={img.title} 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-end p-8">
              <h4 className="text-white font-black uppercase tracking-tight text-xl mb-2">{img.title}</h4>
              <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Official Photo</span>
            </div>
          </div>
        ))}
        
        {/* Placeholder images for more variety */}
        {[1,2,3].map(i => (
          <div key={`extra-${i}`} className="group overflow-hidden rounded-3xl relative aspect-square opacity-60">
            <img 
              src={`https://picsum.photos/seed/school-event-${i}/800/800`} 
              className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105" 
              alt="Archive Photo" 
              referrerPolicy="no-referrer"
            />
             <div className="absolute inset-0 flex items-center justify-center">
               <span className="text-white font-bold bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg text-xs uppercase tracking-widest">Past Event</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}
