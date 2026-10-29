import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { loadEnvFile } from "node:process";
import { z } from "zod";
import { readInternalIdentity } from "./auth.js";
import { prisma } from "./db.js";
import { toJson } from "./json.js";
import { ApiDomainError } from "./errors.js";
import {
  acceptInvite,
  createGroup,
  declineInvite,
  getGroupInfoById,
  getStudentGroupOnboarding,
  inviteMember,
  joinByCode,
  removeMember,
  submitGroup,
  type GroupActor,
} from "./modules/groups.js";
import { acceptUndertaking, acknowledgeRules, type SignoffActor } from "./modules/signoff.js";
import {
  getStudentGroupInfo,
  updateCover,
  updateMember,
  updateMemberPhoto,
  type GroupInfoActor,
} from "./modules/group-info.js";
import { listRecentActivity } from "./modules/activity.js";
import {
  decideTopic,
  getStudentTopicGroupId,
  getTopicSheet,
  listGuideTopicGroups,
  listTopicQueue,
  saveTopic,
  scoreTopic,
  type TopicActor,
} from "./modules/topic.js";
import {
  confirmEntry,
  getMonthChart,
  getStudentChartGroupId,
  listChartQueue,
  listGuideChartGroups,
  verifyEntry,
  type ActivityChartActor,
  type ActivityMonth,
} from "./modules/activity-chart.js";
import {
  approveReview,
  getReviewSheet,
  getStudentReviewGroupId,
  listGroupReviewStatuses,
  listGuideReviewGroups,
  listReviewQueue,
  saveReviewDraft,
  submitReview,
  unlockReview,
  type ReviewActor,
} from "./modules/review.js";
import {
  approveEvalSheets,
  getEvaluationSheet,
  getStudentEvalGroupId,
  listEvalQueue,
  listGuideEvalGroups,
  saveEvalSheets,
  submitEvalSheets,
  unlockEvalSheets,
  type EvalActor,
  type EvalKind,
} from "./modules/evaluation.js";
import {
  getExaminerSheet,
  getStudentExaminerGroupId,
  listExaminerQueue,
  listGuideExaminerGroups,
  saveExaminerFeedback,
  type ExaminerActor,
} from "./modules/examiner.js";
import {
  deleteCompetition,
  deleteNote,
  deletePaper,
  getChecklist,
  getContentPage,
  getGroupRecords,
  listCompetitions,
  listNotes,
  listPapers,
  listRecordsQueue,
  saveCompetition,
  saveContent,
  saveNote,
  savePaper,
  setChecklist,
  uploadCertificate,
  uploadContentFile,
  uploadPaperFile,
  type RecordsActor,
} from "./modules/records.js";
import {
  deleteMeeting,
  getSponsoredSheet,
  getStudentSponsoredGroupId,
  listGuideSponsoredGroups,
  listSponsoredQueue,
  recordExternalSign,
  saveMeeting,
  saveSponsorFeedback,
  signMeetingGuide,
  signMeetingStudent,
  uploadSeal,
  type SponsoredActor,
} from "./modules/sponsored.js";
import {
  approveGroup,
  assignGuide,
  createGuide,
  getHodDashboardStats,
  listActiveGuides,
  listAdminGroups,
  listAssignments,
  listAuditLogs,
  listGuides,
  rejectGroup,
  setGroupSponsored,
  setPdfPermission,
  setUserActive,
  updateGuide,
  type AdminActor,
} from "./modules/admin.js";
import { listForUser, markAllRead } from "./modules/notifications.js";
import {
  getGroupCompletion,
  getGroupCompletions,
  getGuideOverview,
  getHodOverview,
} from "./completion/index.js";
import {
  authorizeFileAccess,
  authorizeMediaPdf,
  checkPdfGate,
  getPdfExport,
  recordPdfExport,
  listGroupPdfExports,
  type PdfActor,
} from "./modules/pdf.js";
import {
  getGalleryData,
  getGallerySummary,
  type GalleryActor,
  type GalleryKind,
} from "./modules/gallery.js";
import {
  authenticate,
  requestPasswordReset,
  resetPassword,
  signupStudent,
  verifyEmail,
} from "./modules/auth.js";





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

