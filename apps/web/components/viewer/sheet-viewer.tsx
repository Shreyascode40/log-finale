"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type CompletionDot = "empty" | "half" | "full";

export type SheetSection = {
  key: string;
  label: string;
  /** Completion dot shown in the thumbnail strip (exactly like a PDF viewer). */
  dot?: CompletionDot;
  content: ReactNode;
};

export type SheetViewerProps = {
  sections: SheetSection[];
  heading?: string;
  /** Slot for the "Saved" indicator. */
  saveStatus?: ReactNode;
  /** Slot for the PDF button. */
  pdfButton?: ReactNode;
  initialIndex?: number;
};

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

function Dot({ state }: { state: CompletionDot }) {
  const bg = state === "full" ? "#16a34a" : state === "half" ? "#eab308" : "#d4d4d8";
  return (
    <span
      aria-hidden
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: bg,
        display: "inline-block",
        flex: "0 0 auto",
      }}
    />
  );
}

/**
 * Viewer shell around the sheets: left thumbnail strip, top toolbar
 * (page x of y, prev/next, zoom, jump-to-section) and a responsive scaler that
 * shrinks the fixed A4 sheet to the viewport width on small screens instead of
 * reflowing it. Keyboard: Page Up / Page Down move between sheets.
 */
export function SheetViewer({
  sections,
  heading,
  saveStatus,
  pdfButton,
  initialIndex = 0,
}: SheetViewerProps) {
  const [index, setIndex] = useState(Math.min(Math.max(initialIndex, 0), Math.max(sections.length - 1, 0)));
  const [zoom, setZoom] = useState<"fit" | "100" | "125">("fit");
  const [fitScale, setFitScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(A4_HEIGHT);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const available = viewport.clientWidth - 24;
    setFitScale(Math.min(1, Math.max(0.2, available / A4_WIDTH)));
    const inner = sheetRef.current?.firstElementChild as HTMLElement | null;
    if (inner) setSheetHeight(inner.offsetHeight || A4_HEIGHT);
  }, []);

  useLayoutEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [measure, index]);

  const goPrev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(
    () => setIndex((i) => Math.min(sections.length - 1, i + 1)),
    [sections.length],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      if (e.key === "PageUp") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext]);

  const scale = zoom === "fit" ? fitScale : Number(zoom) / 100;

  if (sections.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No sheets to show yet.</div>;
  }

  const active = sections[index];

  return (
    <div className="flex min-h-screen flex-col bg-[#8a8a8a]">
      {/* Top toolbar — app chrome, hidden when printing */}
      <div className="print-hide sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2 text-sm">
        {heading ? <span className="mr-2 font-semibold">{heading}</span> : null}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            ‹ Prev
          </button>
          <span className="px-1 tabular-nums">
            Page {index + 1} of {sections.length}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={index === sections.length - 1}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            Next ›
          </button>
        </div>

        <label className="flex items-center gap-1">
          Zoom
          <select
            value={zoom}
            onChange={(e) => setZoom(e.target.value as "fit" | "100" | "125")}
            className="rounded border px-1 py-1"
          >
            <option value="fit">Fit width</option>
            <option value="100">100%</option>
            <option value="125">125%</option>
          </select>
        </label>

        <label className="flex items-center gap-1">
          Go to
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="max-w-[14rem] rounded border px-1 py-1"
          >
            {sections.map((s, i) => (
              <option key={s.key} value={i}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {saveStatus}
          {pdfButton}
        </div>
      </div>

      <div className="flex flex-1 items-stretch">
        {/* Left thumbnail strip — app chrome, hidden when printing */}
        <nav
          aria-label="Sheets"
          className="print-hide hidden w-44 shrink-0 overflow-y-auto border-r bg-neutral-100 p-2 text-xs md:block"
        >
          {sections.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setIndex(i)}
              aria-current={i === index}
              className={`mb-1 flex w-full items-start gap-2 rounded px-2 py-1 text-left ${
                i === index ? "bg-white shadow ring-1 ring-neutral-300" : "hover:bg-white/70"
              }`}
            >
              <span>{i + 1}.</span>
              <span className="flex-1">{s.label}</span>
              <Dot state={s.dot ?? "empty"} />
            </button>
          ))}
        </nav>

        {/* Sheet viewport */}
        <div ref={viewportRef} className="paper-viewport flex-1">
          <div style={{ height: sheetHeight * scale }} className="flex justify-center">
            <div
              ref={sheetRef}
              className="paper-scaler"
              style={{ transform: `scale(${scale})`, transformOrigin: "top center", width: A4_WIDTH }}
            >
              {active.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
