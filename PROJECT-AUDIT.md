# Nura — Project Audit (Re-audit)

**Date:** 16 July 2026 (re-audit)  
**Post-audit product cut:** Health/PHI product surface has been removed from the active app in favor of an AI HR & workforce operations product.  
**Prior audit:** same day, earlier pass (~75% demo / ~88% wellness / ~72% expanded / ~48% SaaS)  
**Scope:** Fresh product and technical audit of this codebase  
**Product names in repo:** package root is `pulseai`; UI/docs brand as **Nura**

> Current direction: remove HIPAA-heavy employee health features from the shipped surface. Keep HRMS, attendance, leave, payroll, assets, learning, weather WFH, email, integrations, and HR AI. Legacy health tables/source files may remain in the repo for migration/backward-compatibility, but the active web routes and mounted API modules are disabled.

---

## Verdict

Production foundations improved materially since the prior audit (migrations, CI, Docker, field encryption, fail-closed secrets, authZ hardening). Feature breadth is largely unchanged.

This is now a **credible internal demo/pilot (~82%)**, still **not a shippable multi-tenant health SaaS (~58%)**.

| Lens | Prior | Now | Notes |
|------|-------|-----|--------|
| Demo / beta readiness | ~75% | **~82%** | Migrations, CI, Docker, seed secret hygiene, encryption |
| Wellness MVP (original PRD) | ~88% | **~90%** | Field encryption + download/search authZ; dual `/chat` remains |
| Expanded product | ~72% | **~74%** | Email/security polish; LMS sandbox still weak |
| Ship as multi-tenant SaaS | ~48% | **~58%** | Real prod path; still no billing, thin tests, no HIPAA/SSO |

**Strongest asset:** breadth and coherence — wellness + HRMS + multi-agent AI in one multi-tenant app, now with a real deploy/CI path.  
**Weakest asset:** health-data trust and monetization — encryption of some fields ≠ compliance; billing still mostly absent.  
**Potential:** high if you pick one wedge (employer wellness analytics or AI-HR ops) and harden for enterprise sale.

---

## What changed since the prior audit

| Area | Change |
|------|--------|
| Prisma migrations | **Improved** — baseline migration + `db:deploy` |
| CI | **Improved** — `.github/workflows/ci.yml` (migrate → test → build) |
| App Docker / prod compose | **Improved** — `Dockerfile.api`, `Dockerfile.web`, `docker-compose.prod.yml` |
| Field encryption | **Improved** — AES-256-GCM on health free-text + bank/tax fields |
| Webhook / uploads / secrets | **Improved** — fail-closed webhook; public `/uploads` removed from API; seed requires env passwords |
| Tenant isolation tests | **Improved** — payroll/attendance/search/encryption specs |
| Feature breadth | **Same** |
| Billing / SSO / marketing / HIPAA program | **Same (still weak)** |
| Email vs `Email-feat.md` | **Slightly improved** (~55% → ~60%) |
| `services/ai` empty / branding drift / code runner | **Same** |
| Dual chat | **Slightly improved** — `/chat` now facades the AI gateway |

---

## What is best

| Strength | Why it matters | Evidence |
|----------|----------------|----------|
| Feature breadth with real wiring | Not a UI mock — check-in, attendance, leave, payroll, assets, learning, weather, email, and agents all have API + UI | ~49 pages, ~20 controllers, ~28k LOC |
| Production foundation catch-up | Migrations + CI + Docker + required encryption/webhook secrets is a step-change | `prisma/migrations/`, `.github/workflows/ci.yml`, `Dockerfile.*`, `docker-compose.prod.yml` |
| Multi-tenant + RBAC foundation | Company-scoped models and `SUPER_ADMIN` / `COMPANY_ADMIN` / `EMPLOYEE` roles | JWT guards, `companyId` scoping + isolation tests |
| Domain schema depth | Prisma covers wellness, HRMS, weather, LMS, email, integrations in one SoR | `schema.prisma` ~1.7k lines, ~62 models |
| AI agent framework | Wellness / HR / Learning agents behind a gateway | `apps/api/src/ai/` agents + registry + usage log |
| Modern stack | NestJS 11, Next 16, React 19, Prisma 6, Tailwind 4 | `apps/api` + `apps/web` workspaces |

