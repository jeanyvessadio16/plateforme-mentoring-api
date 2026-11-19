import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/core/database/prisma.service.js';

describe('AppController & Full API Surface (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: vi.fn(),
        $disconnect: vi.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['/'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET / returns API ok status JSON', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.message).toBe('Mentoring Platform API is running');
  });

  it('GET /api/v1/health returns ok status', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('blocks protected endpoints without JWT Bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
    await request(app.getHttpServer()).get('/api/v1/admin/stats').expect(401);
  });

  it('exposes complete F01-F17 endpoints in OpenAPI Swagger document', () => {
    const config = new DocumentBuilder()
      .setTitle('Mentoring Platform API')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
      .build();

    const doc = SwaggerModule.createDocument(app, config);
    const paths = Object.keys(doc.paths);

    const expectedPaths = [
      '/',
      '/api/v1/health',
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/users/me',
      '/api/v1/users/me/export',
      '/api/v1/mentors',
      '/api/v1/mentors/{id}',
      '/api/v1/diagnostic',
      '/api/v1/matching/recommendations',
      '/api/v1/mentoring/requests',
      '/api/v1/mentoring/programs',
      '/api/v1/sessions',
      '/api/v1/sessions/slots',
      '/api/v1/conversations',
      '/api/v1/masterclasses',
      '/api/v1/masterclasses/{id}/access',
      '/api/v1/opportunities',
      '/api/v1/dashboards/public-stats',
      '/api/v1/dashboards/beneficiary',
      '/api/v1/dashboards/mentor',
      '/api/v1/notifications',
      '/api/v1/reports',
      '/api/v1/admin/stats',
      '/api/v1/admin/validations/pending',
      '/api/v1/admin/exports/users',
      '/api/v1/admin/exports/impact',
    ];

    for (const expected of expectedPaths) {
      expect(paths).toContain(expected);
    }
  });
});
