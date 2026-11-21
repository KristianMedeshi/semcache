# Authentication and Authorization Architecture

SemCache implements browser-based session authentication and policy-based authorization using official NestJS security modules (`@nestjs/authentication`, `@nestjs/authorization`, `@nestjs/throttler`) and built-in NestJS CSRF protection (`app.enableCsrfProtection()`).

---

## 1. Authentication Flow

- **Session-only browser authentication**: Email and password registration/login issue server-side sessions backed by PostgreSQL (`sessions` table) via `DrizzleSessionStore` (`SessionStore` contract).
- **HttpOnly session cookies**: `SessionCookieProvider` (`SessionAuth`) reads the opaque 256-bit token from the session cookie (`SESSION_COOKIE_NAME`, default `semcache_sid`). Only the SHA-256 hash of the token is stored in PostgreSQL.
- **Session security controls**:
  - `HttpOnly: true`, `SameSite=Lax`, and `Secure: true` in production (`SECURE_COOKIES` override available for local configuration).
  - Session rotation on sign-in (`SignInService.signIn()`) deletes any prior session carried by the browser to prevent session fixation.
  - Password updates revoke other active sessions and rotate the current browser session.
  - Absolute lifetime (`SESSION_TTL`, default `24h`) and sliding idle timeout (`SESSION_IDLE_TIMEOUT`, default `30m`).
- **Password security**:
  - Passwords are hashed with Node.js `crypto.scrypt` via `PasswordHasher` from `@nestjs/authentication`.
  - Email addresses are normalized via `trim().normalize('NFC').toLowerCase()`.
  - Registration always assigns `UserRole.CUSTOMER`.
  - Invalid login attempts check a dummy hash when an email does not exist and return a generic `401 Invalid email or password` response.
- **Rate limiting**:
  - `ThrottlerModule` + `ThrottlerGuard` apply both per-IP throttling (`default`) and per-email + IP throttling (`account`) on `POST /auth/login`.
- **CSRF protection**:
  - `api-gateway` enables `app.enableCsrfProtection({ trustedOrigins: config.corsOrigin })` (Fetch Metadata `Sec-Fetch-Site` with `Origin`/`Host` validation) and CORS with `credentials: true`, and `auth-service` enforces `SessionService.isCrossOriginWrite()` on forwarded RPC header metadata.

---

## 2. Authorization Architecture

- **Roles (`@semcache/shared-types`)**:
  - `UserRole.CUSTOMER = 'customer'`
  - `UserRole.ADMIN = 'admin'`
- **Default-deny guards across all 6 NestJS services**:
  - Every backend microservice (`api-gateway`, `auth-service`, `dialog-service`, `llm-service`, `semantic-cache-service`, `knowledge-base-service`) imports `AuthenticationModule` before `AuthorizationModule` so global `AuthenticationGuard` and `AuthorizationGuard` enforce default-deny on all routes and TCP message patterns.
  - Global `AuthenticationGuard` denies unauthenticated requests (`401 Unauthorized`) unless decorated with `@Public()` or `@Authenticate({ optional: true })`.
  - Global `AuthorizationGuard` (`@nestjs/authorization`) denies requests (`403 Forbidden` / `401 Unauthorized`) unless decorated with `@Can(...)`, `@Can.Anyone()`, or `@Public()`.
