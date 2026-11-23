import type {
  DeleteKnowledgeDocumentResponseDto,
  KnowledgeDocumentDetailResponseDto,
  KnowledgeDocumentResponseDto,
  ListKnowledgeDocumentsQueryDto,
  RetrieveKnowledgeContextRequestDto,
  RetrieveKnowledgeContextResponseDto,
  UploadKnowledgeDocumentRequestDto,
} from '@semcache/shared-dtos';
import { apiClient } from '@/shared/api/api-client';

export async function listKnowledgeDocuments(
  filters?: ListKnowledgeDocumentsQueryDto,
): Promise<KnowledgeDocumentResponseDto[]> {
  const params: Record<string, string> = {};
  if (filters?.category) {
    params.category = filters.category;
  }
  if (filters?.status) {
    params.status = filters.status;
  }
  const { data } = await apiClient.get<KnowledgeDocumentResponseDto[]>(
    '/knowledge-base/documents',
    Object.keys(params).length > 0 ? { params } : undefined,
  );
  return data;
}

export async function getKnowledgeDocument(
  documentId: string,
): Promise<KnowledgeDocumentDetailResponseDto> {
  const { data } = await apiClient.get<KnowledgeDocumentDetailResponseDto>(
    `/knowledge-base/documents/${encodeURIComponent(documentId)}`,
  );
  return data;
}

export async function uploadKnowledgeDocument(
  dto: UploadKnowledgeDocumentRequestDto,
): Promise<KnowledgeDocumentDetailResponseDto> {
  const { data } = await apiClient.post<KnowledgeDocumentDetailResponseDto>(
    '/knowledge-base/documents',
    dto,
  );
  return data;
}

export async function uploadMultipleKnowledgeDocuments(
  dtos: UploadKnowledgeDocumentRequestDto[],
  onProgress?: (completed: number, total: number) => void,
): Promise<KnowledgeDocumentDetailResponseDto[]> {
  const results: KnowledgeDocumentDetailResponseDto[] = [];
  for (let i = 0; i < dtos.length; i += 1) {
    const created = await uploadKnowledgeDocument(dtos[i]);
    results.push(created);
    onProgress?.(i + 1, dtos.length);
  }
  return results;
}

export async function reprocessKnowledgeDocument(
  documentId: string,
): Promise<KnowledgeDocumentDetailResponseDto> {
  const { data } = await apiClient.post<KnowledgeDocumentDetailResponseDto>(
    `/knowledge-base/documents/${encodeURIComponent(documentId)}/reprocess`,
  );
  return data;
}

export async function deleteKnowledgeDocument(
  documentId: string,
): Promise<DeleteKnowledgeDocumentResponseDto> {
  const { data } = await apiClient.delete<DeleteKnowledgeDocumentResponseDto>(
    `/knowledge-base/documents/${encodeURIComponent(documentId)}`,
  );
  return data;
}

export async function searchKnowledgeBase(
  dto: RetrieveKnowledgeContextRequestDto,
): Promise<RetrieveKnowledgeContextResponseDto> {
  const { data } = await apiClient.post<RetrieveKnowledgeContextResponseDto>(
    '/knowledge-base/search',
    dto,
  );
  return data;
}
