import type { ScheduleTerm } from "../../lib/constants";

/**
 * The two B.E. Project Schedule tables (SPEC.md B5). Seeded once and then kept
 * up to date by the HOD, who edits the date cells. `sortOrder` is the row number
 * printed in the Sr. No column.
 */
export type ScheduleSeedRow = {
  term: ScheduleTerm;
  sortOrder: number;
  description: string;
};

export const SCHEDULE_SEED: readonly ScheduleSeedRow[] = [
  // Semester I
  { term: "SEMESTER_I", sortOrder: 1, description: "Group Submission" },
  { term: "SEMESTER_I", sortOrder: 2, description: "Guide Allocation List" },
  { term: "SEMESTER_I", sortOrder: 3, description: "Topic Finalization Review" },
  { term: "SEMESTER_I", sortOrder: 4, description: "Synopsis / Abstract submission" },
  { term: "SEMESTER_I", sortOrder: 5, description: "Review-1" },
  { term: "SEMESTER_I", sortOrder: 6, description: "Review-2" },
  { term: "SEMESTER_I", sortOrder: 7, description: "Review-3" },
  { term: "SEMESTER_I", sortOrder: 8, description: "Final Term 1 Exam (as per university schedule)" },
  // Semester II
  { term: "SEMESTER_II", sortOrder: 1, description: "Review-1" },
  { term: "SEMESTER_II", sortOrder: 2, description: "Review-2" },
  { term: "SEMESTER_II", sortOrder: 3, description: "Review-3" },
  { term: "SEMESTER_II", sortOrder: 4, description: "BE Project Poster Competition / Paper Presentation" },
  { term: "SEMESTER_II", sortOrder: 5, description: "Verification of project report by Project Guide" },
  { term: "SEMESTER_II", sortOrder: 6, description: "Final Submission of Project report and Final Review" },
  { term: "SEMESTER_II", sortOrder: 7, description: "Final Project Term-II Examination" },
];
