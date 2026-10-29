import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

/** Thin-bordered logbook table primitives. No rounding, no zebra stripes. */

export function PaperTable({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <table className={`paper-table ${className}`} style={style}>
      {children}
    </table>
  );
}

export function PaperHead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function PaperBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function PaperRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`paper-table-row ${className}`}>{children}</tr>;
}

type CellSpan = {
  colSpan?: number;
  rowSpan?: number;
  width?: string | number;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
};

export function PaperTh({ colSpan, rowSpan, width, className = "", style, children }: CellSpan) {
  const props: ThHTMLAttributes<HTMLTableCellElement> = { colSpan, rowSpan };
  return (
    <th {...props} className={className} style={{ ...(width ? { width } : {}), ...style }}>
      {children}
    </th>
  );
}

export function PaperTd({ colSpan, rowSpan, width, className = "", style, children }: CellSpan) {
  const props: TdHTMLAttributes<HTMLTableCellElement> = { colSpan, rowSpan };
  return (
    <td {...props} className={className} style={{ ...(width ? { width } : {}), ...style }}>
      {children}
    </td>
  );
}
