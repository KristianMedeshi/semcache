import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
} from '@semcache/shared-types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/api-client';
import {
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeDocuments,
  reprocessKnowledgeDocument,
  searchKnowledgeBase,
  uploadKnowledgeDocument,
  uploadMultipleKnowledgeDocuments,
} from './knowledge-base.client';

vi.mock('@/shared/api/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('knowledge-base.client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists knowledge base documents with optional category and status filters', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });
    await listKnowledgeDocuments();
    expect(apiClient.get).toHaveBeenCalledWith('/knowledge-base/documents', undefined);

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: [] });
    await listKnowledgeDocuments({
      category: QueryCategory.BILLING,
      status: KnowledgeDocumentStatus.READY,
    });
    expect(apiClient.get).toHaveBeenCalledWith('/knowledge-base/documents', {
      params: { category: QueryCategory.BILLING, status: KnowledgeDocumentStatus.READY },
    });
  });

  it('fetches document detail, reprocesses, and deletes documents', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { id: 'doc-1' } });
    await getKnowledgeDocument('doc-1');
    expect(apiClient.get).toHaveBeenCalledWith('/knowledge-base/documents/doc-1');

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'doc-1', status: 'ready' } });
    await reprocessKnowledgeDocument('doc-1');
    expect(apiClient.post).toHaveBeenCalledWith('/knowledge-base/documents/doc-1/reprocess');

    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { id: 'doc-1', deleted: true, deletedChunksCount: 3 },
    });
    await deleteKnowledgeDocument('doc-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/knowledge-base/documents/doc-1');
  });

  it('uploads multiple documents and reports progress', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({ data: { id: 'doc-1', title: 'Doc 1' } })
      .mockResolvedValueOnce({ data: { id: 'doc-2', title: 'Doc 2' } });

    const progress = vi.fn();
    const res = await uploadMultipleKnowledgeDocuments(
      [
        { title: 'Doc 1', content: 'A', format: KnowledgeDocumentFormat.TEXT },
        { title: 'Doc 2', content: 'B', format: KnowledgeDocumentFormat.MARKDOWN },
      ],
      progress,
    );

    expect(res).toHaveLength(2);
    expect(progress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(progress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it('uploads a single document and searches knowledge base context', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'doc-3' } });
    await uploadKnowledgeDocument({ title: 'Doc 3', content: 'C' });
    expect(apiClient.post).toHaveBeenCalledWith('/knowledge-base/documents', {
      title: 'Doc 3',
      content: 'C',
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { hasRelevantContext: true } });
    await searchKnowledgeBase({ query: 'EU roaming allowance', topK: 4 });
    expect(apiClient.post).toHaveBeenCalledWith('/knowledge-base/search', {
      query: 'EU roaming allowance',
      topK: 4,
    });
  });
});
