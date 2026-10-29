import { z } from "zod";
import { CHECKLIST_ITEMS, COMPETITION_TYPES, RECORD_CONTENT_TYPES } from "@/lib/constants";

/**
 * Independent records (F12): competitions, papers, checklists, RTM / cost
 * pages and notes. Students of the group write them; the service refuses
 * everyone else. No workflow — saved records count toward completion.
 */

const id = z.string().min(1);
const shortText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} is too long`).default("");

export const competitionSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, "Enter the competition name").max(200, "Name is too long"),
  date: shortText(60, "Date"),
  collegeAndLevel: shortText(200, "College and level"),
  type: z.enum(COMPETITION_TYPES).nullable().optional(),
  award: shortText(200, "Award / participation"),
});

export type CompetitionInput = z.infer<typeof competitionSchema>;

export const paperSchema = z.object({
  id: id.optional(),
  title: z.string().trim().min(1, "Enter the paper title").max(300, "Title is too long"),
  conference: shortText(200, "Conference"),
  issn: shortText(40, "ISSN"),
  volIssue: shortText(40, "Volume / issue"),
  pageNo: shortText(40, "Page number"),
});

export type PaperInput = z.infer<typeof paperSchema>;

export const recordIdSchema = z.object({ id });

export const checklistTermSchema = z.enum(["TERM_I", "TERM_II"]);

export type ChecklistTerm = z.infer<typeof checklistTermSchema>;

export const checklistSchema = z
  .object({
    term: checklistTermSchema,
    checks: z.array(z.boolean()),
  })
  .refine((value) => value.checks.length === CHECKLIST_ITEMS[value.term].length, {
    message: "Tick every checklist item",
    path: ["checks"],
  });

export type ChecklistInput = z.infer<typeof checklistSchema>;

export const contentSchema = z.object({
  type: z.enum(RECORD_CONTENT_TYPES),
  richText: z.string().trim().max(20000, "Content is too long").default(""),
});

export type ContentInput = z.infer<typeof contentSchema>;

export const noteSchema = z.object({
  id: id.optional(),
  text: z.string().trim().min(1, "Write the note first").max(5000, "Note is too long"),
});

export type NoteInput = z.infer<typeof noteSchema>;
