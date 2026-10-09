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
