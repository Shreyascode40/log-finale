"use client";

import { useEffect, useRef, useState } from "react";
import {
  Field,
  PaperBody,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
} from "@/components/paper";
import { SheetViewer } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { updateMemberAction, uploadMemberPhotoAction } from "@/lib/actions/group-info";

export type MemberRow = {
  id: string;
  placeholder: boolean;
  name: string;
  teResult: string;
  rollNo: string;
  examSeatNo: string;
  mobile: string;
  email: string;
  contribution: string;
  photoUrl: string;
};

export type MembersSheetScreenProps = {
  initial: MemberRow[]; // always 4 slots, padded with placeholders
  editable: boolean;
  print: boolean;
};

/**
 * The Project Group Information sheets (SPEC.md E5.3–4 / B3): Members 1–2 on the
 * first sheet, Members 3–4 on the second. Members autosave their text; the photo
 * box uploads a JPG/PNG up to 2 MB.
 */
export function MembersSheetScreen({ initial, editable, print }: MembersSheetScreenProps) {
  const [rows, setRows] = useState<MemberRow[]>(initial);
  const [dirty, setDirty] = useState<string[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function edit(id: string, patch: Partial<MemberRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setDirty((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  useEffect(() => {
    if (!editable || dirty.length === 0) return;
    const timer = setTimeout(async () => {
      setStatus("saving");
      let failed: string | null = null;
      for (const id of dirty) {
        const row = rows.find((r) => r.id === id);
        if (!row || row.placeholder) continue;
        const result = await updateMemberAction({
          memberId: row.id,
          name: row.name,
          teResult: row.teResult,
          rollNo: row.rollNo,
          examSeatNo: row.examSeatNo,
          mobile: row.mobile,
          email: row.email,
          contribution: row.contribution,
        });
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
  }, [rows, dirty, editable]);

  async function uploadPhoto(id: string, file: File) {
    const formData = new FormData();
    formData.set("memberId", id);
    formData.set("file", file);
    setStatus("saving");
    const result = await uploadMemberPhotoAction(formData);
    if (result.success) {
      setRows((prev) => prev.map((row) => (row.id === id ? { ...row, photoUrl: result.data.url } : row)));
      setStatus("saved");
      setMessage(null);
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const sheets = [0, 1].map((pair) => (
    <PaperPage key={pair} pageNumber={pair + 1} totalPages={2}>
      <div className="paper-title">Project Group Information</div>
      <MemberBlock
        index={pair * 2 + 1}
        row={rows[pair * 2]}
        editable={editable}
        onEdit={edit}
        onUpload={uploadPhoto}
      />
      <MemberBlock
        index={pair * 2 + 2}
        row={rows[pair * 2 + 1]}
        editable={editable}
        onEdit={edit}
        onUpload={uploadPhoto}
      />
    </PaperPage>
  ));

  if (print) {
    return <div className="paper-desk">{sheets}</div>;
  }

  const sections = sheets.map((content, i) => ({
    key: `members-${i}`,
    label: `Group Information (${i * 2 + 1}–${i * 2 + 2})`,
    dot: membersDot(rows, i),
    content,
  }));

  return (
    <SheetViewer
      heading="Group Information"
      sections={sections}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="/student/members?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}

function MemberBlock({
  index,
  row,
  editable,
  onEdit,
  onUpload,
}: {
  index: number;
  row: MemberRow;
  editable: boolean;
  onEdit: (id: string, patch: Partial<MemberRow>) => void;
  onUpload: (id: string, file: File) => void;
}) {
  const canEdit = editable && !row.placeholder;
  const set = (patch: Partial<MemberRow>) => onEdit(row.id, patch);

  return (
    <div style={{ marginBottom: "16px" }}>
      <div className="paper-subtitle" style={{ textAlign: "left" }}>
        Member {index}
      </div>
      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTd width="22%">Name</PaperTd>
            <PaperTd>
              <Field
                value={row.name}
                onValueChange={(v) => set({ name: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.name}
                ariaLabel={`Member ${index} name`}
              />
            </PaperTd>
            <PaperTd rowSpan={6} width="26%" style={{ textAlign: "center", verticalAlign: "middle" }}>
              <PhotoBox index={index} row={row} canEdit={canEdit} onUpload={onUpload} />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>TE Result</PaperTd>
            <PaperTd>
              <Field
                value={row.teResult}
                onValueChange={(v) => set({ teResult: v })}
                readOnly={!canEdit}
                ariaLabel={`Member ${index} TE result`}
              />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>Roll No</PaperTd>
            <PaperTd>
              <Field
                value={row.rollNo}
                onValueChange={(v) => set({ rollNo: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.rollNo}
                ariaLabel={`Member ${index} roll number`}
              />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>Mobile No</PaperTd>
            <PaperTd>
              <Field
                value={row.mobile}
                onValueChange={(v) => set({ mobile: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.mobile}
                ariaLabel={`Member ${index} mobile`}
              />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>Exam Seat No</PaperTd>
            <PaperTd>
              <Field
                value={row.examSeatNo}
                onValueChange={(v) => set({ examSeatNo: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.examSeatNo}
                ariaLabel={`Member ${index} exam seat number`}
              />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>Email ID</PaperTd>
            <PaperTd>
              <Field
                value={row.email}
                onValueChange={(v) => set({ email: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.email}
                ariaLabel={`Member ${index} email`}
              />
            </PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>Contribution</PaperTd>
            <PaperTd colSpan={2}>
              <Field
                value={row.contribution}
                onValueChange={(v) => set({ contribution: v })}
                readOnly={!canEdit}
                missing={canEdit && !row.contribution}
                lines={2}
                ariaLabel={`Member ${index} contribution`}
              />
            </PaperTd>
          </PaperRow>
        </PaperBody>
      </PaperTable>
    </div>
  );
}

function PhotoBox({
  index,
  row,
  canEdit,
  onUpload,
}: {
  index: number;
  row: MemberRow;
  canEdit: boolean;
  onUpload: (id: string, file: File) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (row.placeholder) {
    return <span style={{ color: "#888" }}>—</span>;
  }

  if (row.photoUrl) {
    return (
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={row.photoUrl}
          alt={`Member ${index} photo`}
          style={{ maxWidth: "100%", maxHeight: "150px" }}
        />
        {canEdit ? (
          <button
            type="button"
            className="paper-sans"
            style={{ display: "block", margin: "4px auto 0", fontSize: "10px", textDecoration: "underline" }}
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "Uploading…" : "Replace"}
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={handleFile}
        />
      </div>
    );
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    onUpload(row.id, file);
    setBusy(false);
  }

  return (
    <div
      className="paper-photo-box"
      style={{ cursor: canEdit ? "pointer" : "default" }}
      onClick={() => canEdit && inputRef.current?.click()}
    >
      {busy ? "Uploading…" : "Affix your photo here"}
      {canEdit ? (
        <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden onChange={handleFile} />
      ) : null}
    </div>
  );
}

function membersDot(rows: MemberRow[], pair: number): "empty" | "half" | "full" {
  const slice = [rows[pair * 2], rows[pair * 2 + 1]].filter((row) => row && !row.placeholder);
  if (slice.length === 0) return "empty";
  const complete = slice.filter((row) => row.name && row.rollNo && row.photoUrl).length;
  if (complete === slice.length && slice.length === 2) return "full";
  return complete > 0 ? "half" : "empty";
}
