// Frontend types that match the database schema
export interface Whisper {
  id: number;
  storyId: number;
  message: string;
  createdAt: string;
}

export interface Story {
  id: number;
  lat: number;
  lng: number;
  story: string;
  mood: string;
  resonance: number;
  customColor: string | null;
  isTimeCapsule: boolean;
  timeCapsuleDate: string | null;
  healingStatus: "struggling" | "healing" | "healed";
  healingNote: string | null;
  promptId: string | null;
  createdAt: string;
  expiresAt: string;
  whispers: Whisper[];
}

export interface StatsResponse {
  totalStories: number;
  cityPulseCount: number;
  topCity: string;
  topCityCount: number;
  moodWeather: {
    mood: string;
    count: number;
    percentage: number;
  }[];
}

export interface CreateStoryInput {
  lat: number;
  lng: number;
  story: string;
  mood: string;
  customColor?: string;
  isTimeCapsule?: boolean;
  timeCapsuleDays?: number;
  promptId?: string;
}

export interface CreateWhisperInput {
  message: string;
}

export interface UpdateStoryInput {
  resonance?: number;
  healingStatus?: "struggling" | "healing" | "healed";
  healingNote?: string;
}
