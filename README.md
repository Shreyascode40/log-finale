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
| Database | Prisma + SQLite in development (PostgreSQL in production) |
| Auth | NextAuth (credentials) + bcrypt |
| Uploads | local disk in dev, Cloudinary in production |
| PDF | Puppeteer (A4), rendering the same Sheet components |
| Tests | Vitest (unit) and Playwright (E2E / visual, added later) |

## Setup

```bash
npm install
cp .env.example .env          # then edit the values (Windows: copy .env.example .env)
npm run db:migrate            # create/apply migrations (SQLite dev.db)
npm run db:seed               # seed data (added feature by feature)
npm run dev                   # http://localhost:3000
```

### Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | `tsx prisma/seed.ts` |

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
| A4 sheet wrapper | `components/paper/paper-page.tsx` |
| Repeated college header (record no., revision, DoI, grey "Project Diary" bar) | `components/paper/college-header.tsx` |
| Blank-line field (prints as text when read-only/locked) | `components/paper/field.tsx` |
| E-signature cell ("Signed by <name> on <date time>") | `components/paper/sign-cell.tsx` |
| Marks cell (editable only by the assigned guide) | `components/paper/marks-cell.tsx` |
| Tick box | `components/paper/tick-box.tsx` |
| Table primitives | `components/paper/paper-table.tsx` |
| Viewer shell (thumbnails, toolbar, zoom, Page Up/Down) | `components/viewer/sheet-viewer.tsx` |
| Demo (screen + `?print=1`) | `app/demo/paper/page.tsx` |

The same Sheet components are rendered on screen and in the PDF route (`/print/[groupId]`, F16);
there is no separate PDF template.

## Implemented features

### F2 — Authentication

| Piece | Location |
|---|---|
| NextAuth options (credentials, JWT sessions) | `lib/auth.ts` |
| Sign-up / verify / login / reset service | `lib/services/auth.ts` |
| Route protection + role helpers | `lib/permissions.ts`, `lib/roles.ts`, `middleware.ts` |
| Rate limiting | `lib/rate-limit.ts` |

Students self-register at `/signup`; the role is forced to `STUDENT` server-side. Guides and the HOD
are created by the HOD. Unverified accounts cannot log in.

### F3 — HOD administration

| Piece | Location |
|---|---|
| Service (`createGuide`, `updateGuide`, `setUserActive`, `approveGroup`, `rejectGroup`, `assignGuide`) | `lib/services/admin.ts` |
| Server actions (all HOD-gated) | `lib/actions/admin.ts` |
| Pages | `app/hod/` (`users`, `groups`, `assignments`, `audit`) |

The HOD creates guide accounts, approves/rejects submitted groups, assigns exactly one guide per
group, and reviews the audit log. Approving a group and assigning its guide happen together, so the
group only becomes `ACTIVE` when both are done.

### F4 — Student groups (create, invite, submit)

Route: `/student/group`. A student belongs to **at most one** group, and a group has **at most 4**
members. The creator invites classmates by **email or roll number**, anyone can **join by the shared
group code**, and only the creator can **submit** the group (`DRAFT → SUBMITTED`) for HOD approval.

| Piece | Location |
|---|---|
| Service (`createGroup`, `inviteMember`, `acceptInvite`, `declineInvite`, `joinByCode`, `removeMember`, `submitGroup`) | `lib/services/group.ts` |
| Server actions (all student-gated) | `lib/actions/group.ts` |
| Zod schemas | `lib/validation/group.ts` |
| Page + client UI | `app/student/group/page.tsx`, `components/student/group-onboarding.tsx` |
| Student shell + dashboard | `app/student/layout.tsx`, `app/student/page.tsx`, `components/app/student-nav.tsx` |

Server-side invariants (never only in the UI): a student cannot join a second group, the 5th member
is rejected on every path (invite and code), and only the creator can submit. Every create, invite,
accept/decline, join, removal and submit writes an `AuditLog` row.

**Demo flow:** reset the database (`npm run db:seed` on a fresh DB) so that `G1` is `SUBMITTED`
(TE2101–TE2104) and `G2` is a `DRAFT` containing only its creator **TE2105**; TE2106–TE2108 are free.
Log in as `te2105` → `/student/group`, invite `te2106`–`te2108`, have each accept (or share the group
code), then submit. Log in as `hod@apcoer.edu.in` → `/hod/groups` to approve and assign a guide; the
creator then sees the group as `ACTIVE` with the guide's name.

### Static assets to replace with the real files

| Path | Purpose |
|---|---|
| `public/logos/college-crest.svg` | Left logo on every sheet |
| `public/logos/founder-portrait.svg` | Right portrait logo on every sheet |
| `public/cover/building.svg` | Cover-page college building photo |

## Switching development to PostgreSQL

1. Set `provider = "postgresql"` in `prisma/schema.prisma`.
2. Point `DATABASE_URL` at your database.
3. `npm run db:migrate`. Column names do not change (see `AGENTS.md` for the SQLite-to-Postgres
   type mapping notes).
