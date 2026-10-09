"use client";

import { useState } from "react";
import {
  PaperBody,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
  PaperTh,
  TickBox,
} from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { setChecklistAction } from "@/lib/actions/records";

export type ChecklistSheetProps = {
  term: "TERM_I" | "TERM_II";
  title: string;
  items: { text: string; checked: boolean }[];
  editable: boolean;
  print: boolean;
  printHref: string;
};

/**
 * Submission checklist sheet (SPEC.md B11). Static items with one tick each;
 * ticking saves immediately. Fully ticked counts as complete (A5).
 */
export function ChecklistSheet({ term, title, items, editable, print, printHref }: ChecklistSheetProps) {
  const [checks, setChecks] = useState<boolean[]>(items.map((item) => item.checked));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function toggle(index: number) {
    const next = checks.map((checked, i) => (i === index ? !checked : checked));
    setChecks(next);
    setStatus("saving");
    setMessage(null);
    const result = await setChecklistAction({ term, checks: next });
    if (result.success) {
      setStatus("saved");
    } else {
      setChecks(checks);
      setStatus("error");
      setMessage(result.error);
    }
  }

  const done = checks.filter(Boolean).length;

  const sheet = (
    <PaperPage>
      <div className="paper-title">{title}</div>
      <PaperTable style={{ marginTop: "10px" }}>
        <PaperBody>
          <PaperRow>
            <PaperTh width="8%">Sr. No</PaperTh>
            <PaperTh width="74%">Item</PaperTh>
            <PaperTh width="18%">Tick</PaperTh>
          </PaperRow>
          {items.map((item, index) => (
            <PaperRow key={index}>
              <PaperTd style={{ textAlign: "center" }}>{index + 1}</PaperTd>
              <PaperTd style={{ fontSize: "11px" }}>{item.text}</PaperTd>
              <PaperTd style={{ textAlign: "center" }}>
                <TickBox
                  checked={checks[index] ?? false}
                  readOnly={!editable}
                  onCheckedChange={editable ? () => void toggle(index) : undefined}
                  ariaLabel={`Checklist item ${index + 1}`}
                />
              </PaperTd>
            </PaperRow>
          ))}
        </PaperBody>
      </PaperTable>
      <p className="paper-serif" style={{ marginTop: "10px", fontSize: "11px" }}>
        {done} of {items.length} items ticked.
      </p>
    </PaperPage>
  );

  if (print) {
    return <div className="paper-desk">{sheet}</div>;
  }

  const dot: CompletionDot =
    done === items.length && items.length > 0 ? "full" : done > 0 ? "half" : "empty";
  return (
    <SheetViewer
      heading={title}
      sections={[{ key: term.toLowerCase(), label: `${title} (${done}/${items.length})`, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
          Print / PDF
        </a>
      }
    />
  );
}
