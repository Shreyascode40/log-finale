import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canViewGroup, getCurrentUser } from "@/lib/permissions";
import { readGeneratedPdf } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Authenticated download endpoint for archived, private logbook PDFs. */
export async function GET(
  _request: Request,
  { params }: { params: { exportId: string } },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

  const pdf = await prisma.pdfExport.findUnique({
    where: { id: params.exportId },
    select: {
      fileUrl: true,
      group: {
        select: {
          groupNo: true,
          guideId: true,
          pdfPermission: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!pdf) return NextResponse.json({ error: "PDF not found" }, { status: 404 });

  if (!canViewGroup(user, pdf.group)) {
    return NextResponse.json({ error: "You cannot access this group's PDF" }, { status: 403 });
  }
  if (!pdf.group.pdfPermission && user.role !== "HOD") {
    return NextResponse.json({ error: "The HOD has revoked PDF access" }, { status: 403 });
  }

  try {
    const bytes = await readGeneratedPdf(pdf.fileUrl);
    const safeGroup = (pdf.group.groupNo ?? "group").replace(/[^a-zA-Z0-9_-]/g, "");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeGroup || "group"}-logbook.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("pdf download failed", error);
    return NextResponse.json({ error: "The stored PDF could not be retrieved" }, { status: 503 });
  }
}
