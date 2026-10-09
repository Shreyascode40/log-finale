"use client";

import { useEffect, useState } from "react";
import {
  Field,
  PaperBody,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
  PaperTh,
} from "@/components/paper";
import { SheetViewer } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { SCHEDULE_NOTICE } from "@/lib/constants";
import { updateScheduleItemAction } from "@/lib/actions/schedule";
import type { ScheduleTermGroup } from "@/lib/services/schedule";

export type ScheduleSheetScreenProps = {
  terms: ScheduleTermGroup[];
  /** HOD only: the date cells become editable and autosave. */
  editable: boolean;
  print: boolean;
};

/**
 * B.E. Project Schedule sheet (SPEC.md E5.6 / B5). One A4 sheet per semester with
 * the columns Sr. No, Description, Dates. The HOD edits the date cells (autosave,
 * audited); students and the PDF see the same sheet read-only. The bold-italic
 * notice is printed beneath every table.
 */
export function ScheduleSheetScreen({ terms, editable, print }: ScheduleSheetScreenProps) {
  const [edits, setEdits] = useState<Record<string, { date: string; note: string }>>(() => {
    const initial: Record<string, { date: string; note: string }> = {};
    for (const group of terms) {
      for (const row of group.rows) initial[row.id] = { date: row.date, note: row.note };
    }
    return initial;
  });
  const [dirty, setDirty] = useState<string[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function edit(id: string, patch: Partial<{ date: string; note: string }>) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    setDirty((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  useEffect(() => {
    if (!editable || dirty.length === 0) return;
    const timer = setTimeout(async () => {
      setStatus("saving");
      let failed: string | null = null;
      for (const id of dirty) {
        const value = edits[id];
        if (!value) continue;
        const result = await updateScheduleItemAction({ id, date: value.date, note: value.note });
        if (!result.success) {
          failed = result.error;
          break;
        }
      }
      setDirty([]);
      if (failed) {
        setStatus("error");
        setMessage(failed);
      } else {
        setStatus("saved");
        setMessage(null);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [edits, dirty, editable]);

  const sheets = terms.map((group, i) => (
    <PaperPage key={group.term} pageNumber={i + 1} totalPages={terms.length}>
      <div className="paper-title">B.E. Project Schedule</div>
      <div className="paper-subtitle">{group.label}</div>

      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTh width="9%">Sr. No</PaperTh>
            <PaperTh width="53%">Description</PaperTh>
            <PaperTh>Dates</PaperTh>
          </PaperRow>
          {group.rows.map((row) => {
            const value = edits[row.id] ?? { date: row.date, note: row.note };
            return (
              <PaperRow key={row.id}>
                <PaperTd>{row.sortOrder}</PaperTd>
                <PaperTd>{row.description}</PaperTd>
                <PaperTd>
                  <Field
                    value={value.date}
                    onValueChange={editable ? (v) => edit(row.id, { date: v }) : undefined}
                    readOnly={!editable}
                    placeholder={editable ? "e.g. 05 Aug 2025" : undefined}
                    ariaLabel={`${group.label} row ${row.sortOrder} dates`}
                  />
                </PaperTd>
              </PaperRow>
            );
          })}
        </PaperBody>
      </PaperTable>

      <p
        className="paper-serif"
        style={{ fontWeight: 700, fontStyle: "italic", fontSize: "12px", marginTop: "14px" }}
      >
        {SCHEDULE_NOTICE}
      </p>
    </PaperPage>
  ));

  if (print) {
    return <div className="paper-desk">{sheets}</div>;
  }

  const sections = terms.map((group, i) => ({
    key: group.term,
    label: `Schedule: ${group.label}`,
    dot: scheduleDot(group, edits),
    content: sheets[i],
  }));

  return (
    <SheetViewer
      heading="Project schedule"
      sections={sections}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}

function scheduleDot(
  group: ScheduleTermGroup,
  edits: Record<string, { date: string; note: string }>,
): "empty" | "half" | "full" {
  if (group.rows.length === 0) return "empty";
  const filled = group.rows.filter((row) => (edits[row.id] ?? { date: row.date }).date).length;
  if (filled === group.rows.length) return "full";
  return filled > 0 ? "half" : "empty";
}
