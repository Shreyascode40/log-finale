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
  TickBox,
} from "@/components/paper";
import { SheetViewer, type CompletionDot } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import {
  TOPIC2_LOCKED_NOTICE,
  TOPIC2_NOT_REQUIRED_NOTICE,
  TOPIC_CRITERIA,
  TOPIC_MAX_SCORE,
  TOPIC_STATUS_LABELS,
} from "@/lib/constants";
import { signedBy } from "@/lib/format";
import { decideTopicAction, saveTopicAction, scoreTopicAction } from "@/lib/actions/topic";
import type { TopicData } from "@/lib/services/topic";

export type TopicSheetMode = "student" | "guide" | "hod";

export type TopicSheetScreenProps = {
  groupId: string;
  groupNo: string | null;
  guideName: string | null;
  topics: TopicData[];
  mode: TopicSheetMode;
  /** False until the group is ACTIVE (or once the PDF is generated). */
  editable: boolean;
  print: boolean;
  /** Where the toolbar "Print / PDF" button points (?print=1). */
  printHref: string;
};

type ActionResult = Awaited<ReturnType<typeof saveTopicAction>>;

function totalOf(topic: TopicData): number | null {
  const values = [topic.significance, topic.innovativeness, topic.scope, topic.feasibility];
  if (values.some((value) => typeof value !== "number" || Number.isNaN(value))) return null;
  return (values as number[]).reduce((sum, value) => sum + value, 0);
}

function topicDot(topic: TopicData): CompletionDot {
  if (topic.status === "APPROVED") return "full";
  if (topic.title || topic.description || topic.scoredAt) return "half";
  return "empty";
}

/** Fields still stopping a guide from saving, spelled out for the error line. */
function missingScoreFields(topic: TopicData): string[] {
  const missing: string[] = [];
  for (const criterion of TOPIC_CRITERIA) {
    const value = topic[criterion.key];
    if (
      typeof value !== "number" ||
      Number.isNaN(value) ||
      !Number.isInteger(value) ||
      value < 0 ||
      value > TOPIC_MAX_SCORE
    ) {
      missing.push(`${criterion.label}: enter a whole number 0–${TOPIC_MAX_SCORE}`);
    }
  }
  if (topic.recommendation !== "YES" && topic.recommendation !== "NO") {
    missing.push("Recommendation: tick Yes or No");
  }
  return missing;
}

