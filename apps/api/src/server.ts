import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { z } from "zod";
import { readInternalIdentity } from "./auth.js";
import { prisma } from "./db.js";
import { toJson } from "./json.js";

try {
  loadEnvFile(process.env.API_ENV_FILE ?? ".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const updateScheduleItemSchema = z.object({
  id: z.string().min(1),
  date: z.string().trim().max(120),
  note: z.string().trim().max(200),
});

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const allowedOrigins = new Set(
  (process.env.API_ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

function applyCors(request: IncomingMessage, response: ServerResponse): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!allowedOrigins.has(origin)) return false;

  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  response.setHeader("access-control-allow-methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("access-control-allow-headers", "authorization, content-type");
  return true;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function authenticatedUser(request: IncomingMessage) {
  const identity = readInternalIdentity(request);
  if (!identity) return null;
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, role: true, active: true },
  });
  if (!user?.active || !["STUDENT", "GUIDE", "HOD"].includes(user.role)) return null;
  return user;
}

const scheduleTerms = [
  { term: "SEMESTER_I", label: "Semester I" },
  { term: "SEMESTER_II", label: "Semester II" },
] as const;

async function handleApiRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://api.local").pathname;

  if (method === "GET" && pathname === "/v1/schedule") {
    const items = await prisma.scheduleItem.findMany({ orderBy: { sortOrder: "asc" } });
    sendJson(response, 200, scheduleTerms.map(({ term, label }) => ({
      term,
      label,
      rows: items.filter((item) => item.term === term).map((item) => ({
        id: item.id,
        sortOrder: item.sortOrder,
        description: item.description,
        date: item.date ?? "",
        note: item.note ?? "",
      })),
    })));
    return;
  }

  const scheduleMatch = pathname.match(/^\/v1\/schedule\/([^/]+)$/);
  if (method === "PATCH" && scheduleMatch) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    if (user.role !== "HOD") {
      sendJson(response, 403, { error: "Only the Head of Department can edit the schedule." });
      return;
    }

    let parsed;
    try {
      parsed = updateScheduleItemSchema.safeParse({ ...(await readJson(request) as object), id: decodeURIComponent(scheduleMatch[1]!) });
    } catch {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
      return;
    }
    if (!parsed.success) {
      sendJson(response, 400, { error: parsed.error.issues[0]?.message ?? "Invalid input." });
      return;
    }

    const { id, date, note } = parsed.data;
    const item = await prisma.scheduleItem.findUnique({ where: { id } });
    if (!item) {
      sendJson(response, 404, { error: "That schedule row does not exist." });
      return;
    }
    const data = { date: date || null, note: note || null };
    await prisma.$transaction(async (tx) => {
      await tx.scheduleItem.update({ where: { id }, data });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "SCHEDULE_UPDATE",
          entity: "ScheduleItem",
          entityId: id,
          before: toJson({ date: item.date, note: item.note }),
          after: toJson(data),
        },
      });
    });
    sendJson(response, 200, { success: true });
    return;
  }

  sendJson(response, 404, { error: "Not found." });
}

const server = createServer((request, response) => {
  if (!applyCors(request, response)) {
    sendJson(response, 403, { error: "Origin is not allowed." });
    return;
  }

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const pathname = new URL(request.url ?? "/", "http://api.local").pathname;
  if (request.method === "GET" && (pathname === "/health" || pathname === "/v1/health")) {
    sendJson(response, 200, { status: "ok", service: "be-logbook-api" });
    return;
  }
  void handleApiRequest(request, response).catch((error: unknown) => {
    console.error("API request failed", error);
    if (!response.headersSent) sendJson(response, 500, { error: "Internal server error." });
    else response.end();
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`BE Log Book API listening on port ${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
