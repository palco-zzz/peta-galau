"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

// TypeScript declarations
declare global {
  interface Window {
    L: any;
  }
}

// Mood categories
const MOOD_CATEGORIES = [
  { id: "heartbreak", emoji: "💔", label: "Patah Hati", color: "#ef4444" },
  { id: "crisis", emoji: "🌑", label: "Krisis Masa Depan", color: "#6366f1" },
  {
    id: "longing",
    emoji: "🍃",
    label: "Rindu yang Tak Sampai",
    color: "#10b981",
  },
];

interface MarkerPoint {
  id: number;
  lat: number;
  lng: number;
  story: string;
  mood: string;
  createdAt: number; // timestamp
  resonance: number; // "I Feel You" count
}

const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456]; // Jakarta
const MAX_CHARS = 100;
const PIN_LIFESPAN_MS = 24 * 60 * 60 * 1000; // 24 hours

// Utility: Fuzz location by 20-50m for privacy
function fuzzLocation(lat: number, lng: number): { lat: number; lng: number } {
  const fuzzRadiusMeters = 20 + Math.random() * 30; // 20-50m
  const earthRadius = 6371000; // meters
  const angle = Math.random() * 2 * Math.PI;
  const deltaLat =
    ((fuzzRadiusMeters * Math.cos(angle)) / earthRadius) * (180 / Math.PI);
  const deltaLng =
    ((fuzzRadiusMeters * Math.sin(angle)) /
      (earthRadius * Math.cos((lat * Math.PI) / 180))) *
    (180 / Math.PI);
  return { lat: lat + deltaLat, lng: lng + deltaLng };
}

// Utility: Calculate pin age (0-1, where 1 is fresh, 0 is expired)
function getPinAge(createdAt: number): number {
  const age = Date.now() - createdAt;
  if (age >= PIN_LIFESPAN_MS) return 0;
  return 1 - age / PIN_LIFESPAN_MS;
}

