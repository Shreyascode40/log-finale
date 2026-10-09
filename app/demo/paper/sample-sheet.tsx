"use client";

import { useState } from "react";
import {
  Field,
  MarksCell,
  PaperBody,
  PaperHead,
  PaperPage,
  PaperRow,
  PaperTable,
  PaperTd,
  PaperTh,
  SignCell,
  TickBox,
} from "@/components/paper";

/**
 * F1 sample sheet. It is deliberately a "primitives sampler" so that the demo
 * page proves every building block renders like the printed logbook page:
 * underlined fields (editable + read-only), a tick box, a signature cell and a
 * marks cell, inside a bordered logbook table.
 */
export function SampleSheet({ pageNumber = 1, totalPages = 1 }: { pageNumber?: number; totalPages?: number }) {
  const [projectTitle, setProjectTitle] = useState("Smart Attendance System using Face Recognition");
  const [activity, setActivity] = useState("Group Submission");
  const [confirmed, setConfirmed] = useState(false);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [grade, setGrade] = useState("8");

  return (
    <PaperPage pageNumber={pageNumber} totalPages={totalPages}>
      <div className="paper-title">Activity Chart: June</div>

      <p className="paper-serif" style={{ fontSize: "11px", margin: "4px 0 8px" }}>
        Project Title:{" "}
        <Field value={projectTitle} onValueChange={setProjectTitle} width="380px" ariaLabel="Project title" />
      </p>

      <PaperTable>
        <PaperHead>
          <PaperRow>
            <PaperTh width="16%">Date</PaperTh>
            <PaperTh>Activity Planned</PaperTh>
            <PaperTh width="14%">Complete / Incomplete</PaperTh>
            <PaperTh width="18%">Signature of student</PaperTh>
            <PaperTh width="18%">Signature of internal/external guide</PaperTh>
          </PaperRow>
        </PaperHead>
        <PaperBody>
          <PaperRow>
            <PaperTd>
              <Field value="12/06/2025" readOnly width="88px" />
            </PaperTd>
            <PaperTd>{activity}</PaperTd>
            <PaperTd style={{ textAlign: "center" }}>
              <TickBox
                checked={confirmed}
                onCheckedChange={setConfirmed}
                ariaLabel="Confirm activity complete"
              />
            </PaperTd>
            <PaperTd>
              <SignCell
                signedAt={signedAt}
                signedByName="Rahul Patil"
                canSign={confirmed && !signedAt}
                onSign={() => setSignedAt(new Date().toISOString())}
                actionLabel="Sign"
                emptyHint="Pending"
              />
            </PaperTd>
            <PaperTd style={{ color: "#555" }}>Pending guide</PaperTd>
          </PaperRow>
          <PaperRow>
            <PaperTd>
              <Field value="" width="88px" ariaLabel="Date" placeholder="dd/mm/yyyy" />
            </PaperTd>
            <PaperTd>
              <Field
                value={activity}
                onValueChange={setActivity}
                readOnly
                width="100%"
                ariaLabel="Activity (seeded, read-only)"
              />
            </PaperTd>
            <PaperTd style={{ textAlign: "center" }}>—</PaperTd>
            <PaperTd />
            <PaperTd />
          </PaperRow>
        </PaperBody>
      </PaperTable>

      <div className="paper-subtitle" style={{ marginTop: "14px" }}>
        Remark and Grade (guide only)
      </div>
      <PaperTable>
        <PaperHead>
          <PaperRow>
            <PaperTh>Remark</PaperTh>
            <PaperTh width="12%">Grade</PaperTh>
            <PaperTh width="22%">Sign of Guide</PaperTh>
          </PaperRow>
        </PaperHead>
        <PaperBody>
          <PaperRow>
            <PaperTd>
              <Field value="" width="100%" ariaLabel="Remark" placeholder="—" />
            </PaperTd>
            <PaperTd style={{ textAlign: "center" }}>
              <MarksCell value={grade} onValueChange={setGrade} editable max={10} />
            </PaperTd>
            <PaperTd>
              <SignCell
                signedAt={new Date("2025-07-01T10:30:00")}
                signedByName="Dr. S. Kulkarni"
                canSign={false}
              />
            </PaperTd>
          </PaperRow>
        </PaperBody>
      </PaperTable>

      <p className="paper-serif" style={{ fontSize: "11px", marginTop: "10px" }}>
        Contribution:{" "}
        <Field
          value="Requirement analysis and UML design of the attendance module"
          readOnly
          lines={2}
          ariaLabel="Contribution"
        />
      </p>
    </PaperPage>
  );
}
