"use client";

export type MarksCellProps = {
  value?: number | string | null;
  onValueChange?: (value: string) => void;
  /** Only the assigned guide sees an editable cell. */
  editable?: boolean;
  /** Server-enforced maximum for this column; over-max is shown invalid. */
  max?: number;
  /** Locked (APPROVED) shows plain printed text plus a small lock glyph. */
  locked?: boolean;
  width?: string;
  align?: "left" | "center";
};

/**
 * A marks table cell. Only the assigned guide sees it as editable; everyone
 * else sees the printed value. Max is validated on the server, this only
 * surfaces the error.
 */
export function MarksCell({
  value,
  onValueChange,
  editable = false,
  max,
  locked = false,
  width = "52px",
  align = "center",
}: MarksCellProps) {
  const text = value === null || value === undefined ? "" : String(value);
  const numeric = typeof value === "number" ? value : text.trim() === "" ? null : Number(text);
  const overMax = max !== undefined && numeric !== null && !Number.isNaN(numeric) && numeric > max;

  if (!editable || locked) {
    return (
      <span
        className="paper-serif"
        style={{ display: "inline-flex", gap: "4px", justifyContent: align === "center" ? "center" : "flex-start" }}
      >
        {text}
        {locked ? (
          <span aria-label="locked" title="Locked" style={{ fontSize: "9px" }}>
            🔒
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <input
      value={text}
      inputMode="numeric"
      onChange={(e) => onValueChange?.(e.target.value)}
      className="paper-serif"
      style={{
        width,
        border: 0,
        borderBottom: overMax ? "1px solid #b91c1c" : "1px solid transparent",
        background: "transparent",
        outline: "none",
        textAlign: align,
        color: overMax ? "#b91c1c" : "inherit",
        fontFamily: "inherit",
        fontSize: "inherit",
      }}
      title={overMax ? `Maximum is ${max}` : undefined}
    />
  );
}
