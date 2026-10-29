/** External examiner questions used by the completion checks. */
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

export const EXAMINER_RATINGS = ["Excellent", "Good", "Satisfactory"] as const;
export type ExaminerRating = (typeof EXAMINER_RATINGS)[number];

export const ALL_REVIEW_TYPES = [
  "REVIEW_I",
  "REVIEW_II",
  "FINAL_DESIGN",
  "REVIEW_I_MODELING",
  "REVIEW_II_CODING",
  "FINAL_VALIDATION",
  "REPORT_WRITING",
] as const;
export type AnyReviewType = (typeof ALL_REVIEW_TYPES)[number];

export const MOCK_T1_COMPONENTS = [
  { key: "problem", label: "Problem Statement / Motivation / Objectives / Scope / Feasibility / Requirement", max: 5 },
  { key: "literature", label: "Literature Survey", max: 5 },
  { key: "analysis", label: "Requirement Analysis", max: 5 },
  { key: "modeling", label: "Modeling and Designing", max: 10 },
  { key: "planning", label: "Planning and Prototyping", max: 5 },
  { key: "presentation", label: "Presentation and Question-Answer", max: 10 },
  { key: "report", label: "Partial Project Report", max: 10 },
] as const;
export const MOCK_T1_TOTAL = 50;

export const FINAL_T2_COMPONENTS = [
  { key: "modeling", label: "Modeling", max: 10 },
  { key: "coding", label: "Coding and Implementation", max: 40 },
  { key: "testing", label: "Testing", max: 10 },
  { key: "understanding", label: "Understanding, Individual Involvement / Contribution in the project", max: 10 },
  { key: "teamwork", label: "Team Work", max: 10 },
  { key: "demo", label: "Demonstration cum Presentation", max: 10 },
  { key: "documents", label: "Documents and Report", max: 10 },
] as const;
export const FINAL_T2_TOTAL = 100;

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

export const COMPETITION_TYPES = ["POSTER", "DEMO", "PAPER_PRESENTATION"] as const;
export type CompetitionType = (typeof COMPETITION_TYPES)[number];

export const RECORD_CONTENT_TYPES = ["RTM", "COST"] as const;
export type RecordContentType = (typeof RECORD_CONTENT_TYPES)[number];

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

export const SPONSORED_SEMESTERS = ["SEMESTER_1", "SEMESTER_2"] as const;
export type SponsoredSemester = (typeof SPONSORED_SEMESTERS)[number];
