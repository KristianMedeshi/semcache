import type { KnowledgeDocumentResponseDto } from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';

export const CATEGORY_LABELS: Record<QueryCategory, string> = {
  [QueryCategory.BILLING]: 'Billing',
  [QueryCategory.TECHNICAL_SUPPORT]: 'Technical Support',
  [QueryCategory.ACCOUNT_MANAGEMENT]: 'Account Management',
  [QueryCategory.PRODUCT_INQUIRY]: 'Product Inquiry',
  [QueryCategory.GENERAL]: 'General',
};

export const FORMAT_LABELS: Record<KnowledgeDocumentFormat, string> = {
  [KnowledgeDocumentFormat.TEXT]: 'Plain Text',
  [KnowledgeDocumentFormat.MARKDOWN]: 'Markdown',
  [KnowledgeDocumentFormat.HTML]: 'HTML',
  [KnowledgeDocumentFormat.JSON]: 'JSON',
};

export const STATUS_LABELS: Record<KnowledgeDocumentStatus, string> = {
  [KnowledgeDocumentStatus.PENDING]: 'Pending',
  [KnowledgeDocumentStatus.PROCESSING]: 'Processing',
  [KnowledgeDocumentStatus.READY]: 'Ready',
  [KnowledgeDocumentStatus.FAILED]: 'Failed',
};

export function inferFormatFromFileName(fileName: string): KnowledgeDocumentFormat {
  const lower = fileName.trim().toLowerCase();
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

export function deriveTitleFromFileName(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  const normalized = withoutExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized : fileName;
}

export interface ParsedUploadFile {
  title: string;
  fileName: string;
  format: KnowledgeDocumentFormat;
  content: string;
}

export async function readUploadedFile(file: File): Promise<ParsedUploadFile> {
  const content = await file.text();
  return {
    title: deriveTitleFromFileName(file.name),
    fileName: file.name,
    format: inferFormatFromFileName(file.name),
    content,
  };
}

export interface DocumentFilterState {
  searchQuery: string;
  category: QueryCategory | 'all';
  status: KnowledgeDocumentStatus | 'all';
}

export function filterKnowledgeDocuments(
  documents: KnowledgeDocumentResponseDto[],
  filters: DocumentFilterState,
): KnowledgeDocumentResponseDto[] {
  const q = filters.searchQuery.trim().toLowerCase();
  return documents.filter((doc) => {
    if (filters.category !== 'all' && doc.category !== filters.category) {
      return false;
    }
    if (filters.status !== 'all' && doc.status !== filters.status) {
      return false;
    }
    if (q.length === 0) {
      return true;
    }
    const haystack = [doc.title, doc.fileName ?? '', doc.errorMessage ?? '', doc.category]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}
