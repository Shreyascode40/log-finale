"use client";

import { useState } from "react";
import { PaperBody, PaperPage, PaperRow, PaperTable, PaperTd, PaperTh, TickBox } from "@/components/paper";
import { SheetViewer } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { RULES_AND_REGULATIONS } from "@/lib/constants";
import { signedBy } from "@/lib/format";
import { acknowledgeRulesAction } from "@/lib/actions/signoff";

export type RulesMember = {
  id: string;
  name: string;
  acknowledgedAt: string | null;
};

export type RulesSheetScreenProps = {
  members: RulesMember[];
  editable: boolean;
  print: boolean;
};

/**
 * Rules and Regulations sheet (SPEC.md E5.2 / B15). The 13 static rules sit in a
 * boxed list; beneath it each member ticks "I have read and understood". A single
 * student handles the whole group, so any group member can tick any row — the
 * tick is the e-signature and the audit log records who actually clicked.
 */
export function RulesSheetScreen({ members, editable, print }: RulesSheetScreenProps) {
  const [acks, setAcks] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(members.map((m) => [m.id, m.acknowledgedAt])),
  );
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function sign(memberId: string) {
    setStatus("saving");
    const result = await acknowledgeRulesAction({ memberId });
    if (result.success) {
      setAcks((prev) => ({ ...prev, [memberId]: result.data.acknowledgedAt }));
      setStatus("saved");
      setMessage(null);
    } else {
      setStatus("error");
      setMessage(result.error);
    }
  }

  const sheet = (
    <PaperPage>
      <div className="paper-title">Rules and Regulations</div>

      <div style={{ border: "1px solid #000", padding: "8px 12px", marginBottom: "14px" }}>
        <ol style={{ margin: 0, paddingLeft: "20px" }}>
          {RULES_AND_REGULATIONS.map((rule, i) => (
            <li key={i} style={{ fontSize: "11px", lineHeight: 1.35, marginBottom: "3px" }}>
              {rule}
            </li>
          ))}
        </ol>
      </div>

      <div className="paper-sans" style={{ fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
        Acknowledgement
      </div>
      <PaperTable>
        <PaperBody>
          <PaperRow>
            <PaperTh width="8%">Sr. No</PaperTh>
            <PaperTh width="34%">Name of Student</PaperTh>
            <PaperTh width="26%">I have read and understood</PaperTh>
            <PaperTh>Acknowledgement</PaperTh>
          </PaperRow>
          {members.map((member, i) => {
            const ackedAt = acks[member.id] ?? null;
            const canSign = editable && !ackedAt;
            return (
              <PaperRow key={member.id}>
                <PaperTd>{i + 1}</PaperTd>
                <PaperTd>{member.name}</PaperTd>
                <PaperTd>
                  <TickBox
                    checked={Boolean(ackedAt)}
                    readOnly={!canSign}
                    ariaLabel={`${member.name} has read and understood`}
                    onCheckedChange={canSign ? () => void sign(member.id) : undefined}
                  />
                </PaperTd>
                <PaperTd style={{ fontSize: "11px" }}>
                  {ackedAt ? signedBy(member.name, ackedAt) : canSign ? "Tick to acknowledge" : ""}
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
      heading="Rules and Regulations"
      sections={[{ key: "rules", label: "Rules and Regulations", dot: rulesDot(members, acks), content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="/student/rules?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}

function rulesDot(
  members: RulesMember[],
  acks: Record<string, string | null>,
): "empty" | "half" | "full" {
  if (members.length === 0) return "empty";
  const done = members.filter((m) => acks[m.id]).length;
  if (done === members.length) return "full";
  return done > 0 ? "half" : "empty";
}
