"use client";

import { useState, type ReactNode } from "react";
import {
  Field,
  PaperBody,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
  PaperTh,
} from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { paginateByWeight, wrapPaperText } from "@/lib/paper/pagination";
import { signedBy } from "@/lib/format";
import {
  deleteMeetingAction,
  recordExternalSignAction,
  saveMeetingAction,
  signMeetingGuideAction,
  signMeetingStudentAction,
} from "@/lib/actions/sponsored";
import type { MeetingRow } from "@/lib/services/sponsored";

export type MeetingSheetMode = "student" | "guide" | "hod";

export type MeetingSheetProps = {
  semester: "SEMESTER_1" | "SEMESTER_2";
  title: string;
  rows: MeetingRow[];
  mode: MeetingSheetMode;
  /** False once the PDF is generated (students also need a sponsored group). */
  editable: boolean;
  print: boolean;
  printHref: string;
};

function ActionButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="print-hide"
      style={{
        border: "1px solid #000",
        background: "#fff",
        color: "#000",
        padding: "1px 10px",
        fontSize: "11px",
        fontFamily: "Arial, Helvetica, sans-serif",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function meetingRowWeight(row: MeetingRow): number {
  return (
    Math.max(
      wrapPaperText(row.summaryPrev, 26).length,
      wrapPaperText(row.summaryNext, 26).length,
      3,
    ) + 1
  );
}

/**
 * Sponsored meeting log for one semester (SPEC.md B13). Columns Date, the two
 * summaries, student sign, guide sign, external guide sign. Students add rows,
 * sign their own, record the external guide's date and edit; the assigned
 * guide countersigns. Editing a signed row clears every signature.
 */
export function MeetingSheet({ semester, title, rows, mode, editable, print, printHref }: MeetingSheetProps) {
  const [entries, setEntries] = useState<MeetingRow[]>(rows);
  const [drafts, setDrafts] = useState<Record<string, { date: string; prev: string; next: string }>>(() =>
    Object.fromEntries(
      rows.map((row) => [row.id, { date: row.date, prev: row.summaryPrev, next: row.summaryNext }]),
    ),
  );
  const [adding, setAdding] = useState(false);
  const [fresh, setFresh] = useState({ date: "", prev: "", next: "" });
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canWrite = mode === "student" && editable;
  const canCountersign = mode === "guide" && editable;

  function patchRow(id: string, next: Partial<MeetingRow>) {
    setEntries((prev) => prev.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  function setDraft(id: string, field: "date" | "prev" | "next", value: string) {
    setDrafts((prev) => {
      const current = prev[id] ?? { date: "", prev: "", next: "" };
      return { ...prev, [id]: { ...current, [field]: value } };
    });
  }

  async function save(id: string | null) {
    const draft = id ? (drafts[id] ?? { date: "", prev: "", next: "" }) : fresh;
    setStatus("saving");
    setMessage(null);
    const result = await saveMeetingAction({
      id: id ?? undefined,
      semester,
      date: draft.date,
      summaryPrev: draft.prev,
      summaryNext: draft.next,
    });
    if (result.success) {
      const saved = result.data;
      const entry: MeetingRow = {
        id: saved.id,
        sortOrder: saved.sortOrder,
        date: saved.date ?? "",
        summaryPrev: saved.summaryPrev ?? "",
        summaryNext: saved.summaryNext ?? "",
        // Saving clears every signature on the row (fresh countersigns needed).
        studentSign: null,
        guideSign: null,
        externalSignAt: null,
      };
      if (id) {
        patchRow(id, entry);
      } else {
        setEntries((prev) => [...prev, entry]);
        setDrafts((prev) => ({ ...prev, [entry.id]: { date: entry.date, prev: entry.summaryPrev, next: entry.summaryNext } }));
        setAdding(false);
        setFresh({ date: "", prev: "", next: "" });
      }
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function remove(id: string) {
    setStatus("saving");
    setMessage(null);
    const result = await deleteMeetingAction({ id });
    if (result.success) {
      setEntries((prev) => prev.filter((row) => row.id !== id));
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function signStudent(row: MeetingRow) {
    setStatus("saving");
    setMessage(null);
    const result = await signMeetingStudentAction({ id: row.id });
    if (result.success) {
      patchRow(row.id, { studentSign: { name: result.data.name, at: result.data.at } });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function signGuide(row: MeetingRow) {
    setStatus("saving");
    setMessage(null);
    const result = await signMeetingGuideAction({ id: row.id });
    if (result.success) {
      patchRow(row.id, { guideSign: { name: result.data.name, at: result.data.at } });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function recordExternal(row: MeetingRow) {
    setStatus("saving");
    setMessage(null);
    const result = await recordExternalSignAction({ id: row.id });
    if (result.success) {
      patchRow(row.id, { externalSignAt: result.data.at });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  function renderMeetingRows(chunk: MeetingRow[], offset: number) {
    return chunk.map((row, index) => {
      const rowNumber = offset + index + 1;
      const draft = drafts[row.id] ?? { date: row.date, prev: row.summaryPrev, next: row.summaryNext };
      return (
        <PaperRow key={row.id}>
          <PaperTd style={{ textAlign: "center" }}>{rowNumber}</PaperTd>
          <PaperTd>
            <Field
              value={draft.date}
              onValueChange={canWrite ? (value) => setDraft(row.id, "date", value) : undefined}
              readOnly={!canWrite}
              ariaLabel={`Meeting ${rowNumber} date`}
            />
          </PaperTd>
          <PaperTd>
            <Field
              value={draft.prev}
              onValueChange={canWrite ? (value) => setDraft(row.id, "prev", value) : undefined}
              readOnly={!canWrite}
              lines={canWrite ? 3 : Math.max(3, wrapPaperText(draft.prev, 26).length)}
              ariaLabel={`Meeting ${rowNumber} summary since last review`}
            />
          </PaperTd>
          <PaperTd>
            <Field
              value={draft.next}
              onValueChange={canWrite ? (value) => setDraft(row.id, "next", value) : undefined}
              readOnly={!canWrite}
              lines={canWrite ? 3 : Math.max(3, wrapPaperText(draft.next, 26).length)}
              ariaLabel={`Meeting ${rowNumber} summary before next review`}
            />
          </PaperTd>
          <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>
            {row.studentSign ? (
              signedBy(row.studentSign.name, row.studentSign.at)
            ) : canWrite ? (
              <ActionButton onClick={() => void signStudent(row)}>Sign</ActionButton>
            ) : (
              ""
            )}
          </PaperTd>
          <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>
            {row.guideSign ? (
              signedBy(row.guideSign.name, row.guideSign.at)
            ) : canCountersign && row.studentSign ? (
              <ActionButton onClick={() => void signGuide(row)}>Countersign</ActionButton>
            ) : (
              ""
            )}
          </PaperTd>
          <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>
            {row.externalSignAt ? (
              `Signed on ${new Date(row.externalSignAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`
            ) : canWrite ? (
              <ActionButton onClick={() => void recordExternal(row)}>Record</ActionButton>
            ) : (
              ""
            )}
          </PaperTd>
        </PaperRow>
      );
    });
  }

  const screenSheet = (
    <PaperPage flow>
      <div className="paper-title">{title}</div>
      {entries.length === 0 ? (
        <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
          No meetings logged yet.
        </p>
      ) : (
        <PaperTable style={{ marginTop: "10px" }}>
          <PaperBody>
            <PaperRow>
              <PaperTh width="6%">Sr. No</PaperTh>
              <PaperTh width="10%">Date</PaperTh>
              <PaperTh width="23%">Summary of key events since last review</PaperTh>
              <PaperTh width="23%">Summary of key events before next review</PaperTh>
              <PaperTh width="13%">Student sign</PaperTh>
              <PaperTh width="13%">Project Guide signature</PaperTh>
              <PaperTh width="12%">External Guide signature</PaperTh>
            </PaperRow>
            {renderMeetingRows(entries, 0)}
          </PaperBody>
        </PaperTable>
      )}
      {canWrite ? (
        <div className="print-hide" style={{ marginTop: "12px" }}>
          {!adding ? (
            <ActionButton onClick={() => { setAdding(true); setFresh({ date: "", prev: "", next: "" }); }}>
              Add a meeting
            </ActionButton>
          ) : (
            <div style={{ border: "1px solid #000", padding: "8px", maxWidth: "560px" }}>
              <div className="paper-sans" style={{ fontWeight: 700, fontSize: "12px", marginBottom: "6px" }}>
                New meeting
              </div>
              <div style={{ display: "grid", gap: "6px", fontSize: "12px" }}>
                <label>
                  Date{" "}
                  <Field value={fresh.date} onValueChange={(v) => setFresh((f) => ({ ...f, date: v }))} width="200px" ariaLabel="New meeting date" />
                </label>
                <label>
                  Summary since last review
                  <Field value={fresh.prev} onValueChange={(v) => setFresh((f) => ({ ...f, prev: v }))} lines={2} ariaLabel="New meeting summary since last review" />
                </label>
                <label>
                  Summary before next review
                  <Field value={fresh.next} onValueChange={(v) => setFresh((f) => ({ ...f, next: v }))} lines={2} ariaLabel="New meeting summary before next review" />
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <ActionButton onClick={() => void save(null)}>Save meeting</ActionButton>
                  <ActionButton onClick={() => setAdding(false)}>Cancel</ActionButton>
                </div>
              </div>
            </div>
          )}
          {entries.length > 0 ? (
            <p className="paper-serif" style={{ fontSize: "11px", fontStyle: "italic", marginTop: "8px" }}>
              After clicking Save on a meeting, click Sign on its row (and Record for the
              external guide) — the guide can countersign only signed rows.
            </p>
          ) : null}
          {entries.length > 0 ? (
            <p className="paper-serif" style={{ fontSize: "11px", fontStyle: "italic", marginTop: "8px" }}>
              Saving a row also saves its text — editing clears every signature on that row.
            </p>
          ) : null}
        </div>
      ) : null}
      {entries.length > 0 && canWrite ? (
        <div className="print-hide" style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {entries.map((row) => (
            <span key={row.id} style={{ fontSize: "11px", fontFamily: "Arial, Helvetica, sans-serif" }}>
              Row {entries.indexOf(row) + 1}: <ActionButton onClick={() => void save(row.id)}>Save</ActionButton>{" "}
              <ActionButton onClick={() => void remove(row.id)}>Delete</ActionButton>
            </span>
          ))}
        </div>
      ) : null}
    </PaperPage>
  );

  const meetingPages = paginateByWeight(entries, meetingRowWeight, 40);
  const printPages = meetingPages.map((chunk, index, pages) => {
    const start = meetingPages
      .slice(0, index)
      .reduce((sum, page) => sum + page.length, 0);
    return (
      <PaperPage key={index} pageNumber={index + 1} totalPages={pages.length}>
      <div className="paper-title">
        {title}
        {index > 0 ? " (continued)" : ""}
      </div>
      {chunk.length === 0 ? (
        <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
          No meetings logged yet.
        </p>
      ) : (
        <PaperTable style={{ marginTop: "10px" }}>
          <PaperBody>
            <PaperRow>
              <PaperTh width="6%">Sr. No</PaperTh>
              <PaperTh width="10%">Date</PaperTh>
              <PaperTh width="23%">Summary of key events since last review</PaperTh>
              <PaperTh width="23%">Summary of key events before next review</PaperTh>
              <PaperTh width="13%">Student sign</PaperTh>
              <PaperTh width="13%">Project Guide signature</PaperTh>
              <PaperTh width="12%">External Guide signature</PaperTh>
            </PaperRow>
            {renderMeetingRows(chunk, start)}
          </PaperBody>
        </PaperTable>
      )}
      </PaperPage>
    );
  });

  if (print) {
    return <>{printPages}</>;
  }
  const sheet = screenSheet;

  const signed = entries.filter((row) => row.guideSign).length;
  const dot: CompletionDot =
    entries.length > 0 && signed === entries.length ? "full" : signed > 0 ? "half" : "empty";
  return (
    <SheetViewer
      heading={title}
      sections={[{ key: semester.toLowerCase(), label: `${title} (${entries.length})`, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
          Print / PDF
        </a>
      }
    />
  );
}