async function readBytes(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > maxBytes) throw new ApiDomainError("FILE_TOO_LARGE", "File is too large", 413);
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function authenticatedUser(request: IncomingMessage) {
  const identity = readInternalIdentity(request);
  if (!identity) return null;
  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, role: true, active: true, email: true, rollNo: true },
  });
  if (!user?.active || !["STUDENT", "GUIDE", "HOD"].includes(user.role)) return null;
  return user;
}

async function handleGroupRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
  pathname: string,
): Promise<boolean> {
  const memberMatch = pathname.match(/^\/v1\/groups\/members\/([^/]+)$/);
  const infoMatch = pathname.match(/^\/v1\/groups\/([^/]+)\/info$/);
  const isGroupRoute = pathname === "/v1/groups" || pathname.startsWith("/v1/groups/");
  if (!isGroupRoute) return false;

  const user = await authenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Authentication required." });
    return true;
  }
  const actor: GroupActor = {
    id: user.id,
    role: user.role,
    email: user.email,
    rollNo: user.rollNo,
  };

  try {
    if (method === "POST" && pathname === "/v1/groups") {
      sendJson(response, 201, await createGroup(actor, await readJson(request)));
    } else if (method === "POST" && pathname === "/v1/groups/invites") {
      sendJson(response, 201, await inviteMember(actor, await readJson(request)));
    } else if (method === "POST" && pathname === "/v1/groups/invites/accept") {
      sendJson(response, 200, await acceptInvite(actor, await readJson(request)));
    } else if (method === "POST" && pathname === "/v1/groups/invites/decline") {
      await declineInvite(actor, await readJson(request));
      sendJson(response, 200, { success: true });
    } else if (method === "POST" && pathname === "/v1/groups/join-by-code") {
      sendJson(response, 200, await joinByCode(actor, await readJson(request)));
    } else if (method === "DELETE" && memberMatch) {
      await removeMember(actor, { memberId: decodeURIComponent(memberMatch[1]!) });
      sendJson(response, 200, { success: true });
    } else if (method === "POST" && pathname === "/v1/groups/submit") {
      await submitGroup(actor, await readJson(request));
      sendJson(response, 200, { success: true });
    } else if (method === "GET" && pathname === "/v1/groups/onboarding") {
      sendJson(response, 200, await getStudentGroupOnboarding(actor));
    } else if (method === "GET" && infoMatch) {
      sendJson(response, 200, await getGroupInfoById(actor, decodeURIComponent(infoMatch[1]!)));
    } else {
      sendJson(response, 404, { error: "Not found." });
    }
  } catch (error) {
    if (error instanceof ApiDomainError) {
      sendJson(response, error.status, { error: error.message, code: error.code });
      return true;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
      return true;
    }
    throw error;
  }
  return true;
}

async function handleSignoffRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
  pathname: string,
): Promise<boolean> {
  if (method !== "POST" || !["/v1/signoff/rules", "/v1/signoff/undertaking"].includes(pathname)) {
    return false;
  }
  const user = await authenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Authentication required." });
    return true;
  }
  try {
    const body = z.object({ memberId: z.string().min(1) }).safeParse(await readJson(request));
    if (!body.success) {
      sendJson(response, 400, { error: body.error.issues[0]?.message ?? "Choose a member to sign." });
      return true;
    }
    const actor: SignoffActor = { id: user.id, role: user.role };
    const result = pathname.endsWith("/rules")
      ? await acknowledgeRules(actor, body.data.memberId)
      : await acceptUndertaking(actor, body.data.memberId);
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof ApiDomainError) {
      sendJson(response, error.status, { error: error.message, code: error.code });
      return true;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
      return true;
    }
    throw error;
  }
  return true;
}

