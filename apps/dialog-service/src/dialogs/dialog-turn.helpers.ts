import { Annotation } from '@langchain/langgraph';
import type {
  DialogMessageResponseDto,
  DialogResponseDto,
  LlmChatCompletionResponseDto,
  LlmChatMessageDto,
  RetrieveKnowledgeContextResponseDto,
  SemanticCacheLookupResponseDto,
  SemanticCacheTurnMetadataDto,
} from '@semcache/shared-dtos';
import { CacheMode, QueryCategory } from '@semcache/shared-types';

export const CUSTOMER_SUPPORT_SYSTEM_PROMPT = [
  'You are the official Telecom Assistant for SemCache Telecom. Help customers clearly, politely, and accurately with mobile plans and subscriptions, mobile internet and data usage, account balance and bill payments, international roaming, SIM and eSIM activation, network connectivity troubleshooting, and account management.',
  'Grounding rules (mandatory):',
  '1. Prioritize the retrieved Knowledge Base context provided below when answering customer questions, and reference the source document title naturally when applicable.',
  '2. Never invent, guess, or fabricate company-specific information (such as plan names, prices, fees, data allowances, roaming rates, activation codes, SLAs, or policies) that is not supported by the retrieved Knowledge Base context or conversation history.',
  '3. If the retrieved Knowledge Base context does not contain sufficient information to answer a company-specific question, clearly acknowledge that our knowledge base does not currently have verified details for that specific question and offer to connect the customer with a human support specialist.',
  '4. Structure responses using clean Markdown headings, bullet points, or numbered steps when helpful. Never mention internal caching, similarity scores, chunk IDs, vector metrics, or model identifiers.',
].join('\n');

export function buildSystemPromptWithKnowledge(
  knowledgeContext: RetrieveKnowledgeContextResponseDto | null,
): string {
  const hasContext =
    knowledgeContext?.hasRelevantContext && knowledgeContext.formattedContext.trim().length > 0;
  const contextBody = hasContext
    ? knowledgeContext.formattedContext
    : 'No relevant company documents were found in the knowledge base for this inquiry. Do not invent company-specific prices, plans, codes, or policies; explicitly acknowledge when verified company details are unavailable and offer to escalate to a human specialist.';

  return [
    CUSTOMER_SUPPORT_SYSTEM_PROMPT,
    '',
    '### Retrieved Official Knowledge Base Context',
    contextBody,
  ].join('\n');
}

export const DialogTurnState = Annotation.Root({
  dialog: Annotation<DialogResponseDto>,
  userContent: Annotation<string>,
  requestedModel: Annotation<string | undefined>,
  parentMessageId: Annotation<string | null | undefined>,
  queryCategory: Annotation<QueryCategory | undefined>,
  cacheMode: Annotation<CacheMode | undefined>,
  fixedThresholdOverride: Annotation<number | undefined>,
  queryEmbedding: Annotation<number[] | null>,
  cacheLookup: Annotation<SemanticCacheLookupResponseDto | null>,
  cacheHit: Annotation<boolean>,
  knowledgeContext: Annotation<RetrieveKnowledgeContextResponseDto | null>,
  history: Annotation<LlmChatMessageDto[]>,
  userMessage: Annotation<DialogMessageResponseDto | null>,
  llmCompletion: Annotation<LlmChatCompletionResponseDto | null>,
  assistantMessage: Annotation<DialogMessageResponseDto | null>,
  updatedDialog: Annotation<DialogResponseDto | null>,
});

export type DialogTurnStateType = typeof DialogTurnState.State;

export interface DialogTurnInput {
  dialog: DialogResponseDto;
  content: string;
  model?: string;
  parentMessageId?: string | null;
  category?: QueryCategory;
  cacheMode?: CacheMode;
  fixedThresholdOverride?: number;
}

