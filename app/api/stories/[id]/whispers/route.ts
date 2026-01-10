import { NextRequest, NextResponse } from "next/server";
import { db, whispers, stories } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch all whispers for a story
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    const storyWhispers = await db
      .select()
      .from(whispers)
      .where(eq(whispers.storyId, storyId))
      .orderBy(desc(whispers.createdAt));

    return NextResponse.json(storyWhispers);
  } catch (error) {
    console.error("Error fetching whispers:", error);
    return NextResponse.json(
      { error: "Failed to fetch whispers" },
      { status: 500 }
    );
  }
}

// POST - Create a new whisper for a story
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);
    const body = await request.json();

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    const { message } = body;

    // Validate message
    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    if (message.length > 50) {
      return NextResponse.json(
        { error: "Message must be 50 characters or less" },
        { status: 400 }
      );
    }

    // Check if story exists
    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const [newWhisper] = await db
      .insert(whispers)
      .values({
        storyId,
        message: message.trim(),
      })
      .returning();

    return NextResponse.json(newWhisper, { status: 201 });
  } catch (error) {
    console.error("Error creating whisper:", error);
    return NextResponse.json(
      { error: "Failed to create whisper" },
      { status: 500 }
    );
  }
}
