import { z } from "zod";

/**
 * Schedule sheet (F7). The HOD edits the "Dates" cell of a seeded row; the
 * description itself is fixed. Dates are free text because the logbook prints
 * ranges and phrases like "As per university schedule".
 */
export const updateScheduleItemSchema = z.object({
  id: z.string().min(1),
  date: z.string().trim().max(120),
  note: z.string().trim().max(200),
});

export type UpdateScheduleItemInput = z.infer<typeof updateScheduleItemSchema>;
