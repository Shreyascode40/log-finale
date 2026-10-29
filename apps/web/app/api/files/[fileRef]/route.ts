import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canViewGroup, getCurrentUser } from "@/lib/permissions";
import { readPrivateUpload } from "@/lib/upload";

export const dynamic = "force-dynamic";

const groupAccess = {
  select: { guideId: true, members: { select: { userId: true } } },
} as const;

/** Streams a private upload only to a user who can access its owning group. */
export async function GET(_request: Request, { params }: { params: { fileRef: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  const fileUrl = `/api/files/${params.fileRef}`;

  const [member, competition, paper, content, sponsor] = await Promise.all([
    prisma.groupMember.findFirst({ where: { photoUrl: fileUrl }, select: { group: groupAccess } }),
    prisma.competition.findFirst({ where: { certificateUrl: fileUrl }, select: { group: groupAccess } }),
    prisma.paperPublication.findFirst({ where: { fileUrl }, select: { group: groupAccess } }),
    prisma.contentPage.findFirst({ where: { fileUrl }, select: { group: groupAccess } }),
    prisma.sponsorFeedback.findFirst({ where: { sealUrl: fileUrl }, select: { group: groupAccess } }),
  ]);
  const owner = member ?? competition ?? paper ?? content ?? sponsor;
  if (!owner) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!canViewGroup(user, owner.group)) {
    return NextResponse.json({ error: "You cannot access this group's file" }, { status: 403 });
  }

  try {
    const { bytes, contentType } = await readPrivateUpload(fileUrl);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("private file read failed", error);
    return NextResponse.json({ error: "The file could not be retrieved" }, { status: 503 });
  }
}
