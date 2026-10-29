import { z } from "zod";
import { ACTIVITY_MONTHS } from "@/lib/constants";

/** Activity charts (F9): student confirms a row, the assigned guide verifies it. */

export const chartMonthSchema = z.enum(ACTIVITY_MONTHS);

export type ChartMonth = z.infer<typeof chartMonthSchema>;

export const confirmEntrySchema = z.object({
  entryId: z.string().min(1),
  date: z.string().trim().max(60, "Date is too long").default(""),
  statusText: z.enum(["COMPLETE", "INCOMPLETE"]),
});

export type ConfirmEntryInput = z.infer<typeof confirmEntrySchema>;

export const verifyEntrySchema = z.object({
  entryId: z.string().min(1),
});

export type VerifyEntryInput = z.infer<typeof verifyEntrySchema>;
