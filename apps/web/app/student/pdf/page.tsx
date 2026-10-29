import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { getGroupCompletion } from "@/lib/completion/index";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Final PDF — Digital BE Log Book" };

/**
 * Student PDF status gate (F16). Shows completion, permission and past
 * generations; the download button hits the gated API route, which re-checks
 * everything and returns 403 with the missing list otherwise.
 */
export default async function StudentPdfPage() {
  const user = await requireRole("STUDENT");
  const membership = await prisma.groupMember.findFirst({
    where: { userId: user.id },
    include: { group: true },
  });
  if (!membership) redirect("/student/group");

  const [completion, exports] = await Promise.all([
    getGroupCompletion(membership.groupId),
    prisma.pdfExport.findMany({
      where: { groupId: membership.groupId },
      orderBy: { generatedAt: "desc" },
    }),
  ]);

  const group = membership.group;
  const open = group.pdfPermission && completion.complete && group.status !== "PDF_GENERATED";

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Final PDF</CardTitle>
          <CardDescription>
            Generates the whole logbook (cover to notes) as an A4 PDF from the same
            sheets you see on screen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant={completion.complete ? "default" : "secondary"}>
              {completion.complete ? "All sections complete" : `${completion.percent}% complete`}
            </Badge>
            <Badge variant={group.pdfPermission ? "default" : "secondary"}>
              {group.pdfPermission ? "PDF allowed" : "PDF not allowed"}
            </Badge>
            {group.status === "PDF_GENERATED" ? <Badge>PDF generated</Badge> : null}
          </div>
          {!completion.complete ? (
            <p className="text-muted-foreground">Missing: {completion.missing.join(", ")}</p>
          ) : null}
          {!group.pdfPermission ? (
            <p className="text-muted-foreground">
              The HOD allows generation once every section is complete.
            </p>
          ) : null}
          {group.status === "PDF_GENERATED" ? (
            <Alert>
              <AlertTitle>Logbook locked</AlertTitle>
              <AlertDescription>
                The final PDF was generated, so every sheet is now read-only.
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/print/${membership.groupId}`} target="_blank" rel="noreferrer">
                Preview print version
              </Link>
            </Button>
            {open ? (
              <Button asChild size="sm">
                <Link href={`/api/groups/${membership.groupId}/pdf`}>
                  Generate &amp; download PDF
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {exports.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Past generations</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {exports.map((file) => (
              <div key={file.id} className="flex items-center gap-3">
                <span className="flex-1 text-muted-foreground">
                  {file.generatedAt.toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <Button asChild size="sm" variant="outline">
                  <Link href={file.fileUrl} target="_blank" rel="noreferrer">
                    Download
                  </Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
