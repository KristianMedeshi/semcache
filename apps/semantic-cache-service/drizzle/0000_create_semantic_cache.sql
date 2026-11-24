CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."semantic_cache_category" AS ENUM('billing', 'technical_support', 'account_management', 'product_inquiry', 'general');--> statement-breakpoint
CREATE TYPE "public"."semantic_cache_mode" AS ENUM('disabled', 'fixed', 'adaptive');--> statement-breakpoint
CREATE TABLE "semantic_cache_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query" text NOT NULL,
	"response" text NOT NULL,
	"category" "semantic_cache_category" DEFAULT 'general' NOT NULL,
	"embedding" vector(384) NOT NULL,
	"model" varchar(120),
	"hit_count" integer DEFAULT 0 NOT NULL,
	"last_hit_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_cache_entry_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"document_title" varchar(200),
	"chunk_id" uuid,
	"chunk_index" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_cache_settings" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"mode" "semantic_cache_mode" DEFAULT 'adaptive' NOT NULL,
	"fixed_threshold" double precision DEFAULT 0.9 NOT NULL,
	"adaptive_base_threshold" double precision DEFAULT 0.85 NOT NULL,
	"min_adaptive_threshold" double precision DEFAULT 0.72 NOT NULL,
	"max_adaptive_threshold" double precision DEFAULT 0.97 NOT NULL,
	"density_weight" double precision DEFAULT 0.08 NOT NULL,
	"density_k_neighbors" integer DEFAULT 5 NOT NULL,
	"category_weights" jsonb NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "semantic_cache_entry_sources" ADD CONSTRAINT "semantic_cache_entry_sources_entry_id_semantic_cache_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."semantic_cache_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "semantic_cache_entries_category_idx" ON "semantic_cache_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "semantic_cache_entries_created_at_idx" ON "semantic_cache_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "semantic_cache_entries_embedding_hnsw_idx" ON "semantic_cache_entries" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "semantic_cache_entry_sources_entry_id_idx" ON "semantic_cache_entry_sources" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "semantic_cache_entry_sources_document_id_idx" ON "semantic_cache_entry_sources" USING btree ("document_id");