async function handleGroupInfoRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
  pathname: string,
): Promise<boolean> {
  const photoMatch = pathname.match(/^\/v1\/student\/group-info\/members\/([^/]+)\/photo$/);
  const route = pathname === "/v1/student/group-info" || pathname.startsWith("/v1/student/group-info/");
  if (!route) return false;
  const user = await authenticatedUser(request);
  if (!user) {
    sendJson(response, 401, { error: "Authentication required." });
    return true;
  }
  const actor: GroupInfoActor = { id: user.id, role: user.role };
  try {
    if (method === "GET" && pathname === "/v1/student/group-info") {
      sendJson(response, 200, await getStudentGroupInfo(actor));
    } else if (method === "POST" && pathname === "/v1/student/group-info/cover") {
      await updateCover(actor, await readJson(request));
      sendJson(response, 200, { success: true });
    } else if (method === "POST" && pathname === "/v1/student/group-info/member") {
      await updateMember(actor, await readJson(request));
      sendJson(response, 200, { success: true });
    } else if (method === "PUT" && photoMatch) {
      const contentType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
      const bytes = await readBytes(request, 2 * 1024 * 1024);
      const result = await updateMemberPhoto(actor, decodeURIComponent(photoMatch[1]!), contentType, bytes);
      sendJson(response, 200, result);
    } else {
      sendJson(response, 404, { error: "Not found." });
    }
  } catch (error) {
    if (error instanceof ApiDomainError) {
      sendJson(response, error.status, { error: error.message, code: error.code });
      return true;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
      return true;
    }
    throw error;
  }
  return true;
}

async function handleAuthRequest(
  request: IncomingMessage,
  response: ServerResponse,
  method: string,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith("/v1/auth/")) return false;

  const identity = readInternalIdentity(request);
  if (!identity) {
    sendJson(response, 401, { error: "Authentication required." });
    return true;
  }

  try {
    if (method === "POST" && pathname === "/v1/auth/signup") {
      const body = await readJson(request);
      sendJson(response, 200, await signupStudent(body));
      return true;
    }
    if (method === "POST" && pathname === "/v1/auth/login") {
      const body = (await readJson(request)) as { email?: string; password?: string };
      sendJson(response, 200, await authenticate(body.email ?? "", body.password ?? ""));
      return true;
    }
    if (method === "POST" && pathname === "/v1/auth/verify-email") {
      const body = (await readJson(request)) as { token?: string };
      sendJson(response, 200, await verifyEmail(body.token ?? ""));
      return true;
    }
    if (method === "POST" && pathname === "/v1/auth/forgot-password") {
      const body = await readJson(request);
      sendJson(response, 200, await requestPasswordReset(body));
      return true;
    }
    if (method === "POST" && pathname === "/v1/auth/reset-password") {
      const body = await readJson(request);
      await resetPassword(body);
      sendJson(response, 200, { success: true });
      return true;
    }

    sendJson(response, 404, { error: "Not found." });
    return true;
  } catch (error) {
    if (error instanceof ApiDomainError) {
      sendJson(response, error.status, { error: error.message, code: error.code });
      return true;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
      return true;
    }
    throw error;
  }
}

const scheduleTerms = [
  { term: "SEMESTER_I", label: "Semester I" },
  { term: "SEMESTER_II", label: "Semester II" },
] as const;