function ActionButton({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="print-hide"
      style={{
        border: "1px solid #000",
        background: primary ? "#d4d4d4" : "#fff",
        color: "#000",
        padding: "3px 12px",
        fontSize: "12px",
        fontFamily: "Arial, Helvetica, sans-serif",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Topic Finalization sheets (SPEC.md B6 / E5.7). Two A4 sheets — Topic 1 and
 * Topic 2 — rendered identically on screen and in the PDF. The mode decides the
 * write affordances; the server re-checks every one of them:
 *   student writes the title/description, guide scores, HOD decides.
 */
export function TopicSheetScreen({
  groupId,
  groupNo,
  guideName,
  topics,
  mode,
  editable,
  print,
  printHref,
}: TopicSheetScreenProps) {
  const [rows, setRows] = useState<TopicData[]>(topics);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const topic1 = rows.find((row) => row.topicNo === 1) ?? rows[0];
  const topic2Locked = (topic1?.status ?? "DRAFT") !== "REJECTED";
  const topic2Note =
    topic1?.status === "APPROVED" ? TOPIC2_NOT_REQUIRED_NOTICE : TOPIC2_LOCKED_NOTICE;

  function patch(topicNo: number, next: Partial<TopicData>) {
    setRows((prev) => prev.map((row) => (row.topicNo === topicNo ? { ...row, ...next } : row)));
  }

  async function submit(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    setStatus("saving");
    setMessage(null);
    const result = await action();
    if (result.success) {
      setStatus("saved");
      onSuccess?.();
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  function renderTopicSheet(topic: TopicData): ReactNode {
    const textEditable =
      mode === "student" && editable && ["DRAFT", "REJECTED"].includes(topic.status);
    const scoreEditable =
      mode === "guide" && editable && ["SUBMITTED", "SCORED"].includes(topic.status);
    const decideEditable = mode === "hod" && editable && topic.status === "SCORED";
    const locked = topic.topicNo === 2 && topic2Locked;
    const total = totalOf(topic);
    const scoresReady =
      topic.significance !== null &&
      topic.innovativeness !== null &&
      topic.scope !== null &&
      topic.feasibility !== null &&
      topic.recommendation !== null;

    return (
      <PaperPage key={topic.topicNo}>
        <div className="paper-title">Finalization of Project Topic</div>
        <div className="paper-subtitle">Topic {topic.topicNo}</div>

        {locked ? (
          <p className="paper-serif" style={{ marginTop: "20px", fontStyle: "italic" }}>
            {topic2Note}
          </p>
        ) : (
          <>
            <PaperTable style={{ marginTop: "10px" }}>
              <PaperBody>
                <PaperRow>
                  <PaperTh width="44%">Title of the Project</PaperTh>
                  <PaperTd>
                    <Field
                      value={topic.title}
                      onValueChange={
                        textEditable ? (value) => patch(topic.topicNo, { title: value }) : undefined
                      }
                      readOnly={!textEditable}
                      missing={textEditable && !topic.title}
                      lines={4}
                      ariaLabel={`Topic ${topic.topicNo} title`}
                    />
                  </PaperTd>
                </PaperRow>
                <PaperRow>
                  <PaperTh>Brief Description</PaperTh>
                  <PaperTd>
                    <Field
                      value={topic.description}
                      onValueChange={
                        textEditable
                          ? (value) => patch(topic.topicNo, { description: value })
                          : undefined
                      }
                      readOnly={!textEditable}
                      lines={4}
                      ariaLabel={`Topic ${topic.topicNo} description`}
                    />
                  </PaperTd>
                </PaperRow>
                {TOPIC_CRITERIA.map((criterion) => (
                  <PaperRow key={criterion.key}>
                    <PaperTh>
                      {criterion.label}{" "}
                      <span style={{ fontWeight: 400 }}>(0–{TOPIC_MAX_SCORE})</span>
                    </PaperTh>
                    <PaperTd style={{ textAlign: "center" }}>
                      <MarksCell
                        value={topic[criterion.key]}
                        editable={scoreEditable}
                        max={TOPIC_MAX_SCORE}
                        onValueChange={
                          scoreEditable
                            ? (value) =>
                                patch(topic.topicNo, {
                                  [criterion.key]: value === "" ? null : Number(value),
                                } as Partial<TopicData>)
                            : undefined
                        }
                      />
                    </PaperTd>
                  </PaperRow>
                ))}
                <PaperRow>
                  <PaperTh>Recommendation</PaperTh>
                  <PaperTd style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-flex", gap: "22px", alignItems: "center" }}>
                      <span>
                        <TickBox
                          checked={topic.recommendation === "YES"}
                          readOnly={!scoreEditable}
                          onCheckedChange={
                            scoreEditable
                              ? () => patch(topic.topicNo, { recommendation: "YES" })
                              : undefined
                          }
                          ariaLabel={`Topic ${topic.topicNo} recommended yes`}
                        />{" "}
                        Yes
                      </span>
                      <span>
                        <TickBox
                          checked={topic.recommendation === "NO"}
                          readOnly={!scoreEditable}
                          onCheckedChange={
                            scoreEditable
                              ? () => patch(topic.topicNo, { recommendation: "NO" })
                              : undefined
                          }
                          ariaLabel={`Topic ${topic.topicNo} recommended no`}
                        />{" "}
                        No
                      </span>
                    </span>
                  </PaperTd>
                </PaperRow>
                {total !== null ? (
                  <PaperRow>
                    <PaperTh>Total (out of {TOPIC_MAX_SCORE * 4})</PaperTh>
                    <PaperTd style={{ textAlign: "center", fontWeight: 700 }}>{total}</PaperTd>
                  </PaperRow>
                ) : null}
              </PaperBody>
            </PaperTable>

            <div style={{ marginTop: "14px" }}>
              <span className="paper-sans" style={{ fontWeight: 700, fontSize: "12px" }}>
                Remarks / Reason
              </span>
              <div style={{ marginTop: "4px" }}>
                <Field
                  value={topic.rejectReason}
                  onValueChange={
                    decideEditable
                      ? (value) => patch(topic.topicNo, { rejectReason: value })
                      : undefined
                  }
                  readOnly={!decideEditable}
                  lines={2}
                  ariaLabel={`Topic ${topic.topicNo} remarks`}
                />
              </div>
            </div>

            <div style={{ marginTop: "16px", fontSize: "11px", lineHeight: 1.9 }}>
              <div>
                <span className="paper-sans" style={{ fontWeight: 700 }}>
                  Reviewer (Project Guide):{" "}
                </span>
                {topic.scoredAt
                  ? signedBy(topic.scoredByName ?? guideName, topic.scoredAt)
                  : "________________________"}
              </div>
              <div>
                <span className="paper-sans" style={{ fontWeight: 700 }}>
                  Head of Department:{" "}
                </span>
                {topic.approvedAt
                  ? signedBy(topic.approvedByName, topic.approvedAt)
                  : "________________________"}
              </div>
            </div>

            {topic.status === "REJECTED" && topic.rejectReason ? (
              <p
                className="paper-serif"
                style={{ marginTop: "10px", color: "#b91c1c", fontSize: "12px" }}
              >
                Rejected: {topic.rejectReason}
              </p>
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
              <span style={{ fontWeight: 700 }}>
                Status: {TOPIC_STATUS_LABELS[topic.status] ?? topic.status}
              </span>

              {(mode === "guide" || mode === "hod") &&
              ["DRAFT", "REJECTED"].includes(topic.status) ? (
                <span className="paper-sans" style={{ fontSize: "11px", fontStyle: "italic" }}>
                  Waiting for the students to submit this topic for review.
                </span>
              ) : null}
              {mode === "hod" && topic.status === "SUBMITTED" ? (
                <span className="paper-sans" style={{ fontSize: "11px", fontStyle: "italic" }}>
                  Waiting for the assigned guide to score this topic. Only the guide enters
                  scores; the HOD approves or rejects.
                </span>
              ) : null}

              {textEditable ? (
                <>
                  <ActionButton
                    onClick={() =>
                      void submit(async () => {
                        const result = await saveTopicAction({
                          topicNo: topic.topicNo,
                          title: topic.title,
                          description: topic.description,
                          submit: false,
                        });
                        return result;
                      })
                    }
                  >
                    Save draft
                  </ActionButton>
                  <ActionButton
                    primary
                    onClick={() =>
                      void submit(
                        async () =>
                          saveTopicAction({
                            topicNo: topic.topicNo,
                            title: topic.title,
                            description: topic.description,
                            submit: true,
                          }),
                        () => patch(topic.topicNo, { status: "SUBMITTED" }),
                      )
                    }
                  >
                    Submit for review
                  </ActionButton>
                </>
              ) : null}

              {scoreEditable ? (
                <>
                  {!scoresReady ? (
                    <span
                      className="paper-sans"
                      style={{ fontSize: "11px", fontStyle: "italic" }}
                    >
                      Enter all four scores (0–10), tick Yes or No, then save.
                    </span>
                  ) : null}
                  <ActionButton
                    primary
                  onClick={() => {
                    const missing = missingScoreFields(topic);
                    if (missing.length > 0) {
                      setStatus("error");
                      setMessage(missing.join(" "));
                      return;
                    }
                    void submit(
                      async () =>
                        scoreTopicAction({
                          groupId,
                          topicNo: topic.topicNo,
                          significance: topic.significance,
                          innovativeness: topic.innovativeness,
                          scope: topic.scope,
                          feasibility: topic.feasibility,
                          recommendation: topic.recommendation,
                        }),
                      () => patch(topic.topicNo, { status: "SCORED" }),
                    );
                  }}
                >
                  Save score &amp; recommendation
                </ActionButton>
                </>
              ) : null}

              {decideEditable ? (
                <>
                  <ActionButton
                    primary
                    onClick={() =>
                      void submit(
                        async () =>
                          decideTopicAction({
                            groupId,
                            topicNo: topic.topicNo,
                            decision: "APPROVED",
                            reason: topic.rejectReason,
                          }),
                        () => patch(topic.topicNo, { status: "APPROVED" }),
                      )
                    }
                  >
                    Approve
                  </ActionButton>
                  <ActionButton
                    onClick={() =>
                      void submit(
                        async () =>
                          decideTopicAction({
                            groupId,
                            topicNo: topic.topicNo,
                            decision: "REJECTED",
                            reason: topic.rejectReason,
                          }),
                        () => patch(topic.topicNo, { status: "REJECTED" }),
                      )
                    }
                  >
                    Reject
                  </ActionButton>
                </>
              ) : null}
            </div>
          </>
        )}
      </PaperPage>
    );
  }

  if (print) {
    return <div className="paper-desk">{rows.map((topic) => renderTopicSheet(topic))}</div>;
  }

  const sections = rows.map((topic) => ({
    key: `topic-${topic.topicNo}`,
    label: `Topic ${topic.topicNo}`,
    dot: topicDot(topic),
    content: renderTopicSheet(topic),
  }));

  return (
    <SheetViewer
      heading={groupNo ? `Topic finalization · Group ${groupNo}` : "Topic finalization"}
      sections={sections}
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
