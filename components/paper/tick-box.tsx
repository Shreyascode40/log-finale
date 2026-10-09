"use client";

export type TickBoxProps = {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  readOnly?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

/** Plain black square tick used by the rules checklist and submission checklists. */
export function TickBox({
  checked = false,
  onCheckedChange,
  readOnly = false,
  disabled = false,
  ariaLabel,
}: TickBoxProps) {
  const box = (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: "13px",
        height: "13px",
        border: "1px solid #000",
        lineHeight: "11px",
        textAlign: "center",
        fontSize: "11px",
        verticalAlign: "middle",
        background: "#fff",
      }}
    >
      {checked ? "✓" : ""}
    </span>
  );

  if (readOnly || disabled) {
    return (
      <span aria-label={ariaLabel} style={{ opacity: disabled ? 0.5 : 1 }}>
        {box}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={checked}
      onClick={() => onCheckedChange?.(!checked)}
      style={{ border: 0, background: "transparent", padding: 0, cursor: "pointer" }}
    >
      {box}
    </button>
  );
}
