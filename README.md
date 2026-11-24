# ACCEENT Mentoring — API Backend (`mentoring-platform-api`)

API RESTful officielle du MVP de la plateforme digitale de mentoring, compétences, réseaux et opportunités **ACCEENT Mentoring**.

## 1. Stack technique

- **Runtime & Framework** : Node.js (ESM), TypeScript 6, NestJS 12 (`@nestjs/platform-express`)
- **ORM & Base de données** : Prisma ORM 7 (`@prisma/adapter-pg`) sur PostgreSQL (Supabase)
- **Authentification & Stockage** : Supabase Auth (validation asymétrique JWKS via `jose`) & Supabase Storage
- **Notifications & E-mail** : `@nestjs/event-emitter`, `@nestjs/schedule` (tâches Cron), Resend + repli SMTP Nodemailer
- **Exports & Rapports** : `csv-stringify`, `exceljs` (`.xlsx`), `pdfkit` (`.pdf`)
- **Documentation API** : OpenAPI / Swagger (`/api/docs`)
- **Qualité & Tests** : `oxlint --type-aware`, Vitest 4 & Supertest

---

## 2. Architecture du projet

```text
src/
  common/
    decorators/     # @Public, @AllowUnregistered, @Roles, @RequireActiveAccount, @CurrentUser
    filters/        # AllExceptionsFilter (HTTP + codes Prisma P2002/P2025/P2003)
    guards/         # SupabaseAuthGuard (JWT JWKS + statut compte), RolesGuard
    interceptors/   # LoggingInterceptor
  core/
    database/       # PrismaModule & PrismaService
    supabase/       # SupabaseModule & SupabaseService (Auth + Storage public/privé signé)
    mail/           # MailModule & MailService (Resend + fallback SMTP)
  modules/
    auth/           # F01 — Inscription, connexion, OTP/callback, refresh, mot de passe
    users/          # F02 — Profil utilisateur, avatar, profil public, export & oubli RGPD
    mentors/        # F03 & F06 — Candidature mentor, disponibilité, catalogue filtrable
    diagnostic/     # F04 — Questionnaire de diagnostic & profil de besoin
    matching/       # F05 — Moteur multicritère pondéré (6 critères) & filtres
    mentoring/      # F07 & F08 — Demandes, parcours, objectifs, tâches, ressources, rappels J-1
    sessions/       # F09 — Créneaux de disponibilité, sessions, anti-chevauchement, rappels 24h
    messaging/      # F10 — Conversations autorisées, messages, pièces jointes privées signées
    masterclasses/  # F11 — Catalogue, inscriptions, liens live/replay protégés, présences
    opportunities/  # F12 — Hub d'opportunités (8 catégories), favoris, archivage auto Cron
    dashboards/     # F13 & F14 — Tableaux de bord bénéficiaire, mentor, expert, partenaire
    notifications/  # F15 — Notifications in-app et e-mails transactionnels
    admin/          # F16 & F17 — Modération, validations CV signé, rôles, KPIs, exports CSV/XLSX/PDF
prisma/
  schema.prisma     # Modèle de données PostgreSQL
  migrations/       # Migrations SQL versionnées
test/
  app.e2e-spec.ts   # Tests E2E HTTP & contrat OpenAPI
```

---

## 3. Configuration de l'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs propres à l'environnement :

```bash
cp .env.example .env
```

Principales variables :
- `PORT` : port HTTP d'écoute (défaut `3001`).
- `CORS_ORIGIN` : origines frontales autorisées séparées par des virgules.
- `FRONTEND_URL` : URL de base du frontend utilisée pour les liens de confirmation e-mail (`/auth/callback`).
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL` : configuration Supabase Auth & Storage.
- `DATABASE_URL`, `DIRECT_URL` : chaînes de connexion PostgreSQL (pooler transactionnel + session directe pour Prisma CLI).
- `RESEND_API_KEY`, `MAIL_FROM` (et optionnellement `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`).

Buckets Supabase Storage attendus :
- `plateforme-images` (public) : photos de profil (`avatars/<userId>/...`).
- `mentor-documents` (privé) : CV mentors (`cvs/<userId>/...`) et pièces jointes de messagerie (`messages/<conversationId>/...`) servis par URL signées temporaires.

---

## 4. Installation, Base de données & Démarrage

```bash
# Installation des dépendances (génère automatiquement le client Prisma en postinstall)
pnpm install

# Appliquer les migrations sur une nouvelle base PostgreSQL
npx prisma migrate deploy

# Note : si la base Supabase existante a déjà été initialisée avant le versionnement :
# npx prisma migrate resolve --applied 20260101000000_init

# Démarrage en développement (watch)
pnpm run start:dev

# Build et démarrage en production (ex: Render)
pnpm run build
pnpm run start
```

Une fois démarrée :
- **Racine / Healthcheck** : `GET /` et `GET /api/v1/health`
- **Préfixe REST** : `/api/v1`
- **Documentation Swagger** : `/api/docs`

---

## 5. Sécurité & Conformité RGPD

- **Validation stricte** : `ValidationPipe` global (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`).
- **Authentification & Statuts** : vérification JWT asymétrique via JWKS ; rejet automatique des comptes `SUSPENDED` / `REJECTED` ; blocage des comptes en attente (`PENDING`) sur les opérations réservées aux partenaires, experts et mentors validés (`@RequireActiveAccount()`).
- **Anti-bruteforce** : `ThrottlerGuard` global (`100 req/min`) et limites dédiées sur `/auth/register`, `/auth/login`, `/auth/forgot-password` et `/auth/verify-otp`.
- **Sécurité des fichiers** : validation binaire par *magic bytes* (`PDF`, `JPG`, `PNG`, `WEBP`) et plafond à `5 Mo`.
- **Protection des données (RGPD)** : consentements obligatoires (`consentCgu`, `consentData`), confidentialité des données sensibles (`situationHandicap` jamais exposée publiquement), export personnel (`GET /api/v1/users/me/export`) et suppression intégrale (`DELETE /api/v1/users/me`).

---

## 6. Vérifications & Tests

```bash
# Analyse statique typée (oxlint + tsgolint)
pnpm run lint

# Tests unitaires (Vitest)
pnpm test

# Tests End-to-End HTTP & surface OpenAPI
pnpm run test:e2e

# Compilation de production
pnpm run build
```
