import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ConfigService,
  extractRpcErrorPayload,
  formatRpcErrorMessage,
} from '@semcache/shared-config';
import {
  type DeleteKnowledgeDocumentResponseDto,
  KNOWLEDGE_BASE_VALIDATION_LIMITS,
  type KnowledgeContextSourceReferenceDto,
  type KnowledgeDocumentDetailResponseDto,
  type KnowledgeDocumentResponseDto,
  type ListKnowledgeDocumentsQueryDto,
  type LlmGenerateEmbeddingsRequestDto,
  type LlmGenerateEmbeddingsResponseDto,
  type RetrieveKnowledgeContextRequestDto,
  type RetrieveKnowledgeContextResponseDto,
  type RetrievedKnowledgeChunkDto,
  type UploadKnowledgeDocumentRequestDto,
} from '@semcache/shared-dtos';
import {
  KnowledgeDocumentFormat,
  KnowledgeDocumentStatus,
  QueryCategory,
  SERVICE_TCP_PATTERNS,
} from '@semcache/shared-types';
import { firstValueFrom } from 'rxjs';
import type { KnowledgeBaseEnv } from '../config/knowledge-base.env';
import type { KnowledgeDocumentRecord } from '../db/schema';
import { DocumentProcessorService } from './document-processor.service';
import {
  KnowledgeBaseRepository,
  toKnowledgeChunkResponseDto,
  toKnowledgeDocumentResponseDto,
} from './knowledge-base.repository';

