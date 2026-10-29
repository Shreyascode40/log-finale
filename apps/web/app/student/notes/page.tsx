import { redirect } from "next/navigation";
import { NotesSheet } from "@/components/records/notes-sheet";
import { requireRole } from "@/lib/permissions";
import { getStudentGroupInfo } from "@/lib/services/group-info";
import { listNotes } from "@/lib/services/records";

export const metadata = { title: "Notes — Digital BE Log Book" };

/** Student free-text notes (F12). */
export default async function StudentNotesPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const membership = await getStudentGroupInfo(user.id);
  if (!membership) redirect("/student/group");

  const notes = await listNotes(membership.groupId);

  return (
    <NotesSheet
      notes={notes.map((note) => ({ id: note.id, text: note.richText ?? "" }))}
      editable={membership.group.status !== "PDF_GENERATED"}
      print={searchParams?.print === "1"}
      printHref="/student/notes?print=1"
    />
  );
}
