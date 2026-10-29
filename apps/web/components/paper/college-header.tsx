import { COLLEGE } from "@/lib/constants";

/**
 * The college header repeated at the top of EVERY logbook sheet (SPEC.md E3).
 * Left crest + centre title + record row + right portrait logo, then the grey
 * "Project Diary" bar. Borders are the standard 1px black paper-table borders.
 */
export function CollegeHeader() {
  return (
    <div className="paper-header">
      <table className="paper-table">
        <tbody>
          <tr>
            <td rowSpan={2} style={{ width: "88px", textAlign: "center", verticalAlign: "middle" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/college-crest.webp"
                alt="Anantrao Pawar College of Engineering & Research crest"
                style={{ maxHeight: "62px", maxWidth: "72px", margin: "0 auto" }}
              />
            </td>
            <td colSpan={2} style={{ textAlign: "center", verticalAlign: "middle", padding: "4px 6px" }}>
              <div className="paper-serif" style={{ fontWeight: 700, fontSize: "13px", color: "#404040" }}>
                {COLLEGE.parishad}
              </div>
              <div className="paper-serif" style={{ fontWeight: 700, fontSize: "14px", color: "#404040" }}>
                {COLLEGE.name}
              </div>
            </td>
            <td rowSpan={2} style={{ width: "66px", textAlign: "center", verticalAlign: "middle" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logos/founder-portrait.webp"
                alt="Founder portrait"
                style={{ maxHeight: "62px", maxWidth: "54px", margin: "0 auto" }}
              />
            </td>
          </tr>
          <tr>
            <td style={{ width: "42%" }}>
              <div>
                <span style={{ fontWeight: 700 }}>Record No.:</span> {COLLEGE.recordNo}
              </div>
              <div>
                <span style={{ fontWeight: 700 }}>Revision:</span> {COLLEGE.revision}
              </div>
            </td>
            <td>
              <span style={{ fontWeight: 700 }}>DoI:</span> {COLLEGE.doi}
            </td>
          </tr>
        </tbody>
      </table>
      <div
        className="paper-grey-bar paper-sans"
        style={{
          border: "1px solid #000",
          borderTop: 0,
          textAlign: "center",
          fontWeight: 700,
          padding: "3px 0",
          letterSpacing: "0.02em",
        }}
      >
        {COLLEGE.diaryTitle}
      </div>
    </div>
  );
}
