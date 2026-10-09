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
import { ACTIVITY_MONTH_LABELS } from "@/lib/constants";
import { signedBy } from "@/lib/format";
import { confirmEntryAction, verifyEntryAction } from "@/lib/actions/activity-chart";
import type { ChartEntry } from "@/lib/services/activity-chart";

export type ActivityChartMode = "student" | "guide" | "hod";

export type ActivityChartScreenProps = {
  groupId: string;
  groupNo: string | null;
  guideName: string | null;
  month: keyof typeof ACTIVITY_MONTH_LABELS;
  entries: ChartEntry[];
  mode: ActivityChartMode;
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

function entryDot(entry: ChartEntry): CompletionDot {
  if (entry.status === "GUIDE_VERIFIED") return "full";
  if (entry.status === "STUDENT_CONFIRMED") return "half";
  return "empty";
}

/**
 * One month of the Activity Chart (SPEC.md B7). Columns Date, Activity Planned,
 * Complete/Incomplete, student sign, guide sign. The student confirms a row,
 * the assigned guide verifies it; editing a verified row resets it and needs a
 * fresh countersign. Same markup on screen and in print.
 */
export function ActivityChartScreen({
  groupId: _groupId,
  groupNo,
  guideName,
  month,
  entries,
  mode,
  editable,
  print,
  printHref,
}: ActivityChartScreenProps) {
  void _groupId;
  const [rows, setRows] = useState<ChartEntry[]>(entries);
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.date])),
  );
  const [marks, setMarks] = useState<Record<string, "COMPLETE" | "INCOMPLETE" | null>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.statusText])),
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const verified = rows.filter((row) => row.status === "GUIDE_VERIFIED").length;

  function patchRow(id: string, next: Partial<ChartEntry>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...next } : row)));
  }

  async function confirm(row: ChartEntry) {
    const mark = marks[row.id] ?? null;
    if (!mark) {
      setStatus("error");
      setMessage("Choose Complete or Incomplete before confirming.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await confirmEntryAction({
      entryId: row.id,
      date: dates[row.id] ?? "",
      statusText: mark,
    });
    if (result.success) {
      patchRow(row.id, {
        status: result.data.status,
        statusText: mark,
        date: dates[row.id] ?? "",
        studentSign: { name: result.data.studentName ?? guideName, at: result.data.studentConfirmedAt },
        // Confirming always resets the row to STUDENT_CONFIRMED (master rule 7),
        // so any previous guide countersign is cleared until verified again.
        guideSign: null,
      });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  async function verify(row: ChartEntry) {
    setStatus("saving");
    setMessage(null);
    const result = await verifyEntryAction({ entryId: row.id });
    if (result.success) {
      patchRow(row.id, {
        status: result.data.status,
        guideSign: { name: result.data.guideName ?? guideName, at: result.data.guideVerifiedAt },
      });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  function renderSheet(): ReactNode {
    return (
      <PaperPage>
        <div className="paper-title">Activity Chart</div>
        <div className="paper-subtitle">{ACTIVITY_MONTH_LABELS[month]}</div>

        <PaperTable style={{ marginTop: "10px" }}>
          <PaperBody>
            <PaperRow>
              <PaperTh width="7%">Sr. No</PaperTh>
              <PaperTh width="13%">Date</PaperTh>
              <PaperTh width="34%">Activity Planned</PaperTh>
              <PaperTh width="14%">Complete / Incomplete</PaperTh>
              <PaperTh width="16%">Signature of student</PaperTh>
              <PaperTh width="16%">Signature of guide</PaperTh>
            </PaperRow>
            {rows.map((row) => {
              const dateEditable = mode === "student" && editable;
              const markEditable = mode === "student" && editable;
              const canConfirm = mode === "student" && editable;
              const canVerify =
                mode === "guide" && editable && row.status === "STUDENT_CONFIRMED";
              const mark = marks[row.id] ?? null;
              return (
                <PaperRow key={row.id}>
                  <PaperTd style={{ textAlign: "center" }}>{row.sortOrder}</PaperTd>
                  <PaperTd>
                    <Field
                      value={dates[row.id] ?? ""}
                      onValueChange={
                        dateEditable
                          ? (value) => setDates((prev) => ({ ...prev, [row.id]: value }))
                          : undefined
                      }
                      readOnly={!dateEditable}
                      ariaLabel={`Row ${row.sortOrder} date`}
                    />
                  </PaperTd>
                  <PaperTd style={{ fontSize: "11px" }}>{row.text}</PaperTd>
                  <PaperTd style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", gap: "10px", alignItems: "center" }}>
                      <span>
                        <TickBox
                          checked={mark === "COMPLETE"}
                          readOnly={!markEditable}
                          onCheckedChange={
                            markEditable
                              ? () => setMarks((prev) => ({ ...prev, [row.id]: "COMPLETE" }))
                              : undefined
                          }
                          ariaLabel={`Row ${row.sortOrder} complete`}
                        />{" "}
                        C
                      </span>
                      <span>
                        <TickBox
                          checked={mark === "INCOMPLETE"}
                          readOnly={!markEditable}
                          onCheckedChange={
                            markEditable
                              ? () => setMarks((prev) => ({ ...prev, [row.id]: "INCOMPLETE" }))
                              : undefined
                          }
                          ariaLabel={`Row ${row.sortOrder} incomplete`}
                        />{" "}
                        I
                      </span>
                    </span>
                  </PaperTd>
                  <PaperTd style={{ fontSize: "10px" }}>
                    {row.studentSign ? (
                      signedBy(row.studentSign.name, row.studentSign.at)
                    ) : canConfirm ? (
                      <ActionButton onClick={() => void confirm(row)}>Confirm</ActionButton>
                    ) : (
                      ""
                    )}
                  </PaperTd>
                  <PaperTd style={{ fontSize: "10px" }}>
                    {row.guideSign ? (
                      signedBy(row.guideSign.name, row.guideSign.at)
                    ) : canVerify ? (
                      <ActionButton onClick={() => void verify(row)}>Verify</ActionButton>
                    ) : (
                      ""
                    )}
                  </PaperTd>
                </PaperRow>
              );
            })}
          </PaperBody>
        </PaperTable>

        <p className="paper-serif" style={{ marginTop: "10px", fontSize: "11px" }}>
          {verified} of {rows.length} rows verified by the guide.
        </p>

        {(mode === "student" || mode === "guide") && !editable ? (
          <p className="paper-serif" style={{ fontSize: "11px", fontStyle: "italic" }}>
            Activity charts unlock once the HOD approves the group and assigns a guide.
          </p>
        ) : null}
        {mode === "student" && editable ? (
          <p className="paper-serif" style={{ fontSize: "11px", fontStyle: "italic" }}>
            Confirming a guide-verified row clears the guide sign and asks for a fresh
            verification.
          </p>
        ) : null}
        {mode === "guide" &&
        rows.some((row) => row.status === "PLANNED") &&
        editable ? (
          <p className="paper-serif" style={{ fontSize: "11px", fontStyle: "italic" }}>
            Rows the students have not confirmed yet cannot be verified.
          </p>
        ) : null}
      </PaperPage>
    );
  }

  const sheet = renderSheet();

  if (print) {
    return <div className="paper-desk">{sheet}</div>;
  }

  const done = rows.filter((row) => row.status === "GUIDE_VERIFIED").length;
  const started = rows.filter((row) => row.status !== "PLANNED").length;
  const dot: CompletionDot =
    rows.length > 0 && done === rows.length ? "full" : started > 0 ? "half" : "empty";

  return (
    <SheetViewer
      heading={
        groupNo
          ? `Activity chart · ${ACTIVITY_MONTH_LABELS[month]} · Group ${groupNo}`
          : `Activity chart · ${ACTIVITY_MONTH_LABELS[month]}`
      }
      sections={[
        {
          key: month,
          label: `${ACTIVITY_MONTH_LABELS[month]} (${done}/${rows.length} verified)`,
          dot,
          content: sheet,
        },
      ]}
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
