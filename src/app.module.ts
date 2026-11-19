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

    // Socle base de données Prisma et intégration Supabase
    PrismaModule,
    SupabaseModule,

    // Modules Fonctionnels (F01, F02, F03, F04, F05, F06)
    AuthModule,
    UsersModule,
    MentorsModule,
    DiagnosticModule,
    MatchingModule,
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