---

## What is worst

| Weakness | Risk | Severity |
|----------|------|----------|
| Health data without a compliance program | Encryption of some fields ≠ HIPAA/BAA/retention/IR; employer insights not truly anonymized; chat/docs/email not encrypted at rest | Critical |
| No real SaaS billing | Schema + FREE 10-seat invite check; no payment provider; plan limits mostly unenforced | Critical |
| Thin automated tests | ~6 spec files / ~21 cases cannot guard payroll/leave/health regressions | High |
| Email hub below its own spec | Nodemailer SMTP only; rich compose, malware scan, bounce/open tracking, content encryption missing | High |
| Unsafe learning code runner | Still uses `new Function` — not a sandbox | High |
| No OAuth/SSO | `googleId` schema field only — enterprise buying blocker | High |
| Product identity / GTM drift | PulseAI vs Nura; no marketing landing; empty `services/ai`; dual chat routes | Medium |

---

## Module completeness

| Module | Prior | Now | Notes |
|--------|-------|-----|--------|
| Auth & invites | ~90% | **~90%** | OAuth/SSO missing |
| Wellness core | ~88% | **~90%** | Strong; privacy/anonymization incomplete |
| HRMS ops | ~82% | **~85%** | Deep; tenant tests for payroll/attendance |
| AI agents | ~78% | **~80%** | Gateway real; dual routes; empty `services/ai` |
| Weather WFH | ~80% | **~80%** | Feature-complete; process-local cron |
| Learning LMS | ~72% | **~70%** | Broad; unsafe runner (rescored honestly) |
| Email hub | ~55% | **~60%** | Below `Email-feat.md` |
| Integrations | ~75% | **~75%** | Make MVP solid |
| SaaS billing | ~25% | **~30%** | Schema + free seat cap; no payments |
| Landing / marketing | — | **~15%** | Redirect only |
| OAuth / SSO | — | **~10%** | Schema field only |
| Prod / DevOps | ~30% | **~65%** | Biggest jump |
| Privacy / HIPAA | ~20% | **~35%** | Encryption helps; no program |

---

## Architecture snapshot

| Layer | Stack |
|-------|--------|
| Frontend | Next.js 16.2.9, React 19.2.4, TypeScript, TailwindCSS v4 |
| Backend | NestJS 11, REST (`/api/v1`), Swagger `/docs`, JWT + refresh |
| Database | PostgreSQL + pgvector (Docker), Prisma 6, **committed migrations** |
| AI | Gemini preferred + OpenAI fallback; Wellness / HR / Learning agents |
| Email | Nodemailer SMTP outbound; inbound webhook (fail-closed) + simulate-reply |
| Storage | Optional AWS S3; local `uploads/` (no longer publicly static from API) |
| Encryption | AES-256-GCM field encryption for health free-text + bank/tax |
| Payments | None (payroll domain only — not SaaS billing) |
| Deploy | `Dockerfile.api` / `Dockerfile.web` + `docker-compose.prod.yml` + GitHub Actions CI |

**Patterns:** npm workspaces monorepo; company-scoped multi-tenancy (shared DB); Next rewrites proxy to Nest; weather jobs via in-process `setInterval`.

**Counts:** 20 Nest controllers · 25 modules · 49 Next pages · ~15.0k API LOC · ~13.2k web LOC · schema 1697 lines.

---

## Security & privacy notes

- Health surface: check-ins, metrics, medical documents, wellness chat — highly sensitive.
- **Improved:** AES-256-GCM on selected health notes and payroll bank/tax fields; prod requires `DATA_ENCRYPTION_KEY`.
- **Still missing:** HIPAA/BAA program; encrypted chat messages, email bodies, document blobs; true anonymized employer analytics.
- Email webhook: **fail-closed** if secret missing.
- Public static `/uploads` serving removed from API `main.ts`; document downloads are JWT-gated.
- Learning code runner is **not** a secure sandbox (`new Function`).
- Seed requires env demo passwords (no hardcoded defaults) — passwords may still print to console after seed.
- Acceptance fields (`termsAcceptedAt` / `privacyAcceptedAt`) exist on Employee.

