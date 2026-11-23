import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { HtmlToTextTransformer } from '@langchain/community/document_transformers/html_to_text';
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';
import { MarkdownTextSplitter, RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Injectable } from '@nestjs/common';
import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { KnowledgeDocumentFormat } from '@semcache/shared-types';

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

class TextDocumentLoader extends BaseDocumentLoader {
  constructor(
    private readonly content: string,
    private readonly metadata: Record<string, unknown>,
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    const normalized = this.content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (normalized.length === 0) {
      return [];
    }
    return [new Document({ pageContent: normalized, metadata: { ...this.metadata } })];
  }
}

class JsonDocumentLoader extends BaseDocumentLoader {
  constructor(
    private readonly rawJson: string,
    private readonly metadata: Record<string, unknown>,
  ) {
    super();
  }

  async load(): Promise<Document[]> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.rawJson);
    } catch {
      throw new Error('Invalid JSON document content');
    }

    const lines: string[] = [];
    this.flattenJsonValue(parsed, '', lines);
    const text = lines.join('\n').trim();
    if (text.length === 0) {
      return [];
    }
    return [new Document({ pageContent: text, metadata: { ...this.metadata } })];
  }

  private flattenJsonValue(value: unknown, path: string, lines: string[]): void {
    if (value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value).trim();
      if (text.length > 0) {
        lines.push(path ? `${path}: ${text}` : text);
      }
      return;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        this.flattenJsonValue(value[i], path ? `${path}[${i}]` : `[${i}]`, lines);
      }
      return;
    }
    if (typeof value === 'object') {
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        this.flattenJsonValue(entry, path ? `${path}.${key}` : key, lines);
      }
    }
  }
}

function decodeContentToBlob(rawContent: string, mimeType: string): Blob {
  const dataUrlPrefix = /^data:[^;]+;base64,/i;
  const cleaned = rawContent.replace(dataUrlPrefix, '').trim();
  const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(cleaned) && cleaned.length >= 4;
  const buffer = isBase64 ? Buffer.from(cleaned, 'base64') : Buffer.from(rawContent, 'utf-8');
  return new Blob([buffer], { type: mimeType });
}

function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'loc' && typeof value === 'object' && value !== null) {
      const pageNumber = (value as { pageNumber?: unknown }).pageNumber;
      if (typeof pageNumber === 'number' && Number.isFinite(pageNumber)) {
        sanitized.pageNumber = pageNumber;
      }
      continue;
    }
    if (key === 'pdf' && typeof value === 'object' && value !== null) {
      const totalPages = (value as { totalPages?: unknown }).totalPages;
      if (typeof totalPages === 'number' && Number.isFinite(totalPages)) {
        sanitized.totalPages = totalPages;
      }
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

@Injectable()
export class DocumentProcessorService {
  resolveFormat(format?: KnowledgeDocumentFormat, fileName?: string): KnowledgeDocumentFormat {
    if (format) {
      return format;
    }

    const lower = fileName?.trim().toLowerCase() ?? '';
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) {
      return KnowledgeDocumentFormat.MARKDOWN;
    }
    if (lower.endsWith('.html') || lower.endsWith('.htm')) {
      return KnowledgeDocumentFormat.HTML;
    }
    if (lower.endsWith('.json')) {
      return KnowledgeDocumentFormat.JSON;
    }
    if (lower.endsWith('.pdf')) {
      return KnowledgeDocumentFormat.PDF;
    }
    if (lower.endsWith('.docx')) {
      return KnowledgeDocumentFormat.DOCX;
    }
    return KnowledgeDocumentFormat.TEXT;
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

    let documents: Document[];
    switch (resolvedFormat) {
      case KnowledgeDocumentFormat.PDF: {
        const blob = decodeContentToBlob(input.rawContent, 'application/pdf');
        const loader = new PDFLoader(blob, { splitPages: true });
        documents = (await loader.load()).map(
          (doc) =>
            new Document({
              pageContent: doc.pageContent.trim(),
              metadata: { ...baseMetadata, ...doc.metadata },
            }),
        );
        break;
      }
      case KnowledgeDocumentFormat.DOCX: {
        const blob = decodeContentToBlob(
          input.rawContent,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        const loader = new DocxLoader(blob, { type: 'docx' });
        documents = (await loader.load()).map(
          (doc) =>
            new Document({
              pageContent: doc.pageContent.trim(),
              metadata: { ...baseMetadata, ...doc.metadata },
            }),
        );
        break;
      }
      case KnowledgeDocumentFormat.HTML: {
        const rawDocs = await new TextDocumentLoader(input.rawContent, baseMetadata).load();
        const transformer = new HtmlToTextTransformer();
        documents = (await transformer.transformDocuments(rawDocs)).map(
          (doc) =>
            new Document({
              pageContent: doc.pageContent.trim(),
              metadata: { ...baseMetadata, ...doc.metadata },
            }),
        );
        break;
      }
      case KnowledgeDocumentFormat.JSON: {
        documents = await new JsonDocumentLoader(input.rawContent, baseMetadata).load();
        break;
      }
      case KnowledgeDocumentFormat.MARKDOWN:
      case KnowledgeDocumentFormat.TEXT:
      default: {
        documents = await new TextDocumentLoader(input.rawContent, baseMetadata).load();
        break;
      }
    }

    const nonEmptyDocs = documents.filter((doc) => doc.pageContent.trim().length > 0);
    if (nonEmptyDocs.length === 0) {
      throw new Error('Document contains no extractable text content after processing');
    }

    return { format: resolvedFormat, documents: nonEmptyDocs };
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
