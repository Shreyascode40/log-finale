import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";
import { getGroupCompletion, type GroupCompletion } from "../completion/index.js";

/**
 * Final PDF Service & Gate (F16, SPEC.md A2/A6).
 *
 * Rules:
 * - PDF permission allowed by HOD
 * - All mandatory sections complete
 * - User belongs to group, or is assigned guide, or is HOD
 * - Generating locks the group to PDF_GENERATED and audits PDF_GENERATE
 */

export type PdfActor = { id: string; role: string; name?: string };

export type PdfGateResult = {
  group: {
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    status: string;
    guideId: string | null;
    pdfPermission: boolean;
    isSponsored: boolean;
  };
  completion: GroupCompletion;
};

export type PdfExportResult = {
  exportId: string;
  downloadUrl: string;
  fileUrl: string;
};

function canGeneratePdf(
  user: PdfActor,
  group: { guideId?: string | null; members?: { userId: string }[]; pdfPermission?: boolean },
  allSectionsComplete: boolean,
): boolean {
  const permitted =
    user.role === "HOD" ||
    Boolean(group.members?.some((m) => m.userId === user.id)) ||
    group.guideId === user.id;
  return permitted && group.pdfPermission === true && allSectionsComplete === true;
}

async function logAction(
  input: { userId: string; action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
  tx: Prisma.TransactionClient,
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}

export async function checkPdfGate(actor: PdfActor, groupId: string): Promise<PdfGateResult> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  if (!group) throw new ApiDomainError("GROUP_NOT_FOUND", "Group not found", 404);

  const roleOk =
    actor.role === "HOD" ||
    group.members.some((member) => member.userId === actor.id) ||
    group.guideId === actor.id;
  if (!roleOk) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's PDF", 403);
  }

  const completion = await getGroupCompletion(groupId);
  const gate = canGeneratePdf(
    actor,
    {
      guideId: group.guideId,
      members: group.members,
      pdfPermission: group.pdfPermission,
    },
    completion.complete,
  );
  if (!gate) {
    if (!completion.complete) {
      throw new ApiDomainError(
        "INCOMPLETE",
        `Cannot generate the PDF: ${completion.missing.join(", ")} still incomplete`,
        400,
      );
    }
    throw new ApiDomainError("FORBIDDEN", "The HOD has not allowed PDF generation for this group yet", 403);
  }
  return { group, completion };
}

export async function recordPdfExport(
  actor: PdfActor,
  groupId: string,
  storageRef: string,
): Promise<PdfExportResult> {
  await checkPdfGate(actor, groupId);

  const result = await prisma.$transaction(async (tx) => {
    const saved = await tx.pdfExport.create({
      data: { groupId, generatedById: actor.id, fileUrl: storageRef },
    });
    const downloadUrl = `/api/pdf/${saved.id}`;
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
    return { exportId: saved.id, downloadUrl, fileUrl: storageRef };
  });

  return result;
}

export async function getPdfExport(actor: PdfActor, exportId: string) {
  const pdf = await prisma.pdfExport.findUnique({
    where: { id: exportId },
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
  if (!pdf) throw new ApiDomainError("NOT_FOUND", "PDF not found", 404);

  const canView =
    actor.role === "HOD" ||
    pdf.group.members.some((m) => m.userId === actor.id) ||
    pdf.group.guideId === actor.id;
  if (!canView) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's PDF", 403);
  }
  if (!pdf.group.pdfPermission && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "The HOD has revoked PDF access", 403);
  }

  return { fileUrl: pdf.fileUrl, groupNo: pdf.group.groupNo };
}

export async function authorizeFileAccess(actor: PdfActor, fileUrl: string) {
  const groupAccess = {
    select: { guideId: true, members: { select: { userId: true } } },
  } as const;

  const [member, competition, paper, content, sponsor] = await Promise.all([
    prisma.groupMember.findFirst({ where: { photoUrl: fileUrl }, select: { group: groupAccess } }),
    prisma.competition.findFirst({ where: { certificateUrl: fileUrl }, select: { group: groupAccess } }),
    prisma.paperPublication.findFirst({ where: { fileUrl }, select: { group: groupAccess } }),
    prisma.contentPage.findFirst({ where: { fileUrl }, select: { group: groupAccess } }),
    prisma.sponsorFeedback.findFirst({ where: { sealUrl: fileUrl }, select: { group: groupAccess } }),
  ]);
  const owner = member ?? competition ?? paper ?? content ?? sponsor;
  if (!owner) throw new ApiDomainError("NOT_FOUND", "File not found", 404);

  const canView =
    actor.role === "HOD" ||
    owner.group.members.some((m) => m.userId === actor.id) ||
    owner.group.guideId === actor.id;
  if (!canView) {
    throw new ApiDomainError("FORBIDDEN", "You cannot access this group's file", 403);
  }

  return { allowed: true };
}

export async function authorizeMediaPdf(actor: PdfActor, fileUrl: string) {
  const pdf = await prisma.pdfExport.findFirst({
    where: { fileUrl },
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
  if (!pdf) throw new ApiDomainError("NOT_FOUND", "Not found", 404);

  const canView =
    actor.role === "HOD" ||
    pdf.group.members.some((m) => m.userId === actor.id) ||
    pdf.group.guideId === actor.id;
  const permissionOpen = pdf.group.pdfPermission || actor.role === "HOD";
  if (!canView || !permissionOpen) {
    throw new ApiDomainError("FORBIDDEN", "You cannot download this PDF.", 403);
  }

  return { allowed: true };
}
