import { z } from "zod";

/**
 * Rules / Undertaking sign-off (F6). A single student handles the whole group,
 * so the target is a member of their own group rather than the caller's row.
 */
export const signoffSchema = z.object({
  memberId: z.string().min(1, "Choose a member to sign"),
});

export type SignoffInput = z.infer<typeof signoffSchema>;
