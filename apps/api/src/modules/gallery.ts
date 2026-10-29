import { COMPETITION_TYPE_LABELS, type CompetitionType } from "../constants.js";
import { prisma } from "../db.js";
import { ApiDomainError } from "../errors.js";

/**
 * HOD media gallery: competition certificates and papers uploaded by groups.
 */

export type GalleryKind = "CERTIFICATE" | "PAPER";

export type GalleryActor = { id: string; role: string; name?: string };

export type GalleryItem = {
  id: string;
  kind: GalleryKind;
  title: string;
  fileUrl: string;
  isImage: boolean;
  groupId: string;
  groupLabel: string;
  projectTitle: string | null;
  guideName: string | null;
  meta: string;
  uploadedOn: string;
};

export type GallerySummary = {
  certificates: number;
  papers: number;
  missingCertificates: number;
  missingPapers: number;
};

export type GalleryData = {
  kind: GalleryKind;
  items: GalleryItem[];
  summary: GallerySummary;
};

const IMAGE_FILE = /\.(jpe?g|png)(?:$|[?#])/i;

export function isImageFile(url: string): boolean {
  return IMAGE_FILE.test(url);
}

function groupLabel(groupNo: string | null): string {
  return groupNo ? `Group ${groupNo}` : "Unnamed group";
}

function competitionTypeLabel(type: string | null): string | null {
  if (!type) return null;
  return (COMPETITION_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

function compact(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

const groupSelect = {
  select: {
    id: true,
    groupNo: true,
    projectTitle: true,
    guide: { select: { name: true } },
  },
} as const;

export async function getGallerySummary(actor?: GalleryActor): Promise<GallerySummary> {
  if (actor && actor.role !== "HOD") {
    throw new ApiDomainError("FORBIDDEN", "Only HOD can view gallery summary", 403);
  }
  const [certificates, papers, missingCertificates, missingPapers] = await Promise.all([
    prisma.competition.count({ where: { certificateUrl: { not: null } } }),
    prisma.paperPublication.count({ where: { fileUrl: { not: null } } }),
    prisma.competition.count({ where: { certificateUrl: null } }),
    prisma.paperPublication.count({ where: { fileUrl: null } }),
  ]);
  return { certificates, papers, missingCertificates, missingPapers };
}

async function listCertificates(): Promise<GalleryItem[]> {
  const rows = await prisma.competition.findMany({
    where: { certificateUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { group: groupSelect },
  });

  const items: GalleryItem[] = [];
  for (const row of rows) {
    const fileUrl = row.certificateUrl;
    if (!fileUrl) continue;
    items.push({
      id: row.id,
      kind: "CERTIFICATE",
      title: row.name,
      fileUrl,
      isImage: isImageFile(fileUrl),
      groupId: row.group.id,
      groupLabel: groupLabel(row.group.groupNo),
      projectTitle: row.group.projectTitle,
      guideName: row.group.guide?.name ?? null,
      meta: compact([
        competitionTypeLabel(row.type),
        row.award,
        row.date,
        row.collegeAndLevel,
      ]),
      uploadedOn: formatDate(row.createdAt),
    });
  }
  return items;
}

async function listPapers(): Promise<GalleryItem[]> {
  const rows = await prisma.paperPublication.findMany({
    where: { fileUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { group: groupSelect },
  });

  const items: GalleryItem[] = [];
  for (const row of rows) {
    const fileUrl = row.fileUrl;
    if (!fileUrl) continue;
    items.push({
      id: row.id,
      kind: "PAPER",
      title: row.title,
      fileUrl,
      isImage: isImageFile(fileUrl),
      groupId: row.group.id,
      groupLabel: groupLabel(row.group.groupNo),
      projectTitle: row.group.projectTitle,
      guideName: row.group.guide?.name ?? null,
      meta: compact([
        row.conference,
        row.issn ? `ISSN ${row.issn}` : null,
        row.volIssue,
        row.pageNo ? `Page ${row.pageNo}` : null,
      ]),
      uploadedOn: formatDate(row.createdAt),
    });
  }
  return items;
}

export async function getGalleryData(actor: GalleryActor | GalleryKind, maybeKind?: GalleryKind): Promise<GalleryData> {
  const kind = typeof actor === "string" ? actor : maybeKind!;
  const [summary, items] = await Promise.all([
    getGallerySummary(),
    kind === "CERTIFICATE" ? listCertificates() : listPapers(),
  ]);
  return { kind, items, summary };
}
