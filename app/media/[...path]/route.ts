import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { canViewGroup, getCurrentUser } from "@/lib/permissions";
import { uploadRoot } from "@/lib/upload";

/**
 * Serves locally stored uploads (`var/uploads`) with the right content type.
 * Needed because `next start` does not serve files added to `public/` after the
 * build. With UPLOAD_PROVIDER="supabase" files live in Supabase Storage
 * instead, so this route is dev-only in practice but always safe to leave in
 * place.
 *
 * Generated final PDFs are private: unlike certificates and photos, a PDF
 * contains the whole logbook. It is only served to a signed-in user who can
 * view its group (and only while PDF permission is still granted, except for
 * the HOD).
 */

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

async function authorizePdf(pathParts: string[]): Promise<NextResponse | null> {
  if (pathParts[0]?.toLowerCase() !== "pdf") return null;

  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Please sign in to download this PDF.", { status: 401 });
  }

  const fileName = pathParts.slice(1).join("/");
  if (!fileName || fileName.includes("/")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const pdf = await prisma.pdfExport.findFirst({
    where: { fileUrl: `/media/pdf/${fileName}` },
    select: {
      group: {
        select: {
          guideId: true,
          pdfPermission: true,
          members: { select: { userId: true } },
        },
      },
    },
  });
  if (!pdf) {
    return new NextResponse("Not found", { status: 404 });
  }

  const canView = canViewGroup(user, {
    guideId: pdf.group.guideId,
    members: pdf.group.members,
  });
  const permissionOpen = pdf.group.pdfPermission || user.role === "HOD";
  if (!canView || !permissionOpen) {
    return new NextResponse("You cannot download this PDF.", { status: 403 });
  }

  return null;
}

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const pathParts = params.path ?? [];
  const denied = await authorizePdf(pathParts);
  if (denied) return denied;

  const root = uploadRoot();
  const relative = pathParts.join("/");
  const full = path.normalize(path.join(root, relative));

  // Never escape the upload root.
  if (!full.startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(full);
    const type = CONTENT_TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
    const isPdf = pathParts[0]?.toLowerCase() === "pdf";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": isPdf ? "private, no-store" : "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
