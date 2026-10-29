import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/permissions";
import { getGallerySummary } from "@/lib/services/gallery";

export const metadata = { title: "Media gallery — Digital BE Log Book" };

function filesLabel(count: number): string {
  return `${count} ${count === 1 ? "file" : "files"}`;
}

function missingLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"} still missing an upload.`;
}

/** HOD-only entry point for the read-only certificates and papers galleries. */
export default async function HodGalleryPage() {
  await requireRole("HOD");
  const summary = await getGallerySummary();

  const cards = [
    {
      href: "/hod/gallery/certificates",
      title: "Certificates",
      description: "Every competition certificate uploaded by the groups.",
      count: summary.certificates,
      missing: summary.missingCertificates,
      missingNoun: "competition entry",
      empty: "All competition entries have a certificate uploaded.",
    },
    {
      href: "/hod/gallery/papers",
      title: "Papers",
      description: "Every paper publication upload across the groups.",
      count: summary.papers,
      missing: summary.missingPapers,
      missingNoun: "paper",
      empty: "All papers have a file uploaded.",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Media gallery</h1>
        <p className="text-sm text-muted-foreground">
          Every certificate and paper file uploaded to the logbook, in one place.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block">
            <Card className="h-full transition-colors hover:border-neutral-400">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{card.title}</CardTitle>
                  <Badge variant="secondary">{filesLabel(card.count)}</Badge>
                </div>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  {card.missing > 0
                    ? missingLabel(card.missing, card.missingNoun)
                    : card.empty}
                </p>
                <span className="block font-medium text-neutral-900">
                  Open {card.title.toLowerCase()} →
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
