import { COMPETITION_TYPE_LABELS, type CompetitionType } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/**
 * HOD media gallery: every competition certificate and paper file uploaded by
 * the groups, read-only. This module never writes, so it creates no audit rows
 * or notifications. Only records that actually have a stored URL are listed.
 */

export type GalleryKind = "CERTIFICATE" | "PAPER";

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
  /** Compact metadata line: competition type/award/date or conference/ISSN/volume/page. */
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

/** Uploaded documents keep their extension (see lib/upload.ts), so it is reliable. */
export function isImageFile(url: string): boolean {
  return IMAGE_FILE.test(url);
}

function groupLabel(groupNo: string | null): string {
  return groupNo ? `Group ${groupNo}` : "Unnamed group";
}

function competitionTypeLabel(type: string | null): string | null {
  if (!type) return null;
  return COMPETITION_TYPE_LABELS[type as CompetitionType] ?? type;
}

function compact(parts: (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

const groupSelect = {
  select: {
    id: true,
    groupNo: true,
    projectTitle: true,
    guide: { select: { name: true } },
  },
} as const;

/** Totals across every group, for the gallery overview and the tab counts. */
export async function getGallerySummary(): Promise<GallerySummary> {
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

/** One gallery page: its files plus the counts needed by the tabs/notices. */
export async function getGalleryData(kind: GalleryKind): Promise<GalleryData> {
  const [summary, items] = await Promise.all([
    getGallerySummary(),
    kind === "CERTIFICATE" ? listCertificates() : listPapers(),
  ]);
  return { kind, items, summary };
}
