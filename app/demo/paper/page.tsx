import { SheetViewer, type SheetSection } from "@/components/viewer/sheet-viewer";
import { SampleSheet } from "./sample-sheet";

export const metadata = { title: "Paper-page demo — Digital BE Log Book" };

/**
 * F1 demo. On screen this renders inside the viewer shell (thumbnail strip,
 * toolbar, zoom). With ?print=1 the SAME sheets render stacked with no chrome,
 * which is exactly what the PDF route will do in F16.
 */
export default function DemoPaperPage({
  searchParams,
}: {
  searchParams?: { print?: string };
}) {
  const isPrint = searchParams?.print === "1";
  const total = 2;

  const sections: SheetSection[] = [
    {
      key: "sample-june",
      label: "Activity Chart: June",
      dot: "half",
      content: <SampleSheet pageNumber={1} totalPages={total} />,
    },
    {
      key: "sample-july",
      label: "Activity Chart: July",
      dot: "empty",
      content: <SampleSheet pageNumber={2} totalPages={total} />,
    },
  ];

  if (isPrint) {
    return (
      <div className="paper-desk">
        {sections.map((s) => (
          <div key={s.key}>{s.content}</div>
        ))}
      </div>
    );
  }

  return (
    <SheetViewer
      heading="Paper-page demo"
      sections={sections}
      saveStatus={<span className="text-xs text-muted-foreground">All changes saved</span>}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="/demo/paper?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}
