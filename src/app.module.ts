import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './core/database/prisma.module.js';
import { SupabaseModule } from './core/supabase/supabase.module.js';
import { MailModule } from './core/mail/mail.module.js';
import { SupabaseAuthGuard } from './common/guards/supabase-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';

// Modules Métiers
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { MentorsModule } from './modules/mentors/mentors.module.js';
import { DiagnosticModule } from './modules/diagnostic/diagnostic.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { MentoringModule } from './modules/mentoring/mentoring.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { MessagingModule } from './modules/messaging/messaging.module.js';
import { MasterclassesModule } from './modules/masterclasses/masterclasses.module.js';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module.js';
import { DashboardsModule } from './modules/dashboards/dashboards.module.js';
import { AdminModule } from './modules/admin/admin.module.js';

@Module({
  imports: [
    // Configuration d'environnement globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Protection anti-bruteforce / Rate limiting (100 requêtes par minute par défaut)
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Tâches planifiées (ex: archivage opportunités expirées)
    ScheduleModule.forRoot(),

    // Bus d'événements asynchrone (notifications internes)
    EventEmitterModule.forRoot(),

    // Socle base de données Prisma et intégration Supabase / E-mail
    PrismaModule,
    SupabaseModule,
    MailModule,

    // Modules Fonctionnels (F01 à F17)
    AuthModule,
    UsersModule,
    MentorsModule,
    DiagnosticModule,
    MatchingModule,
    NotificationsModule,
    MentoringModule,
    SessionsModule,
    MessagingModule,
    MasterclassesModule,
    OpportunitiesModule,
    DashboardsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards d'accès globaux
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    // Filtre global des exceptions
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    // Intercepteur de métriques et logs HTTP
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
