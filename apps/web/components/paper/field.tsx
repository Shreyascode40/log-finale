"use client";

import type { InputHTMLAttributes } from "react";

export type FieldProps = {
  value?: string | number | null;
  onValueChange?: (value: string) => void;
  readOnly?: boolean;
  missing?: boolean;
  /** Tailwind-independent inline width, e.g. "100%" or "120px". */
  width?: string;
  /** Render as a multi-line underlined block (description / contribution). */
  lines?: number;
  type?: InputHTMLAttributes<HTMLInputElement>["type"];
  placeholder?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  disabled?: boolean;
};

/**
 * The logbook "blank line". Editable it is an input drawn only as a bottom
 * rule; read-only or locked it prints as plain text on the same rule.
 */
export function Field({
  value,
  onValueChange,
  readOnly = false,
  missing = false,
  width = "100%",
  lines,
  type = "text",
  placeholder,
  className = "",
  name,
  ariaLabel,
  disabled = false,
}: FieldProps) {
  const text = value === null || value === undefined ? "" : String(value);
  const classes = [
    "paper-field",
    missing ? "paper-field--missing" : "",
    readOnly ? "paper-field--readonly" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  // A multi-line underlined block: draws N rules behind a transparent textarea.
  if (lines && lines > 0) {
    return (
      <div style={{ width, position: "relative" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={{ borderBottom: "1px solid #000", height: "20px" }} />
        ))}
        {readOnly ? (
          <div
            className="paper-serif"
            style={{ position: "absolute", inset: 0, padding: "0 2px", whiteSpace: "pre-wrap" }}
          >
            {text}
          </div>
        ) : (
          <textarea
            name={name}
            aria-label={ariaLabel}
            value={text}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onValueChange?.(e.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: 0,
              background: "transparent",
              resize: "none",
              outline: "none",
              fontFamily: "inherit",
              fontSize: "inherit",
              lineHeight: "20px",
              padding: "0 2px",
              color: "inherit",
            }}
          />
        )}
      </div>
    );
  }

  if (readOnly) {
    return (
      <span className={classes} style={{ width, minWidth: width }} aria-label={ariaLabel}>
        {text || "\u00a0"}
      </span>
    );
  }

  return (
    <input
      className={classes}
      style={{ width }}
      type={type}
      name={name}
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  );
}
