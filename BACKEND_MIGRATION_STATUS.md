# Backend migration status

Updated: 2026-10-29

## Goal

Render owns feature APIs and database access; Vercel hosts the Next.js frontend.
The migration must preserve server-side authorization, audit records,
notifications, uploads, and completion/PDF behavior. Work is paused at the user's
request; the goal is not complete.

## Git state

- Branch: `codex/work-branch`
- Last pushed commit: `bd8a684` — `Move activity chart workflow to backend API`
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

Relevant pushed commits, newest first:

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

The backend is still only partly separated. A repo-wide search found direct
Prisma use under `apps/web` in these areas:

- Services: `admin`, `auth`, `gallery`, `notifications`, `pdf`, and `sponsored`.
- Actions: `group` still queries Prisma for a student's roll number before
  calling the API; that lookup should be removed after the API actor context is
  fully used.
- Pages/routes: HOD assignments, audit, groups, dashboards and users; student
  dashboard, group setup, checklists, competitions, cost, notes, papers, PDF,
  RTM and sponsored pages; the print route; private file/PDF routes and local
  media route.
- Completion code: `apps/web/lib/completion/index.ts` and `sections.ts` still
  query Prisma. API copies exist for topic/activity/review/eval checks, but the frontend
  completion engine and dashboard paths have not yet been switched over.
- NextAuth credentials/auth services still use Prisma in the web deployment.

## Next work when resumed

1. **Sponsored project:** move meetings, signatures, sponsor feedback, and seal
   upload with their guide/student permissions, audit records, and notifications.
2. **Administration:** move user management, group approval/rejection, guide
   assignment, PDF permission changes, schedule editing, and audit log filtering.
3. **Notifications and completion:** move inbox read/mark-read paths and all
   remaining triggers; make Vercel dashboards call the API completion endpoints.
4. **PDF and files:** move PDF eligibility checks, generation/export records and
   file ownership/database access behind Render. Preserve the shared Sheet
   rendering behavior and secure private-file downloads.
5. **Authentication boundary:** remove NextAuth/auth service database access
   from Vercel. Keep credentials/session handling secure while having Render
   verify credentials and issue/validate the identity used by the frontend.
6. **Remove remaining frontend database usage:** migrate all pages and route
   handlers listed above; then search all of `apps/web` for Prisma/database
   calls and remove the web Prisma runtime dependency where possible.
7. **Deployment and full verification:** ensure Render and Vercel environment
   variables, CORS origins, internal secrets, storage/email configuration and
   database URL match the new boundary. Run integration tests against a reachable
   isolated test database, plus typecheck, lint, API build, and deployment smoke
   tests. Push each verified stage to `codex/work-branch`.
