import { z } from "zod";

/** Schemas for student group onboarding (F4). */

const optionalText = (max: number, label = "Value") =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .optional()
    .or(z.literal(""));

export const createGroupSchema = z.object({
  groupNo: optionalText(20, "Group number"),
  academicYear: optionalText(20, "Academic year"),
  department: optionalText(80, "Department"),
  projectTitle: optionalText(200, "Project title"),
  area: optionalText(120, "Area of project"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const inviteSchema = z.object({
  // an email address or a roll number — detected by the "@"
  identifier: z.string().trim().min(3, "Enter an email address or roll number").max(120),
});

export const joinByCodeSchema = z.object({
  code: z.string().trim().min(3, "Enter the group code").max(40),
});

export const inviteResponseSchema = z.object({
  inviteId: z.string().min(1),
});

export const submitGroupSchema = z.object({
  groupId: z.string().min(1),
});

export const removeMemberSchema = z.object({
  memberId: z.string().min(1),
});

export const MAX_GROUP_MEMBERS = 4;
