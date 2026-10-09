"use client";

import { useEffect, useRef, useState } from "react";
import { Field, PaperPage } from "@/components/paper";
import { SheetViewer } from "@/components/viewer/sheet-viewer";
import { SaveBadge, type SaveStatus } from "@/components/student/save-badge";
import { updateCoverAction } from "@/lib/actions/group-info";

export type CoverData = {
  department: string;
  academicYear: string;
  projectTitle: string;
  area: string;
  groupNo: string;
};

export type CoverSheetScreenProps = {
  initial: CoverData;
  guideName: string;
  editable: boolean;
  print: boolean;
};

/**
 * The Cover sheet (SPEC.md E5.1 / B2). Editable by group members with autosave;
 * read-only for locked groups. The same markup renders on screen and in print.
 */
export function CoverSheetScreen({ initial, guideName, editable, print }: CoverSheetScreenProps) {
  const [data, setData] = useState<CoverData>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (!editable) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      setStatus("saving");
      const result = await updateCoverAction(data);
      if (result.success) {
        setStatus("saved");
        setMessage(null);
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, editable]);

  const sheet = (
    <PaperPage>
      <div style={{ paddingTop: "6px" }}>
        <p style={{ fontSize: "15px", margin: "0 0 12px" }}>
          Department of{" "}
          <Field
            value={data.department}
            onValueChange={(v) => setData((d) => ({ ...d, department: v }))}
            readOnly={!editable}
            missing={editable && !data.department}
            width="190px"
            ariaLabel="Department"
          />{" "}
          Engineering
        </p>

        <div className="paper-cover-banner paper-sans">
          <span style={{ color: "#c0392b" }}>BE PROJECT LOG BOOK</span>
          <span> A.Y. </span>
          <Field
            value={data.academicYear}
            onValueChange={(v) => setData((d) => ({ ...d, academicYear: v }))}
            readOnly={!editable}
            missing={editable && !data.academicYear}
            width="110px"
            ariaLabel="Academic year"
          />
        </div>

        <div style={{ textAlign: "center", margin: "20px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cover/building.svg"
            alt="College building"
            style={{ maxWidth: "68%", maxHeight: "210px" }}
          />
        </div>

        <div className="paper-cover-box">
          <div style={{ marginBottom: "14px" }}>
            <div className="paper-sans" style={{ fontWeight: 700, marginBottom: "2px" }}>
              Project Title
            </div>
            <Field
              value={data.projectTitle}
              onValueChange={(v) => setData((d) => ({ ...d, projectTitle: v }))}
              readOnly={!editable}
              missing={editable && !data.projectTitle}
              lines={2}
              ariaLabel="Project title"
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <span className="paper-sans" style={{ fontWeight: 700 }}>
              Area of Project:{" "}
            </span>
            <Field
              value={data.area}
              onValueChange={(v) => setData((d) => ({ ...d, area: v }))}
              readOnly={!editable}
              missing={editable && !data.area}
              width="56%"
              ariaLabel="Area of project"
            />
          </div>
          <div>
            <span className="paper-sans" style={{ fontWeight: 700 }}>
              Project Guide:{" "}
            </span>
            <Field
              value={guideName || "Assigned by the HOD"}
              readOnly
              width="56%"
              ariaLabel="Project guide"
            />
          </div>
        </div>

        <div className="paper-cover-group paper-sans">
          <span style={{ fontWeight: 700 }}>Group No: </span>
          <Field
            value={data.groupNo}
            onValueChange={(v) => setData((d) => ({ ...d, groupNo: v }))}
            readOnly={!editable}
            missing={editable && !data.groupNo}
            width="140px"
            ariaLabel="Group number"
          />
        </div>
      </div>
    </PaperPage>
  );

  if (print) {
    return <div className="paper-desk">{sheet}</div>;
  }

  return (
    <SheetViewer
      heading="Cover"
      sections={[{ key: "cover", label: "Cover", dot: coverDot(data), content: sheet }]}
      saveStatus={<SaveBadge status={status} message={message} />}
      pdfButton={
        <a
          className="rounded bg-neutral-900 px-3 py-1 text-white"
          href="/student/cover?print=1"
          target="_blank"
          rel="noreferrer"
        >
          Print / PDF
        </a>
      }
    />
  );
}

function coverDot(data: CoverData): "empty" | "half" | "full" {
  const filled = [data.department, data.academicYear, data.projectTitle, data.area, data.groupNo].filter(
    (v) => v && v.trim().length > 0,
  ).length;
  if (filled === 5) return "full";
  return filled > 0 ? "half" : "empty";
}
