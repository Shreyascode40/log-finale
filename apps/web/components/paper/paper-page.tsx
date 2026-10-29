import type { ReactNode } from "react";
import { CollegeHeader } from "./college-header";

export type PaperPageProps = {
  children: ReactNode;
  /** Printed at the bottom centre. Omit for a single, unnumbered sheet. */
  pageNumber?: number;
  totalPages?: number;
  /**
   * Print mode (?print=1): no shadow, no scaling and the sheet is the whole
   * document. The same markup is used on screen, so screen === PDF.
   */
  print?: boolean;
  /**
   * Allow the sheet to grow past one A4 page. Used for long activity charts /
   * notes; the PDF continues onto a numbered sheet with the header repeated.
   */
  flow?: boolean;
  /** Show the repeated college header (default true, as in the logbook). */
  header?: boolean;
  className?: string;
};

/**
 * A4 sheet. White paper on the grey desk, exactly 794 x 1123 css px at 96dpi,
 * with the repeated college header and an optional page number.
 */
export function PaperPage({
  children,
  pageNumber,
  totalPages,
  print = false,
  flow = false,
  header = true,
  className = "",
}: PaperPageProps) {
  return (
    <div
      className={[
        "paper-page",
        flow ? "paper-page--flow" : "",
        print ? "paper-print" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-print={print ? "1" : undefined}
    >
      {header ? <CollegeHeader /> : null}
      <div className="paper-body">{children}</div>
      {pageNumber ? (
        <div
          className="paper-serif paper-page-number"
          style={{
            position: "absolute",
            bottom: "14px",
            left: 0,
            right: 0,
            textAlign: "center",
            fontSize: "10px",
          }}
        >
          {totalPages ? `Page ${pageNumber} of ${totalPages}` : `Page ${pageNumber}`}
        </div>
      ) : null}
    </div>
  );
}
