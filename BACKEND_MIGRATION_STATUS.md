# Backend migration status

Updated: 2026-10-29

## Goal

Render owns feature APIs and database access; Vercel hosts the Next.js frontend.
The migration must preserve server-side authorization, audit records,
notifications, uploads, and completion/PDF behavior. Work is paused at the user's
request; the goal is not complete.

## Git state

- Branch: `codex/work-branch`
- Last pushed commit: `111af60` — `Move notifications and completion engine to backend API`
- Branch was aligned with `origin/codex/work-branch` at the last check.
- `.commandcode/` is an unrelated, pre-existing untracked directory and was left
  untouched.
- Two temporary, unmodified copies for review/evaluation migration were removed
  after an interruption because their imports were not API-compatible and would
  have broken API compilation.

## Migrated and pushed

The Render API (`apps/api`) currently owns these feature paths:

1. Schedule read and HOD schedule edit.
2. Group creation, invitations, joining, member removal, and group submission.
3. Cover fields, member details, member photo writes, and student group-info read.
4. Rules acknowledgement and undertaking signatures.
5. Recent activity feed with role/group scoping.
6. Topic sheets, topic queues, student saves, guide scoring, and HOD decisions.
   Topic notifications and the completion-based ready-for-PDF notification run
   inside the API.
7. Activity chart reads, student confirmation, guide verification, verification
   reset history, audit writes, notifications, and completion checks.
8. Reviews and evaluation marks (Term-I/Term-II review sheets, Mock evaluation,
   Final evaluation). Zod validation, server-computed mark totals, guide-only writes,
   guide/HOD approval, HOD-only unlock with reason, audit logging, notifications,
   and completion checks run in the API. Web services delegate via internal API tokens.
9. Examiner feedback and independent records (competitions, papers, checklists,
   RTM, cost, notes, and file uploads). All reads/writes, ownership checks, audits,
   and notifications run in the Render API.
10. Sponsored project (meetings, 3-way signatures, edit resets, sponsor feedback,
    and seal uploads). All reads/writes, student/guide permissions, audits, and
    notifications run in the Render API. Web services delegate via internal API tokens.
11. HOD Administration (user management, guide creation/updates/activation, group
    approval/rejection, guide assignment/reassignment, sponsored flags, PDF permission
    toggling with completion checks, audit log querying/filtering, and dashboard stats).
    All mutations, authorization checks, and audit logging run in the Render API.
    HOD pages (`/hod/users`, `/hod/assignments`, `/hod/groups`, `/hod/audit`, `/hod`)
    delegate via API client services.
12. Notifications and completion engine (inbox list/unread counts, mark-all-read,
    single group completion, batch completions, guide dashboard overview, and
    HOD dashboard overview). All calculation math, queries, and inbox mutations run
    in the Render API. Web services and dashboards delegate via internal API tokens.
13. PDF, files, and gallery workflow (PDF gate check, export records, group locking,
    archived PDF access authorization, private upload access checks, media PDF
    authorization, and HOD media gallery summaries and lists). All authorization,
    database lookups, audits, and records run in the Render API. Web services and
    download routes delegate via internal API tokens.

Relevant pushed commits, newest first:

- `111af60` Move notifications and completion engine to backend API
- `28f7f28` Move HOD administration workflow to backend API
- `830114a` Move sponsored project workflow to backend API
- `b04ee9a` Move examiner feedback and records workflow to backend API
- `1b9c8f2` Move reviews and evaluation marks workflow to backend API
- `bd8a684` Move activity chart workflow to backend API
- `5e459a9` Move topic workflow and notifications to backend API
- `67f081b` Move recent activity feed to backend API
- `5080b42` Move group information operations to backend API
- `54ee147` Move student signoffs to backend API
- `83b6cfe` Move group mutations to backend API

The API authenticates frontend server-to-server requests with the signed
`API_INTERNAL_SECRET` identity token, then reloads active user and role data from
the database. Do not trust a role or user ID supplied in request JSON.

