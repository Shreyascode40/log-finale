import { z } from "zod";
import { TOPIC_MAX_SCORE } from "@/lib/constants";

/**
 * Topic Finalization (F8). One schema per workflow step: the students write the
 * text, the guide scores it, the HOD approves or rejects it.
 */

export const topicTextSchema = z.object({
  topicNo: z.number().int().min(1).max(2),
  title: z.string().trim().max(300, "Title is too long").default(""),
  description: z.string().trim().max(4000, "Description is too long").default(""),
  /** false = keep as a draft, true = submit it for review. */
  submit: z.boolean().optional().default(false),
});

export type TopicTextInput = z.infer<typeof topicTextSchema>;

const score = z
  .number({ invalid_type_error: "Enter a score from 0 to 10" })
  .int("Use a whole number")
  .min(0, "Score cannot be below 0")
  .max(TOPIC_MAX_SCORE, `Score cannot be above ${TOPIC_MAX_SCORE}`);

export const topicScoreSchema = z.object({
  groupId: z.string().min(1),
  topicNo: z.number().int().min(1).max(2),
  significance: score,
  innovativeness: score,
  scope: score,
  feasibility: score,
  recommendation: z.enum(["YES", "NO"]),
});

export type TopicScoreInput = z.infer<typeof topicScoreSchema>;

export const topicDecisionSchema = z
  .object({
    groupId: z.string().min(1),
    topicNo: z.number().int().min(1).max(2),
    decision: z.enum(["APPROVED", "REJECTED"]),
    reason: z.string().trim().max(300, "Reason is too long").optional().default(""),
  })
  .refine((value) => value.decision === "APPROVED" || value.reason.length > 0, {
    message: "A reason is required to reject a topic",
    path: ["reason"],
  });

export type TopicDecisionInput = z.infer<typeof topicDecisionSchema>;