- **Service Policies**:
  - `auth-service` (`UserPolicy` implementing `PolicyBefore`):
    - `readSelf` — allows authenticated `CUSTOMER` or `ADMIN`.
    - `viewProfile` — allows `ADMIN` or the owning `CUSTOMER`.
    - `updateProfile` — allows `ADMIN` or the owning `CUSTOMER`.
    - `manageUsers` — allows `ADMIN` only.
    - `hasRole` — backs `@Roles(...roles)` via `@Can(UserPolicy, 'hasRole', ...)`.
    - `AuthEventsListener` subscribes to `AuthorizationEvents.events$` to log structured `authz.denied` audit events.
  - `api-gateway` (`GatewayAccessPolicy` implementing `PolicyBefore`, `GatewaySessionAuth`):
    - `GatewaySessionAuth` (`AuthenticationProvider`) validates session cookies via `AuthProxyService.resolveCurrentUser()` and populates `AuthenticationContext`.
    - `accessDialogs` — allows authenticated `CUSTOMER` or `ADMIN` on `/dialogs/*`.
    - `proxyAuthRequest` — allows forwarding `/auth/*`, `/users/*`, and `/admin/users/*` directly to `auth-service` without duplicate session resolution.
    - `readSelf`, `viewProfile`, `updateProfile`, `manageUsers` — mirror domain access rules at the gateway.
  - `dialog-service` (`DialogPolicy` implementing `PolicyBefore`, `InternalIdentityAuth`):
    - `InternalIdentityAuth` (`AuthenticationProvider`) verifies HMAC-SHA256 signed `x-internal-*` headers over TCP and populates `AuthenticationContext`.
    - `create`, `list`, `viewMessages`, `sendMessage`, `streamMessage` — require an authenticated `CUSTOMER` or `ADMIN`.
    - `accessDialog` — record-level ownership check (`dialog.userId === user.id`) enforced via `AuthorizationService.authorize()`.
  - `llm-service` (`LlmPolicy`):
    - `generateCompletion`, `streamCompletion` — authorize internal TCP completion and streaming calls.
    - `useModel` — enforces zero-cost OpenRouter models (`openrouter/free` or `*:free`).
  - `semantic-cache-service` (`SemanticCachePolicy`):
    - `lookup`, `store` — authorize internal semantic cache lookups and writes.
    - `invalidate` — restricts cache invalidation to `ADMIN`.
  - `knowledge-base-service` (`KnowledgeBasePolicy`):
    - `retrieveContext` — authorizes internal RAG context retrieval.
    - `readDocument` — requires authenticated `CUSTOMER` or `ADMIN`.
    - `manageDocuments` — restricts document management to `ADMIN`.
- **Service-level enforcement**:
  - `UsersService` and `DialogsService` read the actor from `AuthenticationContext` and call `AuthorizationService.authorize(...)` for record-level ownership checks.

---

## 3. Gateway REST & Internal TCP Contracts (`SERVICE_TCP_PATTERNS`)

All DTO contracts live in `@semcache/shared-dtos` (`packages/shared-dtos/src/index.ts`) and TCP message patterns live in `@semcache/shared-types` (`SERVICE_TCP_PATTERNS`).

| Method   | Path                        | TCP Pattern                  | Access                                    | Request DTO                   | Response DTO                            |
| :------- | :-------------------------- | :--------------------------- | :---------------------------------------- | :---------------------------- | :-------------------------------------- |
| `POST`   | `/auth/register`            | `auth.register`              | Public                                    | `RegisterRequestDto`          | `UserResponseDto` (`201`)               |
| `POST`   | `/auth/login`               | `auth.login`                 | Public                                    | `LoginRequestDto`             | `UserResponseDto` (`200`)               |
| `POST`   | `/auth/logout`              | `auth.logout`                | Session cookie required (`401` if absent) | —                             | `LogoutResponseDto` (`200`)             |
| `GET`    | `/auth/me`                  | `auth.me`                    | Authenticated (`CUSTOMER` / `ADMIN`)      | —                             | `UserResponseDto` (`200`)               |
| `GET`    | `/users/:id`                | `users.get`                  | Owner (`CUSTOMER`) or `ADMIN`             | —                             | `UserResponseDto` (`200`)               |
| `PATCH`  | `/users/:id`                | `users.update`               | Owner (`CUSTOMER`) or `ADMIN`             | `UpdateUserProfileRequestDto` | `UserResponseDto` (`200`)               |
| `GET`    | `/admin/users`              | `admin.users.list`           | `ADMIN` only                              | —                             | `UserResponseDto[]` (`200`)             |
| `DELETE` | `/admin/users/:id/sessions` | `admin.users.revokeSessions` | `ADMIN` only                              | —                             | `RevokeUserSessionsResponseDto` (`200`) |

