CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TYPE "public"."kb_document_category" AS ENUM('billing', 'technical_support', 'account_management', 'product_inquiry', 'general');--> statement-breakpoint
CREATE TYPE "public"."kb_document_format" AS ENUM('text', 'markdown', 'html', 'json', 'pdf', 'docx');--> statement-breakpoint
CREATE TYPE "public"."kb_document_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "kb_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"file_name" varchar(255),
	"format" "kb_document_format" DEFAULT 'text' NOT NULL,
	"category" "kb_document_category" DEFAULT 'general' NOT NULL,
	"raw_content" text NOT NULL,
	"extracted_content" text DEFAULT '' NOT NULL,
	"status" "kb_document_status" DEFAULT 'pending' NOT NULL,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"character_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kb_document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"character_count" integer DEFAULT 0 NOT NULL,
	"embedding" vector(384) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_document_chunks" ADD CONSTRAINT "kb_document_chunks_document_id_kb_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."kb_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_documents_status_idx" ON "kb_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kb_documents_category_idx" ON "kb_documents" USING btree ("category");--> statement-breakpoint
CREATE INDEX "kb_documents_created_at_idx" ON "kb_documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "kb_chunks_document_id_idx" ON "kb_document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "kb_chunks_embedding_hnsw_idx" ON "kb_document_chunks" USING hnsw ("embedding" vector_cosine_ops);
