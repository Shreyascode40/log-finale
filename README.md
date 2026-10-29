# Digital BE Project Log Book

Web app that digitizes the paper **Project Diary** (Record No. `ACA/D/003B`, Revision `00`,
DoI `01/02/2025`) of Anantrao Pawar College of Engineering & Research — Computer Engineering.

The full specification is in [`SPEC.md`](./SPEC.md); the always-on agent rules and the paper-page
UI requirement are in [`AGENTS.md`](./AGENTS.md).

## Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Styling | Tailwind CSS; shadcn/ui **outside** the logbook sheets only |
| Forms / validation | React Hook Form + Zod |
| Database | PostgreSQL via Supabase (`DATABASE_URL` transaction pooler + `DIRECT_URL` session pooler) |
| Auth | NextAuth (credentials) + bcrypt |
| Uploads | local disk with `UPLOAD_PROVIDER="local"`, Supabase Storage with `"supabase"` |
| PDF | Puppeteer (A4), rendering the same Sheet components |
| Tests | Vitest (unit) and Playwright (E2E / visual, added later) |

## Frontend and backend

The repository contains separately deployable applications. The Next.js frontend lives in
`apps/web`; the independent TypeScript API lives in `apps/api`. The API health endpoint and
Schedule read/update flow are the first API-backed slice.
Schedule persistence and its audit write now run in the API. Other feature services remain in
the frontend until they are migrated incrementally.

Run both processes locally in separate terminals:

```bash
npm run dev                 # Next.js frontend on port 3000
npm run api:dev             # API on port 4000
```

Deploy the API as its own service using the repository root as its build context. Run
`npm install`, `npx prisma generate`, and `npm run api:build` at the root, then start it with
`npm run api:start`. Set `DATABASE_URL`, `API_INTERNAL_SECRET`, `API_PORT`, and comma-separated
`API_ALLOWED_ORIGINS` in the API service environment. The frontend needs matching
`API_INTERNAL_SECRET` plus `API_BASE_URL`. Keep the shared secret server-side and use a randomly
generated value of at least 32 characters. The default local origin is `http://localhost:3000`.

The frontend creates a short-lived signed identity assertion for server-to-server API calls.
The API verifies it and re-reads the user from the database before applying its own role checks;
the browser never receives the assertion. As modules move, their authorization and database
transactions belong in `apps/api`, with Next.js server actions acting as frontend adapters.

## Setup

