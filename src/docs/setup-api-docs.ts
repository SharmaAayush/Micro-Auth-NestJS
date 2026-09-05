import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DOCS_PATH = 'api/docs';

function readPackageVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf-8'),
    ) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Mount the interactive Swagger UI for this app at `/api/docs`.
 *
 * No-op when `app.docs.enabled` is not exactly `true`, so production
 * builds that leave the env var unset (or set it to anything else)
 * never register the `swagger-ui-express` handler.
 */
export function setupApiDocs(
  app: INestApplication,
  configService: ConfigService,
): void {
  if (configService.get<boolean>('app.docs.enabled') !== true) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Micro-Auth API')
    .setDescription(
      'Authentication microservice: registration, login, JWT access tokens, ' +
        'rotating refresh tokens (HTTP-only cookie), and session management.',
    )
    .setVersion(readPackageVersion())
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste a JWT access token from /auth/login or /auth/register.',
      },
      'bearer',
    )
    .addCookieAuth(
      'refreshToken',
      {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description:
          'HTTP-only refresh token cookie set by login/register/refresh-token.',
      },
      'refresh-cookie',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(DOCS_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}
