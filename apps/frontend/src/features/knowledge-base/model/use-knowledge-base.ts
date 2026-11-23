import type {
  ListKnowledgeDocumentsQueryDto,
  RetrieveKnowledgeContextRequestDto,
  UploadKnowledgeDocumentRequestDto,
} from '@semcache/shared-dtos';
import { KnowledgeDocumentStatus } from '@semcache/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteKnowledgeDocument,
  getKnowledgeDocument,
  listKnowledgeDocuments,
  reprocessKnowledgeDocument,
  searchKnowledgeBase,
  uploadMultipleKnowledgeDocuments,
} from '@/features/knowledge-base/api/knowledge-base.client';
import { queryKeys } from '@/shared/api/query-client';

const PROCESSING_POLL_INTERVAL_MS = 2_000;

function isActiveStatus(status: KnowledgeDocumentStatus): boolean {
  return (
    status === KnowledgeDocumentStatus.PENDING || status === KnowledgeDocumentStatus.PROCESSING
  );
}

export function useKnowledgeDocumentsQuery(filters?: ListKnowledgeDocumentsQueryDto) {
  return useQuery({
    queryKey: queryKeys.knowledgeBase.list(filters),
    queryFn: () => listKnowledgeDocuments(filters),
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs) {
        return false;
      }
      return docs.some((doc) => isActiveStatus(doc.status)) ? PROCESSING_POLL_INTERVAL_MS : false;
    },
  });
}

export function useKnowledgeDocumentDetailQuery(documentId: string | null) {
  return useQuery({
    queryKey: queryKeys.knowledgeBase.detail(documentId ?? ''),
    queryFn: () => getKnowledgeDocument(documentId!),
    enabled: Boolean(documentId),
    refetchInterval: (query) => {
      const doc = query.state.data;
      if (!doc) {
        return false;
      }
      return isActiveStatus(doc.status) ? PROCESSING_POLL_INTERVAL_MS : false;
    },
  });
}

export function useUploadKnowledgeDocumentsMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      documents: UploadKnowledgeDocumentRequestDto[];
      onProgress?: (completed: number, total: number) => void;
    }) => uploadMultipleKnowledgeDocuments(input.documents, input.onProgress),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.knowledgeBase.all });
    },
  });
}

export function useReprocessKnowledgeDocumentMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => reprocessKnowledgeDocument(documentId),
    onSuccess: (updated) => {
      void client.invalidateQueries({ queryKey: queryKeys.knowledgeBase.all });
      client.setQueryData(queryKeys.knowledgeBase.detail(updated.id), updated);
    },
  });
}

export function useDeleteKnowledgeDocumentMutation() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteKnowledgeDocument(documentId),
    onSuccess: (_result, documentId) => {
      void client.invalidateQueries({ queryKey: queryKeys.knowledgeBase.all });
      client.removeQueries({ queryKey: queryKeys.knowledgeBase.detail(documentId) });
    },
  });
}

export function useSearchKnowledgeBaseMutation() {
  return useMutation({
    mutationFn: (dto: RetrieveKnowledgeContextRequestDto) => searchKnowledgeBase(dto),
  });
}
