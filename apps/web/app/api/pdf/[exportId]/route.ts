import { NextResponse } from "next/server";
import { backendApi } from "@/lib/backend-api";
import { readGeneratedPdf } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** Authenticated download endpoint for archived, private logbook PDFs. */
export async function GET(
  _request: Request,
  { params }: { params: { exportId: string } },
) {
  try {
    const pdf = await backendApi<{ fileUrl: string; groupNo: string | null }>(
      `/v1/pdf/exports/${encodeURIComponent(params.exportId)}`,
    );

    const bytes = await readGeneratedPdf(pdf.fileUrl);
    const safeGroup = (pdf.groupNo ?? "group").replace(/[^a-zA-Z0-9_-]/g, "");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeGroup || "group"}-logbook.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    const status = message.includes("Authentication required")
      ? 401
      : message.includes("PDF not found")
        ? 404
        : message.includes("access")
          ? 403
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