export const LLM_SERVICE_CLIENT = Symbol('LLM_SERVICE_CLIENT');

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly repository: KnowledgeBaseRepository,
    private readonly processor: DocumentProcessorService,
    @Inject(LLM_SERVICE_CLIENT) private readonly llmClient: ClientProxy,
    @Optional() private readonly config?: ConfigService<KnowledgeBaseEnv, true>,
  ) {}

  async uploadDocument(
    dto: UploadKnowledgeDocumentRequestDto,
    uploadedBy?: string,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    const resolvedFormat = this.processor.resolveFormat(dto.format, dto.fileName);
    const defaultChunkSize =
      this.config?.get('KB_CHUNK_SIZE') ?? KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE;
    const defaultChunkOverlap =
      this.config?.get('KB_CHUNK_OVERLAP') ??
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP;

    const chunkSize = dto.chunkSize ?? defaultChunkSize;
    const chunkOverlap = dto.chunkOverlap ?? defaultChunkOverlap;
    if (chunkOverlap >= chunkSize) {
      throw new BadRequestException('chunkOverlap must be strictly less than chunkSize');
    }

    const created = await this.repository.createDocument({
      title: dto.title.trim(),
      fileName: dto.fileName?.trim() || undefined,
      format: resolvedFormat,
      category: dto.category ?? QueryCategory.GENERAL,
      rawContent: dto.content,
      metadata: dto.metadata ?? {},
      uploadedBy,
      status: KnowledgeDocumentStatus.PENDING,
    });

    return this.processAndStoreDocument(created, { chunkSize, chunkOverlap });
  }

  async reprocessDocument(
    documentId: string,
    options?: { chunkSize?: number; chunkOverlap?: number },
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    const existing = await this.repository.findDocumentById(documentId);
    if (!existing) {
      throw new NotFoundException(`Knowledge document ${documentId} not found`);
    }

    const defaultChunkSize =
      this.config?.get('KB_CHUNK_SIZE') ?? KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_SIZE;
    const defaultChunkOverlap =
      this.config?.get('KB_CHUNK_OVERLAP') ??
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_CHUNK_OVERLAP;
    const chunkSize = options?.chunkSize ?? defaultChunkSize;
    const chunkOverlap = options?.chunkOverlap ?? defaultChunkOverlap;

    if (chunkOverlap >= chunkSize) {
      throw new BadRequestException('chunkOverlap must be strictly less than chunkSize');
    }

    return this.processAndStoreDocument(existing, { chunkSize, chunkOverlap });
  }

  async listDocuments(
    filters?: ListKnowledgeDocumentsQueryDto,
  ): Promise<KnowledgeDocumentResponseDto[]> {
    const records = await this.repository.findAllDocuments(filters);
    return records.map(toKnowledgeDocumentResponseDto);
  }

  async getDocument(
    documentId: string,
    includeChunks = true,
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    const record = await this.repository.findDocumentById(documentId);
    if (!record) {
      throw new NotFoundException(`Knowledge document ${documentId} not found`);
    }

    const chunks = includeChunks ? await this.repository.findChunksByDocumentId(documentId) : [];

    return {
      ...toKnowledgeDocumentResponseDto(record),
      content: record.extractedContent || record.rawContent,
      ...(includeChunks ? { chunks: chunks.map(toKnowledgeChunkResponseDto) } : {}),
    };
  }

  async deleteDocument(documentId: string): Promise<DeleteKnowledgeDocumentResponseDto> {
    const result = await this.repository.deleteDocument(documentId);
    if (!result.deleted) {
      throw new NotFoundException(`Knowledge document ${documentId} not found`);
    }

    return {
      id: documentId,
      deleted: true,
      deletedChunksCount: result.deletedChunksCount,
    };
  }

  async retrieveContext(
    dto: RetrieveKnowledgeContextRequestDto,
  ): Promise<RetrieveKnowledgeContextResponseDto> {
    const trimmedQuery = dto.query.trim();
    if (trimmedQuery.length === 0) {
      throw new BadRequestException('Search query must not be empty');
    }

    const topK =
      dto.topK ??
      this.config?.get('KB_DEFAULT_TOP_K') ??
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_TOP_K;
    const minSimilarity =
      dto.minSimilarity ??
      this.config?.get('KB_MIN_SIMILARITY') ??
      KNOWLEDGE_BASE_VALIDATION_LIMITS.DEFAULT_MIN_SIMILARITY;

    const [queryEmbedding] = await this.generateEmbeddingsInBatches([trimmedQuery]);
    if (!queryEmbedding) {
      throw new BadGatewayException('Failed to generate query embedding');
    }

    const results = await this.repository.searchSimilarChunks({
      queryEmbedding,
      topK,
      minSimilarity,
      category: dto.category,
    });

    const sources = this.extractUniqueSources(results);
    const formattedContext = this.formatRetrievedContext(results);

    return {
      query: trimmedQuery,
      hasRelevantContext: results.length > 0,
      formattedContext,
      results,
      sources,
    };
  }

  private async processAndStoreDocument(
    document: KnowledgeDocumentRecord,
    options: { chunkSize: number; chunkOverlap: number },
  ): Promise<KnowledgeDocumentDetailResponseDto> {
    await this.repository.updateDocumentStatus(document.id, {
      status: KnowledgeDocumentStatus.PROCESSING,
      errorMessage: null,
    });

    try {
      const processed = await this.processor.processDocument({
        rawContent: document.rawContent,
        format: document.format as KnowledgeDocumentFormat,
        fileName: document.fileName ?? undefined,
        documentId: document.id,
        metadata: document.metadata,
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
      });

      const embeddings = await this.generateEmbeddingsInBatches(
        processed.chunks.map((chunk) => chunk.content),
      );

      if (embeddings.length !== processed.chunks.length) {
        throw new Error(
          `Embedding count mismatch: expected ${processed.chunks.length}, received ${embeddings.length}`,
        );
      }

      const storedChunks = await this.repository.replaceDocumentChunks(
        document.id,
        processed.chunks.map((chunk, index) => ({
          ...chunk,
          embedding: embeddings[index] ?? [],
        })),
      );

      const readyRecord = await this.repository.updateDocumentStatus(document.id, {
        status: KnowledgeDocumentStatus.READY,
        format: processed.format,
        extractedContent: processed.text,
        chunkCount: storedChunks.length,
        characterCount: processed.characterCount,
        errorMessage: null,
      });

      return {
        ...toKnowledgeDocumentResponseDto(readyRecord),
        content: readyRecord.extractedContent,
        chunks: storedChunks.map(toKnowledgeChunkResponseDto),
      };
    } catch (error) {
      const errorMessage = this.formatProcessingError(error);
      this.logger.error(
        JSON.stringify({
          event: 'kb.document.processing_failed',
          documentId: document.id,
          title: document.title,
          error: errorMessage,
        }),
      );

      const failedRecord = await this.repository.updateDocumentStatus(document.id, {
        status: KnowledgeDocumentStatus.FAILED,
        chunkCount: 0,
        errorMessage,
      });

      return {
        ...toKnowledgeDocumentResponseDto(failedRecord),
        content: failedRecord.extractedContent || failedRecord.rawContent,
        chunks: [],
      };
    }
  }

  private async generateEmbeddingsInBatches(texts: string[]): Promise<number[][]> {
    const batchSize = KNOWLEDGE_BASE_VALIDATION_LIMITS.MAX_EMBEDDING_BATCH_SIZE;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      try {
        const response = await firstValueFrom(
          this.llmClient.send<LlmGenerateEmbeddingsResponseDto, LlmGenerateEmbeddingsRequestDto>(
            SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS,
            { texts: batch },
          ),
        );
        allEmbeddings.push(...response.embeddings);
      } catch (error) {
        const rpcError = extractRpcErrorPayload(error);
        const message = rpcError
          ? formatRpcErrorMessage(rpcError, 'Embedding service error')
          : error instanceof Error
            ? error.message
            : 'LLM embedding service unavailable';
        throw new BadGatewayException(message);
      }
    }

    return allEmbeddings;
  }

  private extractUniqueSources(
    results: RetrievedKnowledgeChunkDto[],
  ): KnowledgeContextSourceReferenceDto[] {
    return results.map((result) => result.source);
  }

  private formatRetrievedContext(results: RetrievedKnowledgeChunkDto[]): string {
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

  private formatProcessingError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown document processing error';
  }
}
