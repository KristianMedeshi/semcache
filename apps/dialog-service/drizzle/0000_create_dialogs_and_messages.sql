CREATE TYPE "public"."dialog_message_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TABLE "dialog_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dialog_id" uuid NOT NULL,
	"role" "dialog_message_role" NOT NULL,
	"content" text NOT NULL,
	"model" varchar(120),
	"latency_ms" integer,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"total_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dialogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dialog_messages" ADD CONSTRAINT "dialog_messages_dialog_id_dialogs_id_fk" FOREIGN KEY ("dialog_id") REFERENCES "public"."dialogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dialog_messages_dialog_id_idx" ON "dialog_messages" USING btree ("dialog_id");--> statement-breakpoint
CREATE INDEX "dialogs_user_id_idx" ON "dialogs" USING btree ("user_id");