import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { HtmlToTextTransformer } from '@langchain/community/document_transformers/html_to_text';
import type { Document } from '@langchain/core/documents';
import { MarkdownTextSplitter, RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Injectable } from '@nestjs/common';
import {
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  inferKnowledgeDocumentFormat,
} from '@semcache/shared-dtos';
import { KnowledgeDocumentFormat } from '@semcache/shared-types';
import {
  JsonDocumentLoader,
  TextDocumentLoader,
  decodeContentToBlob,
  normalizeLoadedDocuments,
  sanitizeMetadata,
} from './document-loaders';

export interface ProcessedDocumentResult {
  format: KnowledgeDocumentFormat;
  text: string;
  characterCount: number;
  documents: Document[];
  chunks: DocumentChunk[];
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  metadata: Record<string, string | number | boolean>;
}

@Injectable()
export class DocumentProcessorService {
  resolveFormat(format?: KnowledgeDocumentFormat, fileName?: string): KnowledgeDocumentFormat {
    return format ?? inferKnowledgeDocumentFormat(fileName);
  }

  async loadDocuments(input: {
    rawContent: string;
    format?: KnowledgeDocumentFormat;
    fileName?: string;
    documentId?: string;
    metadata?: Record<string, string | number | boolean>;
  }): Promise<{ format: KnowledgeDocumentFormat; documents: Document[] }> {
    const resolvedFormat = this.resolveFormat(input.format, input.fileName);
    const baseMetadata: Record<string, unknown> = {
      ...input.metadata,
      format: resolvedFormat,
      ...(input.documentId ? { documentId: input.documentId } : {}),
      ...(input.fileName ? { fileName: input.fileName } : {}),
    };

    const rawDocs = await this.loadByFormat(resolvedFormat, input.rawContent, baseMetadata);
    const nonEmptyDocs = rawDocs.filter((doc) => doc.pageContent.trim().length > 0);
    if (nonEmptyDocs.length === 0) {
      throw new Error('Document contains no extractable text content after processing');
    }

    return { format: resolvedFormat, documents: nonEmptyDocs };
  }

  private async loadByFormat(
    format: KnowledgeDocumentFormat,
    rawContent: string,
    baseMetadata: Record<string, unknown>,
  ): Promise<Document[]> {
    switch (format) {
      case KnowledgeDocumentFormat.PDF: {
        const blob = decodeContentToBlob(rawContent, 'application/pdf');
        const docs = await new PDFLoader(blob, { splitPages: true }).load();
        return normalizeLoadedDocuments(docs, baseMetadata);
      }
      case KnowledgeDocumentFormat.DOCX: {
        const blob = decodeContentToBlob(
          rawContent,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        const docs = await new DocxLoader(blob, { type: 'docx' }).load();
        return normalizeLoadedDocuments(docs, baseMetadata);
      }
      case KnowledgeDocumentFormat.HTML: {
        const rawDocs = await new TextDocumentLoader(rawContent, baseMetadata).load();
        const docs = await new HtmlToTextTransformer().transformDocuments(rawDocs);
        return normalizeLoadedDocuments(docs, baseMetadata);
      }
      case KnowledgeDocumentFormat.JSON:
        return new JsonDocumentLoader(rawContent, baseMetadata).load();
      case KnowledgeDocumentFormat.MARKDOWN:
      case KnowledgeDocumentFormat.TEXT:
      default:
        return new TextDocumentLoader(rawContent, baseMetadata).load();
    }
  }

  async splitDocuments(
    documents: Document[],
    format: KnowledgeDocumentFormat,
    options?: { chunkSize?: number; chunkOverlap?: number },
  ): Promise<DocumentChunk[]> {
    const chunkSize = options?.chunkSize ?? KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE;
    const chunkOverlap =
      options?.chunkOverlap ?? KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP;

    if (chunkSize < KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE) {
      throw new Error(
        `chunkSize must be at least ${KNOWLEDGE_BASE_VALIDATION_LIMITS.MIN_CHUNK_SIZE}`,
      );
    }
    if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
      throw new Error('chunkOverlap must be non-negative and strictly less than chunkSize');
    }
    if (documents.length === 0) {
      throw new Error('Cannot split empty document content into chunks');
    }

    const splitter =
      format === KnowledgeDocumentFormat.MARKDOWN
        ? new MarkdownTextSplitter({ chunkSize, chunkOverlap })
        : new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });

    const splitDocs = await splitter.splitDocuments(documents);

    let currentSection = '';
    return splitDocs
      .filter((doc) => doc.pageContent.trim().length > 0)
      .map((doc, chunkIndex) => {
        const content = doc.pageContent.trim();
        const headingMatch = /^(#{1,6}\s+.+)$/m.exec(content);
        if (headingMatch?.[1]) {
          currentSection = headingMatch[1].replace(/^#+\s*/, '').trim();
        }

        const metadata = sanitizeMetadata(doc.metadata);
        if (format === KnowledgeDocumentFormat.MARKDOWN && currentSection.length > 0) {
          metadata.section = currentSection;
        }

        return {
          chunkIndex,
          content,
          tokenCount: Math.max(1, Math.ceil(content.length / 4)),
          characterCount: content.length,
          metadata,
        };
      });
  }

  async processDocument(input: {
    rawContent: string;
    format?: KnowledgeDocumentFormat;
    fileName?: string;
    documentId?: string;
    metadata?: Record<string, string | number | boolean>;
    chunkSize?: number;
    chunkOverlap?: number;
  }): Promise<ProcessedDocumentResult> {
    const { format, documents } = await this.loadDocuments(input);
    const chunks = await this.splitDocuments(documents, format, {
      chunkSize: input.chunkSize,
      chunkOverlap: input.chunkOverlap,
    });
    const text = documents.map((doc) => doc.pageContent).join('\n\n');

    return {
      format,
      text,
      characterCount: text.length,
      documents,
      chunks,
    };
  }
}
