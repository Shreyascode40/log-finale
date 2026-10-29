import { GalleryView } from "@/components/gallery/gallery-view";
import { requireRole } from "@/lib/permissions";
import { getGalleryData } from "@/lib/services/gallery";

export const metadata = { title: "Papers — Digital BE Log Book" };

/** HOD-only gallery of every uploaded paper publication. */
export default async function HodPapersGalleryPage() {
  await requireRole("HOD");
  const data = await getGalleryData("PAPER");
  return <GalleryView data={data} />;
}