export function createInitialDialogTurnState(input: DialogTurnInput): DialogTurnStateType {
  return {
    dialog: input.dialog,
    userContent: input.content,
    requestedModel: input.model,
    parentMessageId: input.parentMessageId,
    queryCategory: input.category,
    cacheMode: input.cacheMode,
    fixedThresholdOverride: input.fixedThresholdOverride,
    queryEmbedding: null,
    cacheLookup: null,
    cacheHit: false,
    knowledgeContext: null,
    history: [],
    userMessage: null,
    llmCompletion: null,
    assistantMessage: null,
    updatedDialog: null,
  };
}

const CATEGORY_KEYWORD_RULES: ReadonlyArray<{
  category: QueryCategory;
  keywords: readonly string[];
}> = [
  {
    category: QueryCategory.BILLING,
    keywords: [
      'bill',
      'invoice',
      'charge',
      'refund',
      'autopay',
      'payment',
      'due date',
      'рахунок',
      'списан',
      'повернен',
      'автоплат',
      'оплат',
    ],
  },
  {
    category: QueryCategory.TECHNICAL_SUPPORT,
    keywords: [
      'apn',
      'router',
      'wi-fi',
      'wifi',
      'volte',
      'vowifi',
      'slow',
      'outage',
      'signal',
      'sms',
      'pppoe',
      'роутер',
      'швидк',
      'збій',
      'сигнал',
      'інтернет',
    ],
  },
  {
    category: QueryCategory.ACCOUNT_MANAGEMENT,
    keywords: [
      'sim',
      'esim',
      'puk',
      'pin',
      'contract',
      'cancel',
      'terminat',
      'port',
      'suspend',
      'контракт',
      'розірв',
      'призупин',
      'перенес',
    ],
  },
  {
    category: QueryCategory.PRODUCT_INQUIRY,
    keywords: [
      'roam',
      'plan',
      'tariff',
      'unlimited',
      '5g',
      'bundle',
      'family',
      'роумінг',
      'тариф',
      'безліміт',
      'пакет',
    ],
  },
];

export function classifyQueryCategory(query: string): QueryCategory {
  const text = query.toLowerCase();
  const matched = CATEGORY_KEYWORD_RULES.find((rule) =>
    rule.keywords.some((kw) => text.includes(kw)),
  );
  return matched ? matched.category : QueryCategory.GENERAL;
}

export function toSemanticCacheTurnMetadata(
  lookup: SemanticCacheLookupResponseDto | null,
): SemanticCacheTurnMetadataDto | undefined {
  if (!lookup) {
    return undefined;
  }
  return {
    status: lookup.status,
    mode: lookup.mode,
    ...(lookup.entryId ? { entryId: lookup.entryId } : {}),
    ...(lookup.matchedQuery ? { matchedQuery: lookup.matchedQuery } : {}),
    cosineSimilarity: lookup.evaluation.cosineSimilarity,
    adaptiveThreshold: lookup.evaluation.adaptiveThreshold,
    ...(lookup.evaluation.localClusterDensity !== undefined
      ? { localClusterDensity: lookup.evaluation.localClusterDensity }
      : {}),
    ...(lookup.evaluation.neighborCount !== undefined
      ? { neighborCount: lookup.evaluation.neighborCount }
      : {}),
    category: lookup.evaluation.category,
    ...(lookup.knowledgeSourceIds ? { knowledgeSourceIds: lookup.knowledgeSourceIds } : {}),
  };
}

export function deriveTitleFromMessage(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  return collapsed.length > 60 ? `${collapsed.slice(0, 57)}...` : collapsed;
}

export function buildBranchHistory(
  messages: DialogMessageResponseDto[],
  leafMessageId: string,
): DialogMessageResponseDto[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const chain: DialogMessageResponseDto[] = [];
  const visited = new Set<string>();

  let current: DialogMessageResponseDto | undefined = byId.get(leafMessageId);
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(current);
    current = current.parentMessageId ? byId.get(current.parentMessageId) : undefined;
  }

  return chain.reverse();
}