async function handleApiRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://api.local").pathname;
  const requestUrl = new URL(request.url ?? "/", "http://api.local");

  if (await handleAuthRequest(request, response, method, pathname)) return;

  if (pathname.startsWith("/v1/activity-charts")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: ActivityChartActor = { id: user.id, role: user.role };
    const monthMatch = pathname.match(/^\/v1\/activity-charts\/groups\/([^/]+)\/([^/]+)$/);
    try {
      if (method === "GET" && pathname === "/v1/activity-charts/student-group") {
        sendJson(response, 200, await getStudentChartGroupId(actor));
      } else if (method === "GET" && pathname === "/v1/activity-charts/guide-groups") {
        sendJson(response, 200, await listGuideChartGroups(actor));
      } else if (method === "GET" && pathname === "/v1/activity-charts/hod-queue") {
        sendJson(response, 200, await listChartQueue(actor));
      } else if (method === "GET" && monthMatch) {
        sendJson(response, 200, await getMonthChart(
          actor,
          decodeURIComponent(monthMatch[1]!),
          decodeURIComponent(monthMatch[2]!) as ActivityMonth,
        ));
      } else if (method === "POST" && pathname === "/v1/activity-charts/confirm") {
        sendJson(response, 200, await confirmEntry(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/activity-charts/verify") {
        sendJson(response, 200, await verifyEntry(actor, await readJson(request)));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/topics")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: TopicActor = { id: user.id, role: user.role };
    try {
      if (method === "GET" && pathname === "/v1/topics/student-group") {
        sendJson(response, 200, await getStudentTopicGroupId(actor));
      } else if (method === "GET" && pathname === "/v1/topics/guide-groups") {
        sendJson(response, 200, await listGuideTopicGroups(actor));
      } else if (method === "GET" && pathname === "/v1/topics/hod-queue") {
        sendJson(response, 200, await listTopicQueue(actor));
      } else if (method === "GET" && (pathname.match(/^\/v1\/topics\/group\/[^/]+$/))) {
        const groupId = decodeURIComponent(pathname.split("/").at(-1)!);
        sendJson(response, 200, await getTopicSheet(actor, groupId));
      } else if (method === "POST" && pathname === "/v1/topics/save") {
        await saveTopic(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/topics/score") {
        await scoreTopic(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/topics/decide") {
        await decideTopic(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/reviews")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: ReviewActor = { id: user.id, role: user.role };
    const groupStatusMatch = pathname.match(/^\/v1\/reviews\/groups\/([^/]+)\/statuses$/);
    const sheetMatch = pathname.match(/^\/v1\/reviews\/groups\/([^/]+)\/([^/]+)$/);
    try {
      if (method === "GET" && pathname === "/v1/reviews/student-group") {
        sendJson(response, 200, await getStudentReviewGroupId(actor));
      } else if (method === "GET" && pathname === "/v1/reviews/guide-groups") {
        sendJson(response, 200, await listGuideReviewGroups(actor));
      } else if (method === "GET" && pathname === "/v1/reviews/hod-queue") {
        sendJson(response, 200, await listReviewQueue(actor));
      } else if (method === "GET" && groupStatusMatch) {
        sendJson(response, 200, await listGroupReviewStatuses(actor, decodeURIComponent(groupStatusMatch[1]!)));
      } else if (method === "GET" && sheetMatch) {
        sendJson(
          response,
          200,
          await getReviewSheet(actor, decodeURIComponent(sheetMatch[1]!), decodeURIComponent(sheetMatch[2]!)),
        );
      } else if (method === "POST" && pathname === "/v1/reviews/draft") {
        await saveReviewDraft(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/reviews/submit") {
        await submitReview(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/reviews/approve") {
        await approveReview(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/reviews/unlock") {
        await unlockReview(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/evaluation")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: EvalActor = { id: user.id, role: user.role };
    const guideMatch = pathname.match(/^\/v1\/evaluation\/guide-groups\/([^/]+)$/);
    const queueMatch = pathname.match(/^\/v1\/evaluation\/hod-queue\/([^/]+)$/);
    const sheetMatch = pathname.match(/^\/v1\/evaluation\/groups\/([^/]+)\/([^/]+)$/);
    try {
      if (method === "GET" && pathname === "/v1/evaluation/student-group") {
        sendJson(response, 200, await getStudentEvalGroupId(actor));
      } else if (method === "GET" && guideMatch) {
        sendJson(response, 200, await listGuideEvalGroups(actor, decodeURIComponent(guideMatch[1]!) as EvalKind));
      } else if (method === "GET" && queueMatch) {
        sendJson(response, 200, await listEvalQueue(actor, decodeURIComponent(queueMatch[1]!) as EvalKind));
      } else if (method === "GET" && sheetMatch) {
        sendJson(
          response,
          200,
          await getEvaluationSheet(actor, decodeURIComponent(sheetMatch[1]!), decodeURIComponent(sheetMatch[2]!) as EvalKind),
        );
      } else if (method === "POST" && pathname === "/v1/evaluation/save") {
        const body = (await readJson(request)) as { kind: EvalKind };
        await saveEvalSheets(actor, body.kind, body);
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/evaluation/submit") {
        const body = (await readJson(request)) as { kind: EvalKind };
        await submitEvalSheets(actor, body.kind, body);
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/evaluation/approve") {
        const body = (await readJson(request)) as { kind: EvalKind };
        await approveEvalSheets(actor, body.kind, body);
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/evaluation/unlock") {
        const body = (await readJson(request)) as { kind: EvalKind };
        await unlockEvalSheets(actor, body.kind, body);
        sendJson(response, 200, { success: true });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/examiner")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: ExaminerActor = { id: user.id, role: user.role };
    const sheetMatch = pathname.match(/^\/v1\/examiner\/groups\/([^/]+)\/([^/]+)$/);
    try {
      if (method === "GET" && pathname === "/v1/examiner/student-group") {
        sendJson(response, 200, await getStudentExaminerGroupId(actor));
      } else if (method === "GET" && pathname === "/v1/examiner/guide-groups") {
        sendJson(response, 200, await listGuideExaminerGroups(actor));
      } else if (method === "GET" && pathname === "/v1/examiner/hod-queue") {
        sendJson(response, 200, await listExaminerQueue(actor));
      } else if (method === "GET" && sheetMatch) {
        sendJson(
          response,
          200,
          await getExaminerSheet(actor, decodeURIComponent(sheetMatch[1]!), decodeURIComponent(sheetMatch[2]!)),
        );
      } else if (method === "POST" && pathname === "/v1/examiner/save") {
        await saveExaminerFeedback(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/records")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: RecordsActor = { id: user.id, role: user.role };
    const competitionsMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/competitions$/);
    const certMatch = pathname.match(/^\/v1\/records\/competitions\/([^/]+)\/certificate$/);
    const papersMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/papers$/);
    const paperFileMatch = pathname.match(/^\/v1\/records\/papers\/([^/]+)\/file$/);
    const checklistMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/checklists\/([^/]+)$/);
    const contentMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/content\/([^/]+)$/);
    const contentFileMatch = pathname.match(/^\/v1\/records\/content\/([^/]+)\/file$/);
    const notesMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/notes$/);
    const bundleMatch = pathname.match(/^\/v1\/records\/groups\/([^/]+)\/bundle$/);

    try {
      if (method === "GET" && pathname === "/v1/records/hod-queue") {
        sendJson(response, 200, await listRecordsQueue(actor));
      } else if (method === "GET" && competitionsMatch) {
        sendJson(response, 200, await listCompetitions(actor, decodeURIComponent(competitionsMatch[1]!)));
      } else if (method === "POST" && pathname === "/v1/records/competitions") {
        sendJson(response, 200, await saveCompetition(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/records/competitions/delete") {
        await deleteCompetition(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "PUT" && certMatch) {
        const contentType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
        const bytes = await readBytes(request, 10 * 1024 * 1024);
        const url = await uploadCertificate(actor, decodeURIComponent(certMatch[1]!), contentType, bytes);
        sendJson(response, 200, { url });
      } else if (method === "GET" && papersMatch) {
        sendJson(response, 200, await listPapers(actor, decodeURIComponent(papersMatch[1]!)));
      } else if (method === "POST" && pathname === "/v1/records/papers") {
        sendJson(response, 200, await savePaper(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/records/papers/delete") {
        await deletePaper(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "PUT" && paperFileMatch) {
        const contentType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
        const bytes = await readBytes(request, 10 * 1024 * 1024);
        const url = await uploadPaperFile(actor, decodeURIComponent(paperFileMatch[1]!), contentType, bytes);
        sendJson(response, 200, { url });
      } else if (method === "GET" && checklistMatch) {
        sendJson(
          response,
          200,
          await getChecklist(actor, decodeURIComponent(checklistMatch[1]!), decodeURIComponent(checklistMatch[2]!)),
        );
      } else if (method === "POST" && pathname === "/v1/records/checklists") {
        sendJson(response, 200, await setChecklist(actor, await readJson(request)));
      } else if (method === "GET" && contentMatch) {
        sendJson(
          response,
          200,
          await getContentPage(
            actor,
            decodeURIComponent(contentMatch[1]!),
            decodeURIComponent(contentMatch[2]!) as "RTM" | "COST",
          ),
        );
      } else if (method === "POST" && pathname === "/v1/records/content") {
        sendJson(response, 200, await saveContent(actor, await readJson(request)));
      } else if (method === "PUT" && contentFileMatch) {
        const contentType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
        const bytes = await readBytes(request, 10 * 1024 * 1024);
        const url = await uploadContentFile(
          actor,
          decodeURIComponent(contentFileMatch[1]!) as "RTM" | "COST",
          contentType,
          bytes,
        );
        sendJson(response, 200, { url });
      } else if (method === "GET" && notesMatch) {
        sendJson(response, 200, await listNotes(actor, decodeURIComponent(notesMatch[1]!)));
      } else if (method === "POST" && pathname === "/v1/records/notes") {
        sendJson(response, 200, await saveNote(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/records/notes/delete") {
        await deleteNote(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "GET" && bundleMatch) {
        sendJson(response, 200, await getGroupRecords(actor, decodeURIComponent(bundleMatch[1]!)));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/sponsored")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: SponsoredActor = { id: user.id, role: user.role };
    const groupMatch = pathname.match(/^\/v1\/sponsored\/groups\/([^/]+)$/);

    try {
      if (method === "GET" && pathname === "/v1/sponsored/student-group") {
        sendJson(response, 200, await getStudentSponsoredGroupId(actor));
      } else if (method === "GET" && pathname === "/v1/sponsored/guide-groups") {
        sendJson(response, 200, await listGuideSponsoredGroups(actor));
      } else if (method === "GET" && pathname === "/v1/sponsored/hod-queue") {
        sendJson(response, 200, await listSponsoredQueue(actor));
      } else if (method === "GET" && groupMatch) {
        sendJson(response, 200, await getSponsoredSheet(actor, decodeURIComponent(groupMatch[1]!)));
      } else if (method === "POST" && pathname === "/v1/sponsored/meetings") {
        sendJson(response, 200, await saveMeeting(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/sponsored/meetings/delete") {
        await deleteMeeting(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/sponsored/meetings/sign-student") {
        sendJson(response, 200, await signMeetingStudent(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/sponsored/meetings/sign-guide") {
        sendJson(response, 200, await signMeetingGuide(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/sponsored/meetings/record-external-sign") {
        sendJson(response, 200, await recordExternalSign(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/sponsored/feedback") {
        sendJson(response, 200, await saveSponsorFeedback(actor, await readJson(request)));
      } else if (method === "PUT" && pathname === "/v1/sponsored/seal") {
        const contentType = request.headers["content-type"]?.split(";")[0]?.trim() ?? "";
        const bytes = await readBytes(request, 2 * 1024 * 1024);
        const url = await uploadSeal(actor, contentType, bytes);
        sendJson(response, 200, { url });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/admin")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: AdminActor = { id: user.id, role: user.role };

    try {
      if (method === "GET" && pathname === "/v1/admin/guides") {
        sendJson(response, 200, await listGuides(actor));
      } else if (method === "GET" && pathname === "/v1/admin/guides/active") {
        sendJson(response, 200, await listActiveGuides(actor));
      } else if (method === "POST" && pathname === "/v1/admin/guides") {
        sendJson(response, 200, await createGuide(actor, await readJson(request)));
      } else if (method === "PATCH" && pathname === "/v1/admin/guides") {
        await updateGuide(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/admin/users/active") {
        await setUserActive(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "GET" && pathname === "/v1/admin/assignments") {
        sendJson(response, 200, await listAssignments(actor));
      } else if (method === "POST" && pathname === "/v1/admin/groups/approve") {
        sendJson(response, 200, await approveGroup(actor, await readJson(request)));
      } else if (method === "POST" && pathname === "/v1/admin/groups/reject") {
        await rejectGroup(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/admin/groups/assign-guide") {
        await assignGuide(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/admin/groups/sponsored") {
        await setGroupSponsored(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "POST" && pathname === "/v1/admin/groups/pdf-permission") {
        await setPdfPermission(actor, await readJson(request));
        sendJson(response, 200, { success: true });
      } else if (method === "GET" && pathname === "/v1/admin/groups") {
        sendJson(response, 200, await listAdminGroups(actor));
      } else if (method === "GET" && pathname === "/v1/admin/audit") {
        const query = {
          entity: requestUrl.searchParams.get("entity") ?? undefined,
          action: requestUrl.searchParams.get("action") ?? undefined,
          user: requestUrl.searchParams.get("user") ?? undefined,
        };
        sendJson(response, 200, await listAuditLogs(actor, query));
      } else if (method === "GET" && pathname === "/v1/admin/stats") {
        sendJson(response, 200, await getHodDashboardStats(actor));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/notifications")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    try {
      if (method === "GET" && pathname === "/v1/notifications") {
        const limit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "20", 10);
        sendJson(response, 200, await listForUser(user.id, Number.isNaN(limit) ? 20 : limit));
      } else if (method === "POST" && pathname === "/v1/notifications/mark-read") {
        await markAllRead(user.id);
        sendJson(response, 200, { success: true });
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/completion")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }

    const groupMatch = pathname.match(/^\/v1\/completion\/groups\/([^/]+)$/);

    try {
      if (method === "GET" && groupMatch) {
        const completion = await getGroupCompletion(decodeURIComponent(groupMatch[1]!));
        sendJson(response, 200, completion);
      } else if (method === "POST" && pathname === "/v1/completion/batch") {
        const body = (await readJson(request)) as { groupIds?: string[] };
        const map = await getGroupCompletions(body.groupIds ?? []);
        sendJson(response, 200, Object.fromEntries(map));
      } else if (method === "GET" && pathname === "/v1/completion/guide-overview") {
        if (user.role !== "GUIDE") {
          sendJson(response, 403, { error: "Only guides can view the guide overview." });
          return;
        }
        sendJson(response, 200, await getGuideOverview(user.id));
      } else if (method === "GET" && pathname === "/v1/completion/hod-overview") {
        if (user.role !== "HOD") {
          sendJson(response, 403, { error: "Only the Head of Department can view the HOD overview." });
          return;
        }
        sendJson(response, 200, await getHodOverview());
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/pdf")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: PdfActor = { id: user.id, role: user.role };
    const gateMatch = pathname.match(/^\/v1\/pdf\/groups\/([^/]+)\/gate$/);
    const exportMatch = pathname.match(/^\/v1\/pdf\/exports\/([^/]+)$/);
    const exportsListMatch = pathname.match(/^\/v1\/pdf\/groups\/([^/]+)\/exports$/);

    try {
      if (method === "GET" && gateMatch) {
        sendJson(response, 200, await checkPdfGate(actor, decodeURIComponent(gateMatch[1]!)));
      } else if (method === "POST" && pathname === "/v1/pdf/exports") {
        const body = (await readJson(request)) as { groupId: string; storageRef: string };
        sendJson(response, 200, await recordPdfExport(actor, body.groupId, body.storageRef));
      } else if (method === "GET" && exportMatch) {
        sendJson(response, 200, await getPdfExport(actor, decodeURIComponent(exportMatch[1]!)));
      } else if (method === "GET" && exportsListMatch) {
        sendJson(response, 200, await listGroupPdfExports(actor, decodeURIComponent(exportsListMatch[1]!)));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { error: "Request body must be valid JSON and no larger than 64 KB." });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/files")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: PdfActor = { id: user.id, role: user.role };

    try {
      if (method === "GET" && pathname === "/v1/files/authorize") {
        const fileUrl = requestUrl.searchParams.get("fileUrl") ?? "";
        sendJson(response, 200, await authorizeFileAccess(actor, fileUrl));
      } else if (method === "GET" && pathname === "/v1/files/authorize-media-pdf") {
        const fileUrl = requestUrl.searchParams.get("fileUrl") ?? "";
        sendJson(response, 200, await authorizeMediaPdf(actor, fileUrl));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      throw error;
    }
    return;
  }

  if (pathname.startsWith("/v1/gallery")) {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const actor: GalleryActor = { id: user.id, role: user.role };
    const kindMatch = pathname.match(/^\/v1\/gallery\/([^/]+)$/);

    try {
      if (method === "GET" && pathname === "/v1/gallery/summary") {
        sendJson(response, 200, await getGallerySummary(actor));
      } else if (method === "GET" && kindMatch) {
        sendJson(response, 200, await getGalleryData(actor, decodeURIComponent(kindMatch[1]!) as GalleryKind));
      } else {
        sendJson(response, 404, { error: "Not found." });
      }
    } catch (error) {
      if (error instanceof ApiDomainError) {
        sendJson(response, error.status, { error: error.message, code: error.code });
        return;
      }
      throw error;
    }
    return;
  }

  if (method === "GET" && pathname === "/v1/activity") {
    const user = await authenticatedUser(request);
    if (!user) {
      sendJson(response, 401, { error: "Authentication required." });
      return;
    }
    const requestedLimit = Number.parseInt(requestUrl.searchParams.get("limit") ?? "12", 10);
    const items = await listRecentActivity(
      { id: user.id, role: user.role },
      Number.isNaN(requestedLimit) ? 12 : requestedLimit,
    );
    sendJson(response, 200, items);
    return;
  }

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

  if (await handleGroupRequest(request, response, method, pathname)) return;
  if (await handleSignoffRequest(request, response, method, pathname)) return;
  if (await handleGroupInfoRequest(request, response, method, pathname)) return;

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
