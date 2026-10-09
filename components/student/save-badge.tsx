"use client";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * The small "Saved" tick shown in the viewer toolbar, outside the paper
 * (SPEC.md E6). Autosave drives it from the sheet components.
 */
export function SaveBadge({ status, message }: { status: SaveStatus; message?: string | null }) {
  const text =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "error"
          ? (message ?? "Not saved")
          : "All changes saved";
  const colour =
    status === "error" ? "text-red-600" : status === "saved" ? "text-green-700" : "text-muted-foreground";
  return (
    <span className={`text-xs ${colour}`} title={message ?? undefined}>
      {text}
    </span>
  );
}
