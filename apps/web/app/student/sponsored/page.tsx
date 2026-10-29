import { redirect } from "next/navigation";
import { FeedbackSheet } from "@/components/sponsored/feedback-sheet";
import { MeetingSheet } from "@/components/sponsored/meeting-sheet";
import { requireRole } from "@/lib/permissions";
import { getSponsoredSheet, getStudentSponsoredGroupId } from "@/lib/services/sponsored";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Sponsored project — Digital BE Log Book" };

/**
 * Student sponsored sheets (F14). Only groups the HOD flagged sponsored see
 * the meeting logs and feedback; everyone else gets the notice below.
 */
export default async function StudentSponsoredPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const user = await requireRole("STUDENT");
  const groupId = await getStudentSponsoredGroupId(user.id);
  if (!groupId) redirect("/student/group");

  const sheet = await getSponsoredSheet(groupId);
  const print = searchParams?.print === "1";

  if (!sheet.group.isSponsored) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Sponsored project</CardTitle>
            <CardDescription>
              Your group is not flagged as a sponsored project. The HOD marks sponsored
              groups on the Groups page; these sheets unlock then.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const editable = sheet.group.status !== "PDF_GENERATED";

  return (
    <>
      {sheet.semesters.map((semester) => (
        <MeetingSheet
          key={semester.semester}
          semester={semester.semester}
          title={semester.title}
          rows={semester.rows}
          mode="student"
          editable={editable}
          print={print}
          printHref="/student/sponsored?print=1"
        />
      ))}
      <FeedbackSheet
        company={sheet.feedback.company}
        ratings={sheet.feedback.ratings}
        sealUrl={sheet.feedback.sealUrl}
        signedAt={sheet.feedback.signedAt}
        mode="student"
        editable={editable}
        print={print}
        printHref="/student/sponsored?print=1"
      />
    </>
  );
}
