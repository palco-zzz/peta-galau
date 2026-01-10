import { NextRequest, NextResponse } from "next/server";
import { db, stories } from "@/lib/db";
import { eq, sql } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Increment resonance count for a story
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    // Increment resonance using SQL to avoid race conditions
    const [updatedStory] = await db
      .update(stories)
      .set({
        resonance: sql`${stories.resonance} + 1`,
      })
      .where(eq(stories.id, storyId))
      .returning();

    if (!updatedStory) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: updatedStory.id,
      resonance: updatedStory.resonance,
    });
  } catch (error) {
    console.error("Error incrementing resonance:", error);
    return NextResponse.json(
      { error: "Failed to increment resonance" },
      { status: 500 }
    );
  }
}