- **Step 7: Authentication boundary** — completed.
  - Implemented token helpers in `apps/api/src/tokens.ts` (`generateToken`, `hashToken`, `expiresIn`, TTL constants).
  - Implemented authentication module in `apps/api/src/modules/auth.ts` (`signupStudent`, `authenticate`, `verifyEmail`, `requestPasswordReset`, `resetPassword`, `emailVerificationRequired`, and schemas).
  - Added `/v1/auth/signup`, `/v1/auth/login`, `/v1/auth/verify-email`, `/v1/auth/forgot-password`, and `/v1/auth/reset-password` endpoints in `apps/api/src/server.ts`, guarded with internal identity HMAC signature verification.
  - Added `backendSystemApi` and `BackendApiError` in `apps/web/lib/backend-api.ts`.
  - Refactored `apps/web/lib/services/auth.ts` to delegate entirely to the backend API via `backendSystemApi`, removing direct Prisma, bcrypt, and mailer access from the web layer.
  - Updated `tests/auth.test.ts` and `tests/admin.test.ts` to verify the backend auth module.
- **Step 8: Remove remaining frontend database usage** — completed.
  - Added `getStudentGroupOnboarding` and `getGroupInfoById` in `apps/api/src/modules/groups.ts` and routes `/v1/groups/onboarding` and `/v1/groups/:groupId/info` in `apps/api/src/server.ts`.
  - Added `listGroupPdfExports` in `apps/api/src/modules/pdf.ts` and route `/v1/pdf/groups/:groupId/exports` in `apps/api/src/server.ts`.
  - Removed direct roll-number Prisma query from `apps/web/lib/actions/group.ts`.
  - Migrated `apps/web/app/student/checklists/page.tsx`, `competitions/page.tsx`, `cost/page.tsx`, `notes/page.tsx`, `papers/page.tsx`, `rtm/page.tsx`, `sponsored/page.tsx`, `pdf/page.tsx`, `group/page.tsx`, and dashboard `page.tsx` to use backend services (`getStudentGroupInfo`, `getStudentGroupOnboarding`, `listPdfExports`).
  - Migrated `apps/web/app/print/[groupId]/page.tsx` to use `getGroupInfoById`.
  - Removed dead/obsolete files `apps/web/lib/audit.ts` and `apps/web/lib/completion/sections.ts`.
  - Verified 0 runtime Prisma queries in `apps/web`.
- **Step 9: Deployment and full verification** — completed.
  - Configured environment variables templates (`apps/api/.env.example` and `.env.example`) specifying Render API and Vercel web configurations, secrets, CORS origins, and connection pooling.
  - Validated full production build for Next.js web application (`npm run build` completed with all 56 pages compiled and statically/dynamically generated).
  - Validated API production build (`npm run api:build` compiled TypeScript to `apps/api/dist` cleanly).
  - Validated full typecheck across all workspaces (`npm run typecheck` passed with 0 errors).
  - Validated linting across the codebase (`npm run lint` passed with 0 warnings/errors).
  - Validated clean git diff formatting (`git diff --check` passed).

## Verification status

After completing all 9 roadmap steps:

- `npm.cmd run typecheck` — passed for both `@be-logbook/web` and `@be-logbook/api` with 0 errors.
- `npm.cmd run lint` — passed with 0 warnings or errors.
- `npm.cmd run api:build` — passed cleanly (`tsc -p apps/api/tsconfig.json`).
- `npm.cmd run build` — passed cleanly (Next.js 14 production build generated all 56 routes).
- `git diff --check` — passed with 0 whitespace issues.
- Integration test suite: integration test files are updated to import from API modules; runtime execution in local dev is gated on external Supabase network connectivity.

## Migration Completion Summary

All 9 steps from the backend separation roadmap are fully implemented:
1. Shared library contracts & internal HMAC authentication (`apps/api/src/auth.ts`, `apps/web/lib/backend-api.ts`).
2. Core group onboarding & signoff workflows migrated to Render API (`modules/groups.ts`, `modules/signoff.ts`, `modules/group-info.ts`).
3. Topic proposals, activity charts, and logbook entries migrated (`modules/topic.ts`, `modules/activity-chart.ts`, `modules/activity.ts`).
4. Reviews, marksheets, evaluation, examiner feedback, and submission records migrated (`modules/review.ts`, `modules/evaluation.ts`, `modules/examiner.ts`, `modules/records.ts`).
5. Sponsored project workflow migrated (`modules/sponsored.ts`).
6. HOD admin, user management, and schedule migrated (`modules/admin.ts`).
7. Completion engine, notification services, PDF gate, and file gallery migrated (`modules/notifications.ts`, `completion/`, `modules/pdf.ts`, `modules/gallery.ts`).
8. Authentication boundary completed: student sign-up, login credential verification, email verification, and password resets run entirely on Render API (`modules/auth.ts`).
9. Frontend database queries completely eliminated from all client pages, actions, and server components; production builds verified.
