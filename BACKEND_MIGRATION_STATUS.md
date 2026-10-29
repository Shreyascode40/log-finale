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

## Verification status

After the last migration stage:

- `npm.cmd run typecheck` — passed for web and API.
- `npm.cmd run lint` — passed.
- `npm.cmd run api:build` — passed.
- `npm.cmd test` — could not reach the configured test database. Prisma reported
  `P1001` for `aws-0-ap-northeast-1.pooler.supabase.com:5432` during global setup,
  before collecting or running tests. The integration behavior is therefore
  not runtime-verified in this environment.
- `git diff --check` — passed for the last staged change.

## Work still required

All business logic, database queries, and route mutations have now been completely migrated
to the Render API (`apps/api`). The remaining stage is final deployment configuration
and environment verification (Step 9).

## Next work when resumed

1. **Deployment and full verification (Step 9):** ensure Render and Vercel environment
   variables, CORS origins, internal secrets, storage/email configuration and
   database URL match the new boundary. Run integration tests against a reachable
   isolated test database, plus typecheck, lint, API build, and deployment smoke
   tests. Push each verified stage to `codex/work-branch`.
