import {
  pgTable,
  serial,
  text,
  real,
  integer,
  timestamp,
  boolean,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Stories table - main stories/pins on the map
export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  story: text("story").notNull(),
  mood: varchar("mood", { length: 50 }).notNull(),
  photoUrl: text("photo_url"), // Optional photo URL (max 5MB)
  resonance: integer("resonance").default(0).notNull(),
  customColor: varchar("custom_color", { length: 20 }),
  isTimeCapsule: boolean("is_time_capsule").default(false),
  timeCapsuleDate: timestamp("time_capsule_date"),
  healingStatus: varchar("healing_status", { length: 20 }).default(
    "struggling"
  ), // struggling, healing, healed
  healingNote: text("healing_note"),
  promptId: varchar("prompt_id", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // 24 hours after creation
});

// Whispers table - anonymous messages to stories
export const whispers = pgTable("whispers", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relationships
export const storiesRelations = relations(stories, ({ many }) => ({
  whispers: many(whispers),
}));

export const whispersRelations = relations(whispers, ({ one }) => ({
  story: one(stories, {
    fields: [whispers.storyId],
    references: [stories.id],
  }),
}));

// TypeScript types inferred from schema
export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;
export type Whisper = typeof whispers.$inferSelect;
export type NewWhisper = typeof whispers.$inferInsert;
