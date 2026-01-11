import { NextRequest, NextResponse } from "next/server";
import { db, stories, whispers } from "@/lib/db";
import { desc, gt, and, or, isNull, lte } from "drizzle-orm";

// GET - Fetch all active stories (not expired, or time capsule ready)
export async function GET() {
  try {
    const now = new Date();

    // Get stories that are:
    // 1. Not expired (expires_at > now)
    // 2. AND (not a time capsule OR time capsule date has passed)
    const activeStories = await db
      .select()
      .from(stories)
      .where(
        and(
          gt(stories.expiresAt, now),
          or(isNull(stories.timeCapsuleDate), lte(stories.timeCapsuleDate, now))
        )
      )
      .orderBy(desc(stories.createdAt));

    // Get whispers for each story
    const storiesWithWhispers = await Promise.all(
      activeStories.map(async (story) => {
        const storyWhispers = await db
          .select()
          .from(whispers)
          .where(and(gt(whispers.storyId, 0)))
          .orderBy(desc(whispers.createdAt));

        return {
          ...story,
          whispers: storyWhispers.filter((w) => w.storyId === story.id),
        };
      })
    );

    return NextResponse.json(storiesWithWhispers);
  } catch (error) {
    console.error("Error fetching stories:", error);
    return NextResponse.json(
      { error: "Failed to fetch stories" },
      { status: 500 }
    );
  }
}

// POST - Create a new story
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      lat,
      lng,
      story,
      mood,
      photoUrl,
      customColor,
      isTimeCapsule,
      timeCapsuleDays,
      promptId,
    } = body;

    // Validate required fields
    if (!lat || !lng || !story || !mood) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate story length
    if (story.length > 100) {
      return NextResponse.json(
        { error: "Story must be 100 characters or less" },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Calculate time capsule date if applicable
    let timeCapsuleDate = null;
    if (isTimeCapsule && timeCapsuleDays) {
      timeCapsuleDate = new Date(
        now.getTime() + timeCapsuleDays * 24 * 60 * 60 * 1000
      );
    }

    const [newStory] = await db
      .insert(stories)
      .values({
        lat,
        lng,
        story,
        mood,
        photoUrl: photoUrl || null,
        customColor: customColor || null,
        isTimeCapsule: isTimeCapsule || false,
        timeCapsuleDate,
        promptId: promptId || null,
        resonance: 0,
        healingStatus: "struggling",
        expiresAt,
      })
      .returning();

    return NextResponse.json({ ...newStory, whispers: [] }, { status: 201 });
  } catch (error) {
    console.error("Error creating story:", error);
    return NextResponse.json(
      { error: "Failed to create story" },
      { status: 500 }
    );
  }
}
