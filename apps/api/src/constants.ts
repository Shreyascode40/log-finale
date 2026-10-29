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
