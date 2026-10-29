/** JSON text helpers for fields stored as strings in the shared Prisma schema. */
export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}
