# Backend Migration Summary — Digital BE Project Log Book

> **Status:** All 9 Migration Steps Completed & Verified  
> **Target Branch:** `origin/codex/work-branch`  
> **Latest Commit:** `cfeec7d`  

---

## 1. Architecture Overview

The application is structured into a strict two-tier separation between the frontend presentation layer and the backend service layer:

```mermaid
flowchart TD
    subgraph Vercel ["Frontend Layer (Vercel — apps/web)"]
        ClientUI["Next.js 14 App Router UI (A4 Paper Sheets)"]
        NextAuth["NextAuth.js (Session & JWT Strategy)"]
        BackendClient["backendApi & backendSystemApi (HMAC Client)"]
        PdfWorker["Puppeteer Worker (/print/[groupId] Renderer)"]
    end

    subgraph InternalAuth ["Internal HMAC Authentication"]
        TokenAuth["Bearer Token (sub, aud: be-logbook-api, exp + 60s)"]
        SharedSecret["API_INTERNAL_SECRET (SHA-256 HMAC)"]
    end

    subgraph Render ["Backend API Layer (Render — apps/api)"]
        HttpServer["Node HTTP API Server (port 4000/10000)"]
        IdentityGuard["readInternalIdentity & authenticatedUser"]
        DomainModules["Business Logic Modules (auth, groups, topic, review, eval, etc.)"]
        CompletionEngine["Section Completion Engine"]
        StorageEmail["Upload & Email Services (Supabase/Local, Resend/SMTP)"]
        AuditService["Audit Log Writer"]
        PrismaORM["Prisma Client"]
    end

    subgraph SupabaseDB ["Database (PostgreSQL / Supabase)"]
        Database["PostgreSQL (Transaction Pooler: 6543 / Session: 5432)"]
    end

    ClientUI --> NextAuth
    ClientUI --> BackendClient
    NextAuth -->|authenticate()| BackendClient
    BackendClient --> TokenAuth
    TokenAuth --> SharedSecret
    SharedSecret --> IdentityGuard
    IdentityGuard --> HttpServer
    HttpServer --> DomainModules
    DomainModules --> CompletionEngine
    DomainModules --> StorageEmail
    DomainModules --> AuditService
    DomainModules --> PrismaORM
    PrismaORM --> Database
    PdfWorker -.->|Loads sheets| ClientUI
```

---

## 2. Completed Migration Milestones

| Step | Scope | Commit | Key Deliverables |
|---|---|---|---|
| **Step 1** | Reviews & Evaluation Marks Workflow | `1b9c8f2` | `apps/api/src/modules/review.ts`, `apps/api/src/modules/evaluation.ts`, `/v1/reviews/*`, `/v1/evaluation/*` |
| **Step 2** | Examiner Feedback & Logbook Records | `b04ee9a` | `apps/api/src/modules/examiner.ts`, `apps/api/src/modules/records.ts`, `/v1/examiner/*`, `/v1/records/*` |
| **Step 3** | Sponsored Project Workflow | `830114a` | `apps/api/src/modules/sponsored.ts`, 3-way signatures, seal uploads, `/v1/sponsored/*` |
| **Step 4** | HOD Administration & User Management | `28f7f28` | `apps/api/src/modules/admin.ts`, `apps/api/src/password.ts`, `/v1/admin/*` |
| **Step 5** | Notifications & Completion Engine | `111af60` | `apps/api/src/completion/index.ts`, `apps/api/src/modules/notifications.ts`, `/v1/completion/*`, `/v1/notifications/*` |
| **Step 6** | PDF Export Gate, Storage, & Gallery | `db914d4` | `apps/api/src/modules/pdf.ts`, `apps/api/src/modules/gallery.ts`, `/v1/pdf/*`, `/v1/files/*`, `/v1/gallery/*` |
| **Step 7** | Authentication Boundary | `a1cce50` | `apps/api/src/tokens.ts`, `apps/api/src/modules/auth.ts`, `/v1/auth/*`, `apps/web/lib/backend-api.ts` (`backendSystemApi`) |
| **Step 8** | Complete Elimination of Frontend DB Usage | `83d8142` | `/v1/groups/onboarding`, `/v1/groups/:groupId/info`, `/v1/pdf/groups/:groupId/exports`, refactored all 10 student/print pages, deleted obsolete files |
| **Step 9** | Deployment Configurations & Verification | `cfeec7d` | `apps/api/.env.example`, Next.js production build (`npm run build`), API compilation, zero lint/type errors |

---

## 3. Endpoints Matrix

### Authentication (`/v1/auth/*`)
- `POST /v1/auth/signup` — Student self-registration with roll number uniqueness, email domain checks, single-use token generation, and audit logging.
- `POST /v1/auth/login` — Verifies bcrypt password, checks account active state and email verification requirement.
- `POST /v1/auth/verify-email` — Consumes single-use SHA-256 token and marks account verified.
- `POST /v1/auth/forgot-password` — Generates 1-hour expiration reset token and dispatches reset email.
- `POST /v1/auth/reset-password` — Validates reset token and updates password hash.