// Utility: Get time remaining for a pin
function getTimeRemaining(createdAt: number): string {
  const remaining = PIN_LIFESPAN_MS - (Date.now() - createdAt);
  if (remaining <= 0) return "Menghilang...";
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}j ${minutes}m tersisa`;
}

// Inline SVG Icons
const Icons = {
  MapPin: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
  ),
  Heart: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>
  ),
  X: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  ),
  Plus: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  ),
  Volume: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    </svg>
  ),
  VolumeX: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
      <line x1="23" y1="9" x2="17" y2="15"></line>
      <line x1="17" y1="9" x2="23" y2="15"></line>
    </svg>
  ),
  Sun: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  ),
  Moon: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  ),
  Compass: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10"></circle>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
    </svg>
  ),
  Info: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  ),
  Menu: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="3" y1="12" x2="21" y2="12"></line>
      <line x1="3" y1="6" x2="21" y2="6"></line>
      <line x1="3" y1="18" x2="21" y2="18"></line>
    </svg>
  ),
};

export default function App() {
  const [leafletReady, setLeafletReady] = useState(false);
  const [markers, setMarkers] = useState<MarkerPoint[]>(() => {
    // Initialize with demo data
    const now = Date.now();
    return [
      {
        id: 1,
        lat: -6.1754,
        lng: 106.8272,
        story:
          "Di sini janji itu pernah terucap, kini hanya angin yang tersisa.",
        mood: "heartbreak",
        createdAt: now - 2 * 60 * 60 * 1000, // 2 hours ago
        resonance: 42,
      },
      {
        id: 2,
        lat: -6.2297,
        lng: 106.8095,
        story:
          "Hujan turun, dan aku masih menunggu seseorang yang tak akan datang.",
        mood: "longing",
        createdAt: now - 8 * 60 * 60 * 1000, // 8 hours ago
        resonance: 28,
      },
      {
        id: 3,
        lat: -6.189,
        lng: 106.8456,
        story: "Esok adalah misteri yang membuatku tak bisa tidur malam ini.",
        mood: "crisis",
        createdAt: now - 16 * 60 * 60 * 1000, // 16 hours ago
        resonance: 15,
      },
      {
        id: 4,
        lat: -6.215,
        lng: 106.82,
        story: "Kota ini terlalu bising untuk rindu yang sesunyi ini.",
        mood: "longing",
        createdAt: now - 1 * 60 * 60 * 1000, // 1 hour ago
        resonance: 67,
      },
    ];
  });

  const [isAddingPoint, setIsAddingPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MarkerPoint | null>(null);
  const [newStory, setNewStory] = useState("");
  const [selectedMood, setSelectedMood] = useState<string>("heartbreak");
  const [isMuted, setIsMuted] = useState(true);
  const [cityPulseCount, setCityPulseCount] = useState(3421);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [activeNav, setActiveNav] = useState("beranda");
  const [showExploreSidebar, setShowExploreSidebar] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const tileLayerRef = useRef<any>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersGroup = useRef<any>(null);
  const heatLayer = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // City Pulse animation
  useEffect(() => {
    const interval = setInterval(() => {
      setCityPulseCount((prev) => prev + Math.floor(Math.random() * 5) - 2);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup expired pins every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setMarkers((prev) => prev.filter((m) => getPinAge(m.createdAt) > 0));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load Leaflet
  useEffect(() => {
    const checkReady = () => {
      if (window.L && window.L.map) {
        setLeafletReady(true);
      } else {
        setTimeout(checkReady, 100);
      }
    };

    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    if (!document.getElementById("leaflet-js")) {
      const script = document.createElement("script");
      script.id = "leaflet-js";
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = checkReady;
      document.head.appendChild(script);
    } else {
      checkReady();
    }
  }, []);

  // Initialize Map
  useEffect(() => {
    if (leafletReady && mapContainerRef.current && !mapInstance.current) {
      const L = window.L;

      try {
        const m = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView(DEFAULT_CENTER, 13);

        // Initial tile layer based on theme
        const tileUrl = isDarkMode
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

        tileLayerRef.current = L.tileLayer(tileUrl, {
          subdomains: "abcd",
          maxZoom: 20,
        }).addTo(m);

        mapInstance.current = m;
        markersGroup.current = L.layerGroup().addTo(m);

        m.on("click", (e: any) => {
          setIsAddingPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
          setSelectedPoint(null);
        });

        // Adjust audio volume based on zoom
        m.on("zoomend", () => {
          if (audioRef.current && !isMuted) {
            const zoom = m.getZoom();
            const volume = Math.min(0.5, (zoom - 10) * 0.05);
            audioRef.current.volume = Math.max(0.05, volume);
          }
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
  }, [leafletReady, isMuted, isDarkMode]);

  // Update tile layer when theme changes
  useEffect(() => {
    if (mapInstance.current && tileLayerRef.current && window.L) {
      const L = window.L;
      mapInstance.current.removeLayer(tileLayerRef.current);

      const tileUrl = isDarkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

      tileLayerRef.current = L.tileLayer(tileUrl, {
        subdomains: "abcd",
        maxZoom: 20,
      });

      // Add tile layer to the bottom (behind markers)
      tileLayerRef.current.addTo(mapInstance.current);
      tileLayerRef.current.setZIndex(0);
    }
  }, [isDarkMode]);

  // Sync Markers with age-based styling
  useEffect(() => {
    if (leafletReady && markersGroup.current && mapInstance.current) {
      const L = window.L;
      markersGroup.current.clearLayers();

      markers.forEach((point) => {
        const age = getPinAge(point.createdAt);
        if (age <= 0) return; // Skip expired pins

        const mood = MOOD_CATEGORIES.find((m) => m.id === point.mood);
        const glowIntensity = Math.min(1, point.resonance / 50);
        const size = 12 + age * 12; // Size shrinks as pin ages
        const opacity = 0.3 + age * 0.7;

        const customIcon = L.divIcon({
          className: "custom-marker-icon",
          html: `
            <div class="marker-glow" style="
              width: ${size}px;
              height: ${size}px;
              background: ${mood?.color || "#6366f1"};
              opacity: ${opacity};
              box-shadow: 0 0 ${10 + glowIntensity * 30}px ${
            5 + glowIntensity * 15
          }px ${mood?.color || "#6366f1"}60;
              border-radius: 50%;
              border: 2px solid rgba(255,255,255,${0.3 + glowIntensity * 0.5});
              transform: translate(-50%, -50%);
              cursor: pointer;
              transition: all 0.3s ease;
            "></div>
          `,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([point.lat, point.lng], {
          icon: customIcon,
        }).on("click", (e: any) => {
          L.DomEvent.stopPropagation(e);
          setSelectedPoint(point);
          setIsAddingPoint(null);
          mapInstance.current.flyTo([point.lat, point.lng], 16);
        });

        markersGroup.current.addLayer(marker);
      });

      // Create heatmap-like effect using circles
      if (heatLayer.current) {
        mapInstance.current.removeLayer(heatLayer.current);
      }

      heatLayer.current = L.layerGroup();

      // Group markers by proximity and create heat zones
      markers.forEach((point) => {
        const nearbyCount = markers.filter(
          (m) =>
            Math.abs(m.lat - point.lat) < 0.01 &&
            Math.abs(m.lng - point.lng) < 0.01
        ).length;

        if (nearbyCount >= 2) {
          const heatCircle = L.circle([point.lat, point.lng], {
            radius: 200 + nearbyCount * 100,
            fillColor: "#4338ca",
            fillOpacity: 0.1 + nearbyCount * 0.05,
            stroke: false,
          });
          heatLayer.current.addLayer(heatCircle);
        }
      });

      heatLayer.current.addTo(mapInstance.current);
    }
  }, [markers, leafletReady]);

  // Handle "I Feel You" resonance
  const handleResonance = useCallback(() => {
    if (!selectedPoint) return;
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === selectedPoint.id ? { ...m, resonance: m.resonance + 1 } : m
      )
    );
    setSelectedPoint((prev) =>
      prev ? { ...prev, resonance: prev.resonance + 1 } : null
    );
  }, [selectedPoint]);

  // Save new story with location fuzzing
  const handleSaveStory = () => {
    if (!newStory.trim() || !isAddingPoint) return;

    const fuzzedLocation = fuzzLocation(isAddingPoint.lat, isAddingPoint.lng);

    const point: MarkerPoint = {
      id: Date.now(),
      lat: fuzzedLocation.lat,
      lng: fuzzedLocation.lng,
      story: newStory.slice(0, MAX_CHARS),
      mood: selectedMood,
      createdAt: Date.now(),
      resonance: 0,
    };

    setMarkers((prev) => [...prev, point]);
    setIsAddingPoint(null);
    setNewStory("");
    setSelectedMood("heartbreak");
  };

  // Toggle ambient sound
  const toggleSound = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(
        "https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3?filename=please-calm-my-mind-125566.mp3"
      );
      audioRef.current.loop = true;
      audioRef.current.volume = 0.1;
    }

    if (isMuted) {
      audioRef.current.play().catch(console.error);
    } else {
      audioRef.current.pause();
    }
    setIsMuted(!isMuted);
  };

  // Handle navigation click
  const handleNavClick = (navId: string) => {
    setActiveNav(navId);
    setSelectedPoint(null);
    setIsAddingPoint(null);
    setShowMobileMenu(false);

    if (navId === "beranda") {
      setShowExploreSidebar(false);
      setShowAboutModal(false);
    } else if (navId === "jelajah") {
      setShowExploreSidebar(true);
      setShowAboutModal(false);
    } else if (navId === "tentang") {
      setShowExploreSidebar(false);
      setShowAboutModal(true);
    }
  };

  // Select a story from the explore sidebar
  const handleSelectStory = (point: MarkerPoint) => {
    setSelectedPoint(point);
    setShowExploreSidebar(false);
    setActiveNav("beranda");
    if (mapInstance.current) {
      mapInstance.current.flyTo([point.lat, point.lng], 15);
    }
  };

  if (!leafletReady) {
    return (
      <div
        className={`w-full h-screen flex flex-col items-center justify-center font-serif ${
          isDarkMode ? "bg-slate-950" : "bg-slate-50"
        }`}
      >
        <div
          className={`w-10 h-10 border-2 rounded-full animate-spin mb-6 ${
            isDarkMode
              ? "border-indigo-400/30 border-t-indigo-400"
              : "border-indigo-200 border-t-indigo-600"
          }`}
        ></div>
        <p
          className={`text-sm tracking-widest uppercase ${
            isDarkMode ? "text-indigo-300/60" : "text-indigo-600/60"
          }`}
        >
          Membuka peta kenangan...
        </p>
      </div>
    );
  }

  const selectedMoodData = MOOD_CATEGORIES.find(
    (m) => m.id === selectedPoint?.mood
  );

  return (
    <div
      className={`relative w-full h-screen overflow-hidden font-serif transition-colors duration-500 ${
        isDarkMode
          ? "bg-slate-950 text-slate-200"
          : "bg-slate-50 text-slate-800"
      }`}
    >
      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@300;400&display=swap");

        body {
          font-family: "Playfair Display", serif;
          margin: 0;
          padding: 0;
        }

        .font-mono {
          font-family: "JetBrains Mono", monospace;
        }

        .marker-glow {
          animation: breathe 3s ease-in-out infinite;
        }

        @keyframes breathe {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        .glass-dark {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.1);
        }

        .glass-light {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(99, 102, 241, 0.15);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4338ca40;
          border-radius: 10px;
        }

        .leaflet-control-attribution {
          display: none !important;
        }

        .text-glow {
          text-shadow: 0 0 20px currentColor;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 z-0 transition-colors duration-500 ${
          isDarkMode ? "bg-slate-950" : "bg-slate-100"
        }`}
      />

      {/* Gradient Overlays for atmosphere */}
      {isDarkMode && (
        <>
          <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/40" />
          <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-r from-slate-950/30 via-transparent to-slate-950/30" />
        </>
      )}
      {!isDarkMode && (
        <>
          <div className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-t from-white/40 via-transparent to-white/20" />
        </>
      )}

      {/* Pill Navbar */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl">
        <div
          className={`rounded-full px-3 py-2 flex items-center justify-between shadow-xl transition-all duration-300 ${
            isDarkMode
              ? "glass-dark shadow-indigo-500/5"
              : "glass-light shadow-slate-900/10"
          }`}
        >
          {/* Brand */}
          <div className="flex items-center gap-2.5 pl-1">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                isDarkMode
                  ? "bg-indigo-500/20 border border-indigo-400/30"
                  : "bg-indigo-500 shadow-lg"
              }`}
            >
              <Icons.MapPin
                size={18}
                className={isDarkMode ? "text-indigo-400" : "text-white"}
              />
            </div>
            <h1
              className={`text-base font-semibold tracking-wide hidden sm:block ${
                isDarkMode ? "text-white/90" : "text-slate-900"
              }`}
            >
              Titik Galau
            </h1>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { id: "beranda", label: "Beranda", icon: Icons.MapPin },
              { id: "jelajah", label: "Jelajah", icon: Icons.Compass },
              { id: "tentang", label: "Tentang", icon: Icons.Info },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  activeNav === item.id
                    ? isDarkMode
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-indigo-100 text-indigo-700"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1 pr-1">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2.5 rounded-full transition-all ${
                isDarkMode
                  ? "text-amber-300 hover:bg-amber-500/10"
                  : "text-indigo-600 hover:bg-indigo-100"
              }`}
              title={
                isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"
              }
            >
              {isDarkMode ? <Icons.Sun size={18} /> : <Icons.Moon size={18} />}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`md:hidden p-2.5 rounded-full transition-all ${
                isDarkMode
                  ? "text-slate-300 hover:bg-white/5"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
              title="Menu"
            >
              {showMobileMenu ? (
                <Icons.X size={18} />
              ) : (
                <Icons.Menu size={18} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            showMobileMenu ? "max-h-60 mt-2" : "max-h-0"
          }`}
        >
          <div
            className={`rounded-2xl p-2 ${
              isDarkMode ? "bg-slate-800/50" : "bg-white/80"
            }`}
          >
            {[
              {
                id: "beranda",
                label: "Beranda",
                icon: Icons.MapPin,
                desc: "Kembali ke peta",
              },
              {
                id: "jelajah",
                label: "Jelajah",
                icon: Icons.Compass,
                desc: "Lihat semua cerita",
              },
              {
                id: "tentang",
                label: "Tentang",
                icon: Icons.Info,
                desc: "Tentang aplikasi ini",
              },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${
                  activeNav === item.id
                    ? isDarkMode
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-indigo-100 text-indigo-700"
                    : isDarkMode
                    ? "text-slate-300 hover:bg-white/5"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    activeNav === item.id
                      ? isDarkMode
                        ? "bg-indigo-500/30"
                        : "bg-indigo-200"
                      : isDarkMode
                      ? "bg-slate-700/50"
                      : "bg-slate-100"
                  }`}
                >
                  <item.icon size={18} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p
                    className={`text-[10px] ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {item.desc}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Explore Sidebar (Jelajah) */}
      <div
        className={`fixed top-0 left-0 h-full w-full md:w-96 z-30 transition-transform duration-500 ease-out ${
          showExploreSidebar ? "translate-x-0" : "-translate-x-full"
        } ${isDarkMode ? "glass-dark" : "glass-light"}`}
      >
        <div className="p-6 pt-24 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2
                className={`text-xl font-semibold ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Jelajahi Cerita
              </h2>
              <p
                className={`text-xs font-mono mt-1 ${
                  isDarkMode ? "text-indigo-300/50" : "text-indigo-600/60"
                }`}
              >
                {markers.length} titik kegalauan aktif
              </p>
            </div>
            <button
              onClick={() => {
                setShowExploreSidebar(false);
                setActiveNav("beranda");
              }}
              className={`p-2 rounded-lg transition-colors ${
                isDarkMode
                  ? "text-slate-400 hover:text-white hover:bg-white/5"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icons.X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {markers.length === 0 ? (
              <div
                className={`text-center py-12 ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                <Icons.MapPin size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-sm">Belum ada cerita</p>
              </div>
            ) : (
              markers
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((point) => {
                  const mood = MOOD_CATEGORIES.find((m) => m.id === point.mood);
                  return (
                    <button
                      key={point.id}
                      onClick={() => handleSelectStory(point)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        isDarkMode
                          ? "bg-slate-800/30 border-slate-700/30 hover:bg-slate-700/50"
                          : "bg-white/50 border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span className="text-lg">{mood?.emoji}</span>
                        <span
                          className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full ${
                            isDarkMode
                              ? "bg-indigo-500/20 text-indigo-300"
                              : "bg-indigo-100 text-indigo-600"
                          }`}
                        >
                          {getTimeRemaining(point.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`text-sm italic leading-relaxed mb-2 ${
                          isDarkMode ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        &quot;{point.story}&quot;
                      </p>
                      <div className="flex items-center gap-2">
                        <Icons.Heart
                          size={12}
                          className={
                            isDarkMode ? "text-rose-400/60" : "text-rose-500/60"
                          }
                        />
                        <span
                          className={`text-[10px] font-mono ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          {point.resonance} resonansi
                        </span>
                      </div>
                    </button>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* About Modal (Tentang) */}
      {showAboutModal && (
        <div
          className={`fixed inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm ${
            isDarkMode ? "bg-slate-950/80" : "bg-slate-900/30"
          }`}
        >
          <div
            className={`w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up ${
              isDarkMode ? "glass-dark" : "bg-white"
            }`}
          >
            <div
              className={`p-6 border-b ${
                isDarkMode ? "border-indigo-500/10" : "border-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isDarkMode ? "bg-indigo-500/20" : "bg-indigo-500"
                    }`}
                  >
                    <Icons.MapPin
                      size={20}
                      className={isDarkMode ? "text-indigo-400" : "text-white"}
                    />
                  </div>
                  <div>
                    <h3
                      className={`text-lg font-semibold ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Tentang Titik Galau
                    </h3>
                    <p
                      className={`text-xs font-mono ${
                        isDarkMode ? "text-indigo-300/50" : "text-indigo-600/60"
                      }`}
                    >
                      Peta Kenangan Digital
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAboutModal(false);
                    setActiveNav("beranda");
                  }}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Icons.X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <p
                className={`leading-relaxed ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                <strong
                  className={isDarkMode ? "text-white" : "text-slate-900"}
                >
                  Titik Galau
                </strong>{" "}
                adalah ruang anonim untuk menitipkan rasa di peta. Sebuah tempat
                di mana kegalauan bisa menjadi puisi singkat yang terhubung
                dengan lokasi dan waktu.
              </p>

              <div className="space-y-3">
                <h4
                  className={`text-sm font-semibold uppercase tracking-widest ${
                    isDarkMode ? "text-indigo-400" : "text-indigo-600"
                  }`}
                >
                  Cara Menggunakan
                </h4>
                <div className="space-y-2">
                  {[
                    {
                      emoji: "📍",
                      text: "Ketuk peta untuk menitipkan ceritamu",
                    },
                    {
                      emoji: "💬",
                      text: "Tulis dalam 100 karakter—singkat, seperti puisi",
                    },
                    {
                      emoji: "🔒",
                      text: "Lokasimu diacak 20-50m untuk privasi",
                    },
                    {
                      emoji: "⏳",
                      text: "Cerita akan menghilang dalam 24 jam",
                    },
                    { emoji: "💜", text: "Tekan 'I Feel You' untuk resonansi" },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        isDarkMode ? "bg-slate-800/30" : "bg-slate-50"
                      }`}
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <span
                        className={`text-sm ${
                          isDarkMode ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className={`text-center pt-4 border-t ${
                  isDarkMode ? "border-slate-800" : "border-slate-100"
                }`}
              >
                <p
                  className={`text-[10px] font-mono uppercase tracking-widest ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Dibuat dengan 💔 untuk mereka yang sedang tidak baik-baik saja
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* City Pulse Stats */}
      <div
        className={`absolute bottom-6 left-6 z-10 rounded-xl px-4 py-3 max-w-xs ${
          isDarkMode ? "glass-dark" : "glass-light"
        }`}
      >
        <p
          className={`text-[11px] font-mono uppercase tracking-widest mb-1 ${
            isDarkMode ? "text-indigo-300/50" : "text-indigo-600/50"
          }`}
        >
          Jakarta • {isDarkMode ? "Malam Ini" : "Hari Ini"}
        </p>
        <p
          className={`text-sm leading-relaxed ${
            isDarkMode ? "text-slate-300/80" : "text-slate-600"
          }`}
        >
          <span
            className={`font-semibold ${
              isDarkMode ? "text-indigo-400 text-glow" : "text-indigo-600"
            }`}
          >
            {cityPulseCount.toLocaleString()}
          </span>{" "}
          orang sedang merasa tidak baik-baik saja.
        </p>
      </div>

      {/* Hint */}
      {!selectedPoint && !isAddingPoint && (
        <div
          className={`absolute bottom-6 right-6 z-10 rounded-full px-4 py-2.5 flex items-center gap-3 ${
            isDarkMode ? "glass-dark" : "glass-light"
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full animate-pulse ${
              isDarkMode ? "bg-indigo-400" : "bg-indigo-500"
            }`}
          />
          <span
            className={`text-[10px] font-mono uppercase tracking-widest ${
              isDarkMode ? "text-indigo-300/60" : "text-indigo-600/60"
            }`}
          >
            Ketuk peta untuk menitipkan rasa
          </span>
        </div>
      )}

      {/* Mobile Add Button */}
      {!isAddingPoint && !selectedPoint && (
        <button
          className="md:hidden absolute bottom-24 right-6 z-10 w-14 h-14 bg-indigo-600/80 text-white rounded-full shadow-2xl shadow-indigo-500/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
          onClick={() => {
            if (mapInstance.current) {
              const c = mapInstance.current.getCenter();
              setIsAddingPoint({ lat: c.lat, lng: c.lng });
            }
          }}
        >
          <Icons.Plus size={24} />
        </button>
      )}

      {/* Add Story Modal */}
      {isAddingPoint && (
        <div
          className={`absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-sm ${
            isDarkMode ? "bg-slate-950/70" : "bg-slate-900/30"
          }`}
        >
          <div
            className={`w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up ${
              isDarkMode ? "glass-dark" : "bg-white"
            }`}
          >
            <div
              className={`p-6 border-b ${
                isDarkMode ? "border-indigo-500/10" : "border-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3
                  className={`text-lg font-semibold ${
                    isDarkMode ? "text-white/90" : "text-slate-900"
                  }`}
                >
                  Titipkan Rasamu
                </h3>
                <button
                  onClick={() => setIsAddingPoint(null)}
                  className={`transition-colors ${
                    isDarkMode
                      ? "text-slate-400 hover:text-white"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <Icons.X size={20} />
                </button>
              </div>
              <p
                className={`text-xs font-mono mt-1 ${
                  isDarkMode ? "text-indigo-300/50" : "text-indigo-600/60"
                }`}
              >
                Lokasi akan diacak untuk privasimu
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Mood Selection */}
              <div className="flex gap-2">
                {MOOD_CATEGORIES.map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => setSelectedMood(mood.id)}
                    className={`flex-1 py-3 rounded-xl text-center transition-all border ${
                      selectedMood === mood.id
                        ? isDarkMode
                          ? "bg-indigo-600/30 border-indigo-500/50"
                          : "bg-indigo-100 border-indigo-300"
                        : isDarkMode
                        ? "bg-slate-800/50 border-slate-700/30 hover:bg-slate-700/50"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-xl">{mood.emoji}</span>
                    <p
                      className={`text-[10px] font-mono mt-1 uppercase tracking-wider ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {mood.label}
                    </p>
                  </button>
                ))}
              </div>

              {/* Story Input */}
              <div className="relative">
                <textarea
                  rows={3}
                  maxLength={MAX_CHARS}
                  placeholder="Tulis kegalauanmu dalam 100 karakter..."
                  className={`w-full p-4 rounded-xl border transition-all outline-none resize-none font-serif text-sm ${
                    isDarkMode
                      ? "bg-slate-800/50 border-slate-700/30 focus:border-indigo-500/50 text-slate-200 placeholder:text-slate-500"
                      : "bg-slate-50 border-slate-200 focus:border-indigo-400 text-slate-900 placeholder:text-slate-400"
                  }`}
                  value={newStory}
                  onChange={(e) => setNewStory(e.target.value)}
                />
                <span
                  className={`absolute bottom-3 right-3 text-[10px] font-mono ${
                    newStory.length >= MAX_CHARS
                      ? "text-red-400"
                      : isDarkMode
                      ? "text-slate-500"
                      : "text-slate-400"
                  }`}
                >
                  {newStory.length}/{MAX_CHARS}
                </span>
              </div>

              <button
                onClick={handleSaveStory}
                disabled={!newStory.trim()}
                className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Lepaskan ke Peta
              </button>

              <p
                className={`text-[10px] text-center font-mono ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                Pin akan menghilang dalam 24 jam
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Story Detail Card */}
      {selectedPoint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md animate-fade-in-up">
          <div
            className={`rounded-2xl p-6 relative ${
              isDarkMode ? "glass-dark" : "glass-light"
            }`}
          >
            <button
              onClick={() => setSelectedPoint(null)}
              className={`absolute top-4 right-4 transition-colors ${
                isDarkMode
                  ? "text-slate-500 hover:text-white"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icons.X size={18} />
            </button>

            {/* Mood & Time */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{selectedMoodData?.emoji}</span>
              <div>
                <p
                  className={`text-[10px] font-mono uppercase tracking-widest ${
                    isDarkMode ? "text-indigo-400/60" : "text-indigo-600/80"
                  }`}
                >
                  {selectedMoodData?.label}
                </p>
                <p
                  className={`text-[10px] font-mono ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {getTimeRemaining(selectedPoint.createdAt)}
                </p>
              </div>
            </div>

            {/* Story */}
            <p
              className={`text-lg leading-relaxed italic mb-6 ${
                isDarkMode ? "text-slate-200" : "text-slate-700"
              }`}
            >
              &quot;{selectedPoint.story}&quot;
            </p>

            {/* Actions */}
            <div
              className={`flex items-center justify-between pt-4 border-t ${
                isDarkMode ? "border-indigo-500/10" : "border-slate-200"
              }`}
            >
              <button
                onClick={handleResonance}
                className={`flex items-center gap-2 transition-all group ${
                  isDarkMode
                    ? "text-slate-400 hover:text-rose-400"
                    : "text-slate-500 hover:text-rose-500"
                }`}
              >
                <div
                  className={`p-2 rounded-lg transition-all ${
                    isDarkMode
                      ? "bg-slate-800/50 group-hover:bg-rose-500/10"
                      : "bg-slate-100 group-hover:bg-rose-100"
                  }`}
                >
                  <Icons.Heart size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold">I Feel You</p>
                  <p
                    className={`text-[10px] font-mono ${
                      isDarkMode ? "text-slate-500" : "text-slate-400"
                    }`}
                  >
                    {selectedPoint.resonance} resonansi
                  </p>
                </div>
              </button>

              <div className="text-right">
                <div
                  className="w-3 h-3 rounded-full mx-auto mb-1"
                  style={{
                    backgroundColor: selectedMoodData?.color,
                    boxShadow: `0 0 ${10 + selectedPoint.resonance / 5}px ${
                      selectedMoodData?.color
                    }`,
                  }}
                />
                <p
                  className={`text-[9px] font-mono uppercase ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Glow Level
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
