# Chat & LLM Architecture (OpenRouter + `@nestjs/ai` + `@langchain/langgraph`)

## 1. Overview

The chat subsystem implements end-to-end customer support conversations while strictly adhering to SemCache microservice isolation:

```text
Frontend (:5173)
  │  Cookie session + JSON over HTTP
  ▼
API Gateway (:3000)
  │  1. Verifies session via auth-service (/auth/me)
  │  2. Signs x-internal-user-* headers with INTERNAL_SERVICE_SECRET
  ▼
Dialog Service (:3002)
  │  1. Verifies internal signature (InternalAuthGuard)
  │  2. Persists dialog & messages via Drizzle ORM (dialogs, dialog_messages)
  │  3. Orchestrates turn with LangGraph StateGraph (DialogGraphService)
  ▼
LLM Service (:3004)
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

## 3. REST Contracts (`@semcache/shared-dtos`)

### `llm-service` (`POST /llm/chat`)

Request (`LlmChatCompletionRequestDto`):

- `messages`: `Array<{ role: 'system' | 'user' | 'assistant'; content: string }>`
- `model?`: free OpenRouter model ID (defaults to `OPENROUTER_DEFAULT_MODEL`)
- `temperature?`: `0..2`
- `maxTokens?`: `1..4096`

Response (`LlmChatCompletionResponseDto`):

- `content`: assistant reply text
- `model`: model ID used
- `latencyMs`: provider round-trip duration in milliseconds
- `usage`: `{ promptTokens, completionTokens, totalTokens }`

### `dialog-service` & `api-gateway` (`/dialogs`)

- `POST /dialogs` — creates a new dialog for the authenticated user (`CreateDialogRequestDto` -> `DialogResponseDto`).
- `GET /dialogs` — lists dialogs owned by the authenticated user (`DialogResponseDto[]`).
- `GET /dialogs/:id/messages` — lists ordered messages for an owned dialog (`DialogMessageResponseDto[]`).
- `POST /dialogs/:id/messages` — executes a LangGraph turn (`SendMessageRequestDto` -> `SendMessageResponseDto`) containing `{ dialog, userMessage, assistantMessage }`.

---

## 4. Environment Variables

Add the following variables to `.env` (documented in `.env.example`):

- `DIALOG_SERVICE_URL=http://localhost:3002`
- `LLM_SERVICE_URL=http://localhost:3004`
- `OPENROUTER_API_KEY=<your-openrouter-api-key>`
- `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1`
- `OPENROUTER_DEFAULT_MODEL=openrouter/free`
- `OPENROUTER_TIMEOUT_MS=180000`
