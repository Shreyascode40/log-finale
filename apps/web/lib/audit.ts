import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { toJson } from "./json";

/** Accepts the normal client or a transaction client so writes stay atomic. */
export type AuditClient = PrismaClient | Prisma.TransactionClient;

export type LogActionInput = {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  /** State before the change (serialized to JSON text). */
  before?: unknown;
  /** State after the change (serialized to JSON text). */
  after?: unknown;
};

/**
 * Every create, update, approve, unlock, assignment and PDF generation calls
 * this (master prompt rule 10). AuditLog.before/after are JSON text columns.
 */
export async function logAction(input: LogActionInput, client: AuditClient = prisma): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: input.before === undefined ? null : toJson(input.before),
      after: input.after === undefined ? null : toJson(input.after),
    },
  });
}
