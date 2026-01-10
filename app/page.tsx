"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { storiesApi, statsApi } from "@/lib/api";
import type { Story } from "@/lib/types";

// TypeScript declarations
declare global {
  interface Window {
    L: any;
  }
}

// ============================================
// DATA STRUCTURES FOR ALL FEATURES
// ============================================

// Whisper - anonymous message to a pin
interface Whisper {
  id: number;
  message: string;
  createdAt: number;
}

// Badge - achievement system
interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  unlockedAt?: number;
}

// Enhanced MarkerPoint with all feature support
interface MarkerPoint {
  id: number;
  lat: number;
  lng: number;
  story: string;
  mood: string;
  createdAt: number;
  resonance: number;
  whispers: Whisper[]; // Feature 1: Whisper Mode
  customColor?: string; // Feature 5: Color Your Mood
  timeCapsuleDate?: number; // Feature 10: Time Capsule (when to reveal)
  isTimeCapsule?: boolean; // Feature 10: Is this a time capsule?
  healingStatus?: "struggling" | "healing" | "healed"; // Feature 12: Healing Progress
  healingNote?: string; // Feature 12: Update note
  promptId?: string; // Feature 9: Which prompt inspired this
}

// Mood categories with extended properties
const MOOD_CATEGORIES = [
  {
    id: "heartbreak",
    emoji: "💔",
    label: "Di-ghosting",
    color: "#ef4444",
    sound: "sad-piano",
  },
  {
    id: "crisis",
    emoji: "🌑",
    label: "Quarter Life Crisis",
    color: "#6366f1",
    sound: "ambient-dark",
  },
  {
    id: "longing",
    emoji: "🍃",
    label: "Kangen Mantan",
    color: "#10b981",
    sound: "acoustic-gentle",
  },
  {
    id: "hope",
    emoji: "🌅",
    label: "Healing Era",
    color: "#f59e0b",
    sound: "uplifting",
  },
  {
    id: "grateful",
    emoji: "🙏",
    label: "Grateful Banget",
    color: "#8b5cf6",
    sound: "peaceful",
  },
];

// Daily Prompts - Feature 9
const DAILY_PROMPTS = [
  {
    id: "p1",
    text: "Hal yang pengen lo omongin tapi gak pernah kesampaian?",
    emoji: "💬",
  },
  {
    id: "p2",
    text: "Spot mana yang bikin lo auto inget dia?",
    emoji: "📍",
  },
  {
    id: "p3",
    text: "Kalau bisa rewind, momen mana yang pengen lo ulang?",
    emoji: "⏳",
  },
  {
    id: "p4",
    text: "Apa sih yang bikin lo anxious tentang masa depan?",
    emoji: "🌑",
  },
  { id: "p5", text: "Siapa yang lo kangenin malem ini?", emoji: "🌙" },
  {
    id: "p6",
    text: "Hal kecil apa yang bikin lo senyum hari ini?",
    emoji: "😊",
  },
  {
    id: "p7",
    text: "Kasih satu message buat diri lo 5 tahun lalu.",
    emoji: "✉️",
  },
];

// Badge Definitions - Feature 8
const BADGE_DEFINITIONS: Badge[] = [
  {
    id: "night_owl",
    name: "Night Owl",
    emoji: "🦉",
    description: "Drop cerita pas lagi insomnia mode",
  },
  {
    id: "heartbreak_survivor",
    name: "Heartbreak Survivor",
    emoji: "💔",
    description: "Dapet 5 resonansi di cerita patah hati",
  },
  {
    id: "constellation_maker",
    name: "Constellation Maker",
    emoji: "✨",
    description: "Pin cerita di 5 spot berbeda",
  },
  {
    id: "whisper_angel",
    name: "Whisper Angel",
    emoji: "👼",
    description: "Udah kirim 10 whisper ke random people",
  },
  {
    id: "healer",
    name: "Healer",
    emoji: "🌱",
    description: "Level up ke 'Udah Move On'",
  },
  {
    id: "time_traveler",
    name: "Time Traveler",
    emoji: "⏰",
    description: "Bikin time capsule pertama",
  },
  {
    id: "empath",
    name: "Empath",
    emoji: "💜",
    description: "Kasih 50 resonansi total, so wholesome",
  },
  {
    id: "storyteller",
    name: "Storyteller",
    emoji: "📖",
    description: "Nulis 10 cerita, rajin banget!",
  },
];

const DEFAULT_CENTER: [number, number] = [-6.2088, 106.8456]; // Jakarta
const MAX_CHARS = 100;
const MAX_WHISPER_CHARS = 50;
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

// Utility: Map API story to internal MarkerPoint
const mapStoryToMarker = (story: Story): MarkerPoint => ({
  id: story.id,
  lat: story.lat,
  lng: story.lng,
  story: story.story,
  mood: story.mood,
  createdAt: new Date(story.createdAt).getTime(),
  resonance: story.resonance,
  whispers: story.whispers.map((w) => ({
    id: w.id,
    message: w.message,
    createdAt: new Date(w.createdAt).getTime(),
  })),
  customColor: story.customColor || undefined,
  healingStatus: story.healingStatus,
  healingNote: story.healingNote || undefined,
  promptId: story.promptId || undefined,
  isTimeCapsule: story.isTimeCapsule,
  timeCapsuleDate: story.timeCapsuleDate
    ? new Date(story.timeCapsuleDate).getTime()
    : undefined,
});

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
  Sparkles: ({ size = 24, className = "" }) => (
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
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path>
      <path d="M5 3v4"></path>
      <path d="M19 17v4"></path>
      <path d="M3 5h4"></path>
      <path d="M17 19h4"></path>
    </svg>
  ),
  Check: ({ size = 24, className = "" }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  ),
  Send: ({ size = 24, className = "" }) => (
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
      <path d="m22 2-7 20-4-9-9-4Z"></path>
      <path d="M22 2 11 13"></path>
    </svg>
  ),
  Clock: ({ size = 24, className = "" }) => (
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
      <polyline points="12 6 12 12 16 14"></polyline>
    </svg>
  ),
  ChevronRight: ({ size = 24, className = "" }) => (
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
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  ),
  Feather: ({ size = 24, className = "" }) => (
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
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path>
      <line x1="16" y1="8" x2="2" y2="22"></line>
      <line x1="17.5" y1="15" x2="9" y2="15"></line>
    </svg>
  ),
};

