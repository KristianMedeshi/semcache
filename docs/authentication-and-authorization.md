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
  - Absolute lifetime (`SESSION_TTL_MS`, default 24 hours) and sliding idle timeout (`SESSION_IDLE_TIMEOUT_MS`, default 30 minutes).
- **Password security**:
  - Passwords are hashed with Node.js `crypto.scrypt` via `PasswordHasher` from `@nestjs/authentication`.
  - Email addresses are normalized via `trim().normalize('NFC').toLowerCase()`.
  - Registration always assigns `UserRole.CUSTOMER`.
  - Invalid login attempts check a dummy hash when an email does not exist and return a generic `401 Invalid email or password` response.
- **Rate limiting**:
  - `ThrottlerModule` + `ThrottlerGuard` apply both per-IP throttling (`default`) and per-email + IP throttling (`account`) on `POST /auth/login`.
- **CSRF protection**:
  - Both `auth-service` and `api-gateway` enable `app.enableCsrfProtection({ trustedOrigins: config.corsOrigin })` (Fetch Metadata `Sec-Fetch-Site` with `Origin`/`Host` validation) and CORS with `credentials: true`.

---

## 2. Authorization Architecture

- **Roles (`@semcache/shared-types`)**:
  - `UserRole.CUSTOMER = 'customer'`
  - `UserRole.ADMIN = 'admin'`
- **Default-deny guards**:
  - Global `AuthenticationGuard` denies unauthenticated requests (`401 Unauthorized`) unless decorated with `@Public()`.
  - Global `AuthorizationGuard` (`@nestjs/authorization`) denies authenticated requests (`403 Forbidden`) unless decorated with `@Can(...)` / `@Roles(...)` or `@Public()`.
- **Policies (`UserPolicy` in `apps/auth-service/src/auth/policies/user.policy.ts`)**:
  - `readSelf` — allows authenticated `CUSTOMER` or `ADMIN`.
  - `viewProfile` — allows `ADMIN` or the owning `CUSTOMER`.
  - `updateProfile` — allows `ADMIN` or the owning `CUSTOMER`.
  - `manageUsers` — allows `ADMIN` only.
  - `hasRole` — backs the reusable `@Roles(...roles)` decorator via `@Can(UserPolicy, 'hasRole', ...)`.
- **Service-level enforcement**:
  - `UsersService` additionally calls `AuthorizationService.authorize(...)` for profile read/update and administrative operations so ownership checks remain enforced in business logic.

---

## 3. REST API Contracts & Endpoints

All DTO contracts live in `@semcache/shared-dtos` (`packages/shared-dtos/src/index.ts`).

| Method   | Path                        | Access                                    | Request DTO                   | Response DTO                            |
| :------- | :-------------------------- | :---------------------------------------- | :---------------------------- | :-------------------------------------- |
| `POST`   | `/auth/register`            | Public                                    | `RegisterRequestDto`          | `UserResponseDto` (`201`)               |
| `POST`   | `/auth/login`               | Public                                    | `LoginRequestDto`             | `UserResponseDto` (`200`)               |
| `POST`   | `/auth/logout`              | Session cookie required (`401` if absent) | —                             | `LogoutResponseDto` (`200`)             |
| `GET`    | `/auth/me`                  | Authenticated (`CUSTOMER` / `ADMIN`)      | —                             | `UserResponseDto` (`200`)               |
| `GET`    | `/users/:id`                | Owner (`CUSTOMER`) or `ADMIN`             | —                             | `UserResponseDto` (`200`)               |
| `PATCH`  | `/users/:id`                | Owner (`CUSTOMER`) or `ADMIN`             | `UpdateUserProfileRequestDto` | `UserResponseDto` (`200`)               |
| `GET`    | `/admin/users`              | `ADMIN` only                              | —                             | `UserResponseDto[]` (`200`)             |
| `DELETE` | `/admin/users/:id/sessions` | `ADMIN` only                              | —                             | `RevokeUserSessionsResponseDto` (`200`) |

> **Note**: `role` is rejected (`400 Bad Request`) on all public registration and profile update payloads via strict `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`).

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
- `AuthProxyService` forwards authentication, profile, and admin requests to `AUTH_SERVICE_URL`, relaying `Cookie`, `Origin`, `Referer`, `Sec-Fetch-Site`, `User-Agent`, and `Set-Cookie`.
- `createSignedInternalHeaders` / `verifySignedInternalHeaders` sign and verify `AuthenticatedUser` identity headers with HMAC-SHA256 using `INTERNAL_SERVICE_SECRET` for downstream service calls.

---

## 6. React Frontend Client

`apps/frontend/src/api/auth.client.ts` provides a typed `fetch` client configured with `credentials: 'include'` (`registerCustomer`, `login`, `logout`, `getCurrentUser`, `getUserProfile`, `updateUserProfile`, `listUsers`, `revokeUserSessions`, `isCustomer`, `isAdmin`). Session tokens are kept strictly in `HttpOnly` cookies and never stored in `localStorage` or `sessionStorage`.

---

## 7. Environment Variables

| Variable                        | Default (dev/test)                            | Production Requirement    | Purpose                                        |
| :------------------------------ | :-------------------------------------------- | :------------------------ | :--------------------------------------------- |
| `DATABASE_URL`                  | Optional in `test`                            | Required                  | PostgreSQL connection URL                      |
| `AUTH_SERVICE_URL`              | `http://localhost:3001`                       | Required if non-default   | Base URL of `auth-service` for `api-gateway`   |
| `INTERNAL_SERVICE_SECRET`       | Ephemeral 32-byte random                      | Required (min 32 chars)   | HMAC secret for signing `x-internal-*` headers |
| `SESSION_COOKIE_NAME`           | `semcache_sid`                                | Optional                  | Name of the HttpOnly session cookie            |
| `SESSION_TTL_MS`                | `86400000` (24h)                              | Optional                  | Absolute session expiration in ms              |
| `SESSION_IDLE_TIMEOUT_MS`       | `1800000` (30m)                               | Optional                  | Sliding idle session timeout in ms             |
| `LOGIN_RATE_LIMIT_WINDOW_MS`    | `900000` (15m)                                | Optional                  | Throttling window for failed logins in ms      |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | `5`                                           | Optional                  | Max login attempts per account+IP per window   |
| `CORS_ORIGIN`                   | `http://localhost:5173,http://127.0.0.1:5173` | Set to frontend origin(s) | Allowed CORS and CSRF trusted origins          |
| `SECURE_COOKIES`                | `false` (`true` in prod)                      | `true`                    | Enforce `Secure` flag on session cookie        |
