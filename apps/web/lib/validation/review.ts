import { z } from "zod";

/**
 * Term-I reviews and the marks workflow (F10). The assigned guide writes
 * remarks/grades, submits, and may approve; the HOD may approve or unlock.
 */

export const TERM_I_REVIEW_TYPES = ["REVIEW_I", "REVIEW_II", "FINAL_DESIGN"] as const;

export type TermIReviewType = (typeof TERM_I_REVIEW_TYPES)[number];

/** All seven review sheets; Term-II arrives with F13. */
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

/** Review tabs grouped by term for the detail pages. */
export const REVIEW_TABS: Record<"TERM_I" | "TERM_II", { reviewType: string; label: string }[]> = {
  TERM_I: [
    { reviewType: "REVIEW_I", label: "Review I" },
    { reviewType: "REVIEW_II", label: "Review II" },
    { reviewType: "FINAL_DESIGN", label: "Final (Design)" },
  ],
  TERM_II: [
    { reviewType: "REVIEW_I_MODELING", label: "Review I" },
    { reviewType: "REVIEW_II_CODING", label: "Review II" },
    { reviewType: "FINAL_VALIDATION", label: "Final (Validation)" },
    { reviewType: "REPORT_WRITING", label: "Report Writing" },
  ],
};

export const reviewTypeSchema = z.enum(ALL_REVIEW_TYPES);

const remark = z.string().trim().max(1000, "Remark is too long").default("");
const grade = z.string().trim().max(20, "Grade is too long").default("");
const rowDate = z.string().trim().max(60, "Date is too long").default("");

export const reviewDraftSchema = z.object({
  groupId: z.string().min(1),
  reviewType: reviewTypeSchema,
  remarkAndSuggestions: z.string().trim().max(2000, "Remark and Suggestions is too long").default(""),
  scores: z
    .array(
      z.object({
        questionId: z.string().min(1),
        remark,
        grade,
        date: rowDate,
      }),
    )
    .max(50),
});

export type ReviewDraftInput = z.infer<typeof reviewDraftSchema>;

export const reviewSubmitSchema = z.object({
  groupId: z.string().min(1),
  reviewType: reviewTypeSchema,
});

export type ReviewSubmitInput = z.infer<typeof reviewSubmitSchema>;

export const reviewApproveSchema = z.object({
  groupId: z.string().min(1),
  reviewType: reviewTypeSchema,
});

export type ReviewApproveInput = z.infer<typeof reviewApproveSchema>;

export const reviewUnlockSchema = z
  .object({
    groupId: z.string().min(1),
    reviewType: reviewTypeSchema,
    reason: z.string().trim().max(300, "Reason is too long").default(""),
  })
  .refine((value) => value.reason.length > 0, {
    message: "A reason is required to unlock approved marks",
    path: ["reason"],
  });

export type ReviewUnlockInput = z.infer<typeof reviewUnlockSchema>;
