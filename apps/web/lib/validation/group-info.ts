import { z } from "zod";

/**
 * Schemas for the Cover sheet and the Project Group Information sheets (F5).
 * A group member fills these; the server re-validates every value.
 */

const optionalText = (max: number, label = "Value") =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .optional()
    .or(z.literal(""));

/** Cover page fields (SPEC.md B2). */
export const coverSchema = z.object({
  department: optionalText(80, "Department"),
  academicYear: optionalText(20, "Academic year"),
  projectTitle: optionalText(200, "Project title"),
  area: optionalText(120, "Area of project"),
  groupNo: optionalText(20, "Group number"),
});

export type CoverInput = z.infer<typeof coverSchema>;

/**
 * One member's printed details (SPEC.md B3). Mobile must be 10 digits and the
 * email a valid address when present; roll and exam seat uniqueness is checked
 * against the other members in the service.
 */
export const memberSchema = z.object({
  memberId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  teResult: optionalText(60, "TE result"),
  rollNo: optionalText(20, "Roll number"),
  examSeatNo: optionalText(30, "Exam seat number"),
  mobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Mobile number must be 10 digits")
    .optional()
    .or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  contribution: optionalText(500, "Contribution"),
});

export type MemberInput = z.infer<typeof memberSchema>;
