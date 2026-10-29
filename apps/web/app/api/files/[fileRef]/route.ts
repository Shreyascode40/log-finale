import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backend-api";
import { readPrivateUpload } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Streams a private upload only to a user who can access its owning group. */
export async function GET(_request: Request, { params }: { params: { fileRef: string } }) {
  const fileUrl = `/api/files/${params.fileRef}`;
  try {
    await backendApi<{ allowed: boolean }>(
      `/v1/files/authorize?fileUrl=${encodeURIComponent(fileUrl)}`,
    );

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
    const message = error instanceof Error ? error.message : "File retrieval failed";
    const status = message.includes("Authentication required")
      ? 401
      : message.includes("File not found")
        ? 404
        : message.includes("access")
          ? 403
          : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
