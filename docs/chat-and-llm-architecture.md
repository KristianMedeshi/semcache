# Chat & LLM Architecture (OpenRouter + `@nestjs/ai` + `@langchain/langgraph`)

## 1. Overview

The chat subsystem implements end-to-end customer support conversations while strictly adhering to SemCache microservice isolation:

```text
Frontend (:5173)
  │  Cookie session + JSON over HTTP
  ▼
API Gateway (:3000)
  │  1. Verifies session via auth-service over TCP (`auth.me`)
  │  2. Signs x-internal-user-* headers with INTERNAL_SERVICE_SECRET
  │  3. Forwards dialog operations over NestJS TCP (`Transport.TCP`)
  ▼
Dialog Service (:3002, TCP)
  │  1. Verifies internal signature (InternalAuthGuard)
  │  2. Persists dialog & messages via Drizzle ORM (dialogs, dialog_messages)
  │  3. Orchestrates turn with LangGraph StateGraph (DialogGraphService)
  ▼
LLM Service (:3004, TCP, `llm.chat`)
  │  1. Enforces free-only OpenRouter model policy
  │  2. Executes chat completion via @nestjs/ai + @ai-sdk/openai-compatible
  ▼
OpenRouter API (https://openrouter.ai/api/v1)
```

---

## 2. Free-Only OpenRouter Model Policy

To prevent accidental paid usage during thesis development and evaluation, SemCache enforces zero-cost OpenRouter models across DTO validation, configuration startup, and service execution:

