# Digital BE Project Log Book — Agent Instructions

Source: APCOE&R Project Diary, Record No. ACA/D/003B, Revision 00, DoI 01/02/2025.
The full specification (Parts A–F) lives in `SPEC.md`. This file carries the two prompt
blocks the agent must always follow, plus the rules between features.

## Environment decision (confirmed)

- Development database is **SQLite** via Prisma (no PostgreSQL/Docker on this machine).
- Write the schema so it stays portable to PostgreSQL: avoid Postgres-only types, keep
  `Json`-like data in `String` columns holding JSON text (helpers in `lib/`), and keep the
  `datasource` swappable. Record every deviation from the spec's data model in this file.

### Schema deviations from SPEC.md B16 (F1)

SQLite (Prisma) does not support `enum` or `Json` column types, so:

1. **Enums -> `String` columns.** `User.role`, `User.createdVia`, `Group.status`,
   `GroupInvite.status`, `TopicProposal.status`, `ActivityEntry.status`,
   `ReviewForm.status`, `MarksSheet.status`, `ContentPage.type`, `ReviewTemplate.term`
   / `.reviewType`, `ExaminerFeedback.term`, `Checklist.term`, `Competition.type`,
   `SponsoredMeeting.semester`, `GroupMember.memberType` all store the enum name as
   text. Allowed values are declared in `lib/constants.ts` and validated wherever they
   are written.
2. **`Json` -> `String` (JSON text).** `MarksSheet.components`, `ExaminerFeedback.answers`,
   `Checklist.items`, `SponsorFeedback.ratings`, `ActivityEntryHistory.snapshot`,
   `AuditLog.before` / `.after` hold JSON strings. Always read/write them through
   `lib/json.ts` (`toJson` / `fromJson`) so a move to PostgreSQL `Json` columns is a
   one-place change.
3. Extra columns added beyond B16 that the features need: `Group.code`, `Group.creatorId`,
   `Group.rejectReason`, `MarksSheet.memberId` + `groupMemberId` link,
   `ExaminerFeedback.projectTitle` / `.date` / `.internalName`, `ReviewForm.submittedById`,
   `GroupMember.memberType`, `ActivityEntry.statusText`. All are additive; nothing the
   spec lists was removed.
4. Production switch: set `provider = "postgresql"` in `prisma/schema.prisma` and update
   `DATABASE_URL`. No column names change.

---

## MASTER PROMPT (Part C)

You are a senior full-stack engineer. Build "Digital BE Project Log Book", a web app
that digitizes the paper "Project Diary" (Record No. ACA/D/003B, Revision 00,
DoI 01/02/2025) of Anantrao Pawar College of Engineering & Research
(Akhil Bharatiya Maratha Shikshan Parishad), Computer Engineering department.

TECH STACK
Next.js 14 (App Router) + TypeScript strict, Tailwind CSS, shadcn/ui only,
React Hook Form + Zod, Prisma + SQLite for development (PostgreSQL in production),
NextAuth (credentials, bcrypt), file uploads (local storage in dev, Cloudinary in
production), Puppeteer for PDF, Resend/Nodemailer for email, Vitest for tests.
Responsive on mobile.

ROLES: STUDENT, GUIDE, HOD. The GUIDE is also the reviewer: one faculty member
per group both verifies activity entries and gives marks. There is no separate
REVIEWER role. Enforce role checks on the server in every
action and route, using shared helpers in lib/permissions.ts. Never rely on UI hiding.

NON-NEGOTIABLE RULES
1. A group has at most 4 students and exactly ONE guide (assigned by the HOD),
   who also acts as the reviewer. The group is overseen by the HOD.
2. ONLY the guide assigned to that group can enter or edit marks, grades,
   remarks and topic scores. Students, guides of other groups and the HOD
   cannot write marks.
3. Marks workflow for every ReviewForm and MarksSheet:
   DRAFT -> SUBMITTED (assigned guide) -> APPROVED (assigned guide or HOD).
   Submitting applies the guide's per-question sign automatically.
   APPROVED is locked. Only HOD can unlock, with a mandatory written reason,
   which returns it to DRAFT. Every transition writes an AuditLog row.
4. HOD creates guides and assigns one guide per group, approves or rejects topics,
   approves group marks, and toggles pdfPermission per group.
5. Final PDF generation is allowed only if pdfPermission is true AND all
   mandatory sections are complete. Re-check both on the server at generation
   time and return 403 with the list of missing items otherwise.
6. Topic 2 is enabled only if Topic 1 is REJECTED. If Topic 1 is APPROVED,
   Topic 2 stays locked.
7. Activity entries: student confirms (Complete or Incomplete) then guide
   verifies. Editing a guide-verified entry resets it and requires a new guide
   countersign. Keep history.
8. Group is flagged "Not eligible for final exam" when it has zero competition entries.
9. E-signature means: authenticated user clicks Confirm; store user id, display
   name and timestamp. Render as "Signed by <name> on <date time>".
