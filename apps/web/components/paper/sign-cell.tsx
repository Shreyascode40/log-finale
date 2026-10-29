"use client";

import { formatDateTime } from "@/lib/format";

export type SignCellProps = {
  /** Display name of the signer, if the cell is already signed. */
  signedByName?: string | null;
  signedAt?: Date | string | null;
  /** Show the "Sign" button (the user is allowed to sign this cell now). */
  canSign?: boolean;
  onSign?: () => void;
  /** Button caption, e.g. "Sign", "Accept", "Confirm". */
  actionLabel?: string;
  /** Shown when the cell is empty and the user cannot sign yet. */
  emptyHint?: string;
  compact?: boolean;
};

/**
 * E-signature cell. Authenticated user clicks once; we store id + display name
 * + timestamp and print "Signed by <name> on <date time>".
 */
export function SignCell({
  signedByName,
  signedAt,
  canSign = false,
  onSign,
  actionLabel = "Sign",
  emptyHint,
  compact = false,
}: SignCellProps) {
  if (signedAt) {
    return (
      <span className="paper-sign" title={signedByName ? `Signed by ${signedByName}` : undefined}>
        Signed by {signedByName ?? "—"} on {formatDateTime(signedAt)}
      </span>
    );
  }

  if (canSign) {
    return (
      <button
        type="button"
        onClick={onSign}
        className="paper-serif"
        style={{
          border: "1px solid #000",
          background: "#fff",
          padding: compact ? "0 6px" : "1px 8px",
          fontSize: compact ? "10px" : "11px",
          cursor: "pointer",
        }}
      >
        {actionLabel}
      </button>
    );
  }

  return <span className="paper-serif" style={{ color: "#555" }}>{emptyHint ?? ""}</span>;
}