---

## Email vs `Email-feat.md`

**Implemented (partial MVP):** send, threads, search, archive, templates, inbound webhook, AI thread summary, simulate-reply, attachment MIME/size limits, HR-only RBAC, admin Messages UI.

**Still missing vs spec:** Resend/SES SDK, rich text + signatures, schedule send, sentiment/action/risk AI, bounce/delivered/opened events, malware scan, encrypt stored email content, full inbox polish, mailbox sync.

**Email module vs its own spec: ~60%.**

---

## What potential this project holds

### Strongest commercial wedge

**Employer wellness + HR ops in one OS.** Most competitors are either wellness apps or HRIS. This codebase already bridges daily wellbeing signals with attendance, leave, payroll context, and AI coaching.

Best GTM: sell to HR leads as workforce wellness visibility next to HRMS — not as a medical product.

### AI leverage that is real

The multi-agent registry is a product moat if grounded in company policy, leave rules, and learning paths. Weather WFH and Make webhooks show willingness to automate ops, not just chat.

### Ceiling if you stay broad

Wellness + full HRMS + LMS + email + weather is three or four startups’ worth of surface. Without a sharp ICP and billing, impressive demos and hard support → internal tool / single-company pilot.

### Ceiling if you focus and harden

Freeze scope around wellness analytics + AI HR assistant; finish billing, deepen tests, and build a real privacy program → credible mid-market employer benefits tech. Insurance-manager persona remains the big future unlock from the original PRD.

---

## Strategic paths ranked

| Path | Fit to this codebase | Outcome if executed |
|------|----------------------|---------------------|
| 1. Harden + sell wellness/HR AI wedge | Highest — reuse check-in, insights, agents, company admin | Paid pilots → mid-market SaaS |
| 2. Position as AI-augmented HRMS | High — attendance/leave/payroll already deep | Compete with local HRIS; need payroll/legal rigor |
| 3. Keep building every module | Easy short-term, weak long-term | Impressive demo, weak retention / support load |

---

## Recommended fix order (commercial goal)

### Now — Trust & monetize
- Add real billing + enforce plan limits beyond FREE seat cap
- Deepen tests on health, leave, payroll, email
- Replace `new Function` learning runner with a real sandbox (or disable in prod)
- Document and close anonymized employer-insight gap

### Next — Enterprise readiness
- OAuth/SSO (Google/Microsoft)
- Encrypt chat/email/docs at rest (or justify exclusions)
- Finish email inbound to `Email-feat.md` (provider + security)
- One clear ICP landing page (resolve PulseAI vs Nura)

### Later — Expand
- Durable job runner for weather (replace process `setInterval`)
- Insurance-manager analytics persona
- Split or retire dual `/chat` vs `/ai` surfaces; decide fate of empty `services/ai`

---

## Top 7 highest-impact gaps

1. No real SaaS billing / plan enforcement (beyond FREE 10 seats on invite)  
2. Health-data governance / HIPAA program (BAAs, retention, audit evidence, anonymized insights, encrypt chat/docs/email)  
3. Test & QA depth vs payroll/leave/health surface area  
4. Email hub vs `Email-feat.md` (provider-grade inbound, scans, encryption, AI extras)  
5. Unsafe code execution (`new Function` learning runner)  
6. No OAuth/SSO  
7. Product identity / GTM surface (PulseAI vs Nura; no marketing landing; dual chat / empty `services/ai`)

---

## Bottom line

**Best:** unusually complete multi-domain product with real AI agents — and now a credible CI/Docker/migration foundation.  
**Worst:** trust and monetization still lag feature count; field encryption is progress, not a compliance program.  
**Potential:** high for a focused employer wellness/HR AI product; diluted if every module keeps expanding before billing and privacy are solid.

**Delta vs prior audit:** demo/beta **~75% → ~82%**; SaaS **~48% → ~58%**. Direction is right; commercial ship is still blocked on billing + health-data trust.

---

*Re-audit based on repository structure, Prisma schema + migrations, Nest/Next modules, CI/Docker artifacts, security helpers, and requirement docs (`project-requirment.md`, `Email-feat.md`, HRM, weather, learning, HR assistant). No production runtime metrics were available.*
