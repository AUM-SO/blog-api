import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

const DESCRIPTION = `
REST API for the Blog Management System programming test.

### Authentication
Every route except \`/auth/*\` and the health check requires
\`Authorization: Bearer <accessToken>\`.

1. \`POST /auth/register\` creates an account — it starts **inactive**.
2. A Super Admin activates it with \`PATCH /users/{id}/activate\`.
3. \`POST /auth/login\` returns \`accessToken\` and \`refreshToken\`.
4. Paste the access token into **Authorize** to try requests from this page.

Refresh tokens rotate: \`POST /auth/refresh\` revokes the token you send and returns a new
pair, so a stolen token stops working as soon as the real client refreshes.

### Permissions
- **Update blog** — author only, including for a Super Admin.
- **Delete blog** — author or Super Admin.
- **User management** — Super Admin only, except \`/users/me\`, which any signed-in user may use.
`.trim();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT ?? 3001;

  // Locked to the deployed frontend in production. Left open only when
  // CORS_ORIGIN is unset, which is the local-development case.
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins?.length ? allowedOrigins : true,
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Blog Management System API')
    .setDescription(DESCRIPTION)
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token from POST /auth/login.',
    })
    // The base URL carries the /api prefix, so paths below it stay clean and the
    // generated curl snippets are copy-pasteable. Set PUBLIC_API_URL in production.
    .addServer(
      process.env.PUBLIC_API_URL ?? `http://localhost:${port}/api`,
      'API base URL',
    )
    .addTag('auth', 'Registration, login, token refresh and logout')
    .addTag('blogs', 'Create, read, search, update and delete blogs')
    .addTag('comments', 'Comments on a blog, nested under /blogs/{blogId}')
    .addTag('notifications', 'Comment notifications and unread counts')
    .addTag('users', 'Own profile, plus Super Admin user management')
    .addTag('health', 'Liveness check')
    .build();
  // ignoreGlobalPrefix keeps '/api' out of every path — it lives in the server URL
  // above instead, so requests resolve once and only once.
  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
  });

  // Raw spec, for client generators and for importing into Postman/Insomnia.
  app.use(
    '/api/openapi.json',
    (_req: unknown, res: { json: (body: unknown) => void }) => {
      res.json(document);
    },
  );

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Scalar is the primary reference UI; Swagger UI stays at /api/docs as a fallback.
  app.use(
    '/api/reference',
    apiReference({
      content: document,
      theme: 'purple',
      hideDownloadButton: false,
      metaData: {
        title: 'Blog Management System API Reference',
        description: 'REST API reference for the Blog Management System',
      },
    }),
  );

  await app.listen(port);
}
void bootstrap();
