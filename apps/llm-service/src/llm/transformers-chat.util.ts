import { type TextGenerationPipeline, pipeline } from '@huggingface/transformers';
import type { LlmChatCompletionResponseDto, LlmChatMessageDto } from '@semcache/shared-dtos';
import { estimateTokenCount } from './deterministic-embedding.util';

export const DEFAULT_TRANSFORMERS_CHAT_MODEL = 'onnx-community/Qwen2.5-0.5B-Instruct';
export const DEFAULT_TRANSFORMERS_CHAT_DTYPE = 'q4';

const chatPipelineCache = new Map<string, Promise<TextGenerationPipeline>>();

type TextGenDtype = 'auto' | 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16';

export function resetTextGenerationPipelineCache(): void {
  chatPipelineCache.clear();
}

async function getTextGenerationPipeline(
  modelId: string,
  dtype: string,
): Promise<TextGenerationPipeline> {
  const key = `${modelId}::${dtype}`;
  let cached = chatPipelineCache.get(key);
  if (!cached) {
    cached = pipeline('text-generation', modelId, {
      dtype: dtype as TextGenDtype,
    });
    chatPipelineCache.set(key, cached);
  }
  return cached;
}

function extractGeneratedReply(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output;
  if (!first || typeof first !== 'object' || !('generated_text' in first)) {
    return '';
  }

  const generated = (first as { generated_text: unknown }).generated_text;
  if (typeof generated === 'string') {
    return generated.trim();
  }
  if (Array.isArray(generated) && generated.length > 0) {
    const last = generated.at(-1);
    if (last && typeof last === 'object' && 'content' in last && typeof last.content === 'string') {
      return last.content.trim();
    }
  }
  return '';
}

/**
 * Generates an in-process chat completion using `@huggingface/transformers`.
 */
export async function generateTransformersChatCompletion(input: {
  modelId: string;
  dtype: string;
  messages: LlmChatMessageDto[];
  maxNewTokens: number;
  temperature?: number;
}): Promise<LlmChatCompletionResponseDto> {
  const startedAt = performance.now();
  const generator = await getTextGenerationPipeline(input.modelId, input.dtype);
  const chatInput = input.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const useSampling = input.temperature !== undefined && input.temperature > 0;
  const output = await generator(chatInput, {
    max_new_tokens: input.maxNewTokens,
    do_sample: useSampling,
    ...(useSampling ? { temperature: input.temperature } : {}),
    return_full_text: false,
  });

  const content = extractGeneratedReply(output);
  const promptTokens = input.messages.reduce((sum, m) => sum + estimateTokenCount(m.content), 0);
  const completionTokens = estimateTokenCount(content);

  return {
    content,
    model: input.modelId,
    latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
  };
}
