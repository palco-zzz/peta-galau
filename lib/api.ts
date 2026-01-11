import type {
  Story,
  StatsResponse,
  CreateStoryInput,
  CreateWhisperInput,
  UpdateStoryInput,
  Whisper,
} from "./types";

const API_BASE = "/api";

// Helper function for API calls
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  return response.json();
}

// Stories API
export const storiesApi = {
  // Get all active stories
  getAll: () => fetchAPI<Story[]>("/stories"),

  // Get single story by ID
  getById: (id: number) => fetchAPI<Story>(`/stories/${id}`),

  // Create a new story
  create: (data: CreateStoryInput) =>
    fetchAPI<Story>("/stories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update a story
  update: (id: number, data: UpdateStoryInput) =>
    fetchAPI<Story>(`/stories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Delete a story
  delete: (id: number) =>
    fetchAPI<{ message: string }>(`/stories/${id}`, {
      method: "DELETE",
    }),

  // Increment resonance
  addResonance: (id: number) =>
    fetchAPI<{ id: number; resonance: number }>(`/stories/${id}/resonance`, {
      method: "POST",
    }),

  // Get whispers for a story
  getWhispers: (id: number) => fetchAPI<Whisper[]>(`/stories/${id}/whispers`),

  // Add a whisper to a story
  addWhisper: (id: number, data: CreateWhisperInput) =>
    fetchAPI<Whisper>(`/stories/${id}/whispers`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// Stats API
export const statsApi = {
  // Get map stats
  get: () => fetchAPI<StatsResponse>("/stats"),
};

// Upload API
export const uploadApi = {
  // Upload photo (max 5MB)
  uploadPhoto: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append("photo", file);

    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Upload Error: ${response.status}`);
    }

    return response.json();
  },
};
