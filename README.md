# Nura — AI Employee Health & Wellness Platform

Nura is an AI-powered SaaS platform for employee health, wellness, and insurance insights.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, TailwindCSS
- **Backend:** NestJS, REST API, JWT Authentication
- **Database:** PostgreSQL with Prisma ORM (pgvector)
- **AI:** OpenAI GPT (with fallback responses)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

### 1. Start Database

```bash
docker compose up -d
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings (optional: OPENAI_API_KEY)
```

### 4. Run Database Migrations

```bash
npm run db:push
npm run db:generate
```

### 5. Start Development Servers

```bash
npm run dev
```

- **Web App:** http://localhost:4000
- **API:** http://localhost:5002/api/v1
- **Swagger Docs:** http://localhost:5002/docs

## Project Structure

```
apps/
  api/          # NestJS REST API
  web/          # Next.js frontend
packages/
  types/        # Shared TypeScript types
  config/       # App configuration
  utils/        # Wellness scoring utilities
prisma/         # Database schema
```

## MVP Modules

| Module | Status | Description |
|--------|--------|-------------|
| Authentication | ✅ | Register, login, JWT, refresh tokens |
| Company Setup | ✅ | Onboarding, departments, employee invites |
| Employee Profile | ✅ | Health profile, goals, activity timeline |
| Daily Check-in | ✅ | Sleep, mood, stress, exercise, water |
| Health Metrics | ✅ | Weight, BMI, trends (weekly/monthly) |
| Wellness Score | ✅ | Configurable scoring engine |
| AI Chatbot | ✅ | GPT-powered with fallback mode |
| AI Insights | ✅ | Personal & company-wide insights |
| Employee Dashboard | ✅ | Scores, trends, goals, insights |
| Employer Dashboard | ✅ | Analytics, department wellness |
| Spending | ✅ | Healthcare expense tracking |
| Reports | ✅ | CSV export, wellness reports |
| Notifications | ✅ | Reminders API |
| Documents | ✅ | Secure file upload |
| Search | ✅ | Employees, departments, docs |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register user/company |
| POST | `/auth/login` | Login |
| GET | `/dashboard/employee` | Employee dashboard |
| GET | `/dashboard/employer` | HR dashboard |
| POST | `/health/checkin` | Daily check-in |
| POST | `/chat` | AI wellness chat |
| GET | `/insights/me` | Personal AI insights |
| POST | `/company/invite` | Invite employee |

## User Roles

- **Super Admin** — Platform management across companies
- **Company Admin (HR)** — Company dashboards, invites, reports
- **Employee** — Check-ins, chat, personal dashboard

Set the `SUPER_ADMIN_*` and `DEMO_*` values in `.env`, then run `npm run db:seed`.
Seed passwords have no source-code defaults and must be chosen explicitly.

| Role | Environment variables | Access |
|------|-----------------------|--------|
| Super Admin | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` | `/superadmin/*` |
| HR Admin | `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD` | `/admin/*` |
| Employee | `DEMO_EMPLOYEE_EMAIL`, `DEMO_EMPLOYEE2_EMAIL`, `DEMO_EMPLOYEE_PASSWORD` | Employee application |

## Features

- **AWS S3 storage** — Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET` in `.env` (falls back to local `uploads/` folder)
- **PDF & Excel reports** — Generate from Admin → Reports
- **SMTP emails** — Password reset and employee invites (configure `SMTP_*` in `.env`)
- **Dark mode** — Toggle in sidebar
- **Super Admin panel** — `/superadmin/*` routes for platform management

## Testing

```bash
npm run test
```

## Production database and sensitive data

Use `npm run db:deploy` in deployment environments; do not use `db:push`.
Production startup requires `DATA_ENCRYPTION_KEY` (32 random bytes in base64 or
64 hex characters). After setting it for an existing database, back up the
database and run `npm run data:encrypt-sensitive` once to encrypt legacy
bank/account/tax identifiers and health free-text fields.

For container deployment, set all required values from `.env.example`, then run:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

The API container applies committed Prisma migrations before startup. Keep
database backups and the encryption key outside the container host.

## License

Private — All rights reserved.
