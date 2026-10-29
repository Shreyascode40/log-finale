import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../db.js";
import { toJson } from "../json.js";
import { ApiDomainError } from "../errors.js";

export type GroupInfoActor = { id: string; role: string };

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const coverSchema = z.object({
  department: z.string().trim().max(80, "Department is too long").optional().or(z.literal("")),
  academicYear: z.string().trim().max(20, "Academic year is too long").optional().or(z.literal("")),
  projectTitle: z.string().trim().max(200, "Project title is too long").optional().or(z.literal("")),
  area: z.string().trim().max(120, "Area of project is too long").optional().or(z.literal("")),
  groupNo: z.string().trim().max(20, "Group number is too long").optional().or(z.literal("")),
});
const memberSchema = z.object({
  memberId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  teResult: z.string().trim().max(60, "TE result is too long").optional().or(z.literal("")),
  rollNo: z.string().trim().max(20, "Roll number is too long").optional().or(z.literal("")),
  examSeatNo: z.string().trim().max(30, "Exam seat number is too long").optional().or(z.literal("")),
  mobile: z.string().trim().regex(/^\d{10}$/, "Mobile number must be 10 digits").optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  contribution: z.string().trim().max(500, "Contribution is too long").optional().or(z.literal("")),
});

async function studentMembership(actor: GroupInfoActor) {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students of the group can edit the log book", 403);
  }
  const membership = await prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: { group: true },
  });
  if (!membership) throw new ApiDomainError("NO_GROUP", "You are not in a group yet", 404);
  if (membership.group.status === "PDF_GENERATED") {
    throw new ApiDomainError("LOCKED", "The log book is locked after the final PDF is generated", 409);
  }
  return membership;
}

async function memberInGroup(groupId: string, memberId: string) {
  const member = await prisma.groupMember.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId) {
    throw new ApiDomainError("MEMBER_NOT_FOUND", "That member is not part of your group", 404);
  }
  return member;
}

export async function getStudentGroupInfo(actor: GroupInfoActor) {
  if (actor.role !== "STUDENT") {
    throw new ApiDomainError("FORBIDDEN", "Only students can view student group information", 403);
  }
  return prisma.groupMember.findFirst({
    where: { userId: actor.id },
    include: {
      group: {
        include: {
          guide: { select: { name: true } },
          members: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
}

export async function updateCover(actor: GroupInfoActor, input: unknown) {
  const membership = await studentMembership(actor);
  const parsed = coverSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  const data = {
    department: parsed.data.department || null,
    academicYear: parsed.data.academicYear || null,
    projectTitle: parsed.data.projectTitle || null,
    area: parsed.data.area || null,
    groupNo: parsed.data.groupNo || null,
  };
  const before = {
    department: membership.group.department,
    academicYear: membership.group.academicYear,
    projectTitle: membership.group.projectTitle,
    area: membership.group.area,
    groupNo: membership.group.groupNo,
  };
  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: membership.groupId }, data });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "COVER_UPDATE",
        entity: "Group",
        entityId: membership.groupId,
        before: toJson(before),
        after: toJson(data),
      },
    });
  });
}

export async function updateMember(actor: GroupInfoActor, input: unknown) {
  const membership = await studentMembership(actor);
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) throw new ApiDomainError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Invalid input");
  const { memberId, name, teResult, rollNo, examSeatNo, mobile, email, contribution } = parsed.data;
  const target = await memberInGroup(membership.groupId, memberId);
  if (rollNo) {
    const clash = await prisma.groupMember.findFirst({
      where: { groupId: membership.groupId, rollNo, NOT: { id: memberId } }, select: { name: true },
    });
    if (clash) throw new ApiDomainError("DUPLICATE_ROLL", `Roll number ${rollNo} is already used by ${clash.name}`, 409);
  }
  if (examSeatNo) {
    const clash = await prisma.groupMember.findFirst({
      where: { groupId: membership.groupId, examSeatNo, NOT: { id: memberId } }, select: { name: true },
    });
    if (clash) throw new ApiDomainError("DUPLICATE_SEAT", `Exam seat number ${examSeatNo} is already used by ${clash.name}`, 409);
  }
  const data = {
    name,
    teResult: teResult || null,
    rollNo: rollNo || null,
    examSeatNo: examSeatNo || null,
    mobile: mobile || null,
    email: email || null,
    contribution: contribution || null,
  };
  const before = {
    name: target.name,
    teResult: target.teResult,
    rollNo: target.rollNo,
    examSeatNo: target.examSeatNo,
    mobile: target.mobile,
    email: target.email,
    contribution: target.contribution,
  };
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: memberId }, data });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "MEMBER_UPDATE",
        entity: "GroupMember",
        entityId: memberId,
        before: toJson(before),
        after: toJson(data),
      },
    });
  });
}

async function storePhoto(bytes: Buffer, contentType: "image/jpeg" | "image/png", memberId: string) {
  const ext = contentType === "image/png" ? "png" : "jpg";
  const fileName = `${memberId.replace(/[^a-zA-Z0-9_-]/g, "")}-${Date.now()}-${randomBytes(4).toString("hex")}.${ext}`;
  if ((process.env.UPLOAD_PROVIDER ?? "local") === "supabase") {
    const url = process.env.SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    const bucket = process.env.SUPABASE_PRIVATE_BUCKET ?? "";
    if (!url || !serviceKey || !bucket) {
      throw new ApiDomainError("UPLOAD_NOT_CONFIGURED", "Private uploads are not configured.", 500);
    }
    const objectPath = `group-members/${fileName}`;
    const upload = await fetch(`${url.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "content-type": contentType,
        "x-upsert": "false",
      },
      body: new Uint8Array(bytes),
    });
    if (!upload.ok) throw new ApiDomainError("UPLOAD_FAILED", "Photo upload failed.", 502);
    const reference = Buffer.from(`${bucket}/${objectPath}`).toString("base64url");
    return `/api/files/${reference}.${ext}`;
  }
  if (process.env.NODE_ENV === "production") {
    throw new ApiDomainError("UPLOAD_NOT_CONFIGURED", "Set UPLOAD_PROVIDER=supabase for production file uploads.", 500);
  }
  const uploadDir = path.join(process.cwd(), "var", "uploads", "group-members");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), bytes);
  return `/media/group-members/${fileName}`;
}

export async function updateMemberPhoto(
  actor: GroupInfoActor,
  memberId: string,
  contentType: string,
  bytes: Buffer,
) {
  const membership = await studentMembership(actor);
  const target = await memberInGroup(membership.groupId, memberId);
  if (contentType !== "image/jpeg" && contentType !== "image/png") {
    throw new ApiDomainError("INVALID_FILE", "Photo must be a JPG or PNG image");
  }
  if (bytes.byteLength > MAX_PHOTO_BYTES) throw new ApiDomainError("FILE_TOO_LARGE", "Photo must be 2 MB or smaller");
  if (!bytes.byteLength) throw new ApiDomainError("INVALID_FILE", "Choose a photo to upload");
  const url = await storePhoto(bytes, contentType, target.id);
  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({ where: { id: memberId }, data: { photoUrl: url } });
    await tx.auditLog.create({
      data: {
        userId: actor.id,
        action: "MEMBER_PHOTO_UPDATE",
        entity: "GroupMember",
        entityId: memberId,
        before: toJson({ photoUrl: target.photoUrl }),
        after: toJson({ photoUrl: url }),
      },
    });
  });
  return { url };
}
