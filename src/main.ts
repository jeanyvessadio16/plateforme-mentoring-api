import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Augmenter la limite JSON pour les téléversements encapsulés en base64 (avatars, CV)
  app.useBodyParser('json', { limit: '10mb' });

  // 1. Sécurité des en-têtes HTTP (Helmet)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // 2. Cross-Origin Resource Sharing (CORS)
  const defaultAllowedOrigins = [
    'https://acceent-mentoring.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : [];
  const allowedOrigins = Array.from(
    new Set([...defaultAllowedOrigins, ...envOrigins]),
  );

  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
    ],
    credentials: true,
  });

  // 3. Préfixe global des routes API
  app.setGlobalPrefix('api/v1', {
    exclude: ['/'],
  });

  // 4. Pipe de validation global pour les DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 5. Documentation OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Mentoring Platform API')
    .setDescription(
      'Documentation officielle de l’API RESTful pour la plateforme digitale de mentoring, compétences, réseaux et opportunités.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre jeton JWT Supabase (Bearer token)',
      },
      'JWT-auth',
    )
    .addTag('Santé & Système', 'Endpoints de vérification de l’état de l’API')
    .addTag('Authentification', 'F01 - Inscription, synchronisation et sessions')
    .addTag('Utilisateurs & Profils', 'F02 & F03 - Profils bénéficiaires et mentors')
    .addTag('Mentors', 'F03 & F06 - Candidatures, disponibilités et catalogue des mentors')
    .addTag('Diagnostic', 'F04 - Questionnaire de diagnostic des compétences et besoins')
    .addTag('Matching', 'F05 & F06 - Moteur de recommandation multicritère et recherche')
    .addTag('Mentoring', 'F07 & F08 - Demandes d’accompagnement et parcours de mentoring')
    .addTag('Agenda & Sessions', 'F09 - Disponibilités et réservations de créneaux')
    .addTag('Messagerie', 'F10 - Conversations directes et pièces jointes')
    .addTag('Masterclasses', 'F11 - Sessions collectives live et replay')
    .addTag('Opportunités', 'F12 - Emplois, stages, bourses et concours')
    .addTag('Tableaux de Bord', 'F13 & F14 - Synthèses bénéficiaires et mentors')
    .addTag('Notifications', 'F15 - Alertes in-app et e-mail')
    .addTag('Administration', 'F16 & F17 - Modération, KPIs et exportations de données')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Documentation API — Mentoring Platform',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // 6. Démarrage de l'écoute HTTP
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 Serveur actif sur : http://localhost:${port}`);
  logger.log(`📚 Documentation Swagger accessible sur : http://localhost:${port}/api/docs`);
}

await bootstrap();
