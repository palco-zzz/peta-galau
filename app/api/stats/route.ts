import { NextResponse } from "next/server";
import { db, stories } from "@/lib/db";
import { count, gt, and, or, isNull, lte, eq } from "drizzle-orm";

// Indonesian cities with their approximate bounding boxes (lat/lng ranges)
const CITY_REGIONS = [
  { name: "Jakarta", latMin: -6.4, latMax: -6.0, lngMin: 106.6, lngMax: 107.0 },
  { name: "Bandung", latMin: -7.1, latMax: -6.8, lngMin: 107.4, lngMax: 107.8 },
  {
    name: "Surabaya",
    latMin: -7.4,
    latMax: -7.1,
    lngMin: 112.6,
    lngMax: 112.9,
  },
  {
    name: "Yogyakarta",
    latMin: -7.9,
    latMax: -7.7,
    lngMin: 110.3,
    lngMax: 110.5,
  },
  {
    name: "Semarang",
    latMin: -7.1,
    latMax: -6.9,
    lngMin: 110.3,
    lngMax: 110.5,
  },
  { name: "Medan", latMin: 3.4, latMax: 3.7, lngMin: 98.6, lngMax: 98.8 },
  {
    name: "Makassar",
    latMin: -5.2,
    latMax: -5.0,
    lngMin: 119.3,
    lngMax: 119.5,
  },
  {
    name: "Palembang",
    latMin: -3.1,
    latMax: -2.9,
    lngMin: 104.7,
    lngMax: 104.9,
  },
  {
    name: "Denpasar",
    latMin: -8.8,
    latMax: -8.6,
    lngMin: 115.1,
    lngMax: 115.3,
  },
  { name: "Malang", latMin: -8.1, latMax: -7.9, lngMin: 112.5, lngMax: 112.7 },
  { name: "Bekasi", latMin: -6.3, latMax: -6.1, lngMin: 106.9, lngMax: 107.1 },
  {
    name: "Tangerang",
    latMin: -6.3,
    latMax: -6.1,
    lngMin: 106.5,
    lngMax: 106.7,
  },
  { name: "Depok", latMin: -6.5, latMax: -6.3, lngMin: 106.7, lngMax: 106.9 },
  { name: "Bogor", latMin: -6.7, latMax: -6.5, lngMin: 106.7, lngMax: 106.9 },
];

// Get city name from coordinates
function getCityFromCoords(lat: number, lng: number): string {
  for (const city of CITY_REGIONS) {
    if (
      lat >= city.latMin &&
      lat <= city.latMax &&
      lng >= city.lngMin &&
      lng <= city.lngMax
    ) {
      return city.name;
    }
  }
  return "Indonesia"; // Default for unknown locations
}

// GET - Fetch stats for the map (active story count, mood breakdown, top city)
export async function GET() {
  try {
    const now = new Date();

    // Get all active stories with their coordinates
    const activeStories = await db
      .select({ lat: stories.lat, lng: stories.lng, mood: stories.mood })
      .from(stories)
      .where(
        and(
          gt(stories.expiresAt, now),
          or(isNull(stories.timeCapsuleDate), lte(stories.timeCapsuleDate, now))
        )
      );

    const totalCount = activeStories.length;

    // Group stories by city and count
    const cityCounts: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};

    activeStories.forEach((story) => {
      // Count by city
      const city = getCityFromCoords(story.lat, story.lng);
      cityCounts[city] = (cityCounts[city] || 0) + 1;

      // Count by mood
      moodCounts[story.mood] = (moodCounts[story.mood] || 0) + 1;
    });

    // Find the city with most stories
    let topCity = "Indonesia";
    let topCityCount = 0;
    Object.entries(cityCounts).forEach(([city, count]) => {
      if (count > topCityCount) {
        topCity = city;
        topCityCount = count;
      }
    });

    // Calculate mood weather from counts
    const moods = ["heartbreak", "crisis", "longing", "hope", "grateful"];
    const moodWeather = moods.map((mood) => ({
      mood,
      count: moodCounts[mood] || 0,
      percentage:
        totalCount > 0
          ? Math.round(((moodCounts[mood] || 0) / totalCount) * 100)
          : 0,
    }));

    // Return stats with top city
    return NextResponse.json({
      totalStories: totalCount,
      cityPulseCount: totalCount,
      topCity,
      topCityCount,
      moodWeather,
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