export default function App() {
  const [leafletReady, setLeafletReady] = useState(false);
  const [markers, setMarkers] = useState<MarkerPoint[]>([]);

  // Load data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stories, stats] = await Promise.all([
          storiesApi.getAll(),
          statsApi.get(),
        ]);

        const mappedStories = stories.map(mapStoryToMarker);
        setMarkers(mappedStories);
        setCityPulseCount(stats.cityPulseCount);
        setTopCity(stats.topCity);

        // Map API moodWeather with mood metadata for display
        const enrichedMoodWeather = stats.moodWeather
          .map((item) => ({
            ...item,
            ...MOOD_CATEGORIES.find((c) => c.id === item.mood),
          }))
          .sort((a, b) => b.percentage - a.percentage);
        setApiMoodWeather(enrichedMoodWeather);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };

    fetchData();
    // Refresh stats every 10 seconds for real-time feel
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Core UI States
  const [isAddingPoint, setIsAddingPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<MarkerPoint | null>(null);
  const [newStory, setNewStory] = useState("");
  const [selectedMood, setSelectedMood] = useState<string>("heartbreak");
  const [isMuted, setIsMuted] = useState(true);
  const [cityPulseCount, setCityPulseCount] = useState(0);
  const [topCity, setTopCity] = useState("Indonesia");
  const [apiMoodWeather, setApiMoodWeather] = useState<
    Array<{
      mood: string;
      count: number;
      percentage: number;
      id?: string;
      emoji?: string;
      label?: string;
      color?: string;
    }>
  >([]);
  const isDarkMode = false; // Light mode only
  const [activeNav, setActiveNav] = useState("beranda");
  const [showExploreSidebar, setShowExploreSidebar] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info" | "error";
  } | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isFirstVisit, setIsFirstVisit] = useState(true);

  // Feature 1: Whisper Mode
  const [whisperInput, setWhisperInput] = useState("");
  const [showWhisperInput, setShowWhisperInput] = useState(false);

  // Feature 2: Constellation View
  const [showConstellation, setShowConstellation] = useState(false);

  // Feature 3: Memory Lane (Timeline View)
  const [viewMode, setViewMode] = useState<"map" | "timeline" | "heatmap">(
    "map"
  );

  // Feature 5: Custom Color
  const [customColor, setCustomColor] = useState<string | null>(null);

  // Feature 7: Mood Weather - Use API data for real-time stats from ALL users
  // Fallback to local computation if API data is not available yet
  const localMoodWeather = useMemo(() => {
    const moodCounts = markers.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const total = markers.length || 1;
    return Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        percentage: Math.round((count / total) * 100),
        ...MOOD_CATEGORIES.find((c) => c.id === mood),
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [markers]);

  // Use API moodWeather if available, otherwise fallback to local
  const moodWeather =
    apiMoodWeather.length > 0 ? apiMoodWeather : localMoodWeather;

  // Feature 8: Badges
  const [unlockedBadges, setUnlockedBadges] = useState<string[]>(["night_owl"]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  // Feature 9: Daily Prompt
  const dailyPrompt = useMemo(() => {
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86400000
    );
    return DAILY_PROMPTS[dayOfYear % DAILY_PROMPTS.length];
  }, []);
  const [usePrompt, setUsePrompt] = useState(false);

  // Feature 10: Time Capsule
  const [isTimeCapsule, setIsTimeCapsule] = useState(false);
  const [timeCapsuleDays, setTimeCapsuleDays] = useState(30);

  // Feature 12: Healing Progress
  const [showHealingUpdate, setShowHealingUpdate] = useState(false);

  // Feature 14: Share Card
  const [showShareCard, setShowShareCard] = useState(false);

  // Refs
  const lightTileLayerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersGroup = useRef<any>(null);
  const heatLayer = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const constellationLayer = useRef<any>(null);
  const mapInitialized = useRef(false);

  // Show toast notification
  const showToast = useCallback(
    (message: string, type: "success" | "info" | "error" = "info") => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  // Dismiss first visit hint after interaction
  useEffect(() => {
    const timer = setTimeout(() => setIsFirstVisit(false), 8000);
    return () => clearTimeout(timer);
  }, []);

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
    // Guard: Only initialize once
    if (!leafletReady || !mapContainerRef.current || mapInitialized.current) {
      return;
    }

    const L = window.L;

    try {
      // Double check the container doesn't already have a map
      if (mapInstance.current) {
        return;
      }

      const m = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 2, // Prevent zooming out too far
        maxZoom: 20,
        worldCopyJump: true, // Seamlessly jump when crossing the dateline (like Google Maps)
        // Only limit vertical bounds - allow horizontal continuous scroll
        maxBounds: [
          [-90, -Infinity], // Allow infinite horizontal scroll
          [90, Infinity],
        ],
        maxBoundsViscosity: 1.0, // Strict vertical bounds
      }).setView(DEFAULT_CENTER, 13);

      mapInstance.current = m;
      mapInitialized.current = true;
      markersGroup.current = L.layerGroup().addTo(m);

      // Light mode only - use light tile layer
      lightTileLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          subdomains: "abcd",
          maxZoom: 20,
          minZoom: 2,
          attribution: "&copy; OpenStreetMap &copy; CARTO",
        }
      ).addTo(m);

      m.on("click", (e: any) => {
        setIsAddingPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
        setSelectedPoint(null);
      });

      // Adjust audio volume based on zoom
      m.on("zoomend", () => {
        if (audioRef.current) {
          const zoom = m.getZoom();
          const volume = Math.min(0.5, (zoom - 10) * 0.05);
          audioRef.current.volume = Math.max(0.05, volume);
        }
      });
    } catch (err) {
      console.error("Map initialization failed", err);
    }

    // Cleanup only on unmount
    return () => {
      if (mapInstance.current && mapInitialized.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        mapInitialized.current = false;
        lightTileLayerRef.current = null;
        markersGroup.current = null;
      }
    };
  }, [leafletReady]);

  // Light mode only - no theme toggle needed

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

        // Use custom color if set, otherwise use mood color
        const markerColor = point.customColor || mood?.color || "#6366f1";

        const customIcon = L.divIcon({
          className: "custom-marker-icon",
          html: `
            <div class="relative flex items-center justify-center w-full h-full group">
              <div class="absolute w-[300%] h-[300%] rounded-full opacity-40 animate-pulse" style="
                background: radial-gradient(circle, ${markerColor}40 0%, transparent 70%);
              "></div>
              <div class="relative rounded-full shadow-[0_0_15px_${markerColor}] transition-all duration-300 group-hover:scale-125 group-hover:shadow-[0_0_25px_${markerColor}]" style="
                width: ${size}px;
                height: ${size}px;
                background: ${markerColor};
                border: 2px solid white;
                box-shadow: 0 0 10px ${markerColor};
              "></div>
            </div>
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

      // Feature 2: Constellation Effect - Connect markers with same mood
      if (constellationLayer.current) {
        mapInstance.current.removeLayer(constellationLayer.current);
      }

      if (showConstellation) {
        constellationLayer.current = L.layerGroup();

        // Group markers by mood
        const moodGroups: Record<string, MarkerPoint[]> = {};
        markers.forEach((m) => {
          if (!moodGroups[m.mood]) moodGroups[m.mood] = [];
          moodGroups[m.mood].push(m);
        });

        // Draw lines between markers of same mood
        Object.entries(moodGroups).forEach(([mood, points]) => {
          if (points.length < 2) return;

          const moodColor =
            MOOD_CATEGORIES.find((c) => c.id === mood)?.color || "#6366f1";

          // Connect each point to its nearest neighbor of same mood
          points.forEach((point, i) => {
            // Find nearest point
            let nearestDist = Infinity;
            let nearestPoint: MarkerPoint | null = null;

            points.forEach((other, j) => {
              if (i === j) return;
              const dist = Math.sqrt(
                Math.pow(point.lat - other.lat, 2) +
                  Math.pow(point.lng - other.lng, 2)
              );
              if (dist < nearestDist && dist < 0.05) {
                // Max distance ~5km
                nearestDist = dist;
                nearestPoint = other;
              }
            });

            if (nearestPoint) {
              const np = nearestPoint as MarkerPoint;
              const line = L.polyline(
                [
                  [point.lat, point.lng],
                  [np.lat, np.lng],
                ],
                {
                  color: moodColor,
                  weight: 1.5,
                  opacity: 0.4,
                  dashArray: "5, 10",
                  className: "constellation-line",
                }
              );
              constellationLayer.current.addLayer(line);
            }
          });
        });

        constellationLayer.current.addTo(mapInstance.current);
      }
    }
  }, [markers, leafletReady, showConstellation]);

  // Handle "I Feel You" resonance
  const handleResonance = useCallback(async () => {
    if (!selectedPoint) return;

    // Optimistic update
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === selectedPoint.id ? { ...m, resonance: m.resonance + 1 } : m
      )
    );
    setSelectedPoint((prev) =>
      prev ? { ...prev, resonance: prev.resonance + 1 } : null
    );

    try {
      await storiesApi.addResonance(selectedPoint.id);
      showToast("💜 Resonansi terkirim", "success");
    } catch (error) {
      console.error(error);
      // Revert if needed
    }
  }, [selectedPoint, showToast]);

  // Feature 1: Send Whisper
  const handleSendWhisper = useCallback(async () => {
    if (!selectedPoint || !whisperInput.trim()) return;

    const optimisticWhisper: Whisper = {
      id: Date.now(), // Temp ID
      message: whisperInput.slice(0, MAX_WHISPER_CHARS),
      createdAt: Date.now(),
    };

    // Optimistic update
    setMarkers((prev) =>
      prev.map((m) =>
        m.id === selectedPoint.id
          ? { ...m, whispers: [optimisticWhisper, ...m.whispers] }
          : m
      )
    );

    setSelectedPoint((prev) =>
      prev ? { ...prev, whispers: [optimisticWhisper, ...prev.whispers] } : null
    );

    setWhisperInput("");
    setShowWhisperInput(false);

    try {
      await storiesApi.addWhisper(selectedPoint.id, {
        message: whisperInput.slice(0, MAX_WHISPER_CHARS),
      });
      showToast("💬 Whisper terkirim secara anonim", "success");
    } catch (error) {
      console.error(error);
      showToast("Gagal mengirim whisper", "error");
    }
  }, [selectedPoint, whisperInput, showToast]);

  // Feature 12: Update Healing Status
  const handleUpdateHealing = useCallback(
    async (status: "struggling" | "healing" | "healed", note?: string) => {
      if (!selectedPoint) return;

      // Optimistic API Call preparation
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === selectedPoint.id
            ? { ...m, healingStatus: status, healingNote: note }
            : m
        )
      );

      setSelectedPoint((prev) =>
        prev ? { ...prev, healingStatus: status, healingNote: note } : null
      );

      setShowHealingUpdate(false);

      if (status === "healed") {
        showToast("🌱 Selamat! Kamu sudah sembuh", "success");
        // Unlock healer badge
        if (!unlockedBadges.includes("healer")) {
          setUnlockedBadges((prev) => [...prev, "healer"]);
          setTimeout(
            () => showToast("🏆 Badge baru: Healer!", "success"),
            1500
          );
        }
      } else {
        showToast("Status berhasil diupdate", "info");
      }

      try {
        await storiesApi.update(selectedPoint.id, {
          healingStatus: status,
          healingNote: note,
        });
      } catch (error) {
        console.error(error);
        showToast("Gagal update status di server", "error");
      }
    },
    [selectedPoint, showToast, unlockedBadges]
  );

  // Save new story with location fuzzing
  const handleSaveStory = async () => {
    if (!newStory.trim() || !isAddingPoint) return;

    const fuzzedLocation = fuzzLocation(isAddingPoint.lat, isAddingPoint.lng);
    const now = Date.now();

    // Prepare API payload
    const payload: any = {
      lat: fuzzedLocation.lat,
      lng: fuzzedLocation.lng,
      story: newStory.slice(0, MAX_CHARS),
      mood: selectedMood,
      customColor: customColor || undefined,
      isTimeCapsule: isTimeCapsule,
      timeCapsuleDays: isTimeCapsule ? timeCapsuleDays : undefined,
      promptId: usePrompt ? dailyPrompt.id : undefined,
    };

    setIsAddingPoint(null);
    setNewStory("");
    setSelectedMood("heartbreak");
    setCustomColor(null);
    setUsePrompt(false);
    setIsTimeCapsule(false);

    // Show success animation
    setShowSuccessAnimation(true);
    setTimeout(() => setShowSuccessAnimation(false), 2000);

    // Show toast
    showToast(
      isTimeCapsule
        ? `⏳ Time capsule akan muncul dalam ${timeCapsuleDays} hari`
        : "✨ Ceritamu telah dilepaskan ke peta",
      "success"
    );

    try {
      const createdStory = await storiesApi.create(payload);
      const mappedStory = mapStoryToMarker(createdStory);

      setMarkers((prev) => [mappedStory, ...prev]);

      // Fly to the new pin
      if (mapInstance.current && !isTimeCapsule) {
        setTimeout(() => {
          mapInstance.current.flyTo([mappedStory.lat, mappedStory.lng], 15, {
            duration: 1,
          });
        }, 300);
      }
    } catch (error) {
      console.error(error);
      showToast("Gagal menyimpan cerita", "error");
    }

    // Check for night owl badge
    const currentHour = new Date().getHours();
    if (
      currentHour >= 0 &&
      currentHour < 6 &&
      !unlockedBadges.includes("night_owl")
    ) {
      setUnlockedBadges((prev) => [...prev, "night_owl"]);
      setTimeout(() => showToast("🦉 Badge baru: Night Owl!", "success"), 2000);
    }

    // Check for time traveler badge
    if (isTimeCapsule && !unlockedBadges.includes("time_traveler")) {
      setUnlockedBadges((prev) => [...prev, "time_traveler"]);
      setTimeout(
        () => showToast("⏰ Badge baru: Time Traveler!", "success"),
        2000
      );
    }
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
        className={`w-full h-screen flex flex-col items-center justify-center ${
          isDarkMode ? "bg-[#0a0a0f]" : "bg-slate-50"
        }`}
      >
        {/* Ambient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="ambient-glow ambient-glow-1" />
          <div className="ambient-glow ambient-glow-2" />
        </div>

        {/* Loading content */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="relative mb-8">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse ${
                isDarkMode
                  ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30"
                  : "bg-gradient-to-br from-indigo-500 to-purple-600"
              }`}
            >
              <Icons.MapPin
                size={28}
                className={isDarkMode ? "text-indigo-400" : "text-white"}
              />
            </div>
            <div className="absolute -inset-4 rounded-3xl bg-indigo-500/20 animate-ping opacity-75" />
          </div>

          <h1
            className={`text-2xl font-bold mb-2 ${
              isDarkMode ? "text-white" : "text-slate-900"
            }`}
          >
            Titik Galau
          </h1>
          <p
            className={`text-sm tracking-widest uppercase ${
              isDarkMode ? "text-indigo-300/60" : "text-indigo-600/60"
            }`}
          >
            Membuka peta kenangan...
          </p>
        </div>
      </div>
    );
  }

  const selectedMoodData = MOOD_CATEGORIES.find(
    (m) => m.id === selectedPoint?.mood
  );

  return (
    <div
      className={`relative w-full h-screen overflow-hidden transition-colors duration-700 ${
        isDarkMode
          ? "bg-[#0a0a0f] text-slate-200"
          : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* Ambient Background Glows */}
      {isDarkMode && (
        <>
          <div className="ambient-glow ambient-glow-1" />
          <div className="ambient-glow ambient-glow-2" />
        </>
      )}

      {/* Noise Texture Overlay */}
      <div className="noise-overlay" />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div
            className={`px-6 py-3 rounded-full backdrop-blur-xl shadow-2xl flex items-center gap-3 ${
              toast.type === "success"
                ? isDarkMode
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-200"
                  : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : toast.type === "error"
                ? isDarkMode
                  ? "bg-red-500/20 border border-red-500/30 text-red-200"
                  : "bg-red-50 border border-red-200 text-red-800"
                : isDarkMode
                ? "bg-white/10 border border-white/20 text-white"
                : "bg-white border border-slate-200 text-slate-800"
            }`}
          >
            {toast.type === "success" && (
              <Icons.Check size={18} className="text-emerald-400" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Success Animation Overlay */}
      {showSuccessAnimation && (
        <div className="fixed inset-0 z-[90] pointer-events-none flex items-center justify-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center animate-in zoom-in-50 duration-500">
              <Icons.Check size={48} className="text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping" />
          </div>
        </div>
      )}

      {/* Map Container */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-0 z-0 ${
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

      {/* Pill Navbar - Apple Style Dynamic Island feel */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-[95%] max-w-2xl animate-in slide-in-from-top-6 duration-700 fade-in">
        <div
          className={`rounded-full px-2 py-2 pl-3 flex items-center justify-between transition-all duration-300 ${
            isDarkMode ? "glass-panel" : "glass-panel-light"
          }`}
        >
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                isDarkMode
                  ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
                  : "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              }`}
            >
              <Icons.MapPin size={18} className="" />
            </div>
            <h1
              className={`text-base font-medium tracking-tight hidden sm:block ${
                isDarkMode ? "text-white" : "text-slate-900"
              }`}
            >
              Titik Galau
            </h1>
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center bg-black/5 dark:bg-white/5 rounded-full p-1 mx-2">
            {[
              { id: "beranda", label: "Beranda", icon: Icons.MapPin },
              { id: "jelajah", label: "Jelajah", icon: Icons.Compass },
              { id: "tentang", label: "Tentang", icon: Icons.Info },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 relative group overflow-hidden ${
                  activeNav === item.id
                    ? isDarkMode
                      ? "text-white bg-white/10 shadow-sm"
                      : "bg-white text-slate-900 shadow-sm"
                    : isDarkMode
                    ? "text-slate-400 hover:text-white hover:bg-white/5"
                    : "text-slate-500 hover:text-slate-900 hover:bg-black/5"
                }`}
              >
                <item.icon
                  size={16}
                  className={`transition-transform duration-300 ${
                    activeNav === item.id
                      ? "scale-110"
                      : "group-hover:scale-110"
                  }`}
                />
                {item.label}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pr-1">
            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className={`md:hidden w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                isDarkMode
                  ? "text-slate-200 hover:bg-white/10"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              title="Menu"
            >
              {showMobileMenu ? (
                <Icons.X size={20} />
              ) : (
                <Icons.Menu size={20} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            showMobileMenu
              ? "max-h-80 opacity-100 translate-y-2"
              : "max-h-0 opacity-0 -translate-y-2"
          }`}
        >
          <div
            className={`rounded-3xl p-3 backdrop-blur-3xl border border-white/10 shadow-2xl ${
              isDarkMode ? "bg-slate-900/90" : "bg-white/90"
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
                className={`w-full px-4 py-4 rounded-2xl flex items-center gap-4 transition-all duration-300 group ${
                  activeNav === item.id
                    ? isDarkMode
                      ? "bg-indigo-500/20 text-indigo-300"
                      : "bg-indigo-50 text-indigo-600"
                    : isDarkMode
                    ? "text-slate-400 hover:bg-white/5 hover:text-white"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    activeNav === item.id
                      ? isDarkMode
                        ? "bg-indigo-500/30 text-indigo-200"
                        : "bg-indigo-100 text-indigo-600"
                      : isDarkMode
                      ? "bg-slate-800/50 text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300"
                      : "bg-slate-100 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600"
                  }`}
                >
                  <item.icon size={20} />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-base tracking-tight mb-0.5">
                    {item.label}
                  </p>
                  <p
                    className={`text-xs ${
                      isDarkMode
                        ? "text-slate-500 group-hover:text-slate-400"
                        : "text-slate-400 group-hover:text-slate-500"
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

      {/* Explore Sidebar (Jelajah) - Premium Sheet */}
      <div
        className={`fixed top-0 left-0 h-full w-full md:w-[450px] z-30 transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) ${
          showExploreSidebar ? "translate-x-0" : "-translate-x-full"
        } ${isDarkMode ? "glass-panel bg-slate-950/80" : "glass-panel-light"}`}
        style={{
          borderRight: isDarkMode
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <div className="p-8 pt-28 h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className={`text-2xl font-bold tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Jelajahi Cerita
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <p
                  className={`text-sm font-medium ${
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  {markers.length} titik kegalauan aktif
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowExploreSidebar(false);
                setActiveNav("beranda");
              }}
              className={`p-2.5 rounded-full transition-all duration-300 hover:rotate-90 ${
                isDarkMode
                  ? "text-slate-400 hover:text-white hover:bg-white/10"
                  : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icons.X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-8">
            {markers.length === 0 ? (
              <div
                className={`text-center py-20 flex flex-col items-center ${
                  isDarkMode ? "text-slate-500" : "text-slate-400"
                }`}
              >
                <div
                  className={`p-6 rounded-full mb-6 ${
                    isDarkMode ? "bg-slate-800/50" : "bg-slate-100"
                  }`}
                >
                  <Icons.MapPin size={32} className="opacity-50" />
                </div>
                <h3 className="text-lg font-medium mb-1">Belum ada cerita</h3>
                <p className="text-sm opacity-70">
                  Jadilah yang pertama menulis di sini.
                </p>
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
                      className={`w-full text-left p-6 rounded-3xl border transition-all duration-300 group relative overflow-hidden ${
                        isDarkMode
                          ? "bento-card hover:bg-slate-800/40"
                          : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg ${
                            isDarkMode ? "bg-black/20" : "bg-slate-50"
                          }`}
                        >
                          {mood?.emoji}
                        </div>
                        <span
                          className={`text-[10px] font-bold tracking-wider uppercase px-3 py-1.5 rounded-full ${
                            isDarkMode
                              ? "bg-slate-800 text-slate-300 border border-slate-700"
                              : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {getTimeRemaining(point.createdAt)}
                        </span>
                      </div>
                      <p
                        className={`text-base leading-relaxed mb-4 font-normal ${
                          isDarkMode
                            ? "text-slate-200 group-hover:text-white"
                            : "text-slate-600 group-hover:text-slate-900"
                        }`}
                      >
                        "{point.story}"
                      </p>
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                            isDarkMode ? "bg-rose-500/10" : "bg-rose-50"
                          }`}
                        >
                          <Icons.Heart
                            size={14}
                            className={`${
                              isDarkMode ? "text-rose-400" : "text-rose-500"
                            } transition-transform group-hover:scale-110`}
                          />
                          <span
                            className={`text-xs font-medium ${
                              isDarkMode ? "text-rose-200" : "text-rose-600"
                            }`}
                          >
                            {point.resonance}
                          </span>
                        </div>
                        <span
                          className={`text-xs ${
                            isDarkMode ? "text-slate-600" : "text-slate-400"
                          }`}
                        >
                          •
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            isDarkMode ? "text-slate-500" : "text-slate-400"
                          }`}
                        >
                          Jakarta,{" "}
                          {new Date(point.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-500"
            onClick={() => {
              setShowAboutModal(false);
              setActiveNav("beranda");
            }}
          />
          <div
            className={`relative w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 ${
              isDarkMode ? "glass-panel" : "glass-panel-light"
            }`}
          >
            <div
              className={`p-8 pb-6 border-b ${
                isDarkMode ? "border-white/10" : "border-black/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                      isDarkMode
                        ? "bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10"
                        : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                    }`}
                  >
                    <Icons.MapPin
                      size={24}
                      className={isDarkMode ? "text-indigo-300" : "text-white"}
                    />
                  </div>
                  <div>
                    <h3
                      className={`text-2xl font-bold tracking-tight ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Tentang Titik Galau
                    </h3>
                    <p
                      className={`text-sm ${
                        isDarkMode ? "text-indigo-200/60" : "text-indigo-600/70"
                      }`}
                    >
                      Peta Kenangan Digital versi 2.0
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAboutModal(false);
                    setActiveNav("beranda");
                  }}
                  className={`p-2.5 rounded-full transition-all duration-300 ${
                    isDarkMode
                      ? "bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white"
                      : "bg-black/5 hover:bg-black/10 text-slate-500 hover:text-black"
                  }`}
                >
                  <Icons.X size={20} />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-8">
              <p
                className={`text-lg leading-relaxed font-light ${
                  isDarkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                <strong
                  className={`font-semibold ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Titik Galau
                </strong>{" "}
                adalah ruang anonim untuk menitipkan rasa di peta. Sebuah tempat
                di mana kegalauan bisa menjadi puisi singkat yang terhubung
                dengan lokasi dan waktu.
              </p>

              <div className="space-y-4">
                <h4
                  className={`text-xs font-bold uppercase tracking-[0.2em] ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Cara Menggunakan
                </h4>
                <div className="grid gap-3">
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
                      className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                        isDarkMode
                          ? "bg-white/5 hover:bg-white/10 border border-white/5"
                          : "bg-slate-50 hover:bg-slate-100 border border-slate-100"
                      }`}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span
                        className={`text-sm font-medium ${
                          isDarkMode ? "text-slate-200" : "text-slate-700"
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

      {/* City Pulse Stats - Premium Widget */}
      <div
        className={`absolute bottom-6 left-6 z-10 rounded-3xl overflow-hidden transition-all duration-500 hover:scale-[1.02] group cursor-default ${
          isDarkMode ? "glass-panel" : "glass-panel-light"
        }`}
      >
        <div className="px-6 py-5">
          {/* Header with live indicator */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <div
                className={`w-2 h-2 rounded-full ${
                  isDarkMode ? "bg-emerald-400" : "bg-emerald-500"
                }`}
              />
              <div
                className={`absolute inset-0 w-2 h-2 rounded-full animate-ping ${
                  isDarkMode ? "bg-emerald-400" : "bg-emerald-500"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Live • {topCity}
            </span>
          </div>

          {/* Main stat */}
          <div className="flex items-baseline gap-2 mb-2">
            <span
              className={`text-4xl font-bold tabular-nums tracking-tight ${
                isDarkMode ? "text-gradient" : "text-indigo-600"
              }`}
            >
              {cityPulseCount.toLocaleString()}
            </span>
            <Icons.Heart
              size={16}
              className={`${
                isDarkMode ? "text-rose-400" : "text-rose-500"
              } animate-pulse`}
            />
          </div>

          {/* Description */}
          <p
            className={`text-sm leading-relaxed max-w-[200px] ${
              isDarkMode ? "text-slate-400" : "text-slate-600"
            }`}
          >
            {cityPulseCount > 0
              ? "cerita aktif lagi menitipkan rasa di peta"
              : "belum ada cerita aktif saat ini"}
          </p>

          {/* Feature 7: Mood Weather */}
          <div
            className={`mt-4 pt-4 border-t ${
              isDarkMode ? "border-white/5" : "border-black/5"
            }`}
          >
            <p
              className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${
                isDarkMode ? "text-slate-500" : "text-slate-400"
              }`}
            >
              Mood Weather {topCity}
            </p>
            <div className="space-y-1.5">
              {moodWeather.slice(0, 3).map((item) => (
                <div key={item.mood} className="flex items-center gap-2">
                  <span className="text-xs">{item.emoji}</span>
                  <div className="flex-1 h-1.5 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                  <span
                    className={`text-[10px] font-bold w-8 text-right ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {item.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Gradient accent bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
      </div>

      {/* Map Controls - Constellation Toggle */}
      <div className={`absolute top-24 left-6 z-10 flex flex-col gap-2`}>
        <button
          onClick={() => setShowConstellation(!showConstellation)}
          className={`p-3 rounded-2xl transition-all duration-300 ${
            showConstellation
              ? isDarkMode
                ? "bg-indigo-500/30 text-indigo-300 border border-indigo-500/50"
                : "bg-indigo-100 text-indigo-600 border border-indigo-200"
              : isDarkMode
              ? "glass-panel hover:bg-white/10"
              : "glass-panel-light hover:bg-slate-100"
          }`}
          title="Toggle Constellation"
        >
          <Icons.Sparkles
            size={20}
            className={showConstellation ? "animate-pulse" : ""}
          />
        </button>

        <button
          onClick={() => setShowBadgeModal(true)}
          className={`p-3 rounded-2xl transition-all duration-300 relative ${
            isDarkMode
              ? "glass-panel hover:bg-white/10"
              : "glass-panel-light hover:bg-slate-100"
          }`}
          title="View Badges"
        >
          <span className="text-lg">🏆</span>
          {unlockedBadges.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unlockedBadges.length}
            </span>
          )}
        </button>

        {/* View Mode Toggle */}
        <div
          className={`mt-4 p-1 rounded-2xl ${
            isDarkMode ? "glass-panel" : "glass-panel-light"
          }`}
        >
          <button
            onClick={() => setViewMode("map")}
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              viewMode === "map"
                ? isDarkMode
                  ? "bg-indigo-500/30 text-indigo-300"
                  : "bg-indigo-100 text-indigo-600"
                : isDarkMode
                ? "text-slate-400 hover:text-white hover:bg-white/10"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Map View"
          >
            <Icons.MapPin size={18} />
          </button>
          <button
            onClick={() => setViewMode("timeline")}
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              viewMode === "timeline"
                ? isDarkMode
                  ? "bg-amber-500/30 text-amber-300"
                  : "bg-amber-100 text-amber-600"
                : isDarkMode
                ? "text-slate-400 hover:text-white hover:bg-white/10"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
            title="Timeline View (Memory Lane)"
          >
            <Icons.Clock size={18} />
          </button>
        </div>
      </div>

      {/* Hint - Premium Floating Pill */}
      {!selectedPoint && !isAddingPoint && (
        <div
          className={`absolute bottom-6 right-6 z-10 rounded-2xl overflow-hidden transition-all duration-500 hover:scale-[1.02] ${
            isFirstVisit ? "animate-bounce" : ""
          } ${isDarkMode ? "glass-panel" : "glass-panel-light"}`}
        >
          <div className="px-5 py-4 flex items-center gap-4">
            {/* Animated icon */}
            <div
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center ${
                isDarkMode ? "bg-indigo-500/20" : "bg-indigo-100"
              }`}
            >
              <Icons.Feather
                size={20}
                className={`${
                  isDarkMode ? "text-indigo-400" : "text-indigo-600"
                } transition-transform group-hover:rotate-12`}
              />
              <div
                className={`absolute inset-0 rounded-xl ${
                  isDarkMode ? "bg-indigo-500/20" : "bg-indigo-200"
                } animate-ping opacity-50`}
              />
            </div>

            {/* Text content */}
            <div>
              <p
                className={`text-sm font-semibold mb-0.5 ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Tap peta
              </p>
              <p
                className={`text-xs ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                buat drop curhatan lo
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Add Button - Premium FAB */}
      {!isAddingPoint && !selectedPoint && (
        <button
          className="md:hidden absolute bottom-28 right-6 z-10 group"
          onClick={() => {
            if (mapInstance.current) {
              const c = mapInstance.current.getCenter();
              setIsAddingPoint({ lat: c.lat, lng: c.lng });
            }
          }}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />

          {/* Button */}
          <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-500/30 flex items-center justify-center transform transition-all duration-300 group-hover:scale-110 group-active:scale-95 group-hover:rotate-90">
            <Icons.Plus size={28} />
          </div>
        </button>
      )}

      {/* Feature 3: Timeline View (Memory Lane) */}
      {viewMode === "timeline" && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          {/* Background overlay */}
          <div
            className={`absolute inset-0 ${
              isDarkMode
                ? "bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950"
                : "bg-gradient-to-br from-slate-50 via-indigo-50/50 to-slate-50"
            }`}
          />

          {/* Floating particles */}
          {isDarkMode && (
            <>
              <div className="absolute top-20 left-10 w-2 h-2 bg-indigo-400/40 rounded-full animate-pulse" />
              <div
                className="absolute top-40 right-20 w-3 h-3 bg-purple-400/30 rounded-full animate-bounce"
                style={{ animationDelay: "0.5s" }}
              />
              <div
                className="absolute bottom-40 left-1/4 w-2 h-2 bg-rose-400/40 rounded-full animate-pulse"
                style={{ animationDelay: "1s" }}
              />
            </>
          )}

          {/* Header */}
          <div className="relative z-10 pt-24 pb-6 px-6 flex items-center justify-between">
            <div>
              <h2
                className={`text-2xl font-bold tracking-tight ${
                  isDarkMode ? "text-white" : "text-slate-900"
                }`}
              >
                Memory Lane
              </h2>
              <p
                className={`text-sm mt-1 ${
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {markers.length} curhatan dalam 24 jam terakhir
              </p>
            </div>
            <button
              onClick={() => setViewMode("map")}
              className={`p-3 rounded-2xl transition-all ${
                isDarkMode
                  ? "bg-white/10 hover:bg-white/20 text-white"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-900"
              }`}
            >
              <Icons.X size={20} />
            </button>
          </div>

          {/* Timeline content */}
          <div className="relative z-10 h-[calc(100vh-140px)] overflow-y-auto px-6 pb-20 custom-scrollbar">
            {/* Timeline line */}
            <div
              className={`absolute left-[27px] top-0 bottom-0 w-0.5 ${
                isDarkMode
                  ? "bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-transparent"
                  : "bg-gradient-to-b from-indigo-300 via-purple-200 to-transparent"
              }`}
            />

            {/* Timeline items */}
            <div className="space-y-6">
              {markers
                .sort((a, b) => b.createdAt - a.createdAt)
                .map((point, index) => {
                  const mood = MOOD_CATEGORIES.find((m) => m.id === point.mood);
                  const timeAgo = (() => {
                    const diff = Date.now() - point.createdAt;
                    const hours = Math.floor(diff / (60 * 60 * 1000));
                    const minutes = Math.floor(
                      (diff % (60 * 60 * 1000)) / (60 * 1000)
                    );
                    if (hours > 0) return `${hours}j yang lalu`;
                    return `${minutes}m yang lalu`;
                  })();

                  return (
                    <div
                      key={point.id}
                      className="relative flex gap-4 animate-in slide-in-from-left-4 fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {/* Timeline node */}
                      <div className="relative z-10 flex-shrink-0">
                        <div
                          className="w-[14px] h-[14px] rounded-full border-2 border-white shadow-lg"
                          style={{ backgroundColor: mood?.color || "#6366f1" }}
                        />
                        {/* Glow effect */}
                        <div
                          className="absolute inset-0 rounded-full animate-ping opacity-30"
                          style={{ backgroundColor: mood?.color || "#6366f1" }}
                        />
                      </div>

                      {/* Card */}
                      <button
                        onClick={() => {
                          setSelectedPoint(point);
                          setViewMode("map");
                          if (mapInstance.current) {
                            mapInstance.current.flyTo(
                              [point.lat, point.lng],
                              16
                            );
                          }
                        }}
                        className={`flex-1 text-left p-5 rounded-2xl transition-all duration-300 group border ${
                          isDarkMode
                            ? "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                            : "bg-white border-slate-100 hover:border-indigo-200 hover:shadow-lg"
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xl">{mood?.emoji}</span>
                          <div className="flex-1">
                            <p
                              className={`text-xs font-bold uppercase tracking-wider ${
                                isDarkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {mood?.label}
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                              isDarkMode
                                ? "bg-white/10 text-slate-300"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {timeAgo}
                          </span>
                        </div>

                        {/* Story */}
                        <p
                          className={`text-sm leading-relaxed mb-3 ${
                            isDarkMode ? "text-slate-200" : "text-slate-700"
                          }`}
                        >
                          "{point.story}"
                        </p>

                        {/* Footer */}
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <Icons.Heart
                              size={14}
                              className={
                                isDarkMode ? "text-rose-400" : "text-rose-500"
                              }
                            />
                            <span
                              className={`text-xs font-medium ${
                                isDarkMode ? "text-slate-400" : "text-slate-500"
                              }`}
                            >
                              {point.resonance}
                            </span>
                          </div>
                          {point.whispers.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <Icons.Send
                                size={14}
                                className={
                                  isDarkMode
                                    ? "text-indigo-400"
                                    : "text-indigo-500"
                                }
                              />
                              <span
                                className={`text-xs font-medium ${
                                  isDarkMode
                                    ? "text-slate-400"
                                    : "text-slate-500"
                                }`}
                              >
                                {point.whispers.length}
                              </span>
                            </div>
                          )}
                          {point.healingStatus === "healed" && (
                            <span className="text-[10px] font-bold uppercase text-emerald-400">
                              ✨ Move On
                            </span>
                          )}
                        </div>

                        {/* Hover arrow */}
                        <div
                          className={`absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-1 ${
                            isDarkMode ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          <Icons.ChevronRight size={18} />
                        </div>
                      </button>
                    </div>
                  );
                })}

              {/* Empty state */}
              {markers.length === 0 && (
                <div
                  className={`text-center py-20 ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                      isDarkMode ? "bg-white/5" : "bg-slate-100"
                    }`}
                  >
                    <Icons.MapPin size={32} className="opacity-50" />
                  </div>
                  <p className="text-lg font-medium mb-1">
                    Belum ada yang curhat
                  </p>
                  <p className="text-sm opacity-70">
                    Jadi yang pertama drop cerita kamu
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Story Modal */}
      {isAddingPoint && (
        <div className="absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-md bg-black/20">
          <div
            className={`w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 ${
              isDarkMode ? "glass-panel" : "glass-panel-light"
            }`}
          >
            <div
              className={`p-6 border-b ${
                isDarkMode ? "border-white/10" : "border-black/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3
                  className={`text-lg font-bold ${
                    isDarkMode ? "text-white" : "text-slate-900"
                  }`}
                >
                  Drop Curhatan Lo
                </h3>
                <button
                  onClick={() => setIsAddingPoint(null)}
                  className={`p-2 rounded-full transition-colors ${
                    isDarkMode
                      ? "bg-white/5 hover:bg-white/10 text-slate-300"
                      : "bg-black/5 hover:bg-black/10 text-slate-600"
                  }`}
                >
                  <Icons.X size={18} />
                </button>
              </div>
              <p
                className={`text-xs font-medium mt-1 ${
                  isDarkMode ? "text-indigo-200/60" : "text-indigo-600/60"
                }`}
              >
                Lokasi lo bakal di-blur biar aman
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Feature 9: Daily Prompt */}
              <button
                onClick={() => {
                  setUsePrompt(!usePrompt);
                  if (!usePrompt) {
                    setNewStory("");
                  }
                }}
                className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border ${
                  usePrompt
                    ? isDarkMode
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-amber-50 border-amber-200"
                    : isDarkMode
                    ? "bg-white/5 border-white/10 hover:bg-white/10"
                    : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{dailyPrompt.emoji}</span>
                  <div className="flex-1">
                    <p
                      className={`text-[9px] font-bold uppercase tracking-widest mb-1 ${
                        isDarkMode ? "text-amber-400" : "text-amber-600"
                      }`}
                    >
                      ✨ Daily Vibe Check
                    </p>
                    <p
                      className={`text-sm leading-relaxed ${
                        isDarkMode ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {dailyPrompt.text}
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      usePrompt
                        ? isDarkMode
                          ? "bg-amber-500 border-amber-500"
                          : "bg-amber-500 border-amber-500"
                        : isDarkMode
                        ? "border-slate-600"
                        : "border-slate-300"
                    }`}
                  >
                    {usePrompt && (
                      <Icons.Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </button>

              {/* Feature 10: Time Capsule Toggle */}
              <button
                onClick={() => setIsTimeCapsule(!isTimeCapsule)}
                className={`w-full p-4 rounded-2xl text-left transition-all duration-300 border ${
                  isTimeCapsule
                    ? isDarkMode
                      ? "bg-purple-500/10 border-purple-500/30"
                      : "bg-purple-50 border-purple-200"
                    : isDarkMode
                    ? "bg-white/5 border-white/10 hover:bg-white/10"
                    : "bg-slate-50 border-slate-100 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⏰</span>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-semibold ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Time Capsule
                    </p>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Cerita baru unlock setelah {timeCapsuleDays} hari
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      isTimeCapsule
                        ? isDarkMode
                          ? "bg-purple-500 border-purple-500"
                          : "bg-purple-500 border-purple-500"
                        : isDarkMode
                        ? "border-slate-600"
                        : "border-slate-300"
                    }`}
                  >
                    {isTimeCapsule && (
                      <Icons.Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
              </button>

              {/* Mood Selection - More compact */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {MOOD_CATEGORIES.slice(0, 3).map((mood) => (
                  <button
                    key={mood.id}
                    onClick={() => setSelectedMood(mood.id)}
                    className={`flex-1 py-4 rounded-2xl text-center transition-all duration-300 border ${
                      selectedMood === mood.id
                        ? isDarkMode
                          ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_20px_-5px_rgba(99,102,241,0.3)]"
                          : "bg-indigo-50 border-indigo-200 shadow-lg shadow-indigo-500/10"
                        : isDarkMode
                        ? "bg-white/5 border-transparent hover:bg-white/10"
                        : "bg-slate-50 border-transparent hover:bg-slate-100"
                    }`}
                  >
                    <span className="text-2xl block mb-2">{mood.emoji}</span>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isDarkMode ? "text-slate-300" : "text-slate-600"
                      }`}
                    >
                      {mood.label}
                    </p>
                  </button>
                ))}
              </div>

              {/* Feature 5: Color Your Mood */}
              <div
                className={`p-4 rounded-2xl border ${
                  isDarkMode
                    ? "bg-white/5 border-white/10"
                    : "bg-slate-50 border-slate-100"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎨</span>
                    <p
                      className={`text-xs font-bold uppercase tracking-widest ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Custom Color
                    </p>
                  </div>
                  {customColor && (
                    <button
                      onClick={() => setCustomColor(null)}
                      className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                        isDarkMode
                          ? "bg-white/10 text-slate-300 hover:bg-white/20"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[
                    "#ef4444", // Red
                    "#f97316", // Orange
                    "#eab308", // Yellow
                    "#22c55e", // Green
                    "#06b6d4", // Cyan
                    "#3b82f6", // Blue
                    "#8b5cf6", // Purple
                    "#ec4899", // Pink
                    "#f43f5e", // Rose
                    "#64748b", // Slate
                  ].map((color) => (
                    <button
                      key={color}
                      onClick={() => setCustomColor(color)}
                      className={`w-8 h-8 rounded-xl transition-all duration-300 border-2 ${
                        customColor === color
                          ? "scale-110 ring-2 ring-offset-2 border-white"
                          : "border-transparent hover:scale-105"
                      } ${
                        isDarkMode
                          ? "ring-offset-slate-900"
                          : "ring-offset-white"
                      }`}
                      style={{
                        backgroundColor: color,
                        boxShadow:
                          customColor === color
                            ? `0 0 20px ${color}50`
                            : "none",
                      }}
                      title={`Use ${color}`}
                    />
                  ))}
                </div>
                {customColor && (
                  <div className="mt-3 flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: customColor }}
                    />
                    <p
                      className={`text-[10px] ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      Preview warna pin kamu
                    </p>
                  </div>
                )}
              </div>

              {/* Story Input */}
              <div className="relative">
                <textarea
                  rows={3}
                  maxLength={MAX_CHARS}
                  placeholder="Tulis kegalauanmu dalam 100 karakter..."
                  className={`w-full p-5 rounded-2xl border transition-all outline-none resize-none text-base leading-relaxed ${
                    isDarkMode
                      ? "bg-black/20 border-white/10 focus:border-indigo-500/50 text-white placeholder:text-slate-500"
                      : "bg-slate-50 border-slate-100 focus:border-indigo-500/30 text-slate-900 placeholder:text-slate-400"
                  }`}
                  value={newStory}
                  onChange={(e) => setNewStory(e.target.value)}
                />
                <span
                  className={`absolute bottom-3 right-4 text-[10px] font-bold ${
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
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white font-bold tracking-wide transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-[0.98] relative overflow-hidden group"
              >
                {/* Glow overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-400 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                {/* Button content */}
                <span className="relative flex items-center justify-center gap-2">
                  <Icons.Send
                    size={18}
                    className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
                  />
                  Drop ke Peta
                </span>

                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              </button>

              {/* Footer info */}
              <div className="flex items-center justify-center gap-2">
                <Icons.Clock
                  size={12}
                  className={isDarkMode ? "text-slate-500" : "text-slate-400"}
                />
                <p
                  className={`text-[10px] font-medium ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  Pin bakal ilang dalam 24 jam
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Story Detail Card - Premium Float with Whisper Mode */}
      {selectedPoint && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-lg animate-in slide-in-from-bottom-6 duration-500 fade-in">
          <div
            className={`rounded-[2rem] relative overflow-hidden backdrop-blur-xl ${
              isDarkMode ? "glass-panel" : "glass-panel-light"
            }`}
          >
            {/* Header */}
            <div className="p-6 pb-4">
              <button
                onClick={() => {
                  setSelectedPoint(null);
                  setShowWhisperInput(false);
                }}
                className={`absolute top-4 right-4 p-2 rounded-full transition-all ${
                  isDarkMode
                    ? "bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                    : "bg-black/5 hover:bg-black/10 text-slate-400 hover:text-slate-600"
                }`}
              >
                <Icons.X size={18} />
              </button>

              {/* Mood, Time & Healing Status */}
              <div className="flex items-center gap-4 mb-4">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-lg border ${
                    isDarkMode
                      ? "bg-black/20 border-white/5"
                      : "bg-white border-slate-100"
                  }`}
                >
                  {selectedMoodData?.emoji}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`text-xs font-bold uppercase tracking-widest ${
                        isDarkMode ? "text-indigo-300" : "text-indigo-600"
                      }`}
                    >
                      {selectedMoodData?.label}
                    </p>
                    {/* Healing Status Badge */}
                    {selectedPoint.healingStatus && (
                      <span
                        className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          selectedPoint.healingStatus === "healed"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : selectedPoint.healingStatus === "healing"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-slate-500/20 text-slate-400"
                        }`}
                      >
                        {selectedPoint.healingStatus === "healed"
                          ? "✨ Move On"
                          : selectedPoint.healingStatus === "healing"
                          ? "🌱 Vibin"
                          : "💭 Lagi Struggle"}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-slate-400" : "text-slate-500"
                    }`}
                  >
                    {getTimeRemaining(selectedPoint.createdAt)}
                  </p>
                </div>
              </div>

              {/* Story */}
              <div className="relative mb-4">
                <span
                  className={`absolute -top-1 -left-1 text-3xl opacity-10 font-serif ${
                    isDarkMode ? "text-white" : "text-indigo-900"
                  }`}
                >
                  "
                </span>
                <p
                  className={`text-lg leading-relaxed font-light pl-4 ${
                    isDarkMode ? "text-slate-200" : "text-slate-700"
                  }`}
                >
                  {selectedPoint.story}
                </p>
              </div>

              {/* Healing Note if exists */}
              {selectedPoint.healingNote && (
                <div
                  className={`mb-4 p-3 rounded-xl ${
                    isDarkMode
                      ? "bg-emerald-500/10 border border-emerald-500/20"
                      : "bg-emerald-50 border border-emerald-100"
                  }`}
                >
                  <p
                    className={`text-xs ${
                      isDarkMode ? "text-emerald-300" : "text-emerald-700"
                    }`}
                  >
                    📝 Update: {selectedPoint.healingNote}
                  </p>
                </div>
              )}
            </div>

            {/* Whispers Section */}
            {selectedPoint.whispers.length > 0 && (
              <div
                className={`px-6 py-4 border-t ${
                  isDarkMode ? "border-white/5" : "border-black/5"
                }`}
              >
                <p
                  className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  💬 Whispers ({selectedPoint.whispers.length})
                </p>
                <div className="space-y-2 max-h-24 overflow-y-auto custom-scrollbar">
                  {selectedPoint.whispers.slice(-3).map((whisper) => (
                    <div
                      key={whisper.id}
                      className={`p-2.5 rounded-xl text-sm ${
                        isDarkMode
                          ? "bg-white/5 text-slate-300"
                          : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      "{whisper.message}"
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Whisper Input */}
            {showWhisperInput && (
              <div
                className={`px-6 py-4 border-t ${
                  isDarkMode ? "border-white/5" : "border-black/5"
                }`}
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Kirim support vibes..."
                    maxLength={MAX_WHISPER_CHARS}
                    value={whisperInput}
                    onChange={(e) => setWhisperInput(e.target.value)}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm border transition-all ${
                      isDarkMode
                        ? "bg-black/20 border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50"
                        : "bg-slate-50 border-slate-100 text-slate-900 placeholder:text-slate-400 focus:border-indigo-300"
                    } outline-none`}
                    onKeyDown={(e) => e.key === "Enter" && handleSendWhisper()}
                  />
                  <button
                    onClick={handleSendWhisper}
                    disabled={!whisperInput.trim()}
                    className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-400 transition-colors disabled:opacity-40"
                  >
                    <Icons.Send size={16} />
                  </button>
                </div>
                <p
                  className={`text-[10px] mt-2 ${
                    isDarkMode ? "text-slate-500" : "text-slate-400"
                  }`}
                >
                  {whisperInput.length}/{MAX_WHISPER_CHARS} • Whisper dikirim
                  secara anonim
                </p>
              </div>
            )}

            {/* Actions */}
            <div
              className={`flex items-center gap-2 p-4 border-t ${
                isDarkMode ? "border-white/5" : "border-black/5"
              }`}
            >
              {/* Resonance Button */}
              <button
                onClick={handleResonance}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                  isDarkMode
                    ? "bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    : "bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-500"
                }`}
              >
                <Icons.Heart size={18} />
                <span className="text-sm font-medium">
                  {selectedPoint.resonance}
                </span>
              </button>

              {/* Whisper Button */}
              <button
                onClick={() => setShowWhisperInput(!showWhisperInput)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                  showWhisperInput
                    ? isDarkMode
                      ? "bg-indigo-500/20 text-indigo-400"
                      : "bg-indigo-50 text-indigo-600"
                    : isDarkMode
                    ? "bg-white/5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400"
                    : "bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600"
                }`}
              >
                <Icons.Send size={18} />
                <span className="text-sm font-medium">Whisper</span>
              </button>

              {/* Share Button */}
              <button
                onClick={() => setShowShareCard(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-all ${
                  isDarkMode
                    ? "bg-white/5 hover:bg-purple-500/20 text-slate-400 hover:text-purple-400"
                    : "bg-slate-50 hover:bg-purple-50 text-slate-500 hover:text-purple-600"
                }`}
              >
                <Icons.Sparkles size={18} />
                <span className="text-sm font-medium">Share</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feature 8: Badge Modal */}
      {showBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowBadgeModal(false)}
          />
          <div
            className={`relative w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 ${
              isDarkMode ? "glass-panel" : "glass-panel-light"
            }`}
          >
            <div
              className={`p-6 border-b ${
                isDarkMode ? "border-white/10" : "border-black/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <h3
                      className={`text-lg font-bold ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      Badge Collection
                    </h3>
                    <p
                      className={`text-xs ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {unlockedBadges.length} / {BADGE_DEFINITIONS.length}{" "}
                      unlocked
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBadgeModal(false)}
                  className={`p-2 rounded-full ${
                    isDarkMode ? "hover:bg-white/10" : "hover:bg-black/5"
                  }`}
                >
                  <Icons.X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {BADGE_DEFINITIONS.map((badge) => {
                const isUnlocked = unlockedBadges.includes(badge.id);
                return (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl text-center transition-all ${
                      isUnlocked
                        ? isDarkMode
                          ? "bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30"
                          : "bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200"
                        : isDarkMode
                        ? "bg-white/5 border border-white/5 opacity-40"
                        : "bg-slate-50 border border-slate-100 opacity-40"
                    }`}
                  >
                    <span
                      className={`text-3xl block mb-2 ${
                        isUnlocked ? "" : "grayscale"
                      }`}
                    >
                      {badge.emoji}
                    </span>
                    <p
                      className={`text-xs font-bold mb-1 ${
                        isDarkMode ? "text-white" : "text-slate-900"
                      }`}
                    >
                      {badge.name}
                    </p>
                    <p
                      className={`text-[10px] leading-tight ${
                        isDarkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {badge.description}
                    </p>
                    {isUnlocked && (
                      <p className="text-[9px] text-amber-500 font-bold mt-2">
                        ✓ UNLOCKED
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Feature 14: Share Card Modal */}
      {showShareCard && selectedPoint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
            onClick={() => setShowShareCard(false)}
          />
          <div className="relative animate-in fade-in zoom-in-95 duration-300">
            {/* Close button */}
            <button
              onClick={() => setShowShareCard(false)}
              className="absolute -top-12 right-0 p-2 text-white/60 hover:text-white"
            >
              <Icons.X size={24} />
            </button>

            {/* Share Card Preview */}
            <div className="w-80 rounded-3xl overflow-hidden shadow-2xl">
              {/* Card Background */}
              <div className="relative p-8 bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900">
                {/* Ambient glow */}
                <div
                  className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-30"
                  style={{ backgroundColor: selectedMoodData?.color }}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Mood badge */}
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-2xl">{selectedMoodData?.emoji}</span>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                      {selectedMoodData?.label}
                    </span>
                  </div>

                  {/* Quote */}
                  <div className="mb-8">
                    <span className="text-6xl text-white/10 font-serif leading-none">
                      &quot;
                    </span>
                    <p className="text-lg text-white leading-relaxed font-light -mt-8 ml-6">
                      {selectedPoint.story}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <Icons.MapPin size={12} className="text-white" />
                      </div>
                      <span className="text-xs text-white/50">Titik Galau</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icons.Heart size={14} className="text-rose-400" />
                      <span className="text-xs text-white/60">
                        {selectedPoint.resonance}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4 justify-center">
              <button className="px-6 py-3 rounded-2xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 transition-colors">
                📋 Copy
              </button>
              <button className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                📤 Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
