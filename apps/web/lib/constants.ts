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

/** The two schedule tables (SPEC.md B5). The HOD edits the date cells. */
export const SCHEDULE_TERMS = [
  { term: "SEMESTER_I", label: "Semester I" },
  { term: "SEMESTER_II", label: "Semester II" },
] as const;
export type ScheduleTerm = (typeof SCHEDULE_TERMS)[number]["term"];

/** Printed in bold italic beneath every schedule table (SPEC.md B5 / E5.6). */
export const SCHEDULE_NOTICE =
  "Any changes in schedule will be informed from time to time by notice.";

/**
 * Topic Finalization (SPEC.md B6). The assigned guide scores each criterion out
 * of 10 and records a Yes/No recommendation; the HOD gives the final decision.
 */
export const TOPIC_CRITERIA = [
  { key: "significance", label: "Significance / Applicability" },
  { key: "innovativeness", label: "Innovativeness" },
  { key: "scope", label: "Scope" },
  { key: "feasibility", label: "Feasibility" },
] as const;

export type TopicCriterionKey = (typeof TOPIC_CRITERIA)[number]["key"];

export const TOPIC_MAX_SCORE = 10;

export const TOPIC_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted for review",
  SCORED: "Scored by the guide",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Shown on the Topic 2 sheet while Topic 1 has not been rejected (master rule 6). */
export const TOPIC2_LOCKED_NOTICE = "Topic 2 is enabled only if Topic 1 is rejected.";

/** Shown on the Topic 2 sheet once Topic 1 has been approved. */
export const TOPIC2_NOT_REQUIRED_NOTICE =
  "Topic 1 has been approved, so Topic 2 is not required.";

/** Workflow states of one activity row (SPEC.md A4). */
export const ENTRY_STATUS_LABELS: Record<string, string> = {
  PLANNED: "Planned",
  STUDENT_CONFIRMED: "Confirmed by the student",
  GUIDE_VERIFIED: "Verified by the guide",
};

/**
 * Term-I Mock Evaluation components (SPEC.md B9, total 50). Server-validated
 * maxima; totals are always computed on the server, never trusted from the UI.
 */
export const MOCK_T1_COMPONENTS = [
  { key: "problem", label: "Problem Statement / Motivation / Objectives / Scope / Feasibility / Requirement", max: 5 },
  { key: "literature", label: "Literature Survey", max: 5 },
  { key: "analysis", label: "Requirement Analysis", max: 5 },
  { key: "modeling", label: "Modeling and Designing", max: 10 },
  { key: "planning", label: "Planning and Prototyping", max: 5 },
  { key: "presentation", label: "Presentation and Question-Answer", max: 10 },
  { key: "report", label: "Partial Project Report", max: 10 },
] as const;

export type MockComponentKey = (typeof MOCK_T1_COMPONENTS)[number]["key"];

export const MOCK_T1_TOTAL = 50;

/**
 * Term-II Final Evaluation components (SPEC.md B9, total 100). Same rules as
 * the mock table: server-validated maxima, server-computed totals.
 */
export const FINAL_T2_COMPONENTS = [
  { key: "modeling", label: "Modeling", max: 10 },
  { key: "coding", label: "Coding and Implementation", max: 40 },
  { key: "testing", label: "Testing", max: 10 },
  { key: "understanding", label: "Understanding, Individual Involvement / Contribution in the project", max: 10 },
  { key: "teamwork", label: "Team Work", max: 10 },
  { key: "demo", label: "Demonstration cum Presentation", max: 10 },
  { key: "documents", label: "Documents and Report", max: 10 },
] as const;

export type FinalComponentKey = (typeof FINAL_T2_COMPONENTS)[number]["key"];

export const FINAL_T2_TOTAL = 100;

/** External examiner feedback ratings (SPEC.md B10). */
export const EXAMINER_RATINGS = ["Excellent", "Good", "Satisfactory"] as const;

export type ExaminerRating = (typeof EXAMINER_RATINGS)[number];

