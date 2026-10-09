/**
 * JSON helpers.
 *
 * The spec's data model stores several fields as JSON (components, answers,
 * items, ratings, snapshots). SQLite has no JSON column type, so those fields
 * are `String` columns holding JSON text. Always read/write them through these
 * helpers so a future switch to PostgreSQL `Json` columns is a one-place change.
 */

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