> **Note**: `role` is rejected (`400 Bad Request`) on all public registration and profile update payloads via strict `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).
>
> Shared validation constants (`AUTH_VALIDATION_LIMITS`, `PASSWORD_COMPLEXITY_REGEX`, `PASSWORD_COMPLEXITY_MESSAGE`) are also exported from `@semcache/shared-dtos` so `api-gateway`, `auth-service`, and `frontend` enforce identical email length (`255`) and password complexity/length bounds (`8–128` for registration/updates, `1–128` for login).

---

## 4. Database Schema (`apps/auth-service`)

Owned exclusively by `@semcache/auth-service` (`apps/auth-service/src/db/schema.ts`), with migrations in `apps/auth-service/drizzle/`:

- **`users`**: `id` (UUID PK), `email` (unique varchar 255 + unique index), `password_hash` (text), `role` (`user_role` enum defaulting to `'customer'`), `created_at`, `updated_at`.
- **`sessions`**: `id` (text PK holding SHA-256 token hash), `user_id` (UUID FK -> `users.id` `ON DELETE CASCADE`), `created_at`, `expires_at`, `last_active_at`, `metadata` (jsonb), plus indexes on `user_id` and `expires_at`.

Run migrations for `auth-service`:

```bash
pnpm --filter @semcache/auth-service db:migrate
```

---

## 5. API Gateway & Microservice Identity Context

- `StripInternalHeadersMiddleware` and `stripForgedInternalHeaders()` strip any client-supplied `x-internal-*` headers (`x-internal-user-id`, `x-internal-user-email`, `x-internal-user-role`, `x-internal-session-id`, `x-internal-auth-signature`) at the `api-gateway` boundary.
- `AuthProxyService` forwards authentication, profile, and admin requests to `auth-service` over NestJS TCP (`Transport.TCP` at `AUTH_SERVICE_HOST:AUTH_SERVICE_PORT`), relaying sanitized `Cookie`, `Origin`, `Referer`, `Sec-Fetch-Site`, `User-Agent`, `X-Forwarded-For`, and `Set-Cookie`.
- `createSignedInternalHeaders` / `verifySignedInternalHeaders` sign and verify `AuthenticatedUser` identity headers with HMAC-SHA256 using `INTERNAL_SERVICE_SECRET` for downstream service calls.

---

## 6. React Frontend Client

`apps/frontend/src/features/auth/api/auth.client.ts` provides a typed `fetch` client configured with `credentials: 'include'` (`registerCustomer`, `login`, `logout`, `getCurrentUser`, `getUserProfile`, `updateUserProfile`, `listUsers`, `revokeUserSessions`, `isCustomer`, `isAdmin`). Session tokens are kept strictly in `HttpOnly` cookies and never stored in `localStorage` or `sessionStorage`.

---

## 7. Environment Variables

| Variable                        | Default (dev/test)                            | Production Requirement    | Purpose                                        |
| :------------------------------ | :-------------------------------------------- | :------------------------ | :--------------------------------------------- |
| `DATABASE_URL`                  | Optional in `test`                            | Required                  | PostgreSQL connection URL                      |
| `AUTH_SERVICE_HOST`             | `127.0.0.1`                                   | Required if non-default   | TCP host of `auth-service` for `api-gateway`   |
| `AUTH_SERVICE_PORT`             | `3001`                                        | Required if non-default   | TCP port of `auth-service` for `api-gateway`   |
| `INTERNAL_SERVICE_SECRET`       | Ephemeral 32-byte random                      | Required (min 32 chars)   | HMAC secret for signing `x-internal-*` headers |
| `SESSION_COOKIE_NAME`           | `semcache_sid`                                | Optional                  | Name of the HttpOnly session cookie            |
| `SESSION_TTL`                   | `24h`                                         | Optional                  | Absolute session expiration (`Duration`: e.g. `30d`, `24h`, or ms) |
| `SESSION_IDLE_TIMEOUT`          | `30m`                                         | Optional                  | Sliding idle session timeout (`Duration`: e.g. `7d`, `30m`, or `0` to disable) |
| `LOGIN_RATE_LIMIT_WINDOW_MS`    | `900000` (15m)                                | Optional                  | Throttling window for failed logins in ms      |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | `5`                                           | Optional                  | Max login attempts per account+IP per window   |
| `CORS_ORIGIN`                   | `http://localhost:5173,http://127.0.0.1:5173` | Set to frontend origin(s) | Allowed CORS and CSRF trusted origins          |
| `SECURE_COOKIES`                | `false` (`true` in prod)                      | `true`                    | Enforce `Secure` flag on session cookie        |
