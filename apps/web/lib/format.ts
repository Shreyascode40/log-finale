/** Date/time formatting helpers. All e-signatures render through these. */

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** "Signed by <name> on <date time>" — the canonical e-signature rendering. */
export function signedBy(name: string | null | undefined, at: Date | string | null | undefined): string {
  const when = formatDateTime(at);
  if (!name && !when) return "";
  return `Signed by ${name ?? "—"}${when ? ` on ${when}` : ""}`;
}