10. Every create, update, approve, unlock, assignment and PDF generation writes
    an AuditLog (user, action, entity, entityId, before, after, timestamp).
11. SELF SIGN-UP is for students only. The /signup endpoint always creates
    role STUDENT; ignore any role field sent by the client. GUIDE and HOD
    accounts are created only by the HOD (or seeded). Require email
    verification before login, optionally restrict signup to the college email
    domain (configurable env var ALLOWED_EMAIL_DOMAIN), hash passwords with
    bcrypt, rate-limit signup, login and reset endpoints, and use single-use
    expiring tokens for verification and password reset. Roll number and email
    must be unique.
12. A student belongs to at most one group. The group creator invites up to 3
    others by email, roll number or group code. A new group is SUBMITTED to the
    HOD for approval; the guide is assigned only by the HOD, and
    activity charts, topics and reviews unlock only when the group is ACTIVE.

MODULES AND DATA
Implement all of the following in logbook order, with the exact fields below
(see SPEC.md Part B for full detail, seed lists and wording).

1. Cover: department, academic year, group no, project title, area, guide.
2. Rules and Regulations: static 13 rules; each member acknowledges once.
3. Group Information: up to 4 members: name, TE result, roll no, mobile, exam
   seat no, email, contribution, photo (JPG/PNG, max 2MB). Server enforces max 4;
   roll no and exam seat no unique.
4. Undertaking: logbook wording; each member accepts digitally.
5. Schedule: Semester I and Semester II rows as in SPEC.md B5. HOD edits dates;
   others read-only.
6. Topic Finalization: Topic 1 and Topic 2. Student enters title and
   description. The guide enters Significance, Innovativeness, Scope, Feasibility
   (0-10 each) and Yes/No recommendation. HOD gives final approve or reject.
7. Activity Charts: tabs June … March, May-June (no April). Pre-seed planned
   activities (SPEC.md B7). Columns: date, activity, Complete/Incomplete,
   student sign, guide sign. Also RTM and Project Cost Estimation pages.
