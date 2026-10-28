"use client";

import { useState, type ReactNode } from "react";
import {
  Field,
  MarksCell,
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
import type { EvalRow } from "@/lib/services/evaluation";

export type EvalSheetMode = "student" | "guide" | "hod";

export type EvalComponentDef = { key: string; label: string; max: number };

export type EvalSheetActionResult = { success: boolean; error?: string };

export type EvalSheetActions = {
  save: (input: unknown) => Promise<EvalSheetActionResult>;
  submit: (input: unknown) => Promise<EvalSheetActionResult>;
  approve: (input: unknown) => Promise<EvalSheetActionResult>;
  unlock: (input: unknown) => Promise<EvalSheetActionResult>;
};

export type EvalSheetScreenProps = {
  groupId: string;
  groupNo: string | null;
  title: string;
  subtitle: string;
  components: readonly EvalComponentDef[];
  totalMax: number;
  rows: EvalRow[];
  submittedByName: string | null;
  submittedAt: string | null;
  actions: EvalSheetActions;
  mode: EvalSheetMode;
  /** False until the group is ACTIVE (or once the PDF is generated). */
  editable: boolean;
  print: boolean;
  /** Where the toolbar "Print / PDF" button points (?print=1). */
  printHref: string;
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

function rowTotal(
  components: readonly EvalComponentDef[],
  row: { components: Record<string, number | null> },
): number {
  return components.reduce((sum, component) => sum + (row.components[component.key] ?? 0), 0);
}

/**
 * An evaluation table (Term-I mock out of 50, Term-II final out of 100). One
 * row per member; the assigned guide edits DRAFT cells, submits the table,
 * and the guide or HOD approves; only the HOD unlocks with a reason. Totals
 * always recompute from the cells. Same markup on screen and in print.
 */
export function EvalSheetScreen({
  groupId,
  groupNo,
  title,
  subtitle,
  components,
  totalMax,
  rows,
  submittedByName,
  submittedAt,
  actions,
  mode,
  editable,
  print,
  printHref,
}: EvalSheetScreenProps) {
  const [cells, setCells] = useState<Record<string, Record<string, number | null>>>(() =>
    Object.fromEntries(rows.map((row) => [row.memberId, { ...row.components }])),
  );
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.memberId, row.status])),
  );
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const anyDraft = Object.values(statuses).includes("DRAFT");
  const anySubmitted = Object.values(statuses).includes("SUBMITTED");
  const anyApproved = Object.values(statuses).includes("APPROVED");
  const canEdit = mode === "guide" && editable;
  const canSubmit = mode === "guide" && editable && anyDraft;
  const canApprove = (mode === "guide" || mode === "hod") && editable && anySubmitted;
  const canUnlock = mode === "hod" && editable && anyApproved;

  function setCell(memberId: string, key: string, value: string) {
    setCells((prev) => ({
      ...prev,
      [memberId]: { ...prev[memberId], [key]: value === "" ? null : Number(value) },
    }));
  }

  function draftPayload() {
    return {
      groupId,
      rows: rows
        .filter((row) => statuses[row.memberId] === "DRAFT")
        .map((row) => ({ memberId: row.memberId, components: { ...cells[row.memberId] } })),
    };
  }

  async function save() {
    setStatus("saving");
    setMessage(null);
    const result = await actions.save(draftPayload());
    if (result.success) {
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong. Please try again.");
    }
  }

  async function submit() {
    setStatus("saving");
    setMessage(null);
    // Persist the still-draft rows first; locked rows are left untouched.
    const saved = await actions.save(draftPayload());
    if (!saved.success) {
      setStatus("error");
      setMessage(saved.error ?? "Something went wrong. Please try again.");
      return;
    }
    const result = await actions.submit({ groupId });
    if (result.success) {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (next[row.memberId] === "DRAFT") next[row.memberId] = "SUBMITTED";
        }
        return next;
      });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong. Please try again.");
    }
  }

  async function approve() {
    setStatus("saving");
    setMessage(null);
    const result = await actions.approve({ groupId });
    if (result.success) {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (next[row.memberId] === "SUBMITTED") next[row.memberId] = "APPROVED";
        }
        return next;
      });
      setStatus("saved");
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong. Please try again.");
    }
  }

  async function unlock() {
    if (!reason.trim()) {
      setStatus("error");
      setMessage("A reason is required to unlock approved marks.");
      return;
    }
    setStatus("saving");
    setMessage(null);
    const result = await actions.unlock({ groupId, reason });
    if (result.success) {
      setStatuses((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          if (next[row.memberId] === "APPROVED") next[row.memberId] = "DRAFT";
        }
        return next;
      });
      setStatus("saved");
      setMessage(null);
    } else {
      setStatus("error");
      setMessage(result.error ?? "Something went wrong. Please try again.");
    }
  }

  const sheet = (
    <PaperPage>
      <div className="paper-title">{title}</div>
      <div className="paper-subtitle">{subtitle}</div>

      <PaperTable style={{ marginTop: "10px" }}>
        <PaperBody>
          <PaperRow>
            <PaperTh width="16%">Name of Student</PaperTh>
            {components.map((component) => (
              <PaperTh key={component.key} width="9%">
                <span style={{ fontSize: "9px" }}>
                  {component.label} ({component.max})
                </span>
              </PaperTh>
            ))}
            <PaperTh width="7%">Total / {totalMax}</PaperTh>
            <PaperTh width="8%">Status</PaperTh>
          </PaperRow>
          {rows.map((row) => {
            const rowStatus = statuses[row.memberId] ?? row.status;
            const rowEditable = canEdit && rowStatus === "DRAFT";
            const live: EvalRow = {
              ...row,
              components: cells[row.memberId] ?? row.components,
            };
            return (
              <PaperRow key={row.memberId}>
                <PaperTd style={{ fontSize: "11px" }}>{row.memberName}</PaperTd>
                {components.map((component) => (
                  <PaperTd key={component.key} style={{ textAlign: "center" }}>
                    <MarksCell
                      value={live.components[component.key] ?? null}
                      editable={rowEditable}
                      max={component.max}
                      width="44px"
                      onValueChange={
                        rowEditable
                          ? (value) => setCell(row.memberId, component.key, value)
                          : undefined
                      }
                    />
                  </PaperTd>
                ))}
                <PaperTd style={{ textAlign: "center", fontWeight: 700 }}>{rowTotal(components, live)}</PaperTd>
                <PaperTd style={{ fontSize: "10px", textAlign: "center" }}>{rowStatus}</PaperTd>
              </PaperRow>
            );
          })}
        </PaperBody>
      </PaperTable>

      <div style={{ marginTop: "16px", fontSize: "11px", lineHeight: 1.9 }}>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Name and Signature of Evaluation Committee (1):{" "}
          </span>
          {submittedAt ? signedBy(submittedByName, submittedAt) : "________________________"}
        </div>
        <div>
          <span className="paper-sans" style={{ fontWeight: 700 }}>
            Name and Signature of Evaluation Committee (2):{" "}
          </span>
          {rows.some((row) => (statuses[row.memberId] ?? row.status) === "APPROVED" && row.approvedAt)
            ? signedBy(
                rows.find((row) => row.approvedAt)?.approvedByName ?? null,
                rows.find((row) => row.approvedAt)?.approvedAt ?? null,
              )
            : "________________________"}
        </div>
      </div>

      {canUnlock ? (
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
        {canEdit && anyDraft ? <ActionButton onClick={() => void save()}>Save marks</ActionButton> : null}
        {canSubmit ? <ActionButton primary onClick={() => void submit()}>Submit table</ActionButton> : null}
        {canApprove ? <ActionButton primary onClick={() => void approve()}>Approve</ActionButton> : null}
        {canUnlock ? <ActionButton onClick={() => void unlock()}>Unlock to draft</ActionButton> : null}
      </div>

      {(mode === "student" || mode === "hod") && anyDraft && editable ? (
        <p className="paper-serif print-hide" style={{ fontSize: "11px", fontStyle: "italic" }}>
          Waiting for the assigned guide to fill and submit this table.
        </p>
      ) : null}
    </PaperPage>
  );

  if (print) {
    return <>{sheet}</>;
  }

  const approved = rows.filter((row) => (statuses[row.memberId] ?? row.status) === "APPROVED").length;
  const dot: CompletionDot =
    approved === rows.length && rows.length > 0 ? "full" : approved > 0 ? "half" : "empty";

  return (
    <SheetViewer
      heading={groupNo ? `${title} · Group ${groupNo}` : title}
      sections={[{ key: "eval", label: `${title} (${approved}/${rows.length} approved)`, dot, content: sheet }]}
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
