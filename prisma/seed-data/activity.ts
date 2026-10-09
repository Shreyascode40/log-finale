import type { ActivityMonth } from "../../lib/constants";

/**
 * Planned activities per month (SPEC.md B7). Seeded once into
 * `ActivityTemplate`; every group then gets one `ActivityEntry` per template
 * (materialized lazily when its month chart is first opened). `sortOrder` is
 * the Sr. No printed in the first column. An "(xN)" item from the spec becomes
 * N numbered rows.
 */
export type ActivitySeedRow = {
  month: ActivityMonth;
  sortOrder: number;
  text: string;
};

function rows(month: ActivityMonth, texts: string[]): ActivitySeedRow[] {
  return texts.map((text, index) => ({ month, sortOrder: index + 1, text }));
}

export const ACTIVITY_SEED: readonly ActivitySeedRow[] = [
  ...rows("june", [
    "Group Submission",
    "Guide Allocation",
    "Domain Finalization",
    "Guide Meeting for Topic Finalization 1",
    "Guide Meeting for Topic Finalization 2",
    "Guide Meeting for Topic Finalization 3",
  ]),
  ...rows("july", [
    "Literature Review (review papers, create surveys for real-time application, meet stakeholders)",
    "Feasibility Study of Topic, Cost estimation, generate IDEA Matrix, generate Requirement Traceability Matrix",
    "Project Topic Finalization Review",
    "Synopsis Writing and Submission, Review 1 presentation preparation",
    "Sponsorship details and work",
    "Review-1",
  ]),
  ...rows("august", [
    "Review 1 discussions on suggestions",
    "Design and understand software process model for project",
    "Draw and verify UML (Use Case, Class, Activity, Component diagrams)",
    "Draw and verify Sequence, State, ER diagram and Review 2 presentation preparation",
    "Review-2",
  ]),
  ...rows("september", [
    "Generating Mathematical Model",
    "Test Cases writing",
    "Testing of UML Reliability",
    "Writing paper on design phase (review paper)",
    "Cost Estimation using Estimate or Simplest mate",
    "Report Semester 1 writing in LaTeX/Word",
    "Review-3 (Final Review)",
  ]),
  ...rows("october", [
    "Refinement of Review 3 presentation based on suggestions",
    "Refinement of Semester 1 report based on suggestions",
  ]),
  ...rows("november", [
    "Revising suggestions and completing them for final Semester 1 exam",
    "Discussion with guide regarding presentation technique for final exam",
    "Semester 1 report printing",
  ]),
  ...rows("december", [
    "Preparation of Stage 1 examination",
    "Till Stage 1 Examination",
    "Stage 1 Final Presentation",
    "Discussion with guide regarding suggestions in Stage 1 exam and external comments",
    "Installation and setup of workstations",
    "Review of design and corrective actions from Semester 1 feedback",
  ]),
  ...rows("january", [
    "Actual programming start",
    "Programming progress report (write necessary markers achieved) 1",
    "Programming progress report (write necessary markers achieved) 2",
    "Programming progress report (write necessary markers achieved) 3",
    "Review-1",
  ]),
  ...rows("february", [
    "Programming progress report (as per review discussions)",
    "Programming progress report 2",
    "Programming progress report 3",
    "Review-2",
  ]),
  ...rows("march", [
    "Test cases writing",
    "Programming progress report",
    "Softcopy of report and research paper on results",
    "Project competition and paper publication",
    "Review-3",
  ]),
  ...rows("may-june", [
    "Hardcopy printing of report",
    "CD making",
    "Final implementation check",
    "Final Project Oral Examination",
  ]),
];