/** The 9 examiner questions, identical for Term-I and Term-II (SPEC.md B10). */
export const EXAMINER_QUESTIONS: readonly string[] = [
  "Apply knowledge of mathematics and engineering to identify, formulate and solve complex problems through project work",
  "Ability to design a system, analyze and interpret data to meet desired needs within realistic constraints",
  "Ability to innovatively think, visualize and function on multidisciplinary areas",
  "Understanding of professional and ethical responsibility",
  "Ability to communicate effectively in verbal and written form",
  "Understanding the impact of engineering solutions in a global, economic, environmental and societal context",
  "Understanding of project management and team work",
  "Ability to use modern engineering tools along with knowledge of contemporary issues",
  "Ability to recognize the need of engaging in life-long learning",
];

/** Submission checklist items, Term-I (5) and Term-II (8) (SPEC.md B11). */
export const CHECKLIST_ITEMS: Record<"TERM_I" | "TERM_II", readonly string[]> = {
  TERM_I: [
    "Each group submits hard copy and soft copy of synopsis.",
    "All groups complete the partial project report as per prescribed format.",
    "Prepare soft copy of partial report, get it checked by the internal guide, then print hardcopy.",
    "Hard copy of partial report in spiral bound form: 1 copy for department plus each group member copy.",
    "Submit the Project Work file containing Term-I Project Laboratory assignments to the guide.",
  ],
  TERM_II: [
    "Complete the project in all respect (hardware and software) in the stipulated time.",
    "Prepare soft copy of project report, get it checked by internal guide, then print hardcopy.",
    "Hard copy in hardbound form: 2 copies for the department plus each member copy.",
    "Prepare the project CD containing: complete demo, final project report, readme for execution, PPT of final presentation, software code, paper presented/published, scan copy of certificates, scan copy of sponsorship and completion letter (if applicable), two-page synopsis in given format for the project manual.",
    "Submit the Project Work file containing Term-II Project Laboratory assignments.",
    "Submit hardcopy of report, CD and Project Work file as final submission.",
    "Submit Xerox copies of certificates and hard copy of the paper presented.",
    "Submit the 2-page synopsis checked by the Project Coordinator for the department project manual.",
  ],
};

/** Competition participation types (SPEC.md B12). */
export const COMPETITION_TYPES = ["POSTER", "DEMO", "PAPER_PRESENTATION"] as const;

export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  POSTER: "Poster",
  DEMO: "Demo",
  PAPER_PRESENTATION: "Paper Presentation",
};

/** Free content page types covered by F12 (SPEC.md B7 pages). */
export const RECORD_CONTENT_TYPES = ["RTM", "COST"] as const;

export type RecordContentType = (typeof RECORD_CONTENT_TYPES)[number];

/** Sponsor feedback parameters (SPEC.md B13): rate High / Medium / Low. */
export const SPONSOR_PARAMETERS = [
  { key: "p1", label: "Ability to apply subject knowledge" },
  { key: "p2", label: "Ability to formulate, design and analyze the problem" },
  { key: "p3", label: "Ability to learn advanced technology (hardware/software tools)" },
  { key: "p4", label: "Communication skills" },
  { key: "p5", label: "Ability to work in a team" },
  { key: "p6", label: "Professional / ethical attitude" },
  { key: "p7", label: "Multidisciplinary aspect" },
] as const;

export type SponsorParameterKey = (typeof SPONSOR_PARAMETERS)[number]["key"];

export const SPONSOR_RATINGS = ["HIGH", "MEDIUM", "LOW"] as const;

export type SponsorRating = (typeof SPONSOR_RATINGS)[number];

export const SPONSOR_RATING_LABELS: Record<SponsorRating, string> = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

/** Sponsored meeting-log semesters (SPEC.md B13). */
export const SPONSORED_SEMESTERS = ["SEMESTER_1", "SEMESTER_2"] as const;

export type SponsoredSemester = (typeof SPONSORED_SEMESTERS)[number];