```bash
npm install
cp .env.example .env          # then edit the values (Windows: copy .env.example .env)
npm run db:generate           # generate Prisma client for the shared schema
npm run db:migrate            # apply migrations (Prisma uses DIRECT_URL when set)
npm run db:seed               # seed data (added feature by feature)
npm run dev                   # apps/web at http://localhost:3000
```

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (uses `.env.test.local`) |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:deploy` | Clear a stale migration lock, then `prisma migrate deploy` |
| `npm run db:seed` | `tsx prisma/seed.ts` |

### Test database

`npm test` refuses to run against the application database. Create a git-ignored
`.env.test.local` that points at a **separate schema**:

```bash
TEST_DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=30&schema=logbook_test"
TEST_DIRECT_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres?schema=logbook_test"
```

The global setup drops and recreates that schema, applies the checked-in migration SQL and
adds one baseline review template, so every run starts clean. It will not run against
`public` or against the same URL as `DATABASE_URL`. A local PostgreSQL database works too;
add the same `?schema=logbook_test` parameter to both test URLs.

## Demo accounts (after `npm run db:seed`)

All accounts use the password **`Password@123`**.

| Role | Email |
|---|---|
| HOD | `hod@apcoer.edu.in` |
| Guide / Reviewer | `guide1@apcoer.edu.in`, `guide2@apcoer.edu.in`, `guide3@apcoer.edu.in` |
| Student | `te2101@apcoer.edu.in` … `te2108@apcoer.edu.in` |

Students self-register at `/signup` (role is always STUDENT, set by the server). Guides and the HOD
are created by the HOD — they are never self-registered. In development (`EMAIL_PROVIDER=console`)
verification and reset links are printed to the server log **and** shown on the sign-up / forgot-password
screens, so the whole flow can be demoed without a mailbox. Set `ALLOWED_EMAIL_DOMAIN` to restrict
student sign-up to your college domain.


## Paper-page shell (F1)

Every logbook screen is an A4 sheet that matches the printed page.

| Piece | Location |
|---|---|
| A4 sheet wrapper | `apps/web/components/paper/paper-page.tsx` |
| Repeated college header (record no., revision, DoI, grey "Project Diary" bar) | `apps/web/components/paper/college-header.tsx` |
| Blank-line field (prints as text when read-only/locked) | `apps/web/components/paper/field.tsx` |
| E-signature cell ("Signed by <name> on <date time>") | `apps/web/components/paper/sign-cell.tsx` |
| Marks cell (editable only by the assigned guide) | `apps/web/components/paper/marks-cell.tsx` |
| Tick box | `apps/web/components/paper/tick-box.tsx` |
| Table primitives | `apps/web/components/paper/paper-table.tsx` |
| Viewer shell (thumbnails, toolbar, zoom, Page Up/Down) | `apps/web/components/viewer/sheet-viewer.tsx` |
| Demo (screen + `?print=1`) | `apps/web/app/demo/paper/page.tsx` |

The same Sheet components are rendered on screen and in the PDF route (`/print/[groupId]`, F16);
there is no separate PDF template.

## Implemented features

### F2 — Authentication

| Piece | Location |
|---|---|
| NextAuth options (credentials, JWT sessions) | `apps/web/lib/auth.ts` |
| Sign-up / verify / login / reset service | `apps/web/lib/services/auth.ts` |
| Route protection + role helpers | `apps/web/lib/permissions.ts`, `apps/web/lib/roles.ts`, `apps/web/middleware.ts` |
| Rate limiting | `apps/web/lib/rate-limit.ts` |

Students self-register at `/signup`; the role is forced to `STUDENT` server-side. Guides and the HOD
are created by the HOD. Unverified accounts cannot log in.

### F3 — HOD administration

| Piece | Location |
|---|---|
| Service (`createGuide`, `updateGuide`, `setUserActive`, `approveGroup`, `rejectGroup`, `assignGuide`) | `apps/web/lib/services/admin.ts` |
| Server actions (all HOD-gated) | `apps/web/lib/actions/admin.ts` |
| Pages | `apps/web/app/hod/` (`users`, `groups`, `assignments`, `audit`) |

The HOD creates guide accounts, approves/rejects submitted groups, assigns exactly one guide per
group, and reviews the audit log. Approving a group and assigning its guide happen together, so the
group only becomes `ACTIVE` when both are done.

### F4 — Student groups (create, invite, submit)

Route: `/student/group`. A student belongs to **at most one** group, and a group has **at most 4**
members. The creator invites classmates by **email or roll number**, anyone can **join by the shared
group code**, and only the creator can **submit** the group (`DRAFT → SUBMITTED`) for HOD approval.

| Piece | Location |
|---|---|
| Service (`createGroup`, `inviteMember`, `acceptInvite`, `declineInvite`, `joinByCode`, `removeMember`, `submitGroup`) | `apps/web/lib/services/group.ts` |
| Server actions (all student-gated) | `apps/web/lib/actions/group.ts` |
| Zod schemas | `apps/web/lib/validation/group.ts` |
| Page + client UI | `apps/web/app/student/group/page.tsx`, `apps/web/components/student/group-onboarding.tsx` |
| Student shell + dashboard | `apps/web/app/student/layout.tsx`, `apps/web/app/student/page.tsx`, `apps/web/components/app/student-nav.tsx` |

Server-side invariants (never only in the UI): a student cannot join a second group, the 5th member
is rejected on every path (invite and code), and only the creator can submit. Every create, invite,
accept/decline, join, removal and submit writes an `AuditLog` row.

**Demo flow:** reset the database (`npm run db:seed` on a fresh DB) so that `G1` is `SUBMITTED`
(TE2101–TE2104) and `G2` is a `DRAFT` containing only its creator **TE2105**; TE2106–TE2108 are free.
Log in as `te2105` → `/student/group`, invite `te2106`–`te2108`, have each accept (or share the group
code), then submit. Log in as `hod@apcoer.edu.in` → `/hod/groups` to approve and assign a guide; the
creator then sees the group as `ACTIVE` with the guide's name.

### F5 — Cover sheet and Group Information sheets

Routes: `/student/cover` and `/student/members`. These are the first real logbook pages: A4 sheets
built from the shared paper components (`apps/web/components/paper/*`) and rendered inside the viewer shell on
screen, or stacked with `?print=1` for the PDF route later. Group members edit them with **autosave**
(the "Saved" tick sits in the viewer toolbar, outside the paper); the guide and HOD see them read-only
in later features.

| Piece | Location |
|---|---|
| Service (`updateCover`, `updateMember`, `updateMemberPhoto`, `getStudentGroupInfo`) | `apps/web/lib/services/group-info.ts` |
| Server actions (student-gated) | `apps/web/lib/actions/group-info.ts` |
| Zod schemas | `apps/web/lib/validation/group-info.ts` |
| Local file storage + `/media` serving route | `apps/web/lib/upload.ts`, `apps/web/app/media/[...path]/route.ts` |
| Cover sheet | `apps/web/app/student/cover/page.tsx`, `apps/web/components/student/cover-sheet.tsx` |
| Group Information sheets (Members 1–4 across two sheets) | `apps/web/app/student/members/page.tsx`, `apps/web/components/student/members-sheet.tsx` |

Enforced on the server: only a student who belongs to the group may edit (a guide, the HOD, or a
student from another group is refused); mobile must be 10 digits and email a valid address; roll
numbers and exam seat numbers are unique within the group; photos must be JPG/PNG and ≤ 2 MB; a group
whose status is `PDF_GENERATED` is locked. Every cover, member and photo change writes an `AuditLog`
row (`COVER_UPDATE`, `MEMBER_UPDATE`, `MEMBER_PHOTO_UPDATE`).

Uploads are written to `var/uploads/` and served through `/media/[...path]` (files added to
`apps/web/public/` at runtime are not served by `next start`); production switches the provider to Supabase
Storage via `UPLOAD_PROVIDER="supabase"`.

**Demo flow:** log in as `te2105` → `/student/cover`, fill the department, A.Y., project title, area
and group number (the guide appears once the HOD has assigned one); then `/student/members` and fill
each member's TE result, roll, mobile, exam seat, email, contribution and photo. Values save as you
type and survive a reload.

### F6 — Rules and Undertaking sheets

Routes: `/student/rules` and `/student/undertaking`. The Rules sheet prints the 13 static rules in a
boxed list with an "I have read and understood" tick per member; the Undertaking sheet prints the B4
paragraph (blanks filled from the group data) with a five-row signature table. Both are A4 sheets in
the viewer shell and stack with `?print=1`.

| Piece | Location |
|---|---|
| Service (`acknowledgeRules`, `acceptUndertaking`) | `apps/web/lib/services/signoff.ts` |
| Server actions (student-gated) | `apps/web/lib/actions/signoff.ts` |
| Rules sheet | `apps/web/app/student/rules/page.tsx`, `apps/web/components/student/rules-sheet.tsx` |
| Undertaking sheet | `apps/web/app/student/undertaking/page.tsx`, `apps/web/components/student/undertaking-sheet.tsx` |

**One student handles the whole group:** any group member may sign any member's row, so a single
student can acknowledge and accept for everyone. The target must belong to the caller's own group (a
member of another group is refused), a guide or a student with no group is refused, a second click
keeps the original timestamp, and a `PDF_GENERATED` group is locked. Each signature writes an
`AuditLog` row (`RULES_ACK`, `UNDERTAKING_ACCEPT`) recording the user who actually clicked, and each
row prints as "Signed by \<member name> on \<date time\>".

**Demo flow:** log in as any student in the group and open `/student/rules`, tick the
"I have read and understood" box on each member's row, then `/student/undertaking` and Accept for
each member. One student can complete both sheets for the whole group; a guide or HOD cannot sign.

### F7 — Schedule sheet

Routes: `/hod/schedule` (editable) and `/guide/schedule`, `/student/schedule`
(read-only). The two B5 tables
(**Semester I** and **Semester II**) each render as an A4 sheet with the columns *Sr. No, Description,
Dates*, followed by the bold-italic notice *"Any changes in schedule will be informed from time to time
by notice."* The sheet stacks with `?print=1`.

| Piece | Location |
|---|---|
| Service (`getSchedule`, `updateScheduleItem`) | `apps/web/lib/services/schedule.ts` |
| Server action (HOD-gated) | `apps/web/lib/actions/schedule.ts` |
| Zod schema | `apps/web/lib/validation/schedule.ts` |
| Seeded rows (B5) | `prisma/seed-data/schedule.ts` |
| Shared sheet + pages | `apps/web/components/schedule/schedule-sheet.tsx`, `apps/web/app/hod/schedule/page.tsx`, `apps/web/app/guide/schedule/page.tsx`, `apps/web/app/student/schedule/page.tsx` |

Only the **HOD** may edit the date cells (the server re-checks the role on every save and writes a
`SCHEDULE_UPDATE` `AuditLog` row, recording who made the change); guides, students and the print view
are read-only. Dates are free text so a row can hold a range or a phrase like *"As per university
schedule"*. Re-running `npm run db:seed` refreshes the descriptions but never overwrites a date that
has already been set.

**Demo flow:** log in as `hod@apcoer.edu.in` → `/hod/schedule`, type dates against the Semester I and
Semester II rows (they autosave), then log in as a guide or student → `/guide/schedule` or
`/student/schedule` to see the same sheets read-only.

### F8 — Topic Finalization

Two A4 sheets per group — **Topic 1** and **Topic 2** (SPEC.md B6): the project **title** and
**description**, the guide's scores for **Significance / Applicability, Innovativeness, Scope and
Feasibility (0–10)** with a **Yes/No recommendation**, then the HOD's approval. Workflow:
student writes the text and submits → the assigned guide (reviewer) scores → the HOD approves or
rejects with a mandatory written reason. Each step writes an `AuditLog` row (`TOPIC_SAVE`,
`TOPIC_SUBMIT`, `TOPIC_SCORE`, `TOPIC_APPROVE`, `TOPIC_REJECT`); every write is re-checked on the
server.

| Piece | Location |
|---|---|
| Service (`getTopicSheet`, `saveTopic`, `scoreTopic`, `decideTopic`, queues) | `apps/web/lib/services/topic.ts` |
| Server actions | `apps/web/lib/actions/topic.ts` |
| Zod schemas | `apps/web/lib/validation/topic.ts` |
| Shared sheet (student / guide / HOD modes) | `apps/web/components/topics/topic-sheet.tsx` |
| Pages | `apps/web/app/student/topics`, `apps/web/app/guide/topics` (+`/[groupId]`), `apps/web/app/hod/topics` (+`/[groupId]`) |

Rules enforced server-side:

- **Topic 2 is enabled only if Topic 1 is rejected** (master rule 6). While Topic 1 is a draft,
  submitted, scored or approved, Topic 2 cannot be written, scored or decided; approving Topic 1
  leaves Topic 2 permanently not required.
- **Only the guide assigned to that group may score**; students, other guides and the HOD cannot.
- **Only the HOD may approve or reject**, and the guide must have scored first.
- Topics unlock only once the group is **ACTIVE** (master rule 12); the final PDF locks them.
- The guide's e-signature (from the score audit) and the HOD's approval render as
  "Signed by \<name> on \<date time>".

**Demo flow:** the student opens `/student/topics`, types a title and description and clicks
*Submit for review*; the assigned guide opens `/guide/topics`, scores 0–10 and ticks Yes/No, then
saves; the HOD opens `/hod/topics`, reviews and Approves (or Rejects with a reason).

### F9 — Activity charts

Eleven month charts (June … March plus May-June, no April — SPEC.md B7): each row shows *Sr.
No, Date, Activity Planned, Complete/Incomplete, student sign, guide sign*. The student enters the
date, ticks Complete/Incomplete and confirms; the assigned guide verifies. Editing a
guide-verified row resets it to confirmed, clears the guide countersign, keeps a history row
(`ActivityEntryHistory`) and needs a fresh verification (master rule 7). Each step writes an
`AuditLog` row (`ENTRY_CONFIRM`, `ENTRY_VERIFY`, both now labelled in the Recent activity feed);
every write is re-checked on the server.

| Piece | Location |
|---|---|
| Service (`getMonthChart`, `confirmEntry`, `verifyEntry`, queues) | `apps/web/lib/services/activity-chart.ts` |
| Server actions | `apps/web/lib/actions/activity-chart.ts` |
| Zod schemas | `apps/web/lib/validation/activity-chart.ts` |
| Seeded planned activities (B7, 53 rows) | `prisma/seed-data/activity.ts` |
| Shared sheet + month tabs + pages | `apps/web/components/activity/activity-chart-sheet.tsx`, `apps/web/components/activity/month-tabs.tsx`, `apps/web/app/student/activity/[month]`, `apps/web/app/guide/activity` (+`/[groupId]/[month]`), `apps/web/app/hod/activity` (+`/[groupId]/[month]`) |

Rules enforced server-side:

- Entries materialize lazily (one `PLANNED` row per template) when a month chart opens.
- Only students of the group may confirm; only the assigned guide may verify, and only a
  student-confirmed row (verifying a planned row or re-verifying is refused).
- Charts unlock only once the group is **ACTIVE** (master rule 12); the final PDF locks them.
- Both e-signatures render as "Signed by \<name> on \<date time>".

**Demo flow:** log in as `te2101@apcoer.edu.in` → `/student/activity/june`, tick Complete and
Confirm a row; log in as `guide2@apcoer.edu.in` → `/guide/activity` → Group G1 → June, and Verify
it; the HOD watches progress at `/hod/activity`.

### F10 — Term-I reviews and marks workflow

Three review sheets — **Review I** (10 questions), **Review II** (12), **Final/Design** (17,
SPEC.md B8 seeded exactly): each row has *Question, Remark, Grade, Sign of Guide*, plus a
*Remark and Suggestions* box and the reviewer signatures. Workflow (master rule 3): the assigned
guide fills the draft → **Submit** (applies the guide's per-question sign automatically) →
**Approve** by the guide or HOD (locked). Only the HOD can **unlock** approved marks with a
mandatory written reason, returning the form to DRAFT. Every transition writes an `AuditLog` row
(`REVIEW_SAVE/SUBMIT/APPROVE/UNLOCK`, all labelled in the Recent activity feed).

| Piece | Location |
|---|---|
| Service (sheet, draft, submit, approve, unlock, queues) | `apps/web/lib/services/review.ts` |
| Server actions | `apps/web/lib/actions/review.ts` |
| Zod schemas | `apps/web/lib/validation/review.ts` |
| Seeded templates + B8 questions (10/12/17) | `prisma/seed-data/reviews.ts` |
| Shared sheet + pages | `apps/web/components/reviews/review-sheet.tsx`, `apps/web/app/student/reviews` (+`/[reviewType]`), `apps/web/app/guide/reviews` (+`/[groupId]/[reviewType]`), `apps/web/app/hod/reviews` (+`/[groupId]/[reviewType]`) |

Rules enforced server-side:

- **Only the assigned guide writes** remarks/grades/suggestions; students, other guides and the
  HOD are refused. Students see every sheet read-only.
- Only a draft can be edited or submitted; only a submitted review can be approved; only an
  approved one can be unlocked — and only by the HOD with a reason.
- Reviews unlock only once the group is **ACTIVE** (master rule 12); the final PDF locks them.

**Demo flow:** `guide2@apcoer.edu.in` → `/guide/reviews` → Group G1 → Review I, fill a remark and
grade, *Save draft*, then *Submit (signs every question)*; approve it there (or as
`hod@apcoer.edu.in` → `/hod/reviews`); the HOD can *Unlock to draft* with a reason.

### F11 — Mock Evaluation (50) and Examiner Feedback Term-I

**Mock table** (SPEC.md B9): one row per member over 7 components (5/5/5/10/5/10/10, total 50
always computed on the server, each cell validated against its max). Workflow per row:
DRAFT → SUBMITTED → APPROVED, with group-level Save/Submit/Approve buttons and HOD-only unlock
with a mandatory reason. The two committee signs are the guide's submission (audit-backed) and
the approver. **Examiner sheet** (SPEC.md B10): project title, date, the 9 questions each rated
Excellent/Good/Satisfactory, remarks, external name + internal (guide) sign. The assigned guide
transcribes the ratings; students and the HOD see it read-only. Every marks transition writes a
per-row `AuditLog` (`MOCK_SAVE/SUBMIT/APPROVE/UNLOCK`, `EXAMINER_SAVE`).

| Piece | Location |
|---|---|
| Services | `apps/web/lib/services/mock.ts`, `apps/web/lib/services/examiner.ts` |
| Server actions | `apps/web/lib/actions/mock.ts`, `apps/web/lib/actions/examiner.ts` |
| Zod schemas + rubric/rating constants | `apps/web/lib/validation/mock.ts`, `apps/web/lib/validation/examiner.ts`, `apps/web/lib/constants.ts` (`MOCK_T1_COMPONENTS`, `EXAMINER_QUESTIONS`) |
| Shared sheets + pages | `apps/web/components/evaluation/mock-sheet.tsx`, `apps/web/components/examiner/examiner-sheet.tsx`, `apps/web/app/student/{mock,examiner}`, `apps/web/app/guide/{mock,examiner}` (+`/[groupId]`), `apps/web/app/hod/{mock,examiner}` (+`/[groupId]`) |

Rules enforced server-side: only the assigned guide writes cells/feedback; students, other
guides and the HOD are refused; only drafts edit, only submitted rows approve, only approved rows
unlock (HOD + reason); sheets unlock only once the group is ACTIVE; the final PDF locks them.

**Demo flow:** `guide2@apcoer.edu.in` → `/guide/mock` → Group G1, enter marks, *Save marks*,
*Submit table*, *Approve*; HOD can unlock at `/hod/mock`. Examiner: `/guide/examiner` → rate all
9 questions and *Save feedback*; students read both at `/student/mock` and `/student/examiner`.

### F12 — Competitions, papers, checklists, RTM, cost, notes

Independent student records, no workflow: **competitions** (name, date, college + level,
Poster/Demo/Paper Presentation, award, certificate PDF/scan upload); **papers** (title,
conference, ISSN, volume/issue, page, paper file upload); **submission checklists** Term-I (5)
and Term-II (8, SPEC.md B11 ticked inline); **RTM and Cost Estimation** free pages (typed text
and/or an attached file); **notes** (free text, add/edit/delete). Saved records count toward
completion; zero competitions flags "Not eligible for final exam" (F15).

| Piece | Location |
|---|---|
| Service (CRUD, uploads, checklists, pages, notes, HOD bundle) | `apps/web/lib/services/records.ts` |
| Server actions (incl. `FormData` uploads) | `apps/web/lib/actions/records.ts` |
| Zod schemas + static items | `apps/web/lib/validation/records.ts`, `apps/web/lib/constants.ts` (`CHECKLIST_ITEMS`, `COMPETITION_TYPES`) |
| Document uploads (PDF/JPG/PNG ≤ 10 MB) | `apps/web/lib/upload.ts` (`saveDocument`) |
| Shared sheets + pages | `apps/web/components/records/*-sheet.tsx`, `apps/web/app/student/{competitions,papers,checklists,rtm,cost,notes}`, `apps/web/app/hod/records` (+`/[groupId]`) |

Rules enforced server-side: only students of the group write (guides/HOD read-only); rows
outside the group refused; uploads restricted by type and size; everything audits. Unlike
topics/charts/reviews these unlock before ACTIVE — only a generated final PDF locks them.

**Demo flow:** `te2101@apcoer.edu.in` → `/student/competitions` → *Add a competition*, attach the
certificate; `/student/checklists` and tick Term-I; `/student/rtm` and type the matrix; the HOD
reads the whole bundle at `/hod/records` → Group G1.

### F13 — Term-II reviews, Final Evaluation (100), Examiner Feedback Term-II

Reuses the F10/F11 machinery for Term-II: **Review I (Modeling, 13 q)**, **Review II
(Coding, 10 q, per-row Date column)**, **Final Validation (9 q, per-row Date)**, **Report Writing
(9 q, per-row Date)** — B8 seeded exactly, with term-aware tabs on every detail page. The
**Final Evaluation table** (B9: Modeling 10, Coding 40, Testing/Understanding/Team/Demo/Docs 10
each, total 100 server-computed) runs on a shared generic core with the mock table
(`apps/web/lib/services/evaluation.ts`; `mock.ts`/`final.ts` are thin kind wrappers, F11 behavior
unchanged). **Examiner Feedback Term-II** reuses the F11 sheet under `[term]` routes with
Term-I/Term-II tabs.

| Piece | Location |
|---|---|
| Schema change (approved): `ReviewScore.date` | `prisma/schema.prisma` + migration `20261009170105_add_review_score_date` |
| Shared core + kind wrappers | `apps/web/lib/services/evaluation.ts`, `apps/web/lib/services/mock.ts`, `apps/web/lib/services/final.ts` |
| Validation | `apps/web/lib/validation/review.ts` (all 7 types + per-row date), `apps/web/lib/validation/final.ts` |
| Sheets | `apps/web/components/reviews/review-sheet.tsx` (Date column), `apps/web/components/evaluation/eval-sheet.tsx` (was `mock-sheet.tsx`) |
| Pages | all review details (term tabs), `apps/web/app/student/final`, `apps/web/app/guide/final` (+`[groupId]`), `apps/web/app/hod/final` (+`[groupId]`), examiner `[term]` routes |

**Demo flow:** `guide2@apcoer.edu.in` → `/guide/reviews/.../REVIEW_II_CODING`, fill dates/remarks
and submit; → `/guide/final/...` enter marks (Coding max 40) and submit; → examiner
`/TERM_II` tab and record; HOD approves each at `/hod/reviews`, `/hod/final`, `/hod/examiner`.

### F14 — Sponsored project sheets

Only groups the HOD flags **Sponsored** (toggle on `/hod/groups`, audited `GROUP_SPONSORED`) use
them: **meeting logs Semester 1 + 2** (date, summary since last review, summary before next
review, student sign, guide countersign, external guide sign) and **sponsor feedback** (7
parameters rated High/Medium/Low, company, seal-scan upload carrying the authority signature).
Students add/edit rows, sign their own, and record the external date (external guides have no
accounts — the audit captures the recorder); the assigned guide countersigns signed rows;
editing a signed row clears every signature. Unsponsored groups see a notice instead of sheets.

| Piece | Location |
|---|---|
| Service + actions + validation | `apps/web/lib/services/sponsored.ts`, `apps/web/lib/actions/sponsored.ts`, `apps/web/lib/validation/sponsored.ts` |
| Sponsored flag (HOD) | `setGroupSponsored` in `apps/web/lib/services/admin.ts`, action in `apps/web/lib/actions/admin.ts`, toggle in `apps/web/components/admin/groups-manager.tsx` |
| Sheets + pages | `apps/web/components/sponsored/meeting-sheet.tsx`, `apps/web/components/sponsored/feedback-sheet.tsx`, `apps/web/app/student/sponsored`, `apps/web/app/guide/sponsored` (+`[groupId]`), `apps/web/app/hod/sponsored` (+`/[groupId]`) |

**Demo flow:** HOD → `/hod/groups` → *Mark sponsored* on a group; student → `/student/sponsored`
adds a Semester 1 meeting, signs it; guide → `/guide/sponsored` countersigns; student files the
feedback ratings and seal.

### F15 — Completion engine and dashboards

Each section exposes its status (`SectionStatus = { key, label, href, complete, percent }`) and
the registry in `apps/web/lib/completion/index.ts` aggregates them into an overall percent, a missing
list and ready-for-PDF. "Complete" follows SPEC.md A5 exactly (cover + guide + full members,
rules + undertaking from every member, one APPROVED topic, every planned activity row COMPLETE
and guide-verified counted against all templates, RTM/cost present, all 7 reviews APPROVED,
mock + final APPROVED for every member, both examiner feedbacks saved, both checklists fully
ticked, 1+ competition, 1+ paper, sponsored sections only if sponsored).

| Piece | Location |
|---|---|
| Section statuses + registry/aggregate | `apps/web/lib/completion/sections.ts`, `apps/web/lib/completion/index.ts` (`getGroupCompletion`, `getGuideOverview`, `getHodOverview`) |
| PDF permission toggle (HOD, refused with the missing list unless complete) | `setPdfPermission` in `apps/web/lib/services/admin.ts`, action in `apps/web/lib/actions/admin.ts`, `apps/web/components/hod/pdf-toggle.tsx` |
| Dashboards | `apps/web/app/student/page.tsx` (stepper, pending, eligibility warning, PDF panel), `apps/web/app/guide/page.tsx` (assigned groups + pending), `apps/web/app/hod/page.tsx` (all groups + queue + toggles) |

**Demo flow:** any dashboard shows its new panels — student `/student` has the stepper and the
"Not eligible" warning when competitions are missing; guide `/guide` lists what awaits them per
group; HOD `/hod` shows percents, the approval queue and per-group Allow/Revoke PDF.

### F16 — PDF export with HOD permission gate

Puppeteer (`puppeteer-core` + system Chrome, no download) prints the **same Sheet
components** through `/print/[groupId]` — cover, rules, members with photos, undertaking,
schedule, topics, all 11 activity charts, RTM, cost, all 7 reviews, mock, final, both examiner
feedbacks, both checklists, competitions, papers, sponsored sections (if sponsored), notes —
with the college header repeated on every sheet. There is no separate PDF template.

| Piece | Location |
|---|---|
| Print route (all sheets, `print` mode, read-only) | `apps/web/app/print/[groupId]/page.tsx` |
| Gate + renderer + persistence | `apps/web/lib/services/pdf.ts` (`checkPdfGate`, `renderGroupPdf`, `generateGroupPdf`) |
| Download route (re-checks gate, 403 + missing list otherwise) | `apps/web/app/api/groups/[groupId]/pdf/route.ts` |
| Student status + download page | `apps/web/app/student/pdf/page.tsx` |

Gate (master rule 5, re-checked at generation time): the student, the assigned guide or the
HOD may generate **only if** `pdfPermission` is true **and** every section is complete —
otherwise 403 naming the missing sections. Success saves the file under `var/uploads/pdf/`,
records a `PdfExport` row, audits `PDF_GENERATE` and locks the group at `PDF_GENERATED`.

Setup: install grabs no browser (`puppeteer-core` only). On this machine Chrome is found
automatically; elsewhere set `CHROME_PATH` (see `.env.example`). Puppeteer loads the print
route with the downloader's own session cookies, so the same role checks apply.

**Demo flow:** bring any group to 100% (dashboards show the missing list), HOD → *Allow PDF*,
then `/student/pdf` → *Generate & download PDF* (verified end-to-end: 936 KB A4 file, export
row, locked status). An incomplete group gets 403 with its missing sections instead.

### F17 — Notifications, tests, polish, deployment

**Notifications** (SPEC.md A6): every event writes an in-app `Notification` row **and**
emails (best-effort, never breaking the action): guide assignment → students + guide; activity
confirm → guide; verify → students; topic scored → HODs; topic decided → students; review
submitted → HODs; marks approved/unlocked → students + guide; group ready-for-PDF → HODs once
(deterministic message dedup); PDF permission granted/revoked → students. Email providers:
`console` (dev prints), `noop` (tests), `resend` (REST, no dep), `smtp` (Nodemailer). The bell
in the header (all roles) polls every 30 s with an unread badge, a latest-20 dropdown and
mark-all-read.

| Piece | Location |
|---|---|
| Service (fan-out, triggers, inbox) | `apps/web/lib/services/notifications.ts` |
| Inbox actions + bell | `apps/web/lib/actions/notifications.ts`, `apps/web/components/app/notifications-bell.tsx` (wired into `AppHeader`) |
| Email providers | `apps/web/lib/email.ts` (+ `nodemailer`) |

**Tests:** 135 tests across 20 files (`npm test`), covering every permission rule in the
master prompt (student/other-guide/HOD mark writes refused, approval locks, HOD-only unlocks
with reasons, Topic-2 lock, 5th member, one-group rule, PDF gate) plus the full workflow of
each feature.

### HOD media gallery

A read-only, HOD-only gallery of the uploaded evidence: `/hod/gallery` links to
`/hod/gallery/certificates` (competition certificates) and `/hod/gallery/papers`
(paper files). Each page has a group filter, search, image thumbnails or PDF tiles,
and a lightbox that previews images and PDFs. It also counts records that still have
no upload. Reach it from the **Gallery** item in the HOD navigation or directly at
`/hod/gallery`.

| Piece | Location |
|---|---|
| Service (file-only listing, counts, metadata) | `apps/web/lib/services/gallery.ts` |
| Gallery screen (filters, grid, lightbox) | `apps/web/components/gallery/gallery-view.tsx` |
| Pages | `apps/web/app/hod/gallery/` (`page.tsx`, `certificates`, `papers`) |

### Recent activity (auto-refreshing)

Every dashboard (`/student`, `/guide`, `/hod`) shows a **Recent activity** panel sourced from the
`AuditLog`. The server renders the first page and the browser then **polls every 10 seconds** (and on
window focus) so it stays current without a reload; the **Live / Paused** pill toggles the polling.
The feed is **role-scoped on the server** (`apps/web/lib/services/activity.ts`): a student sees events about
their own group, a guide sees the groups assigned to them, and the HOD sees everything — plus each
actor's own actions and schedule changes, which concern everyone.

| Piece | Location |
|---|---|
| Service (`listRecentActivity`, role scoping) | `apps/web/lib/services/activity.ts` |
| Server action | `apps/web/lib/actions/activity.ts` |
| Auto-refreshing panel | `apps/web/components/app/recent-activity.tsx` |

### Static assets

| Path | Purpose |
|---|---|
| `apps/web/public/logos/college-crest.webp` | Left logo on every sheet (copied from `logo/SMM-11.webp`) |
| `apps/web/public/logos/founder-portrait.webp` | Right portrait logo on every sheet (copied from `logo/ap1-1.webp`) |
| `apps/web/public/cover/college-building.webp` | Cover-page college building photo (copied from `logo/college-building.webp`) |

The old SVG logo and cover placeholders remain in `apps/web/public/logos/` and `apps/web/public/cover/` but are no longer referenced.

## Switching development to PostgreSQL

1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at your database.
3. `npm run db:migrate`. Column names do not change (see `AGENTS.md` for the SQLite-to-Postgres
   type mapping notes).

## Deployment

```bash
npm install
npm run db:deploy             # clear a stale migration lock + prisma migrate deploy
npm run db:seed               # HOD, guides, students, schedule, templates, questions
npm run build                 # production build (verified: compiles clean, all routes)
npm start                     # serve on http://localhost:3000
```

Notes:

- Run **exactly one** server process. A second `npm run dev` is blocked by the `predev`
  port guard (`scripts/check-dev-port.js`) because two servers sharing `.next/` corrupt
  each other's build (static-asset 404s, dead buttons).
- PDF generation needs a Chrome/Chromium executable: autodetected on Windows, otherwise set
  `CHROME_PATH`. Uploads live under `var/uploads/` (served via `/media/[...path]`) — back
  this directory up alongside the database file.
- Email: `EMAIL_PROVIDER=console` logs mail (dev); use `resend` (+ `RESEND_API_KEY`) or
  `smtp` (+ `SMTP_*`) in production with a real `EMAIL_FROM`.
- Google Fonts fall back to local serif/sans stacks when the network is unavailable;
  the paper look is preserved by the CSS fallbacks.
- Uploads: Server Actions accept up to 12 MB (`apps/web/next.config.mjs`), matching the 2 MB
  photo and 10 MB document limits enforced in `apps/web/lib/upload.ts`.
- Quality gates before every release: `npm run typecheck`, `npm run lint`, `npm test`
  (requires `.env.test.local`), `npm run build`.

## Deploying frontend to Vercel and API to Render

The Vercel project should deploy `apps/web`; the Render service should deploy the API workspace from the repository root. Keep the Render service root at the repository root because the API uses the root npm workspace and shared Prisma schema. `render.yaml` defines the API service only.

### Vercel frontend

1. Import this GitHub repository as a Vercel project and set **Root Directory** to `apps/web`. Enable **Include source files outside of the Root Directory in the Build Step** because the Prisma schema and npm workspace lockfile live at the repository root. Vercel documents this option in its [monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq).
2. Use the Next.js framework defaults and deploy the `main` branch. The web workspace's `postinstall` generates Prisma Client from the shared schema.
3. Set these environment variables in Vercel: `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `API_BASE_URL`, `API_INTERNAL_SECRET`, `UPLOAD_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`, and the selected `EMAIL_*` variables. `API_INTERNAL_SECRET` must exactly match Render.
4. Local disk is ephemeral on Vercel, so keep uploads on Supabase Storage. PDF generation still uses `puppeteer-core` and expects a Chrome/Chromium executable; the Vercel deployment needs a compatible Chromium setup or PDF generation must move to the Render API before that feature is production-ready.

### Render API

1. Connect the same GitHub repository and deploy the `be-logbook-api` service from `render.yaml` on branch `main`. Leave **Root Directory** blank (repository root). The build runs `npm ci`, generates Prisma Client and builds `apps/api`; the service starts with `npm run api:start`. Render keeps files outside a configured root directory unavailable, so setting it to `apps/api` would hide the shared schema and workspace files; see [Render monorepo support](https://render.com/docs/monorepo-support).
2. Set `DATABASE_URL` and `DIRECT_URL` for the same database used by Vercel, `API_INTERNAL_SECRET` to the same generated value as Vercel, and `API_ALLOWED_ORIGINS` to the Vercel origin if browser requests are added later. The current frontend calls the API server-to-server.
3. Set Vercel `API_BASE_URL` to the Render API URL, such as `https://be-logbook-api.onrender.com`.
4. Seed the database once from the repository root with `npm run db:seed` after deploying.

The API currently owns the Schedule read/update flow. Other pages and modules still access Prisma from the Next.js app, so this is a split deployment with a partially extracted API, not yet a fully backend-owned data layer. The PDF Chromium requirement also needs work before all app features are ready on Vercel.

If this Render Blueprint previously managed the frontend service, removing that service from `render.yaml` does not delete it. Render leaves removed Blueprint resources in place; stop or delete the old frontend service in the Render dashboard after the Vercel deployment is verified.

## Email (Resend)

Set on Render: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` (secret), `EMAIL_FROM`.

- **Testing:** with the default sender `Digital BE Log Book <onboarding@resend.dev>`,
  Resend only delivers to the email address of the Resend account owner. Use your
  own address to sign up and confirm the verification mail arrives.
- **Real users:** verify a domain in Resend (Domains → Add Domain, add the DNS
  records it shows), then set `EMAIL_FROM` to an address on that domain, e.g.
  `Digital BE Log Book <no-reply@yourdomain.com>`. Until the domain is verified,
  signups for other addresses fail safely: no account is left behind and the
  student sees "We couldn't send the verification email…" and can retry.
- **Alternatives:** `EMAIL_PROVIDER=smtp` (e.g. Gmail with an App Password via the
  `SMTP_*` vars) or `EMAIL_PROVIDER=console` for demos only (prints mail to the
  server log, delivers nothing).
- **When mail does not arrive:** check the Resend dashboard “Emails” log first
  (rejections name the reason, e.g. unverified domain), then the spam folder, then
  the Render service logs (send failures are logged server-side without secrets).
- **Demos:** set `REQUIRE_EMAIL_VERIFICATION=false` on Render and redeploy to let
  new accounts log in instantly with no mailbox. Flip it back to `"true"` (or delete
  the variable) afterwards to restore verification — no code changes needed.
