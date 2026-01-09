import React, { useState, useEffect, useRef } from 'react';

const DEFAULT_CENTER = [-6.2088, 106.8456]; // Jakarta

// Inline SVG Icons for better reliability and performance
const Icons = {
MapPin: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
<circle cx="12" cy="10" r="3"></circle>
</svg>
),
Heart: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
</svg>
),
Message: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
</svg>
),
Search: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<circle cx="11" cy="11" r="8"></circle>
<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
</svg>
),
User: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
<circle cx="12" cy="7" r="4"></circle>
</svg>
),
Plus: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<line x1="12" y1="5" x2="12" y2="19"></line>
<line x1="5" y1="12" x2="19" y2="12"></line>
</svg>
),
X: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<line x1="18" y1="6" x2="6" y2="18"></line>
<line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
),
ChevronRight: ({ size = 24, className = "" }) => (
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
<polyline points="9 18 15 12 9 6"></polyline>
</svg>
)
};

const App = () => {
const [leafletReady, setLeafletReady] = useState(false);
const [activeTab, setActiveTab] = useState('home');
const [markers, setMarkers] = useState([
{
id: 1,
lat: -6.1754,
lng: 106.8272,
title: "Sudut Kenangan Monas",
story: "Di sini kita dulu pernah berjanji untuk tidak saling melepaskan, namun sore itu angin membawa kabarmu yang lain.",
date: "12 Jan 2024",
author: "Anonim"
},
{
id: 2,
lat: -6.2297,
lng: 106.8095,
title: "Hujan di SCBD",
story: "Lampu-lampu gedung ini tampak buram karena air mata yang beradu dengan rintik hujan. Kota ini terlalu bising untuk rindu yang sesunyi ini.",
date: "05 Feb 2024",
author: "Pejalan Sunyi"
}
]);

const [isAddingPoint, setIsAddingPoint] = useState(null);
const [selectedPoint, setSelectedPoint] = useState(null);
const [newStory, setNewStory] = useState({ title: '', content: '' });
const [showSidebar, setShowSidebar] = useState(false);

const mapContainerRef = useRef(null);
const mapInstance = useRef(null);
const markersGroup = useRef(null);

// 1. Load Leaflet with retry and verification
useEffect(() => {
const checkReady = () => {
if (window.L && window.L.map) {
setLeafletReady(true);
} else {
setTimeout(checkReady, 100);
}
};

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = checkReady;
      document.head.appendChild(script);
    } else {
      checkReady();
    }

}, []);

// 2. Initialize Map
useEffect(() => {
if (leafletReady && mapContainerRef.current && !mapInstance.current) {
const L = window.L;

      try {
        // We use Leaflet (Open Source / Free)
        const m = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: true // Required for free tile services
        }).setView(DEFAULT_CENTER, 13);

        // Tile Layer: CartoDB Positron (Free, clean, modern)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(m);

        mapInstance.current = m;
        markersGroup.current = L.layerGroup().addTo(m);

        m.on('click', (e) => {
          setIsAddingPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
          setSelectedPoint(null);
        });
      } catch (err) {
        console.error("Map initialization failed", err);
      }
    }

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };

}, [leafletReady]);

