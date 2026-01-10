import { NextResponse } from "next/server";
import { db, stories } from "@/lib/db";
import { count, gt, and, or, isNull, lte, eq } from "drizzle-orm";

// GET - Fetch stats for the map (active story count, mood breakdown)
export async function GET() {
  try {
    const now = new Date();

    // Count active stories
    const [activeCount] = await db
      .select({ count: count() })
      .from(stories)
      .where(
        and(
          gt(stories.expiresAt, now),
          or(isNull(stories.timeCapsuleDate), lte(stories.timeCapsuleDate, now))
        )
      );

    // Get mood breakdown for mood weather
    const moods = ["heartbreak", "crisis", "longing", "hope", "grateful"];
    const moodCounts = await Promise.all(
      moods.map(async (mood) => {
        const [result] = await db
          .select({ count: count() })
          .from(stories)
          .where(
            and(
              eq(stories.mood, mood),
              gt(stories.expiresAt, now),
              or(
                isNull(stories.timeCapsuleDate),
                lte(stories.timeCapsuleDate, now)
              )
            )
          );
        return { mood, count: result?.count || 0 };
      })
    );

    const totalCount = activeCount?.count || 0;
    const moodWeather = moodCounts.map((m) => ({
      mood: m.mood,
      count: m.count,
      percentage: totalCount > 0 ? Math.round((m.count / totalCount) * 100) : 0,
    }));

    // Add a random base count to make it feel more alive
    const cityPulseBase = 3000 + Math.floor(Math.random() * 500);
    const cityPulseCount = cityPulseBase + totalCount;

    return NextResponse.json({
      totalStories: totalCount,
      cityPulseCount,
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
