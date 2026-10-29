"use client";

import { useState } from "react";
import {
  Field,
  PaperBody,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
  PaperTh,
  SignCell,
} from "@/components/paper";
import { SheetViewer } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { UNDERTAKING_TEXT } from "@/lib/constants";
import { acceptUndertakingAction } from "@/lib/actions/signoff";

export type UndertakingMember = {
  id: string;
  name: string;
  acceptedAt: string | null;
};

export type UndertakingSheetScreenProps = {
  department: string;
  batch: string;
  academicYear: string;
  projectTitle: string;
  members: UndertakingMember[];
  editable: boolean;
  print: boolean;
};

/**
 * Undertaking sheet (SPEC.md E5.5 / B4). The paragraph blanks are filled from the
 * group data; the five-row signature table lets a single student Accept every
 * member, printed as "Signed by <name> on <date time>". The audit log records who
 * actually clicked.
 */
export function UndertakingSheetScreen({
  department,
  batch,
  academicYear,
  projectTitle,
  members,
  editable,
  print,
}: UndertakingSheetScreenProps) {
  const [accepted, setAccepted] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.acceptedAt])),
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function accept(memberId: string) {
    setStatus("saving");
    const result = await acceptUndertakingAction({ memberId });
    if (result.success) {
      setAccepted((prev) => ({ ...prev, [memberId]: result.data.acceptedAt }));
      setStatus("saved");
      setMessage(null);
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  // The printed table always has five rows (B4).
  const rows = [0, 1, 2, 3, 4];

  const sheet = (
    <PaperPage>
      <div className="paper-title">Undertaking by Students</div>

      <p style={{ fontSize: "12.5px", lineHeight: 1.9, textAlign: "justify", margin: "4px 0 22px" }}>
        {UNDERTAKING_TEXT.before}{" "}
        <Field value={department} readOnly width="150px" ariaLabel="Branch" />{" "}
        {UNDERTAKING_TEXT.afterBatch}{" "}
        <Field value={batch} readOnly width="110px" ariaLabel="Batch" />{" "}
        {UNDERTAKING_TEXT.afterYear}{" "}
        <Field value={academicYear} readOnly width="100px" ariaLabel="Academic year" />.{" "}
        {UNDERTAKING_TEXT.afterTitle}{" "}
        <Field value={projectTitle} readOnly width="300px" ariaLabel="Project title" />{" "}
        {UNDERTAKING_TEXT.afterTitle2}
      </p>

      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTh width="10%">Sr. No</PaperTh>
            <PaperTh width="40%">Name of Student</PaperTh>
            <PaperTh>Signature</PaperTh>
          </PaperRow>
          {rows.map((slot) => {
            const member = members[slot];
            if (!member) {
              return (
                <PaperRow key={`blank-${slot}`}>
                  <PaperTd>{slot + 1}</PaperTd>
                  <PaperTd>&nbsp;</PaperTd>
                  <PaperTd>&nbsp;</PaperTd>
                </PaperRow>
              );
            }
            const acceptedAt = accepted[member.id] ?? null;
            const canSign = editable && !acceptedAt;
            return (
              <PaperRow key={member.id}>
                <PaperTd>{slot + 1}</PaperTd>
                <PaperTd>{member.name}</PaperTd>
                <PaperTd>
                  <SignCell
                    signedByName={member.name}
                    signedAt={acceptedAt}
                    canSign={canSign}
                    actionLabel="Accept"
                    onSign={() => void accept(member.id)}
                    emptyHint=""
                  />
                </PaperTd>
              </PaperRow>
            );
          })}
        </PaperBody>
      </PaperTable>
    </PaperPage>
  );

  if (print) {
    return <>{sheet}</>;
  }

  return (
    <SheetViewer
      heading="Undertaking"
      sections={[{ key: "undertaking", label: "Undertaking", dot: undertakingDot(members, accepted), content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="/student/undertaking?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}

function undertakingDot(
  members: UndertakingMember[],
  accepted: Record<string, string | null>,
): "empty" | "half" | "full" {
  if (members.length === 0) return "empty";
  const done = members.filter((m) => accepted[m.id]).length;
  if (done === members.length) return "full";
  return done > 0 ? "half" : "empty";
}
