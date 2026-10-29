"use client";

import { useState, type ReactNode } from "react";
import {
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
import {
  deletePaperAction,
  savePaperAction,
  uploadPaperFileAction,
} from "@/lib/actions/records";

export type PaperEntry = {
  id: string;
  title: string;
  conference: string | null;
  issn: string | null;
  volIssue: string | null;
  pageNo: string | null;
  fileUrl: string | null;
};

export type PaperSheetProps = {
  entries: PaperEntry[];
  editable: boolean;
  print: boolean;
  printHref: string;
};

const EMPTY = { title: "", conference: "", issn: "", volIssue: "", pageNo: "" };

function paperRowWeight(row: PaperEntry): number {
  return (
    Math.max(
      wrapPaperText(row.title, 28).length,
      wrapPaperText(row.conference ?? "", 24).length,
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
 * Paper Publication / Presentation sheet (SPEC.md B12). One row per paper:
 * title, conference, ISSN, volume/issue, page number and the uploaded paper
 * file. Students add, edit, delete and upload; everyone else reads.
 */
export function PaperSheet({ entries, editable, print, printHref }: PaperSheetProps) {
  const [rows, setRows] = useState<PaperEntry[]>(entries);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setEditingId("new");
    setForm(EMPTY);
  }

  function startEdit(row: PaperEntry) {
    setEditingId(row.id);
    setForm({
      title: row.title,
      conference: row.conference ?? "",
      issn: row.issn ?? "",
      volIssue: row.volIssue ?? "",
      pageNo: row.pageNo ?? "",
    });
  }

  async function save() {
    if (!form.title.trim()) {
      setStatus("error");
      setMessage("Enter the paper title.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await savePaperAction({
      id: editingId === "new" ? undefined : (editingId ?? undefined),
      title: form.title,
      conference: form.conference,
      issn: form.issn,
      volIssue: form.volIssue,
      pageNo: form.pageNo,
    });
    if (result.success) {
      const saved = result.data;
      const entry: PaperEntry = {
        id: saved.id,
        title: saved.title,
        conference: saved.conference,
        issn: saved.issn,
        volIssue: saved.volIssue,
        pageNo: saved.pageNo,
        fileUrl: saved.fileUrl,
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
    const result = await deletePaperAction({ id });
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
    const result = await uploadPaperFileAction(data);
    if (result.success) {
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, fileUrl: result.data } : row)));
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
          <div className="font-medium">{editingId === "new" ? "Add a paper" : "Edit the paper"}</div>
          <label className="grid gap-1">
            Title of Paper
            <input className="rounded border px-2 py-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </label>
          <label className="grid gap-1">
            Name of Conference
            <input className="rounded border px-2 py-1" value={form.conference} onChange={(e) => setForm((f) => ({ ...f, conference: e.target.value }))} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="grid gap-1">
              ISSN No
              <input className="rounded border px-2 py-1" value={form.issn} onChange={(e) => setForm((f) => ({ ...f, issn: e.target.value }))} />
            </label>
            <label className="grid gap-1">
              Vol No and issue
              <input className="rounded border px-2 py-1" value={form.volIssue} onChange={(e) => setForm((f) => ({ ...f, volIssue: e.target.value }))} />
            </label>
            <label className="grid gap-1">
              Page no
              <input className="rounded border px-2 py-1" value={form.pageNo} onChange={(e) => setForm((f) => ({ ...f, pageNo: e.target.value }))} />
            </label>
          </div>
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
          Add a paper
        </button>
      )}
    </div>
  ) : null;

  const rowPages = paginateByWeight(rows, paperRowWeight, 40);
  const pages = rowPages.map((chunk, pageIndex) => {
    const start = rowPages
      .slice(0, pageIndex)
      .reduce((sum, page) => sum + page.length, 0);
    return (
      <PaperPage key={pageIndex} pageNumber={pageIndex + 1} totalPages={rowPages.length}>
        <div className="paper-title">
          Paper Publication / Presentation
          {pageIndex > 0 ? " (continued)" : ""}
        </div>
        {chunk.length === 0 ? (
          <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
            No papers yet. At least one technical paper is required.
          </p>
        ) : (
          <PaperTable style={{ marginTop: "10px" }}>
            <PaperBody>
              <PaperRow>
                <PaperTh width="6%">Sr. No</PaperTh>
                <PaperTh width="26%">Title of Paper</PaperTh>
                <PaperTh width="20%">Name of Conference</PaperTh>
                <PaperTh width="12%">ISSN No</PaperTh>
                <PaperTh width="12%">Vol No and issue</PaperTh>
                <PaperTh width="10%">Page no</PaperTh>
                <PaperTh width="14%">Paper file</PaperTh>
              </PaperRow>
              {chunk.map((row, index) => (
                <PaperRow key={row.id}>
                  <PaperTd style={{ textAlign: "center" }}>{start + index + 1}</PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.title}</PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.conference ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "11px", textAlign: "center" }}>{row.issn ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "11px", textAlign: "center" }}>{row.volIssue ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "11px", textAlign: "center" }}>{row.pageNo ?? ""}</PaperTd>
                  <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>
                    {row.fileUrl ? (
                      <a href={row.fileUrl} target="_blank" rel="noreferrer">
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
                            aria-label={`Upload paper file for ${row.title}`}
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
        heading="Paper publication"
        sections={pages.map((content, index) => ({
          key: `papers-${index}`,
          label:
            pages.length > 1
              ? `Papers (${index + 1}/${pages.length})`
              : `Papers (${rows.length})`,
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
