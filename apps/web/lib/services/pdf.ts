import { existsSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { saveGeneratedPdf } from "@/lib/upload";
import { canGeneratePdf } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/permissions";
import { getGroupCompletion } from "@/lib/completion/index";

/**
 * Final PDF generation (F16). The gate re-checks at generation time:
 *   pdfPermission === true AND every mandatory section complete (master rule 5)
 * otherwise the caller gets the missing list. Puppeteer prints the SAME sheet
 * components via /print/[groupId] (no separate PDF template); the file is
 * saved, a PdfExport row is recorded and the group locks at PDF_GENERATED.
 */

export type PdfActor = Pick<CurrentUser, "id" | "role">;

export async function checkPdfGate(actor: PdfActor, groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  if (!group) throw new AppError("GROUP_NOT_FOUND", "Group not found");

  const roleOk =
    actor.role === "HOD" ||
    group.members.some((member) => member.userId === actor.id) ||
    group.guideId === actor.id;
  if (!roleOk) {
    throw new AppError("FORBIDDEN", "You cannot access this group's PDF");
  }

  const completion = await getGroupCompletion(groupId);
  const gate = canGeneratePdf(
    { id: actor.id, role: actor.role } as CurrentUser,
    {
      guideId: group.guideId,
      members: group.members,
      pdfPermission: group.pdfPermission,
    },
    completion.complete,
  );
  if (!gate) {
    if (!completion.complete) {
      throw new AppError(
        "INCOMPLETE",
        `Cannot generate the PDF: ${completion.missing.join(", ")} still incomplete`,
      );
    }
    throw new AppError("FORBIDDEN", "The HOD has not allowed PDF generation for this group yet");
  }
  return { group, completion };
}

async function resolveChrome(): Promise<{ executablePath: string; args: string[] }> {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) return { executablePath: candidate, args: [] };
    } catch {
      // try the next candidate
    }
  }
  try {
    // Vercel's serverless Chromium bundle; local development can still use
    // CHROME_PATH or a standard Windows Chrome install above.
    const chromium = (await import("@sparticuz/chromium")).default;
    return { executablePath: await chromium.executablePath(), args: chromium.args };
  } catch {
    throw new AppError(
      "PDF_UNAVAILABLE",
      "No Chrome browser found. Configure CHROME_PATH locally or deploy with the bundled serverless Chromium.",
    );
  }
}

export type PdfTransport = { cookie: string; baseUrl: string };

/** Renders /print/[groupId] to A4 PDF bytes with the caller's session. */
export async function renderGroupPdf(groupId: string, transport: PdfTransport): Promise<Buffer> {
  const chrome = await resolveChrome();
  const browser = await puppeteer.launch({
    executablePath: chrome.executablePath,
    headless: true,
    args: [...chrome.args, "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    protocolTimeout: 120000,
  });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ cookie: transport.cookie });
    const printUrl = new URL(`/print/${encodeURIComponent(groupId)}`, transport.baseUrl);
    const response = await page.goto(printUrl.toString(), {
      waitUntil: "networkidle0",
      timeout: 90000,
    });
    if (!response) {
      throw new AppError("PDF_RENDER_FAILED", "The print page did not respond.");
    }
    if (!response.ok()) {
      throw new AppError(
        "PDF_RENDER_FAILED",
        `The print page returned HTTP ${response.status()}.`,
      );
    }
    const finalUrl = new URL(response.url());
    if (finalUrl.origin !== printUrl.origin || finalUrl.pathname !== printUrl.pathname) {
      throw new AppError(
        "PDF_RENDER_FAILED",
        "The print page redirected away. The session may have expired; please sign in and try again.",
      );
    }
    if (!(await page.$('[data-pdf-ready="1"]'))) {
      throw new AppError("PDF_RENDER_FAILED", "The print page did not finish rendering.");
    }
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function generateGroupPdf(
  actor: PdfActor,
  groupId: string,
  transport: PdfTransport,
): Promise<{ bytes: Buffer; fileName: string; url: string }> {
  const { group } = await checkPdfGate(actor, groupId);
  const bytes = await renderGroupPdf(groupId, transport);

  const slug = (group.groupNo ?? group.id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "group";
  const fileName = `${slug}-${Date.now()}.pdf`;
  const storageRef = await saveGeneratedPdf(fileName, bytes);

  let downloadUrl = "";
  await prisma.$transaction(async (tx) => {
    const saved = await tx.pdfExport.create({
      data: { groupId, generatedById: actor.id, fileUrl: storageRef },
    });
    downloadUrl = `/api/pdf/${saved.id}`;
    await tx.group.update({ where: { id: groupId }, data: { status: "PDF_GENERATED" } });
    await logAction(
      {
        userId: actor.id,
        action: "PDF_GENERATE",
        entity: "PdfExport",
        entityId: saved.id,
        after: { url: downloadUrl },
      },
      tx,
    );
  });

  return { bytes, fileName, url: downloadUrl };
}
