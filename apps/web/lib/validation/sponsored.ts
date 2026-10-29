import { z } from "zod";
import { SPONSORED_SEMESTERS, SPONSOR_PARAMETERS, SPONSOR_RATINGS } from "@/lib/constants";

/**
 * Sponsored project sheets (F14, SPEC.md B13). Only groups flagged sponsored
 * by the HOD use them: a meeting log per semester plus the sponsor feedback.
 */

export const sponsoredSemesterSchema = z.enum(SPONSORED_SEMESTERS);

export type SponsoredSemesterInput = z.infer<typeof sponsoredSemesterSchema>;

const id = z.string().min(1);

export const meetingSchema = z.object({
  id: id.optional(),
  semester: sponsoredSemesterSchema,
  date: z.string().trim().max(60, "Date is too long").default(""),
  summaryPrev: z.string().trim().max(2000, "Summary is too long").default(""),
  summaryNext: z.string().trim().max(2000, "Summary is too long").default(""),
});

export type MeetingInput = z.infer<typeof meetingSchema>;

export const meetingIdSchema = z.object({ id });

const rating = z.enum(SPONSOR_RATINGS);

export const sponsorFeedbackSchema = z.object({
  company: z.string().trim().max(200, "Company name is too long").default(""),
  ratings: z.object(
    Object.fromEntries(SPONSOR_PARAMETERS.map((p) => [p.key, rating])) as Record<
      string,
      typeof rating
    >,
  ),
});

export type SponsorFeedbackInput = z.infer<typeof sponsorFeedbackSchema>;

export const sponsoredFlagSchema = z.object({
  groupId: z.string().min(1),
  isSponsored: z.boolean(),
});