- **Permitted models** (`FREE_OPENROUTER_MODEL_REGEX`):
  - `openrouter/free` (default)
  - `<provider>/<model>:free` (e.g., `nvidia/nemotron-3-ultra-550b-a55b:free`, `nvidia/nemotron-3.5-lightning:free`, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`, `nvidia/nemotron-3.5-super-vl:free`, `baidu/ernie-5.5-flash-preview:free`, `liquid/lfm-3-1.7b:free`, `recursive/flint-v1.0:free`)
- **Enforcement points**:
  1. `LlmConfigService` validates `OPENROUTER_DEFAULT_MODEL` at startup.
  2. `GatewaySendMessageDto`, `SendMessageDto`, and `ChatCompletionRequestDto` validate `model` with `@Matches(FREE_OPENROUTER_MODEL_REGEX)`.
  3. `LlmService.generateChatCompletion` checks `isFreeOpenRouterModel(targetModel)` and rejects non-free models with `400 Bad Request`.

---

## 3. HTTP & TCP Contracts (`@semcache/shared-dtos` & `SERVICE_TCP_PATTERNS`)

### `llm-service` (`SERVICE_TCP_PATTERNS.LLM_CHAT` = `'llm.chat'`, `SERVICE_TCP_PATTERNS.LLM_CHAT_STREAM` = `'llm.chat.stream'`, & `SERVICE_TCP_PATTERNS.LLM_EMBEDDINGS` = `'llm.embeddings'` over `Transport.TCP`)

Request (`LlmGenerateEmbeddingsRequestDto` for `llm.embeddings`):

- `texts`: `string[]` (1–128 strings)
- `model?`: embedding model identifier (defaults to `OPENROUTER_EMBEDDING_MODEL`, `Xenova/paraphrase-multilingual-MiniLM-L12-v2` via `@huggingface/transformers`)

Response (`LlmGenerateEmbeddingsResponseDto` for `llm.embeddings`):

- `embeddings`: `number[][]` (384-dimensional L2-normalized vectors)
- `model`: model ID used
- `dimensions`: `384`
- `latencyMs`: processing duration in milliseconds
- `usage`: `{ totalTokens }`

### `knowledge-base-service` (`Transport.TCP`) & `api-gateway` (HTTP `/knowledge-base`)

- `POST /knowledge-base/documents` -> `kb.documents.upload` (`ADMIN` only) — uploads, extracts (`text`, `markdown`, `html`, `json`), chunks, embeds via `llm.embeddings`, and stores a knowledge base document (`UploadKnowledgeDocumentRequestDto` -> `KnowledgeDocumentDetailResponseDto`). Tracks `status` (`pending` -> `processing` -> `ready` | `failed`) and `errorMessage`.
- `GET /knowledge-base/documents` -> `kb.documents.list` (`CUSTOMER` / `ADMIN`) — lists knowledge base documents with optional `category` and `status` filters (`KnowledgeDocumentResponseDto[]`).
- `GET /knowledge-base/documents/:id` -> `kb.documents.get` (`CUSTOMER` / `ADMIN`) — retrieves document details and processed chunks (`KnowledgeDocumentDetailResponseDto`).
- `POST /knowledge-base/documents/:id/reprocess` -> `kb.documents.reprocess` (`ADMIN` only) — re-extracts, re-chunks, and re-embeds an existing document.
- `DELETE /knowledge-base/documents/:id` -> `kb.documents.delete` (`ADMIN` only) — deletes a document and all associated chunks and embeddings (`DeleteKnowledgeDocumentResponseDto`).
- `POST /knowledge-base/search` -> `kb.context.retrieve` (authenticated users & internal `dialog-service` RAG) — performs `pgvector` cosine similarity search (`<=>`) over ready document chunks and returns ranked context with source references (`RetrieveKnowledgeContextRequestDto` -> `RetrieveKnowledgeContextResponseDto`).

`dialog-service` (`DialogGraphService`) invokes `kb.context.retrieve` before calling `llm.chat` / `llm.chat.stream`, instructing the assistant to prioritize retrieved company knowledge, avoid inventing company-specific facts, and acknowledge when the knowledge base lacks sufficient information.

Request (`LlmChatCompletionRequestDto`):

- `messages`: `Array<{ role: 'system' | 'user' | 'assistant'; content: string }>`
- `model?`: free OpenRouter model ID (defaults to `OPENROUTER_DEFAULT_MODEL`)
- `temperature?`: `0..2`
- `maxTokens?`: `1..4096`

Response (`LlmChatCompletionResponseDto` for `llm.chat`):

- `content`: assistant reply text
- `model`: model ID used
- `latencyMs`: provider round-trip duration in milliseconds
- `usage`: `{ promptTokens, completionTokens, totalTokens }`

Stream Events (`Observable<LlmChatStreamEventDto>` for `llm.chat.stream`):

- `{ type: 'delta', delta: string }` — incremental text chunk from `AiService.streamText()`
- `{ type: 'done', completion: LlmChatCompletionResponseDto }` — final completion payload with usage & latency

### `dialog-service` (`Transport.TCP`) & `api-gateway` (HTTP `/dialogs`)

- `POST /dialogs` -> `dialogs.create` — creates a new dialog for the authenticated user (`CreateDialogRequestDto` -> `DialogResponseDto`).
- `GET /dialogs` -> `dialogs.list` — lists dialogs owned by the authenticated user (`DialogResponseDto[]`).
- `PATCH /dialogs/:id` -> `dialogs.update` — updates an owned dialog's title (`UpdateDialogRequestDto` -> `DialogResponseDto`).
- `DELETE /dialogs/:id` -> `dialogs.delete` — deletes an owned dialog and cascades its messages (`DeleteDialogResponseDto`).
- `DELETE /dialogs` -> `dialogs.deleteAll` — deletes all dialogs owned by the authenticated user and cascades their messages (`DeleteAllDialogsResponseDto`).
- `GET /dialogs/:id/messages` -> `dialogs.messages.list` — lists ordered messages for an owned dialog (`DialogMessageResponseDto[]`, each carrying `parentMessageId` for tree/branch reconstruction).
- `POST /dialogs/:id/messages` -> `dialogs.messages.send` — executes a LangGraph turn (`SendMessageRequestDto` -> `SendMessageResponseDto`) containing `{ dialog, userMessage, assistantMessage }`, optionally continuing from `parentMessageId`.
- `POST /dialogs/:id/messages/stream` -> `dialogs.messages.stream` — streams a dialog turn over Server-Sent Events (`text/event-stream`) emitting `DialogMessageStreamEventDto` frames:
  - `{ type: 'user_message', userMessage: DialogMessageResponseDto }`
  - `{ type: 'delta', delta: string }`
  - `{ type: 'done', dialog, userMessage, assistantMessage }`
  - `{ type: 'error', statusCode: number, message: string }` (if an error occurs after SSE headers are sent)
- `POST /dialogs/:id/messages/:messageId/edit` -> `dialogs.messages.edit` — creates a sibling branch from an existing user message (`EditMessageRequestDto` -> `SendMessageResponseDto`) sharing `targetMessage.parentMessageId` and generates a new assistant reply using only the ancestor branch history.
- `POST /dialogs/:id/messages/:messageId/edit/stream` -> `dialogs.messages.edit.stream` — streams a branched message edit turn over Server-Sent Events (`text/event-stream`).

---

## 4. Environment Variables

Configure these variables in the respective app `.env` files (`apps/dialog-service/.env` and `apps/llm-service/.env`, documented in each app's `.env.example`):

In `apps/dialog-service/.env`:

- `DIALOG_SERVICE_HOST=127.0.0.1`
- `DIALOG_SERVICE_PORT=3002`
- `LLM_SERVICE_HOST=127.0.0.1`
- `LLM_SERVICE_PORT=3004`

In `apps/llm-service/.env`:

- `LLM_SERVICE_HOST=127.0.0.1`
- `LLM_SERVICE_PORT=3004`
- `OPENROUTER_API_KEY=<your-openrouter-api-key>`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_DEFAULT_MODEL=openrouter/free`
- `OPENROUTER_TIMEOUT_MS=180000`