8. Reviews (each row: question, remark, grade, guide sign; plus Remark and
   Suggestions and the guide's name and sign): Term-I Review I (10 q),
   Term-I Review II (12 q), Term-I Final/Design (17 q), Term-II Review I (13 q),
   Term-II Review II (10 q, with date), Term-II Final Validation (9 q, with date),
   Term-II Report Writing (9 q, with date). Seed questions as data (SPEC.md B8).
9. Mock Evaluation Term-I (total 50) per member: Problem Statement/Motivation/
   Objectives/Scope/Feasibility/Requirement 5, Literature Survey 5,
   Requirement Analysis 5, Modeling and Designing 10, Planning and Prototyping 5,
   Presentation and Q&A 10, Partial Project Report 10. Two committee signs.
10. Final Evaluation Term-II (total 100) per member: Modeling 10, Coding and
    Implementation 40, Testing 10, Understanding/Individual Involvement 10,
    Team Work 10, Demonstration cum Presentation 10, Documents and Report 10.
    For 9 and 10: validate each cell against its max, compute totals on the
    server, one row per member.
11. External Examiner Feedback Term-I and Term-II: 9 questions rated Excellent/
    Good/Satisfactory, remarks, external and internal sign.
12. Submission Checklists Term-I (5 items) and Term-II (8 items incl. CD contents).
13. Competition participation: name, date, college and level, type (Poster/Demo/
    Paper Presentation), award/participation, certificate upload.
14. Paper publication: title, conference, ISSN, volume/issue, page no, paper upload.
15. Sponsored project (only if group.isSponsored): meeting log Semester 1 and 2
    and sponsor feedback (7 parameters High/Medium/Low, company, seal upload).
16. Notes: free text entries.

UI STYLE
Every logbook screen is an A4 paper sheet that looks like the printed page.
Follow the PAPER-PAGE UI REQUIREMENT block below in full.

DASHBOARDS
- Student: stepper of all sections with completion percent, pending items,
  exam-eligibility warning, PDF status panel.
- Guide: only assigned groups, pending activity verifications, pending topic
  scoring, reviews and mark sheets.
- HOD: all groups with guide, completion percent, status; approval
  queue (topics, marks); unlock marks; assignments; PDF permission toggles;
  audit log with filters; user management; schedule editor.

COMPLETION ENGINE
Each module exposes getXStatus(groupId): Promise<SectionStatus[]> where
SectionStatus = { key, label, complete, percent }. A registry aggregates them.
Complete means: cover and members filled (1+ member, all fields and photo),
all members acknowledged rules and accepted undertaking, one topic APPROVED,
all activity rows complete and guide-verified, RTM and cost content present,
all reviews APPROVED, both mark sheets APPROVED for every member, both examiner
feedbacks saved, both checklists fully ticked, 1+ competition, 1+ paper, and
sponsored sections if sponsored.

PDF GENERATION
Server route using Puppeteer. A4. Every page carries the college header table:
left logo, centre "Akhil Bharatiya Maratha Shikshan Parishad's / Anantrao Pawar
College of Engineering & Research", Record No. ACA/D/003B, Revision 00,
DoI 01/02/2025, right logo, then a grey bar "Project Diary". Order: cover, rules,
group information with photos, undertaking, schedule, topics, activity charts
(all months), RTM, cost estimation, all reviews, mock evaluation, final
evaluation, examiner feedback, checklists, competitions, papers, sponsored
sections, notes. Signatures render as "Signed by <name> on <timestamp>".
Gate with canGeneratePdf. Save the file and record a PdfExport row.

NOTIFICATIONS
In-app plus email for: assignment, entry confirmed, entry verified, topic scored,
topic approved or rejected, review submitted, marks approved or unlocked, group
ready for PDF, PDF permission granted or revoked.

CODE QUALITY
- Server actions in lib/actions/<module>-*.ts returning { success, data?, error? }
- One Zod schema per form in lib/validation/<module>.ts
- Prisma transactions for multi-row writes
- Tests (Vitest) proving: a student cannot write marks; a guide of another
  group cannot write marks; approved marks cannot be edited; only HOD can unlock
  with a reason; Topic 2 is blocked unless Topic 1 is rejected; a 5th member is
  rejected; PDF is refused without permission or with incomplete sections.
- Seed script: 1 HOD, 3 guides, 8 students, 2 groups, schedule,
  activity templates, all review templates and questions, examiner questions.
- Provide .env.example and a README with setup steps.

BUILD ORDER (do one step at a time and wait for confirmation)
1. Prisma schema, seed skeleton, auth (login, student sign-up, email
   verification, password reset), roles, permissions, audit helper
2. HOD admin: users, assignments, schedule, dashboard
3. Group setup: cover, members, rules, undertaking, topics
4. Activity charts with two-step signature
5. Reviews, mark sheets, marks workflow, examiner feedback
6. Competitions, papers, checklists, sponsored project, RTM, cost, notes
7. Completion engine and dashboards
8. Notifications
9. PDF generation and gate
10. Tests, polish, deployment notes

---

## PAPER-PAGE UI REQUIREMENT (applies to every logbook screen)

Every logbook section must look exactly like the printed logbook page. Build each
page as a "Sheet" React component rendered inside a shared <PaperPage> wrapper:
- A4 sheet (794 x 1123 px), white, centered on a grey background with a soft shadow.
- Repeat on EVERY sheet the college header table: left college logo, centre
  "Akhil Bharatiya Maratha Shikshan Parishad's / Anantrao Pawar College of
  Engineering & Research", second row "Record No.: ACA/D/003B / Revision: 00" and
  "DoI: 01/02/2025", right portrait logo, then a full-width light grey bar with
  bold centred "Project Diary". Thin 1px black borders.
- Fonts: Times New Roman style serif (Liberation Serif fallback) for body, labels
  and tables; Arial style bold sans-serif centred titles. Black ink on white.
  Colours only on the cover page and grey bars.
- Tables: thin black borders, same columns and widths as the logbook, no zebra,
  no rounded corners. Blank "_____" lines become underline inputs that look like
  printed text when read-only or locked.
- Do NOT use cards, shadcn components, or app chrome inside a sheet. shadcn/ui is
  only for login, dashboards, side panel, dialogs and toasts.
- Signature cells show a "Sign" button, then "Signed by <name> on <timestamp>".
- Marks cells are plain table cells, editable only by the assigned guide.
- Left panel with page thumbnails and completion dots, top bar with page number,
  prev/next, zoom, jump-to-section and PDF button. On mobile scale the sheet to
  fit the screen width with pinch zoom (never reflow).
- Sheets longer than one page continue on a numbered continuation sheet with the
  header repeated.
- The PDF export route /print/[groupId] renders the SAME Sheet components in
  logbook order with print=1 and Puppeteer (A4, printBackground, preferCSSPageSize).
  There must be no separate PDF template.
- Add Playwright visual tests comparing on-screen and print rendering of each Sheet.

BUILD ORDER FOR THE UI
1. PaperPage wrapper, header component, fonts, underline Field, SignCell, MarksCell,
   Table primitives, and the viewer shell (thumbnails, top bar, zoom).
2. Sheets in logbook order: cover, rules, members, undertaking, schedule, topics,
   activity charts, RTM and cost sheets, reviews, evaluation tables, examiner
   feedback, checklists, competitions and papers, sponsored sheets, notes.
3. /print/[groupId] route and the PDF export that reuses the same Sheets.
4. Visual regression tests.

---

## RULES BETWEEN FEATURES (Part F3)

- Do only the feature requested. Do not "improve" earlier features unless a test fails.
- Reuse the paper components (F1). Do not create new styles inside sheets.
- Run lint, type-check and tests before saying a feature is done.
- End every feature with a list of files created or changed.
- If a feature needs a schema change, say exactly what and why, then wait for approval.
- Feature order and prompts: SPEC.md Part F.
