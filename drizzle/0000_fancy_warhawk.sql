CREATE TABLE "stories" (
	"id" serial PRIMARY KEY NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"story" text NOT NULL,
	"mood" varchar(50) NOT NULL,
	"resonance" integer DEFAULT 0 NOT NULL,
	"custom_color" varchar(20),
	"is_time_capsule" boolean DEFAULT false,
	"time_capsule_date" timestamp,
	"healing_status" varchar(20) DEFAULT 'struggling',
	"healing_note" text,
	"prompt_id" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whispers" (
	"id" serial PRIMARY KEY NOT NULL,
	"story_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "whispers" ADD CONSTRAINT "whispers_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;