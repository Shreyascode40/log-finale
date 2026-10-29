import { z } from "zod";
import { EXAMINER_QUESTIONS, EXAMINER_RATINGS } from "@/lib/constants";

/**
 * External Examiner Feedback (F11 for Term-I; Term-II reuses it in F13). The
 * assigned guide transcribes the external examiner's ratings; students and the
 * HOD see the sheet read-only.
 */

export const examinerTermSchema = z.enum(["TERM_I", "TERM_II"]);

export type ExaminerTerm = z.infer<typeof examinerTermSchema>;

export const examinerFeedbackSchema = z.object({
  groupId: z.string().min(1),
  term: examinerTermSchema,
  projectTitle: z.string().trim().max(300, "Title is too long").default(""),
  date: z.string().trim().max(60, "Date is too long").default(""),
  answers: z.array(z.enum(EXAMINER_RATINGS)).length(EXAMINER_QUESTIONS.length, "Rate all 9 questions"),
  remarks: z.string().trim().max(2000, "Remarks are too long").default(""),
  externalName: z.string().trim().max(120, "Name is too long").default(""),
});

export type ExaminerFeedbackInput = z.infer<typeof examinerFeedbackSchema>;
