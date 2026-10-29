"use client";

import { useState, type ReactNode } from "react";
import { Field, PaperPage } from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { chunkArray, wrapPaperText } from "@/lib/paper/pagination";
import { deleteNoteAction, saveNoteAction } from "@/lib/actions/records";

export type NoteEntry = {
  id: string;
  text: string;
};

export type NotesSheetProps = {
  notes: NoteEntry[];
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

type NoteBlock = {
  key: string;
  label: string;
  lines: string[];
};

/** Split long notes into repeated six-line blocks, then group blocks by page. */
function paginateNotes(rows: NoteEntry[], drafts: Record<string, string>): NoteBlock[][] {
  const blocks = rows.flatMap((row, index) => {
    const wrapped = wrapPaperText(drafts[row.id] ?? row.text);
    return chunkArray(wrapped, 6).map((lines, part) => ({
      key: `${row.id}-${part}`,
      label: `Note ${index + 1}${part > 0 ? " (continued)" : ""}`,
      lines,
    }));
  });

  const pages: NoteBlock[][] = [];
  let page: NoteBlock[] = [];
  let used = 0;
  const pageLines = 28;

  for (const block of blocks) {
    const cost = block.lines.length + 2;
    if (page.length > 0 && used + cost > pageLines) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(block);
    used += cost;
  }
  if (page.length > 0) pages.push(page);
  return pages.length > 0 ? pages : [[]];
}

/**
 * Notes sheet (SPEC.md B14). Free text entries; students add, edit and delete
 * their own group's notes. Long notes continue on numbered sheets with the
 * college header repeated.
 */
export function NotesSheet({ notes, editable, print, printHref }: NotesSheetProps) {
  const [rows, setRows] = useState<NoteEntry[]>(notes);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(notes.map((note) => [note.id, note.text])),
  );
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save(id: string) {
    const text = (drafts[id] ?? "").trim();
    if (!text) {
      setStatus("error");
      setMessage("Write the note first.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await saveNoteAction({ id, text });
    if (result.success) {
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, text } : row)));
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function add() {
    const text = newText.trim();
    if (!text) {
      setStatus("error");
      setMessage("Write the note first.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await saveNoteAction({ text });
    if (result.success) {
      const saved = result.data;
      setRows((prev) => [...prev, { id: saved.id, text: saved.richText ?? text }]);
      setDrafts((prev) => ({ ...prev, [saved.id]: saved.richText ?? text }));
      setNewText("");
      setAdding(false);
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function remove(id: string) {
    setStatus("saving");
    setMessage(null);
    const result = await deleteNoteAction({ id });
    if (result.success) {
      setRows((prev) => prev.filter((row) => row.id !== id));
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const screenSheet = (
    <PaperPage flow>
      <div className="paper-title">Notes</div>
      {rows.length === 0 ? (
        <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
          No notes yet.
        </p>
      ) : (
        rows.map((row, index) => (
          <div key={row.id} style={{ marginTop: "12px" }}>
            <div className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
              Note {index + 1}
              {editable ? (
                <span className="print-hide" style={{ marginLeft: "8px", fontWeight: 400 }}>
                  <ActionButton onClick={() => void save(row.id)}>Save</ActionButton>{" "}
                  <ActionButton onClick={() => void remove(row.id)}>Delete</ActionButton>
                </span>
              ) : null}
            </div>
            <div style={{ marginTop: "4px" }}>
              <Field
                value={drafts[row.id] ?? ""}
                onValueChange={
                  editable
                    ? (value) => setDrafts((prev) => ({ ...prev, [row.id]: value }))
                    : undefined
                }
                readOnly={!editable}
                lines={6}
                ariaLabel={`Note ${index + 1}`}
              />
            </div>
          </div>
        ))
      )}
      {editable && !print ? (
        <div className="print-hide" style={{ marginTop: "14px" }}>
          {adding ? (
            <div>
              <Field value={newText} onValueChange={setNewText} lines={4} ariaLabel="New note" />
              <div style={{ marginTop: "6px", display: "flex", gap: "8px" }}>
                <ActionButton onClick={() => void add()}>Add note</ActionButton>
                <ActionButton
                  onClick={() => {
                    setAdding(false);
                    setNewText("");
                  }}
                >
                  Cancel
                </ActionButton>
              </div>
            </div>
          ) : (
            <ActionButton onClick={() => setAdding(true)}>Add a note</ActionButton>
          )}
        </div>
      ) : null}
    </PaperPage>
  );

  const printPages = paginateNotes(rows, drafts).map((blocks, index, pages) => (
    <PaperPage key={index} pageNumber={index + 1} totalPages={pages.length}>
      <div className="paper-title">
        Notes
        {index > 0 ? " (continued)" : ""}
      </div>
      {blocks.length === 0 ? (
        <p className="paper-serif" style={{ marginTop: "12px", fontStyle: "italic" }}>
          No notes yet.
        </p>
      ) : (
        blocks.map((block) => (
          <div key={block.key} style={{ marginTop: "12px" }}>
            <div className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
              {block.label}
            </div>
            <div style={{ marginTop: "4px" }}>
              <Field
                value={block.lines.join("\n")}
                readOnly
                lines={Math.max(block.lines.length, 1)}
                ariaLabel={block.label}
              />
            </div>
          </div>
        ))
      )}
    </PaperPage>
  ));

  if (print) {
    return <>{printPages}</>;
  }
  const sheet = screenSheet;

  const dot: CompletionDot = rows.length > 0 ? "half" : "empty";
  return (
    <SheetViewer
      heading="Notes"
      sections={[{ key: "notes", label: `Notes (${rows.length})`, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
          Print / PDF
        </a>
      }
    />
  );
}
