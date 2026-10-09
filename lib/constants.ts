/**
 * Static logbook content that is identical for every group: the college header
 * on each sheet, the record numbers, and the free-text content blocks used by
 * the Rules, Undertaking and Checklist sheets.
 *
 * Seedable lists (schedule, activity templates, review questions, examiner
 * questions) live in `prisma/seed-data/` and are loaded by `prisma/seed.ts`.
 */

export const COLLEGE = {
  parishad: "Akhil Bharatiya Maratha Shikshan Parishad's",
  name: "Anantrao Pawar College of Engineering & Research",
  // Header of every sheet
  recordNo: "ACA/D/003B",
  revision: "00",
  doi: "01/02/2025",
  diaryTitle: "Project Diary",
  // Cover
  logBookTitle: "BE PROJECT LOG BOOK",
  department: "Computer",
} as const;

/** Rules and Regulations (SPEC.md B15) — static, shown with per-member acknowledgement. */
export const RULES_AND_REGULATIONS: readonly string[] = [
  "All students must enter the correct information in the log book.",
  "All entries must be verified by the concerned project guide.",
  "Students must report to their guide on project day as per the time table.",
  "Planned activity should be completed as per the schedule only.",
  "Submit soft and hard copies of Synopsis, Partial Project Report in Term-I and Final Project Report in Term-II in the prescribed format.",
  "Submit Project Laboratory Assignments in Term-I and Term-II as per syllabus.",
  "Submit and preferably publish at least one technical paper in conferences/workshops in IITs, Central Universities or UoP conferences or equivalent international conferences sponsored by IEEE/ACM in Term-I and Term-II.",
  "Participate in at least one project competition organized by any engineering college to become eligible for the final project exam.",
  "Attach all published papers and competition certificates at the end of the log book.",
  "Bring the log book at the time of meeting with guide, project reviews and examination.",
  "Changes, if any, must be countersigned by the concerned project guide.",
  "For queries, contact your project guide or project coordinator.",
  "Log book must be submitted to the Coordinator at the time of final submission.",
] as const;

/** Undertaking body (SPEC.md B4). Blanks are filled from group data at render time. */
export const UNDERTAKING_TEXT = {
  before:
    "We, the students of B.E.",
  afterBatch: "batch",
  afterYear:
    "assure that we will follow all rules and regulations of the BE project activity assigned by Savitribai Phule Pune University for academic year",
  afterTitle:
    "The project entitled",
  afterTitle2:
    "will be fully designed and developed by us. Any part of the hardware and software will not be purchased from outside parties for direct use. If found by the examiner, we are responsible for the consequences.",
} as const;

/** Roles. Stored as String columns (SQLite has no enums). */
export const ROLES = ["STUDENT", "GUIDE", "HOD"] as const;
export type Role = (typeof ROLES)[number];

/** Group states. */
export const GROUP_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "ACTIVE",
  "READY_FOR_PDF",
  "PDF_ALLOWED",
  "PDF_GENERATED",
] as const;

/** Marks / review workflow states. */
export const WORKFLOW_STATUS = ["DRAFT", "SUBMITTED", "APPROVED"] as const;

/** Topic states. */
export const TOPIC_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "SCORED",
  "APPROVED",
  "REJECTED",
] as const;

/** Activity entry states. */
export const ACTIVITY_STATUS = [
  "PLANNED",
  "STUDENT_CONFIRMED",
  "GUIDE_VERIFIED",
] as const;

/** Months of the activity logbook (no April; May-June combined). */
export const ACTIVITY_MONTHS = [
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
  "january",
  "february",
  "march",
  "may-june",
] as const;
export type ActivityMonth = (typeof ACTIVITY_MONTHS)[number];

export const ACTIVITY_MONTH_LABELS: Record<ActivityMonth, string> = {
  june: "June",
  july: "July",
  august: "August",
  september: "September",
  october: "October",
  november: "November",
  december: "December",
  january: "January",
  february: "February",
  march: "March",
  "may-june": "May-June",
};
