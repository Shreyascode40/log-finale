import { z } from "zod";
import { passwordSchema } from "./auth";

/** Schemas for the HOD admin area (F3). */

const mobile = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Mobile must be 10 digits")
  .or(z.literal(""))
  .optional();

export const createGuideSchema = z.object({
  name: z.string().trim().min(2, "Enter the guide's full name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  mobile,
  password: passwordSchema,
  department: z.string().trim().max(100).optional(),
});

export type CreateGuideInput = z.infer<typeof createGuideSchema>;

export const updateGuideSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  mobile,
});

export type UpdateGuideInput = z.infer<typeof updateGuideSchema>;

export const setUserActiveSchema = z.object({
  userId: z.string().min(1),
  active: z.boolean(),
});

export const approveGroupSchema = z.object({
  groupId: z.string().min(1),
  // approval and guide assignment happen together: the group only becomes
  // ACTIVE when both are done (state machine: DRAFT -> SUBMITTED -> ACTIVE)
  guideId: z.string().min(1, "Select the guide (who is also the reviewer)"),
});

export const rejectGroupSchema = z.object({
  groupId: z.string().min(1),
  reason: z.string().trim().min(5, "A rejection reason is required").max(500),
});

export const assignGuideSchema = z.object({
  groupId: z.string().min(1),
  guideId: z.string().min(1, "Select a guide"),
});
