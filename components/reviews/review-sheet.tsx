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
import { signedBy } from "@/lib/format";
import {
  approveReviewAction,
  saveReviewDraftAction,
  submitReviewAction,
  unlockReviewAction,
} from "@/lib/actions/review";
import type { ReviewScoreRow } from "@/lib/services/review";

export type ReviewSheetMode = "student" | "guide" | "hod";

export type ReviewSheetScreenProps = {
  groupId: string;
  groupNo: string | null;
  guideName: string | null;
  reviewType: string;
  title: string;
  formStatus: string;
  remarkAndSuggestions: string;
  submittedByName: string | null;
  submittedAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  unlockReason: string;
  scores: ReviewScoreRow[];
  /** Term-II coding / validation / report sheets show a per-row Date column. */
  hasDateColumn: boolean;
  mode: ReviewSheetMode;
  /** False until the group is ACTIVE (or once the PDF is generated). */
  editable: boolean;
  print: boolean;
  /** Where the toolbar "Print / PDF" button points (?print=1). */
  printHref: string;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
};

function ActionButton({
  children,
  onClick,
  primary = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="print-hide"
      style={{
        border: "1px solid #000",
        background: primary ? "#d4d4d4" : "#fff",
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
 * One review sheet (SPEC.md B8 / E5.12). Rows of question / remark / grade /
 * guide sign, then the Remark and Suggestions box and the reviewer signatures.
 * The assigned guide edits the draft; submitting signs every question
 * automatically; the guide or HOD approves; only the HOD unlocks (reason
 * mandatory). Same markup on screen and in print.
 */
export function ReviewSheetScreen({
  groupId,
  groupNo,
  guideName,
  reviewType,
  title,
  formStatus,
  remarkAndSuggestions,
  submittedByName,
  submittedAt,
  approvedByName,
  approvedAt,
  unlockReason,
  scores,
  hasDateColumn,
  mode,
  editable,
  print,
  printHref,
}: ReviewSheetScreenProps) {
  const [rows, setRows] = useState<ReviewScoreRow[]>(scores);
  const [suggestions, setSuggestions] = useState(remarkAndSuggestions);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string>(formStatus);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const draftEditable = mode === "guide" && editable && status === "DRAFT";
  const submittable = mode === "guide" && editable && status === "DRAFT";
  const approvable =
    (mode === "guide" || mode === "hod") && editable && status === "SUBMITTED";
  const unlockable = mode === "hod" && editable && status === "APPROVED";

  function patchRow(questionId: string, next: Partial<ReviewScoreRow>) {
    setRows((prev) => prev.map((row) => (row.questionId === questionId ? { ...row, ...next } : row)));
  }

  function draftPayload() {
    return {
      groupId,
      reviewType,
      remarkAndSuggestions: suggestions,
      scores: rows.map((row) => ({
        questionId: row.questionId,
        remark: row.remark,
        grade: row.grade,
        date: row.date,
      })),
    };
  }

  async function save() {
    setSaveState("saving");
    setMessage(null);
    const result = await saveReviewDraftAction(draftPayload());
    if (result.success) {
      setSaveState("saved");
    } else {
      setSaveState("error");
      setMessage(result.error);
    }
  }

  async function submit() {
    setSaveState("saving");
    setMessage(null);
    const saveResult = await saveReviewDraftAction(draftPayload());
    if (!saveResult.success) {
      setSaveState("error");
      setMessage(saveResult.error);
      return;
    }
    const result = await submitReviewAction({ groupId, reviewType });
    if (result.success) {
      setStatus("SUBMITTED");
      setSaveState("saved");
    } else {
      setSaveState("error");
      setMessage(result.error);
    }
  }

  async function approve() {
    setSaveState("saving");
    setMessage(null);
    const result = await approveReviewAction({ groupId, reviewType });
    if (result.success) {
      setStatus("APPROVED");
      setSaveState("saved");
    } else {
      setSaveState("error");
      setMessage(result.error);
    }
  }

  async function unlock() {
    if (!reason.trim()) {
      setSaveState("error");
      setMessage("A reason is required to unlock approved marks.");
      return;
    }
    setSaveState("saving");
    setMessage(null);
    const result = await unlockReviewAction({ groupId, reviewType, reason });
    if (result.success) {
      setStatus("DRAFT");
      setSaveState("saved");
      setMessage(null);
    } else {
      setSaveState("error");
      setMessage(result.error);
    }
  }

  const sheet = (
    <PaperPage>
      <div className="paper-title">{title}</div>

      <PaperTable style={{ marginTop: "10px" }}>
        <PaperBody>
          <PaperRow>
            <PaperTh width="7%">Sr. No</PaperTh>
            <PaperTh width={hasDateColumn ? "33%" : "43%"}>Question</PaperTh>
            {hasDateColumn ? <PaperTh width="10%">Date</PaperTh> : null}
            <PaperTh width="20%">Remark</PaperTh>
            <PaperTh width="10%">Grade</PaperTh>
            <PaperTh width="20%">Sign of Guide</PaperTh>
          </PaperRow>
          {rows.map((row) => (
            <PaperRow key={row.questionId}>
              <PaperTd style={{ textAlign: "center" }}>{row.questionNo}</PaperTd>
              <PaperTd style={{ fontSize: "11px" }}>{row.text}</PaperTd>
              {hasDateColumn ? (
                <PaperTd>
                  <Field
                    value={row.date}
                    onValueChange={
                      draftEditable
                        ? (value) => patchRow(row.questionId, { date: value })
                        : undefined
                    }
                    readOnly={!draftEditable}
                    ariaLabel={`Question ${row.questionNo} date`}
                  />
                </PaperTd>
              ) : null}
              <PaperTd>
                <Field
                  value={row.remark}
                  onValueChange={
                    draftEditable
                      ? (value) => patchRow(row.questionId, { remark: value })
                      : undefined
                  }
                  readOnly={!draftEditable}
                  ariaLabel={`Question ${row.questionNo} remark`}
                />
              </PaperTd>
              <PaperTd style={{ textAlign: "center" }}>
                <Field
                  value={row.grade}
                  onValueChange={
                    draftEditable
                      ? (value) => patchRow(row.questionId, { grade: value })
                      : undefined
                  }
                  readOnly={!draftEditable}
                  width="100%"
                  ariaLabel={`Question ${row.questionNo} grade`}
                />
              </PaperTd>
              <PaperTd style={{ fontSize: "10px" }}>
                {row.signedAt ? signedBy(row.signedByName ?? guideName, row.signedAt) : ""}
              </PaperTd>
            </PaperRow>
          ))}
        </PaperBody>
      </PaperTable>

      <div style={{ marginTop: "14px" }}>
        <span className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
          Remark and Suggestions
        </span>
        <div style={{ marginTop: "4px" }}>
          <Field
            value={suggestions}
            onValueChange={draftEditable ? setSuggestions : undefined}
            readOnly={!draftEditable}
            lines={3}
            ariaLabel="Remark and suggestions"
          />
        </div>
      </div>

      <div style={{ marginTop: "16px", fontSize: "11px", lineHeight: 1.9 }}>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Name and Sign of Reviewer (Project Guide{guideName ? `: ${guideName}` : ""}):{" "}
          </span>
          {submittedAt ? signedBy(submittedByName ?? guideName, submittedAt) : "________________________"}
        </div>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Approved by:{" "}
          </span>
          {approvedAt ? signedBy(approvedByName, approvedAt) : "________________________"}
        </div>
      </div>

      {unlockReason ? (
        <p className="paper-serif" style={{ marginTop: "10px", fontSize: "11px" }}>
          Last unlocked by the HOD: {unlockReason}
        </p>
      ) : null}

      {unlockable ? (
        <div className="print-hide" style={{ marginTop: "10px" }}>
          <span className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
            Reason for unlocking (mandatory)
          </span>
          <div style={{ marginTop: "4px" }}>
            <Field
              value={reason}
              onValueChange={setReason}
              lines={2}
              ariaLabel="Reason for unlocking"
            />
          </div>
        </div>
      ) : null}

      <div
        className="print-hide"
        style={{
          marginTop: "16px",
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          alignItems: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "12px",
        }}
      >
        <span style={{ fontWeight: 700 }}>Status: {STATUS_LABELS[status] ?? status}</span>
        {draftEditable ? <ActionButton onClick={() => void save()}>Save draft</ActionButton> : null}
        {submittable ? (
          <ActionButton primary onClick={() => void submit()}>
            Submit (signs every question)
          </ActionButton>
        ) : null}
        {approvable ? (
          <ActionButton primary onClick={() => void approve()}>
            Approve
          </ActionButton>
        ) : null}
        {unlockable ? <ActionButton onClick={() => void unlock()}>Unlock to draft</ActionButton> : null}
      </div>

      {(mode === "student" || mode === "hod") && status === "DRAFT" && editable ? (
        <p className="paper-serif print-hide" style={{ fontSize: "11px", fontStyle: "italic" }}>
          Waiting for the assigned guide to fill and submit this review.
        </p>
      ) : null}
      {mode === "hod" && status === "SUBMITTED" ? (
        <p className="paper-serif print-hide" style={{ fontSize: "11px", fontStyle: "italic" }}>
          Submitted by the guide — approve to lock it, or wait for the guide&rsquo;s approval.
        </p>
      ) : null}
    </PaperPage>
  );

  if (print) {
    return <div className="paper-desk">{sheet}</div>;
  }

  const answered = rows.filter((row) => row.remark || row.grade).length;
  const dot: CompletionDot =
    status === "APPROVED" ? "full" : answered > 0 || status === "SUBMITTED" ? "half" : "empty";

  return (
    <SheetViewer
      heading={groupNo ? `${title} · Group ${groupNo}` : title}
      sections={[{ key: reviewType, label: title, dot, content: sheet }]}
      saveStatus={<SaveBadge status={saveState} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href={printHref}
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}
