import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { generateGroupPdf } from "@/lib/services/pdf";

export const runtime = "nodejs";
// A full A4 logbook can take longer to render on a cold serverless instance.
export const maxDuration = 300;

/**
 * Final PDF download (F16). GET returns the generated A4 PDF as an
 * attachment. The gate re-checks here: role, every section complete and HOD
 * permission — otherwise 403 with the missing list.
 */
export async function GET(request: NextRequest, { params }: { params: { groupId: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  try {
    const cookie = request.headers.get("cookie") ?? "";
    const baseUrl =
      process.env.PDF_BASE_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      request.nextUrl.origin;
    const { bytes, fileName } = await generateGroupPdf(
      { id: user.id, role: user.role },
      params.groupId,
      { cookie, baseUrl },
    );
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      const status =
        error.code === "PDF_UNAVAILABLE"
          ? 503
          : error.code === "UPLOAD_NOT_CONFIGURED" || error.code === "UPLOAD_FAILED"
            ? 503
          : error.code === "PDF_RENDER_FAILED"
            ? 502
            : error.code === "GROUP_NOT_FOUND"
              ? 404
              : 403;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error("pdf generation failed", error);
    return NextResponse.json({ error: "PDF generation failed. Please try again." }, { status: 500 });
  }
}
