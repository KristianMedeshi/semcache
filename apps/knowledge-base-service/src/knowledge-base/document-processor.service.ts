import { Injectable } from '@nestjs/common';
import { KNOWLEDGE_BASE_VALIDATION_LIMITS } from '@semcache/shared-dtos';
import { KnowledgeDocumentFormat } from '@semcache/shared-types';

export interface ExtractedDocumentContent {
  format: KnowledgeDocumentFormat;
  text: string;
  characterCount: number;
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  characterCount: number;
  metadata: Record<string, string | number | boolean>;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

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
    return KnowledgeDocumentFormat.TEXT;
  }

  extractContent(
    rawContent: string,
    format?: KnowledgeDocumentFormat,
    fileName?: string,
  ): ExtractedDocumentContent {
    const resolvedFormat = this.resolveFormat(format, fileName);

    let extracted: string;
    switch (resolvedFormat) {
      case KnowledgeDocumentFormat.HTML:
        extracted = this.extractFromHtml(rawContent);
        break;
      case KnowledgeDocumentFormat.JSON:
        extracted = this.extractFromJson(rawContent);
        break;
      case KnowledgeDocumentFormat.MARKDOWN:
      case KnowledgeDocumentFormat.TEXT:
      default:
        extracted = this.normalizeWhitespace(rawContent);
        break;
    }

    if (extracted.length === 0) {
      throw new Error('Document contains no extractable text content after processing');
    }

    return {
      format: resolvedFormat,
      text: extracted,
      characterCount: extracted.length,
    };
  }

  splitIntoChunks(
    text: string,
    options?: { chunkSize?: number; chunkOverlap?: number },
  ): DocumentChunk[] {
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

    const normalized = this.normalizeWhitespace(text);
    if (normalized.length === 0) {
      throw new Error('Cannot split empty document content into chunks');
    }

    const segments = this.recursiveSplit(normalized, chunkSize);
    const mergedChunks = this.mergeSegmentsWithOverlap(segments, chunkSize, chunkOverlap);

    let currentHeading = '';
    return mergedChunks.map((content, chunkIndex) => {
      const headingMatch = /^(#{1,6}\s+.+)$/m.exec(content);
      if (headingMatch?.[1]) {
        currentHeading = headingMatch[1].replace(/^#+\s*/, '').trim();
      }

      const metadata: Record<string, string | number | boolean> = currentHeading
        ? { section: currentHeading }
        : {};

      return {
        chunkIndex,
        content,
        tokenCount: Math.max(1, Math.ceil(content.length / 4)),
        characterCount: content.length,
        metadata,
      };
    });
  }

  private extractFromHtml(rawHtml: string): string {
    const withoutScriptsAndStyles = rawHtml
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

    const withLineBreaks = withoutScriptsAndStyles
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote)>/gi, '\n\n')
      .replace(/<(li)\b[^>]*>/gi, '- ');

    const withoutTags = withLineBreaks.replace(/<[^>]+>/g, ' ');
    const decoded = withoutTags.replace(
      /&(amp|lt|gt|quot|#39|apos|nbsp);/gi,
      (entity) => HTML_ENTITY_MAP[entity.toLowerCase()] ?? entity,
    );

    return this.normalizeWhitespace(decoded);
  }

  private extractFromJson(rawJson: string): string {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Invalid JSON document content');
    }

    const lines: string[] = [];
    this.flattenJsonValue(parsed, '', lines);
    return this.normalizeWhitespace(lines.join('\n'));
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
        const nextPath = path ? `${path}.${key}` : key;
        this.flattenJsonValue(entry, nextPath, lines);
      }
    }
  }

  private normalizeWhitespace(input: string): string {
    return input
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  private recursiveSplit(text: string, chunkSize: number): string[] {
    if (text.length <= chunkSize) {
      return [text];
    }

    const separators = ['\n\n', '\n', '. ', '? ', '! ', '; ', ' '];
    for (const separator of separators) {
      if (!text.includes(separator)) {
        continue;
      }

      const parts = text.split(separator).filter((part) => part.trim().length > 0);
      if (parts.length <= 1) {
        continue;
      }

      const results: string[] = [];
      let current = '';

      for (const rawPart of parts) {
        const part = rawPart.trim();
        const joiner = separator.trim().length === 0 ? separator : `${separator.trim()} `;
        const candidate = current.length === 0 ? part : `${current}${joiner}${part}`;

        if (candidate.length <= chunkSize) {
          current = candidate;
        } else {
          if (current.length > 0) {
            results.push(current);
          }
          if (part.length > chunkSize) {
            results.push(...this.recursiveSplit(part, chunkSize));
            current = '';
          } else {
            current = part;
          }
        }
      }

      if (current.length > 0) {
        results.push(current);
      }
      return results;
    }

    // Hard character split fallback for uninterrupted tokens
    const hardSlices: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      hardSlices.push(text.slice(i, i + chunkSize));
    }
    return hardSlices;
  }

  private mergeSegmentsWithOverlap(
    segments: string[],
    chunkSize: number,
    chunkOverlap: number,
  ): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (trimmed.length === 0) {
        continue;
      }

      const candidate = current.length === 0 ? trimmed : `${current}\n\n${trimmed}`;
      if (candidate.length <= chunkSize) {
        current = candidate;
        continue;
      }

      if (current.length > 0) {
        chunks.push(current);
      }

      if (chunkOverlap > 0 && current.length > 0) {
        const overlapText = this.extractOverlapTail(current, chunkOverlap);
        const withOverlap = overlapText.length > 0 ? `${overlapText}\n\n${trimmed}` : trimmed;
        current = withOverlap.length <= chunkSize ? withOverlap : trimmed;
      } else {
        current = trimmed;
      }
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    return chunks;
  }

  private extractOverlapTail(text: string, overlap: number): string {
    if (text.length <= overlap) {
      return text;
    }

    const tail = text.slice(text.length - overlap);
    const firstSpace = tail.indexOf(' ');
    if (firstSpace > 0 && firstSpace < tail.length - 1) {
      return tail.slice(firstSpace + 1).trim();
    }
    return tail.trim();
  }
}