// 3. Sync Markers
useEffect(() => {
if (leafletReady && markersGroup.current && mapInstance.current) {
const L = window.L;
markersGroup.current.clearLayers();

      markers.forEach(point => {
        const customIcon = L.divIcon({
          className: 'custom-marker-icon',
          html: `<div class="marker-pulse"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        const marker = L.marker([point.lat, point.lng], { icon: customIcon })
          .on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            setSelectedPoint(point);
            setIsAddingPoint(null);
            mapInstance.current.flyTo([point.lat, point.lng], 15);
          });

        markersGroup.current.addLayer(marker);
      });
    }

}, [markers, leafletReady]);

const handleSaveStory = () => {
if (!newStory.title.trim() || !newStory.content.trim()) return;

    const point = {
      id: Date.now(),
      lat: isAddingPoint.lat,
      lng: isAddingPoint.lng,
      title: newStory.title,
      story: newStory.content,
      date: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }),
      author: "Kamu"
    };

    setMarkers(prev => [...prev, point]);
    setIsAddingPoint(null);
    setNewStory({ title: '', content: '' });

};

if (!leafletReady) {
return (
<div className="w-full h-screen flex flex-col items-center justify-center bg-slate-50 font-sans">
<div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
<p className="text-slate-400 font-medium">Membuka peta kenangan...</p>
</div>
);
}

return (
<div className="relative w-full h-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
<style>{`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; }

        .marker-pulse {
          width: 20px;
          height: 20px;
          background: rgba(99, 102, 241, 0.8);
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
          animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(99, 102, 241, 0); }
          100% { transform: scale(0.8); box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
        }

        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }

        .leaflet-control-attribution {
          font-size: 8px !important;
          background: rgba(255, 255, 255, 0.5) !important;
          backdrop-filter: blur(4px);
        }
      `}</style>

      {/* Map Container */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-100" />

      {/* Navigation */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-10 w-[90%] max-w-2xl">
        <div className="glass rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xl shadow-slate-900/5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg">
              <Icons.MapPin size={20} />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">Titik Galau</h1>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-500">
            <button onClick={() => {setActiveTab('home'); setShowSidebar(false)}} className={`hover:text-indigo-600 transition-colors ${activeTab === 'home' ? 'text-indigo-600' : ''}`}>Beranda</button>
            <button onClick={() => {setActiveTab('my'); setShowSidebar(true)}} className={`hover:text-indigo-600 transition-colors ${activeTab === 'my' ? 'text-indigo-600' : ''}`}>Titikku</button>
            <button onClick={() => {setActiveTab('explore'); setShowSidebar(true)}} className={`hover:text-indigo-600 transition-colors ${activeTab === 'explore' ? 'text-indigo-600' : ''}`}>Jelajah</button>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600"><Icons.Search size={20} /></button>
            <button className="p-2 bg-slate-100 text-slate-600 rounded-full"><Icons.User size={20} /></button>
          </div>
        </div>
      </nav>

      {/* Sidebar List */}
      <div className={`absolute top-0 left-0 z-20 h-full w-full md:w-96 glass shadow-2xl transition-transform duration-500 ease-out ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 pt-24 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-slate-900">{activeTab === 'my' ? 'Jejak Kenangan' : 'Ruang Cerita'}</h2>
            <button onClick={() => setShowSidebar(false)} className="p-2 text-slate-400 hover:text-slate-600"><Icons.X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {(activeTab === 'my' ? markers.filter(m => m.author === 'Kamu') : markers).map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPoint(p);
                  mapInstance.current.flyTo([p.lat, p.lng], 15);
                  if(window.innerWidth < 768) setShowSidebar(false);
                }}
                className="p-4 bg-white/50 hover:bg-white rounded-xl border border-white/50 cursor-pointer transition-all hover:shadow-md"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-slate-800">{p.title}</h3>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">{p.date}</span>
                </div>
                <p className="text-sm text-slate-500 line-clamp-2 italic">"{p.story}"</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Write Story Modal */}
      {isAddingPoint && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <h3 className="text-xl font-bold">Simpan Kenangan</h3>
              <button onClick={() => setIsAddingPoint(null)}><Icons.X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="text" placeholder="Judul (Misal: Sore itu...)"
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-500 transition-all outline-none font-medium"
                value={newStory.title} onChange={(e) => setNewStory(prev => ({...prev, title: e.target.value}))}
              />
              <textarea
                rows="4" placeholder="Apa yang terjadi di sini?"
                className="w-full p-4 rounded-xl bg-slate-50 border border-slate-100 focus:border-indigo-500 transition-all outline-none font-medium resize-none"
                value={newStory.content} onChange={(e) => setNewStory(prev => ({...prev, content: e.target.value}))}
              />
              <button
                onClick={handleSaveStory}
                disabled={!newStory.title.trim() || !newStory.content.trim()}
                className="w-full py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-all disabled:opacity-40"
              >
                Simpan Titik Ini
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Story Detail Card */}
      {selectedPoint && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-lg animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-white rounded-[2rem] p-7 shadow-2xl border border-slate-100 relative">
            <button onClick={() => setSelectedPoint(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 transition-colors"><Icons.X size={22} /></button>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shadow-inner">
                <Icons.Message size={28} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight">{selectedPoint.title}</h3>
                <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">{selectedPoint.author} • {selectedPoint.date}</p>
              </div>
            </div>

            <p className="text-slate-600 leading-relaxed italic text-lg pr-4">"{selectedPoint.story}"</p>

            <div className="mt-8 flex items-center justify-between pt-5 border-t border-slate-50">
              <div className="flex gap-4">
                <button className="text-slate-400 hover:text-rose-500 flex items-center gap-2 font-bold text-xs uppercase transition-colors">
                  <Icons.Heart size={18} /> Peluk
                </button>
                <button className="text-slate-400 hover:text-indigo-500 flex items-center gap-2 font-bold text-xs uppercase transition-colors">
                  <Icons.Plus size={18} /> Simpan
                </button>
              </div>
              <button className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-100 transition-all">
                Bagikan <Icons.ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hint for Desktop */}
      {!selectedPoint && !isAddingPoint && (
        <div className="absolute bottom-12 left-8 z-10 hidden md:block">
          <div className="glass px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Ketuk peta untuk menitipkan rasa
          </div>
        </div>
      )}

      {/* Add Button for Mobile */}
      {!isAddingPoint && !selectedPoint && (
        <button
          className="md:hidden absolute bottom-10 right-10 z-10 w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
          onClick={() => {
            const c = mapInstance.current.getCenter();
            setIsAddingPoint({ lat: c.lat, lng: c.lng });
          }}
        >
          <Icons.Plus size={32} />
        </button>
      )}
    </div>

);
};

export default App;
