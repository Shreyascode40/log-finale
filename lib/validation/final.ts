import { z } from "zod";
import { FINAL_T2_COMPONENTS } from "@/lib/constants";

/**
 * Term-II Final Evaluation mark sheets (F13, total 100). Same workflow as the
 * Term-I mock table: guide-only writes, guide/HOD approval, HOD-only unlock.
 */

function component(max: number) {
  return z
    .number({ invalid_type_error: "Enter a number" })
    .int("Use a whole number")
    .min(0, "Marks cannot be below 0")
    .max(max, `Marks cannot be above ${max}`)
    .nullable()
    .optional();
}

const componentsSchema = z.object(
  Object.fromEntries(
    FINAL_T2_COMPONENTS.map((c) => [c.key, component(c.max)]),
  ) as Record<string, ReturnType<typeof component>>,
);

export const finalSaveSchema = z.object({
  groupId: z.string().min(1),
  rows: z
    .array(
      z.object({
        memberId: z.string().min(1),
        components: componentsSchema,
      }),
    )
    .min(1)
    .max(4),
});

export type FinalSaveInput = z.infer<typeof finalSaveSchema>;

export const finalSubmitSchema = z.object({
  groupId: z.string().min(1),
});

export type FinalSubmitInput = z.infer<typeof finalSubmitSchema>;

export const finalApproveSchema = z.object({
  groupId: z.string().min(1),
});

export type FinalApproveInput = z.infer<typeof finalApproveSchema>;

export const finalUnlockSchema = z
  .object({
    groupId: z.string().min(1),
    reason: z.string().trim().max(300, "Reason is too long").default(""),
  })
  .refine((value) => value.reason.length > 0, {
    message: "A reason is required to unlock approved marks",
    path: ["reason"],
  });

export type FinalUnlockInput = z.infer<typeof finalUnlockSchema>;
