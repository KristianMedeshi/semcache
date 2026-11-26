import { extractRpcErrorPayload, formatRpcErrorMessage } from '@semcache/shared-config';
import type { RetrievedKnowledgeChunkDto } from '@semcache/shared-dtos';

export function formatRetrievedContext(results: RetrievedKnowledgeChunkDto[]): string {
  if (results.length === 0) {
    return '';
  }

  return results
    .map(
      (result, index) =>
        `[Source ${index + 1}: ${result.documentTitle}${result.fileName ? ` (${result.fileName})` : ''} | Category: ${result.category} | Section Chunk #${result.chunkIndex + 1}]\n${result.content}`,
    )
    .join('\n\n---\n\n');
}

export function formatProcessingError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown document processing error';
}

export function formatEmbeddingRpcError(error: unknown): string {
  const rpcError = extractRpcErrorPayload(error);
  if (rpcError) {
    return formatRpcErrorMessage(rpcError, 'Embedding service error');
  }
  return error instanceof Error ? error.message : 'Embedding service unavailable';
}
