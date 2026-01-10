import { NextRequest, NextResponse } from "next/server";
import { db, stories, whispers } from "@/lib/db";
import { eq } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Fetch a single story by ID
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, storyId));

    if (!story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const storyWhispers = await db
      .select()
      .from(whispers)
      .where(eq(whispers.storyId, storyId));

    return NextResponse.json({ ...story, whispers: storyWhispers });
  } catch (error) {
    console.error("Error fetching story:", error);
    return NextResponse.json(
      { error: "Failed to fetch story" },
      { status: 500 }
    );
  }
}

// PATCH - Update story (resonance, healing status, etc.)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);
    const body = await request.json();

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    const { resonance, healingStatus, healingNote } = body;

    const updateData: Record<string, unknown> = {};
    if (resonance !== undefined) updateData.resonance = resonance;
    if (healingStatus !== undefined) updateData.healingStatus = healingStatus;
    if (healingNote !== undefined) updateData.healingNote = healingNote;

    const [updatedStory] = await db
      .update(stories)
      .set(updateData)
      .where(eq(stories.id, storyId))
      .returning();

    if (!updatedStory) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json(updatedStory);
  } catch (error) {
    console.error("Error updating story:", error);
    return NextResponse.json(
      { error: "Failed to update story" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a story
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const storyId = parseInt(id);

    if (isNaN(storyId)) {
      return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
    }

    const [deletedStory] = await db
      .delete(stories)
      .where(eq(stories.id, storyId))
      .returning();

    if (!deletedStory) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Story deleted successfully" });
  } catch (error) {
    console.error("Error deleting story:", error);
    return NextResponse.json(
      { error: "Failed to delete story" },
      { status: 500 }
    );
  }
}
