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
import { EXAMINER_QUESTIONS, EXAMINER_RATINGS, type ExaminerRating } from "@/lib/constants";
import { signedBy } from "@/lib/format";
import { saveExaminerFeedbackAction } from "@/lib/actions/examiner";

export type ExaminerSheetMode = "student" | "guide" | "hod";

export type ExaminerSheetScreenProps = {
  groupId: string;
  groupNo: string | null;
  term: string;
  termLabel: string;
  projectTitle: string;
  date: string;
  answers: (ExaminerRating | null)[];
  remarks: string;
  externalName: string;
  internalName: string | null;
  signedAt: string | null;
  mode: ExaminerSheetMode;
  /** False until the group is ACTIVE (or once the PDF is generated). */
  editable: boolean;
  print: boolean;
  /** Where the toolbar "Print / PDF" button points (?print=1). */
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
 * External Examiner Feedback sheet (SPEC.md B10 / E5.15). Project title, date,
 * the 9 questions each rated Excellent / Good / Satisfactory, remarks, and the
 * external + internal signatures. The assigned guide transcribes the external
 * examiner's ratings; everyone else sees it read-only.
 */
export function ExaminerSheetScreen({
  groupId,
  term,
  termLabel,
  projectTitle,
  date,
  answers,
  remarks,
  externalName,
  internalName,
  signedAt,
  mode,
  editable,
  print,
  printHref,
}: ExaminerSheetScreenProps) {
  const [title, setTitle] = useState(projectTitle);
  const [day, setDay] = useState(date);
  const [ratings, setRatings] = useState<(ExaminerRating | null)[]>(answers);
  const [note, setNote] = useState(remarks);
  const [external, setExternal] = useState(externalName);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const canEdit = mode === "guide" && editable;

  function missing(): string[] {
    const gaps: string[] = [];
    ratings.forEach((rating, index) => {
      if (!rating) gaps.push(`Q${index + 1}`);
    });
    return gaps;
  }

  async function save() {
    const gaps = missing();
    if (gaps.length > 0) {
      setStatus("error");
      setMessage(`Rate every question before saving (missing: ${gaps.join(", ")}).`);
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await saveExaminerFeedbackAction({
      groupId,
      term,
      projectTitle: title,
      date: day,
      answers: ratings,
      remarks: note,
      externalName: external,
    });
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const sheet = (
    <PaperPage>
      <div className="paper-title">External Examiner Feedback ({termLabel})</div>

      <div style={{ margin: "10px 0", fontSize: "12px", lineHeight: 2 }}>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Project Title:{" "}
          </span>
          <Field
            value={title}
            onValueChange={canEdit ? setTitle : undefined}
            readOnly={!canEdit}
            width="70%"
            ariaLabel="Project title"
          />
        </div>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Date:{" "}
          </span>
          <Field
            value={day}
            onValueChange={canEdit ? setDay : undefined}
            readOnly={!canEdit}
            width="40%"
            ariaLabel="Feedback date"
          />
        </div>
      </div>

      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTh width="7%">Q. No</PaperTh>
            <PaperTh width="53%">Question</PaperTh>
            {EXAMINER_RATINGS.map((rating) => (
              <PaperTh key={rating} width="13%">
                {rating}
              </PaperTh>
            ))}
          </PaperRow>
          {EXAMINER_QUESTIONS.map((question, index) => (
            <PaperRow key={index}>
              <PaperTd style={{ textAlign: "center" }}>{index + 1}</PaperTd>
              <PaperTd style={{ fontSize: "11px" }}>{question}</PaperTd>
              {EXAMINER_RATINGS.map((rating) => (
                <PaperTd key={rating} style={{ textAlign: "center" }}>
                  <TickBox
                    checked={ratings[index] === rating}
                    readOnly={!canEdit}
                    onCheckedChange={
                      canEdit
                        ? () =>
                            setRatings((prev) => {
                              const next = [...prev];
                              next[index] = rating;
                              return next;
                            })
                        : undefined
                    }
                    ariaLabel={`Question ${index + 1} rated ${rating}`}
                  />
                </PaperTd>
              ))}
            </PaperRow>
          ))}
        </PaperBody>
      </PaperTable>

      <div style={{ marginTop: "14px" }}>
        <span className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
          Remarks
        </span>
        <div style={{ marginTop: "4px" }}>
          <Field
            value={note}
            onValueChange={canEdit ? setNote : undefined}
            readOnly={!canEdit}
            lines={3}
            ariaLabel="Remarks"
          />
        </div>
        <div style={{ marginTop: "8px", fontSize: "12px" }}>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Name of External Examiner:{" "}
          </span>
          <Field
            value={external}
            onValueChange={canEdit ? setExternal : undefined}
            readOnly={!canEdit}
            width="50%"
            ariaLabel="External examiner name"
          />
        </div>
      </div>

      <div style={{ marginTop: "16px", fontSize: "11px", lineHeight: 1.9 }}>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Signature (External):{" "}
          </span>
          {external || "________________________"}
        </div>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Signature (Internal):{" "}
          </span>
          {signedAt ? signedBy(internalName, signedAt) : "________________________"}
        </div>
      </div>

      {canEdit ? (
        <div
          className="print-hide"
          style={{ marginTop: "16px", display: "flex", gap: "8px", alignItems: "center" }}
        >
          <ActionButton onClick={() => void save()}>Save feedback</ActionButton>
          <span className="paper-sans" style={{ fontSize: "11px", fontStyle: "italic" }}>
            Rate all 9 questions, then save.
          </span>
        </div>
      ) : null}
    </PaperPage>
  );

  if (print) {
    return <>{sheet}</>;
  }

  const answered = ratings.filter(Boolean).length;
  const dot: CompletionDot =
    answered === EXAMINER_QUESTIONS.length ? "full" : answered > 0 ? "half" : "empty";

  return (
    <SheetViewer
      heading={`External Examiner Feedback (${termLabel})`}
      sections={[{ key: "examiner", label: `Feedback (${termLabel})`, dot, content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
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
