import { GalleryView } from "@/components/gallery/gallery-view";
import { requireRole } from "@/lib/permissions";
import { getGalleryData } from "@/lib/services/gallery";

export const metadata = { title: "Certificates — Digital BE Log Book" };

/** HOD-only gallery of every uploaded competition certificate. */
export default async function HodCertificatesGalleryPage() {
  await requireRole("HOD");
  const data = await getGalleryData("CERTIFICATE");
  return <GalleryView data={data} />;
}
