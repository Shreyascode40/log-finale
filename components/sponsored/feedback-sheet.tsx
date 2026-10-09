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
  TickBox,
} from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import {
  SPONSOR_PARAMETERS,
  SPONSOR_RATINGS,
  SPONSOR_RATING_LABELS,
  type SponsorRating,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { saveSponsorFeedbackAction, uploadSealAction } from "@/lib/actions/sponsored";

export type FeedbackSheetMode = "student" | "guide" | "hod";

export type FeedbackSheetProps = {
  company: string;
  ratings: Record<string, string | null>;
  sealUrl: string | null;
  signedAt: string | null;
  mode: FeedbackSheetMode;
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
 * Sponsor feedback sheet (SPEC.md B13). The 7 parameters rated High / Medium /
 * Low, the sponsored company, and the seal scan carrying the reporting
 * authority's signature. Students file it; everyone else reads.
 */
export function FeedbackSheet({ company, ratings, sealUrl, signedAt, mode, editable, print, printHref }: FeedbackSheetProps) {
  const [firm, setFirm] = useState(company);
  const [marks, setMarks] = useState<Record<string, SponsorRating | null>>(() => {
    const initial: Record<string, SponsorRating | null> = {};
    for (const param of SPONSOR_PARAMETERS) {
      const value = ratings[param.key];
      initial[param.key] =
        value === "HIGH" || value === "MEDIUM" || value === "LOW" ? value : null;
    }
    return initial;
  });
  const [seal, setSeal] = useState<string | null>(sealUrl);
  const [completedAt, setCompletedAt] = useState<string | null>(signedAt);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = mode === "student" && editable;

  function missing(): string[] {
    return SPONSOR_PARAMETERS.filter((param) => !marks[param.key]).map((param) => param.key.toUpperCase());
  }

  async function save() {
    const gaps = missing();
    if (gaps.length > 0) {
      setStatus("error");
      setMessage(`Rate every parameter before saving (missing: ${gaps.join(", ")}).`);
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await saveSponsorFeedbackAction({ company: firm, ratings: marks });
    if (result.success) {
      setCompletedAt(new Date().toISOString());
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
    data.set("file", file);
    const result = await uploadSealAction(data);
    if (result.success) {
      setSeal(result.data);
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const sheet = (
    <PaperPage>
      <div className="paper-title">Sponsored Project Feedback</div>
      <div style={{ margin: "10px 0", fontSize: "12px" }}>
        <span className="paper-sans" style={{ fontWeight: 700 }}>
          Name of sponsored company:{" "}
        </span>
        <Field
          value={firm}
          onValueChange={canEdit ? setFirm : undefined}
          readOnly={!canEdit}
          width="55%"
          ariaLabel="Sponsored company"
        />
      </div>

      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTh width="8%">Sr. No</PaperTh>
            <PaperTh width="53%">Parameter</PaperTh>
            {SPONSOR_RATINGS.map((rating) => (
              <PaperTh key={rating} width="13%">
                {SPONSOR_RATING_LABELS[rating]}
              </PaperTh>
            ))}
          </PaperRow>
          {SPONSOR_PARAMETERS.map((param, index) => (
            <PaperRow key={param.key}>
              <PaperTd style={{ textAlign: "center" }}>{index + 1}</PaperTd>
              <PaperTd style={{ fontSize: "11px" }}>{param.label}</PaperTd>
              {SPONSOR_RATINGS.map((rating) => (
                <PaperTd key={rating} style={{ textAlign: "center" }}>
                  <TickBox
                    checked={marks[param.key] === rating}
                    readOnly={!canEdit}
                    onCheckedChange={
                      canEdit
                        ? () => setMarks((prev) => ({ ...prev, [param.key]: rating }))
                        : undefined
                    }
                    ariaLabel={`${param.label} rated ${SPONSOR_RATING_LABELS[rating]}`}
                  />
                </PaperTd>
              ))}
            </PaperRow>
          ))}
        </PaperBody>
      </PaperTable>

      <div style={{ marginTop: "14px", fontSize: "12px", lineHeight: 2 }}>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Seal and signature of reporting authority:{" "}
          </span>
          {seal ? (
            <a href={seal} target="_blank" rel="noreferrer">
              View scan
            </a>
          ) : (
            <span className="paper-serif" style={{ fontStyle: "italic" }}>not attached</span>
          )}
        </div>
        {seal ? (
          <div style={{ marginTop: "6px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={seal} alt="Sponsor seal and signature" style={{ maxWidth: "220px", border: "1px solid #000" }} />
          </div>
        ) : null}
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Completed on:{" "}
          </span>
          {completedAt ? formatDate(completedAt) : "—"}
        </div>
      </div>

      {canEdit ? (
        <div className="print-hide" style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <ActionButton onClick={() => void save()}>Save feedback</ActionButton>
          <label style={{ fontSize: "12px", fontFamily: "Arial, Helvetica, sans-serif" }}>
            Upload seal scan (JPG/PNG, max 2 MB){" "}
            <input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => void upload(e.target.files?.[0])}
              aria-label="Upload sponsor seal scan"
            />
          </label>
        </div>
      ) : null}
    </PaperPage>
  );

  if (print) {
    return <div className="paper-desk">{sheet}</div>;
  }

  const answered = SPONSOR_PARAMETERS.filter((param) => marks[param.key]).length;
  const dot: CompletionDot =
    answered === SPONSOR_PARAMETERS.length ? "full" : answered > 0 ? "half" : "empty";
  return (
    <SheetViewer
      heading="Sponsor feedback"
      sections={[{ key: "feedback", label: `Feedback (${answered}/7)`, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a className="rounded bg-neutral-900 px-3 py-1 text-white" href={printHref} target="_blank" rel="noreferrer">
          Print / PDF
        </a>
      }
    />
  );
}
