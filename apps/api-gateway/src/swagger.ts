import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@semcache/shared-config';
import type { GatewayEnv } from './config/gateway.env';

export const SWAGGER_COOKIE_AUTH_NAME = 'sessionCookie';

/**
 * Configures OpenAPI 3.0 specification generation and serves Swagger UI at `/docs`
 * and the OpenAPI JSON document at `/docs-json`.
 */
export function setupSwagger(app: INestApplication): void {
  const configService = app.get<ConfigService<GatewayEnv, true>>(ConfigService);
  const sessionCookieName = configService.getOrThrow('SESSION_COOKIE_NAME');

  const config = new DocumentBuilder()
    .setTitle('SemCache API Gateway')
    .setDescription(
      [
        'REST API Gateway for the SemCache adaptive LLM semantic caching customer support system.',
        '',
        '### Authentication & Security',
        `- **Session Cookie (\`${sessionCookieName}\`)**: HttpOnly session cookie issued by \`POST /auth/login\` and \`POST /auth/register\`.`,
        '- **CSRF Protection**: State-changing requests validate `Origin` / `Sec-Fetch-Site` against `CORS_ORIGIN`.',
        '- **Request Tracing**: Every response includes `X-Request-Id` (echoed if valid, otherwise generated UUID).',
        '',
        '### Semantic Caching & Streaming',
        '- Dialog turn endpoints (`POST /dialogs/:id/messages`, `POST /dialogs/:id/messages/:messageId/edit`) emit `X-Cache-Status` (`HIT` | `MISS` | `BYPASS`) and `X-Cache-Mode` (`adaptive` | `fixed` | `disabled`) response headers.',
        '- Streaming endpoints emit Server-Sent Events (`text/event-stream`) with `user_message`, `delta`, `done`, and `error` event payloads.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addCookieAuth(
      sessionCookieName,
      {
        type: 'apiKey',
        in: 'cookie',
        name: sessionCookieName,
        description: `HttpOnly session cookie issued by POST /auth/login or POST /auth/register`,
      },
      SWAGGER_COOKIE_AUTH_NAME,
    )
    .addTag('Health', 'Service liveness endpoint')
    .addTag('Metrics', 'Prometheus exposition metrics')
    .addTag('Auth', 'Customer registration, login, logout, and current session')
    .addTag('Users', 'User profile read and update')
    .addTag('Admin Users', 'Admin user listing and session revocation')
    .addTag('Dialogs', 'Conversation threads, branching, and LLM/RAG/cache turns')
    .addTag('Knowledge Base', 'Knowledge base document ingestion and vector search')
    .addTag('Admin Semantic Cache', 'Adaptive/fixed cache settings, stats, and invalidation')
    .addTag('Documentation', 'OpenAPI specification')
    .build();

  const documentFactory = () => {
    const document = SwaggerModule.createDocument(app, config);
    document.paths['/docs-json'] = {
      get: {
        tags: ['Documentation'],
        summary: 'OpenAPI 3.0 JSON specification',
        responses: {
          '200': {
            description: 'OpenAPI specification document',
          },
        },
      },
    };
    return document;
  };

  SwaggerModule.setup('docs', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
      withCredentials: true,
    },
  });
}
