"use client";

import { useState, type ReactNode } from "react";
import { Field, PaperPage } from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { splitTextPages } from "@/lib/paper/pagination";
import { saveContentAction, uploadContentFileAction } from "@/lib/actions/records";

export type ContentSheetProps = {
  pageType: "RTM" | "COST";
  title: string;
  richText: string;
  fileUrl: string | null;
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
        background: "#d4d4d4",
        color: "#000",
        padding: "3px 12px",
        fontSize: "12px",
        fontFamily: "Arial, Helvetica, sans-serif",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

/**
 * A free content page (SPEC.md B7 pages): Requirement Traceability Matrix or
 * Project Cost Estimation. Students type rich text and/or attach a file that
 * fills the sheet. Content or file present counts as complete (A5).
 */
export function ContentSheet({ pageType, title, richText, fileUrl, editable, print, printHref }: ContentSheetProps) {
  const [text, setText] = useState(richText);
  const [url, setUrl] = useState<string | null>(fileUrl);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    setStatus("saving");
    setMessage(null);
    const result = await saveContentAction({ type: pageType, richText: text });
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    setStatus("saving");
    setMessage(null);
    const data = new FormData();
    data.set("type", pageType);
    data.set("file", file);
    const result = await uploadContentFileAction(data);
    if (result.success) {
      setUrl(result.data);
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const screenSheet = (
    <PaperPage flow>
      <div className="paper-title">{title}</div>
      <div style={{ marginTop: "10px" }}>
        <Field
          value={text}
          onValueChange={editable ? setText : undefined}
          readOnly={!editable}
          lines={text ? Math.min(4 + text.split("\n").length, 40) : 16}
          ariaLabel={title}
        />
      </div>
      <div style={{ marginTop: "14px", fontSize: "12px" }}>
        <span className="paper-sans" style={{ fontWeight: 700 }}>
          Attached file:{" "}
        </span>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer">
            View
          </a>
        ) : (
          <span className="paper-serif" style={{ fontStyle: "italic" }}>none</span>
        )}
      </div>
      {editable ? (
        <div className="print-hide" style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <ActionButton onClick={() => void save()}>Save page</ActionButton>
          <label style={{ fontSize: "12px", fontFamily: "Arial, Helvetica, sans-serif" }}>
            Attach file{" "}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => void upload(e.target.files?.[0])}
              aria-label={`Attach a file to ${title}`}
            />
          </label>
        </div>
      ) : null}
    </PaperPage>
  );

  const printPages = splitTextPages(text).map((lines, index, pages) => (
    <PaperPage key={index} pageNumber={index + 1} totalPages={pages.length}>
      <div className="paper-title">
        {title}
        {index > 0 ? " (continued)" : ""}
      </div>
      <div style={{ marginTop: "10px" }}>
        <Field
          value={lines.join("\n")}
          readOnly
          lines={Math.max(lines.length, 8)}
          ariaLabel={`${title}${index > 0 ? ` page ${index + 1}` : ""}`}
        />
      </div>
      {index === pages.length - 1 ? (
        <div style={{ marginTop: "14px", fontSize: "12px" }}>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Attached file:{" "}
          </span>
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              View
            </a>
          ) : (
            <span className="paper-serif" style={{ fontStyle: "italic" }}>none</span>
          )}
        </div>
      ) : null}
    </PaperPage>
  ));

  if (print) {
    return <>{printPages}</>;
  }
  const sheet = screenSheet;

  const dot: CompletionDot = text.trim() || url ? "full" : "empty";
  return (
    <SheetViewer
      heading={title}
      sections={[{ key: pageType.toLowerCase(), label: title, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
          Print / PDF
        </a>
      }
    />
  );
}
