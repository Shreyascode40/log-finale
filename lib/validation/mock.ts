import { z } from "zod";
import { MOCK_T1_COMPONENTS } from "@/lib/constants";

/**
 * Term-I Mock Evaluation mark sheets (F11). One row per group member; each
 * cell is validated against its column max and the total is computed on the
 * server. Only the assigned guide writes; the guide or HOD approves; only the
 * HOD unlocks with a reason.
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
    MOCK_T1_COMPONENTS.map((c) => [c.key, component(c.max)]),
  ) as Record<string, ReturnType<typeof component>>,
);

export const mockSaveSchema = z.object({
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

export type MockSaveInput = z.infer<typeof mockSaveSchema>;

export const mockSubmitSchema = z.object({
  groupId: z.string().min(1),
});

export type MockSubmitInput = z.infer<typeof mockSubmitSchema>;

export const mockApproveSchema = z.object({
  groupId: z.string().min(1),
});

export type MockApproveInput = z.infer<typeof mockApproveSchema>;

export const mockUnlockSchema = z
  .object({
    groupId: z.string().min(1),
    reason: z.string().trim().max(300, "Reason is too long").default(""),
  })
  .refine((value) => value.reason.length > 0, {
    message: "A reason is required to unlock approved marks",
    path: ["reason"],
  });

export type MockUnlockInput = z.infer<typeof mockUnlockSchema>;