### Groups & Signoff (`/v1/groups/*`, `/v1/student/group-info/*`, `/v1/signoff/*`)
- `GET /v1/groups/onboarding` — Fetches current student membership, group details, and pending received invites.
- `GET /v1/groups/:groupId/info` — Retrieves group metadata, members, and guide info with access control.
- `POST /v1/groups` — Group creation.
- `POST /v1/groups/invites` — Member invitation by roll number or email.
- `POST /v1/groups/invites/accept` & `/decline` — Responding to invitations.
- `POST /v1/groups/join-by-code` — Joining via unique alphanumeric group code.
- `DELETE /v1/groups/members/:memberId` — Removing group members.
- `POST /v1/groups/submit` — Submitting group for HOD approval.
- `GET /v1/student/group-info` & `POST /v1/student/group-info/cover` / `member` / `photo` — Group cover and members management.
- `POST /v1/signoff/rules` & `POST /v1/signoff/undertaking` — Digital acknowledgment and undertaking signature.

### Topics & Activity Charts (`/v1/topics/*`, `/v1/activity-charts/*`, `/v1/activity/*`)
- `GET /v1/topics/sheet/:groupId` & `POST /v1/topics/save` — Student topic draft proposals (Topic 1 & locked Topic 2).
- `POST /v1/topics/score` & `POST /v1/topics/decide` — Guide scoring (0-10 parameters) and HOD approve/reject decisions.
- `GET /v1/activity-charts/groups/:groupId/:month` — Monthly activity charts (June to March, May-June).
- `POST /v1/activity-charts/confirm` — Student two-step activity confirmation.
- `POST /v1/activity-charts/verify` — Guide verification and countersignature.
- `GET /v1/activity/recent` — Recent logbook activity timeline.

### Reviews & Marks Evaluation (`/v1/reviews/*`, `/v1/evaluation/*`)
- `GET /v1/reviews/groups/:groupId/:reviewType` — 7 standardized project review sheets.
- `POST /v1/reviews/draft`, `submit`, `approve`, `unlock` — Marks workflow (`DRAFT` -> `SUBMITTED` -> `APPROVED` -> HOD `unlock` with reason).
- `GET /v1/evaluation/mock/:groupId` & `POST /v1/evaluation/mock/save` / `approve` / `unlock` — Mock Evaluation Term-I (50 marks).
- `GET /v1/evaluation/final/:groupId` & `POST /v1/evaluation/final/save` / `approve` / `unlock` — Final Evaluation Term-II (100 marks).

### Records, Examiner & Sponsored Projects (`/v1/records/*`, `/v1/examiner/*`, `/v1/sponsored/*`)
- `GET /v1/records/groups/:groupId` — Competitions, papers, content pages (RTM & Cost), and notes.
- `POST /v1/records/competitions`, `papers`, `content`, `notes`, `checklists` — CRUD and document file uploads.
- `GET /v1/examiner/groups/:groupId/:term` & `POST /v1/examiner/save` — External examiner feedback forms.
- `GET /v1/sponsored/groups/:groupId` & `POST /v1/sponsored/meetings` / `feedback` / `seal` — Sponsored meeting logs (Semester 1 & 2) and company feedback.

### HOD Administration (`/v1/admin/*`)
- `GET /v1/admin/dashboard` — Live counts, queues, and activity stats.
- `GET /v1/admin/users`, `POST /v1/admin/guides`, `PATCH /v1/admin/users/:userId/active` — User management and guide accounts.
- `GET /v1/admin/groups`, `POST /v1/admin/groups/:groupId/approve` / `reject` / `sponsored` — Group administration.
- `GET /v1/admin/assignments`, `POST /v1/admin/assignments` — Assigning/reassigning faculty guides.
- `POST /v1/admin/groups/:groupId/pdf-permission` — Toggling PDF export permissions (enforcing full completion checks).
- `GET /v1/admin/audit-logs` — Filterable audit trail.

### Completion, Notifications & PDF (`/v1/completion/*`, `/v1/notifications/*`, `/v1/pdf/*`, `/v1/gallery/*`)
- `GET /v1/completion/groups/:groupId`, `/batch`, `/guide-overview`, `/hod-overview` — Section completion aggregate engine.
- `GET /v1/notifications` & `POST /v1/notifications/mark-read` — User notification feed.
- `GET /v1/pdf/groups/:groupId/gate` — Validates HOD permission and 100% completion prerequisites.
- `GET /v1/pdf/groups/:groupId/exports` & `POST /v1/pdf/exports` — Past PDF generations and locking group to `PDF_GENERATED`.
- `GET /v1/files/authorize` & `GET /v1/media/authorize-pdf` — Access control for private stored assets.
- `GET /v1/gallery/summary` & `GET /v1/gallery/data` — Filterable certificate and paper evidence gallery.

---

## 4. Verification & Quality Matrix

| Check | Tool / Command | Result | Details |
|---|---|---|---|
| **Typecheck** | `npm run typecheck` | **PASS (0 errors)** | Validated `@be-logbook/web` and `@be-logbook/api` in strict TypeScript mode |
| **Lint** | `npm run lint` | **PASS (0 warnings)** | Next.js and ESLint checks passed cleanly |
| **API Build** | `npm run api:build` | **PASS** | `tsc -p apps/api/tsconfig.json` compiles to `apps/api/dist` |
| **Web Production Build** | `npm run build` | **PASS** | Next.js 14 production build compiled all 56 pages with static & dynamic optimization |
| **Code Formatting** | `git diff --check` | **PASS** | Clean diff with zero whitespace or line-break warnings |
| **Frontend DB Queries** | `git grep -n "prisma" apps/web` | **0 runtime queries** | All direct Prisma queries removed from pages, actions, and services in `apps/web` |
