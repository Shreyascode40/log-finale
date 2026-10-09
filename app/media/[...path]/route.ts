import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadRoot } from "@/lib/upload";

/**
 * Serves locally stored uploads (`var/uploads`) with the right content type.
 * Needed because `next start` does not serve files added to `public/` after the
 * build. Production uses Cloudinary URLs instead, so this route is dev-only in
 * practice but always safe to leave in place.
 */

export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const root = uploadRoot();
  const relative = (params.path ?? []).join("/");
  const full = path.normalize(path.join(root, relative));

  // Never escape the upload root.
  if (!full.startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(full);
    const type = CONTENT_TYPES[path.extname(full).toLowerCase()] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=3600" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
