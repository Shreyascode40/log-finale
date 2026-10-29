import "server-only";

import { backendApi } from "@/lib/backend-api";

/**
 * HOD media gallery client service.
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

export function getGallerySummary(): Promise<GallerySummary> {
  return backendApi<GallerySummary>("/v1/gallery/summary");
}

export function getGalleryData(kind: GalleryKind): Promise<GalleryData> {
  return backendApi<GalleryData>(`/v1/gallery/${encodeURIComponent(kind)}`);
}
