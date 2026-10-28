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
import { COMPETITION_TYPE_LABELS, type CompetitionType } from "@/lib/constants";
import {
  deleteCompetitionAction,
  saveCompetitionAction,
  uploadCertificateAction,
} from "@/lib/actions/records";

export type CompetitionEntry = {
  id: string;
  name: string;
  date: string | null;
  collegeAndLevel: string | null;
  type: string | null;
  award: string | null;
  certificateUrl: string | null;
};

export type CompetitionSheetProps = {
  entries: CompetitionEntry[];
  editable: boolean;
  print: boolean;
  printHref: string;
};

const EMPTY = { name: "", date: "", collegeAndLevel: "", type: "", award: "" };

function competitionRowWeight(row: CompetitionEntry): number {
  return (
    Math.max(
      wrapPaperText(row.name, 24).length,
      wrapPaperText(row.collegeAndLevel ?? "", 24).length,
      wrapPaperText(row.award ?? "", 16).length,
      2,
    ) + 1
  );
}

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

/**
 * Competition participation sheet (SPEC.md B12). One row per competition:
 * name, date, college and level, type, award/participation and the uploaded
 * certificate. Students add, edit, delete and upload; everyone else reads.
 */
export function CompetitionSheet({ entries, editable, print, printHref }: CompetitionSheetProps) {
  const [rows, setRows] = useState<CompetitionEntry[]>(entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setEditingId("new");
    setForm(EMPTY);
  }

  function startEdit(row: CompetitionEntry) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      date: row.date ?? "",
      collegeAndLevel: row.collegeAndLevel ?? "",
      type: row.type ?? "",
      award: row.award ?? "",
    });
  }

  async function save() {
    if (!form.name.trim()) {
      setStatus("error");
      setMessage("Enter the competition name.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await saveCompetitionAction({
      id: editingId === "new" ? undefined : (editingId ?? undefined),
      name: form.name,
      date: form.date,
      collegeAndLevel: form.collegeAndLevel,
      type: form.type || null,
      award: form.award,
    });
    if (result.success) {
      const saved = result.data;
      const entry: CompetitionEntry = {
        id: saved.id,
        name: saved.name,
        date: saved.date,
        collegeAndLevel: saved.collegeAndLevel,
        type: saved.type,
        award: saved.award,
        certificateUrl: saved.certificateUrl,
      };
      setRows((prev) =>
        editingId === "new" ? [...prev, entry] : prev.map((row) => (row.id === entry.id ? { ...row, ...entry } : row)),
      );
      setStatus("saved");
      setEditingId(null);
      setForm(EMPTY);
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function remove(id: string) {
    setStatus("saving");
    setMessage(null);
    const result = await deleteCompetitionAction({ id });
    if (result.success) {
      setRows((prev) => prev.filter((row) => row.id !== id));
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function upload(id: string, file: File | undefined) {
    if (!file) return;
    setStatus("saving");
    setMessage(null);
    const data = new FormData();
    data.set("id", id);
    data.set("file", file);
    const result = await uploadCertificateAction(data);
    if (result.success) {
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, certificateUrl: result.data } : row)));
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const formPane = editable ? (
    <div className="print-hide mx-auto mb-3 max-w-[794px] rounded border bg-white p-3 text-sm">
      {editingId ? (
        <div className="grid gap-2">
          <div className="font-medium">{editingId === "new" ? "Add a competition" : "Edit the competition"}</div>
          <label className="grid gap-1">
            Name of Project Competition
            <input className="rounded border px-2 py-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              Date
              <input className="rounded border px-2 py-1" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </label>
            <label className="grid gap-1">
              Type of participation
              <select className="rounded border px-2 py-1" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="">—</option>
                {(Object.keys(COMPETITION_TYPE_LABELS) as CompetitionType[]).map((key) => (
                  <option key={key} value={key}>
                    {COMPETITION_TYPE_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="grid gap-1">
            Name of College and level
            <input className="rounded border px-2 py-1" value={form.collegeAndLevel} onChange={(e) => setForm((f) => ({ ...f, collegeAndLevel: e.target.value }))} />
          </label>
          <label className="grid gap-1">
            Award / Participation
            <input className="rounded border px-2 py-1" value={form.award} onChange={(e) => setForm((f) => ({ ...f, award: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button type="button" className="rounded bg-neutral-900 px-3 py-1 text-white" onClick={() => void save()}>
              Save
            </button>
            <button type="button" className="rounded border px-3 py-1" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="rounded border px-3 py-1" onClick={startAdd}>
          Add a competition
        </button>
      )}
    </div>
  ) : null;

  const rowPages = paginateByWeight(rows, competitionRowWeight, 40);
  const pages = rowPages.map((chunk, pageIndex) => {
    const start = rowPages
      .slice(0, pageIndex)
      .reduce((sum, page) => sum + page.length, 0);
    return (
      <PaperPage key={pageIndex} pageNumber={pageIndex + 1} totalPages={rowPages.length}>
        <div className="paper-title">
          Participation in Project Competition
          {pageIndex > 0 ? " (continued)" : ""}
        </div>
        {chunk.length === 0 ? (
          <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
            No competition entries yet. At least one is required for final-exam eligibility.
          </p>
        ) : (
          <PaperTable style={{ marginTop: "10px" }}>
            <PaperBody>
              <PaperRow>
                <PaperTh width="6%">Sr. No</PaperTh>
                <PaperTh width="24%">Name of Project Competition</PaperTh>
                <PaperTh width="10%">Date</PaperTh>
                <PaperTh width="20%">Name of College and level</PaperTh>
                <PaperTh width="13%">Type</PaperTh>
                <PaperTh width="13%">Award / Participation</PaperTh>
                <PaperTh width="14%">Certificate</PaperTh>
              </PaperRow>
              {chunk.map((row, index) => (
                <PaperRow key={row.id}>
                  <PaperTd style={{ textAlign: "center" }}>{start + index + 1}</PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.name}</PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.date ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.collegeAndLevel ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "11px", textAlign: "center" }}>
                    {row.type ? (COMPETITION_TYPE_LABELS[row.type as CompetitionType] ?? row.type) : ""}
                  </PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.award ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>
                    {row.certificateUrl ? (
                      <a href={row.certificateUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                    {editable ? (
                      <span className="print-hide" style={{ display: "block", marginTop: "4px" }}>
                        <label style={{ display: "block", marginBottom: "4px" }}>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ fontSize: "10px", maxWidth: "110px" }}
                            onChange={(e) => void upload(row.id, e.target.files?.[0])}
                            aria-label={`Upload certificate for ${row.name}`}
                          />
                        </label>
                        <ActionButton onClick={() => startEdit(row)}>Edit</ActionButton>{" "}
                        <ActionButton onClick={() => void remove(row.id)}>Delete</ActionButton>
                      </span>
                    ) : null}
                  </PaperTd>
                </PaperRow>
              ))}
            </PaperBody>
          </PaperTable>
        )}
      </PaperPage>
    );
  });

  if (print) {
    return <>{pages}</>;
  }

  const dot: CompletionDot = rows.length > 0 ? "full" : "empty";
  return (
    <>
      {formPane}
      <SheetViewer
        heading="Competition participation"
        sections={pages.map((content, index) => ({
          key: `competitions-${index}`,
          label:
            pages.length > 1
              ? `Competitions (${index + 1}/${pages.length})`
              : `Competitions (${rows.length})`,
          dot,
          content,
        }))}
        saveStatus={<SaveBadge status={status} message={message} />}
        pdfButton={
          <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
            Print / PDF
          </a>
        }
      />
    </>
  );
}
