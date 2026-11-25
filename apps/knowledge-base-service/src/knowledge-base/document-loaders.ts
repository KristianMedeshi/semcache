import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { Document } from '@langchain/core/documents';

export class TextDocumentLoader extends BaseDocumentLoader {
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

export class JsonDocumentLoader extends BaseDocumentLoader {
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

export function decodeContentToBlob(rawContent: string, mimeType: string): Blob {
  const dataUrlPrefix = /^data:[^;]+;base64,/i;
  const cleaned = rawContent.replace(dataUrlPrefix, '').trim();
  const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(cleaned) && cleaned.length >= 4;
  const buffer = isBase64 ? Buffer.from(cleaned, 'base64') : Buffer.from(rawContent, 'utf-8');
  return new Blob([buffer], { type: mimeType });
}

export function normalizeLoadedDocuments(
  docs: Document[],
  baseMetadata: Record<string, unknown>,
): Document[] {
  return docs.map(
    (doc) =>
      new Document({
        pageContent: doc.pageContent.trim(),
        metadata: { ...baseMetadata, ...doc.metadata },
      }),
  );
}

export function sanitizeMetadata(
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
