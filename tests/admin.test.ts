import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { authenticate } from "../apps/api/src/modules/auth";
import type { Role } from "@/lib/roles";
import {
  approveGroup,
  assignGuide,
  createGuide,
  rejectGroup,
  setUserActive,
} from "../apps/api/src/modules/admin";

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);
const emailFor = (label: string) => {
  const email = `${label}.${rid()}@apcoer.edu.in`;
  createdEmails.push(email);
  return email;
};

async function makeUser(role: string, label: string) {
  const email = emailFor(label);
  return prisma.user.create({
    data: {
      name: `${label} ${rid()}`,
      email,
      role,
      mobile: "9000000000",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
}

async function makeGroup(creatorId: string, status: string) {
  const group = await prisma.group.create({
    data: {
      groupNo: `G-${rid()}`,
      projectTitle: "Test project",
      status,
      creatorId,
    },
  });
  createdGroupIds.push(group.id);
  return group;
}

let hod: { id: string; role: Role };
let student: { id: string; role: Role };
let guide1: { id: string; role: Role };
let guide2: { id: string; role: Role };

beforeAll(async () => {
  const [h, s, g1, g2] = await Promise.all([
    makeUser("HOD", "hod"),
    makeUser("STUDENT", "student"),
    makeUser("GUIDE", "guide1"),
    makeUser("GUIDE", "guide2"),
  ]);
  hod = { id: h.id, role: h.role as Role };
  student = { id: s.id, role: s.role as Role };
  guide1 = { id: g1.id, role: g1.role as Role };
  guide2 = { id: g2.id, role: g2.role as Role };
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdGroupIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("only the HOD may administer", () => {
  it("rejects guide and student actors", async () => {
    const guideInput = {
      name: "Sneaky Guide",
      email: emailFor("sneaky"),
      password: "Password@123",
    };
    await expect(createGuide(student, guideInput)).rejects.toThrow(/Head of Department/);
    await expect(createGuide(guide1, guideInput)).rejects.toThrow(/Head of Department/);

    const group = await makeGroup(student.id, "SUBMITTED");
    await expect(approveGroup(student, { groupId: group.id, guideId: guide1.id })).rejects.toThrow(
      /Head of Department/,
    );
    await expect(rejectGroup(guide1, { groupId: group.id, reason: "nope" })).rejects.toThrow(
      /Head of Department/,
    );
    await expect(assignGuide(student, { groupId: group.id, guideId: guide1.id })).rejects.toThrow(
      /Head of Department/,
    );
    await expect(setUserActive(guide1, { userId: guide2.id, active: false })).rejects.toThrow(
      /Head of Department/,
    );
  });
});

describe("guide accounts", () => {
  it("creates a usable GUIDE account and audits it", async () => {
    const email = emailFor("newguide");
    const { userId } = await createGuide(hod, {
      name: "Prof. New Guide",
      email,
      mobile: "9000012345",
      password: "Password@123",
    });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.role).toBe("GUIDE");
    expect(user.createdVia).toBe("HOD_CREATED");
    expect(user.emailVerifiedAt).not.toBeNull();

    const login = await authenticate(email, "Password@123");
    expect(login.ok).toBe(true);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "GUIDE_CREATE", entityId: userId },
    });
    expect(audit).not.toBeNull();
    expect(audit?.userId).toBe(hod.id);
  });

  it("rejects a duplicate email and a weak password", async () => {
    const email = emailFor("dupguide");
    await createGuide(hod, { name: "First", email, password: "Password@123" });
    await expect(
      createGuide(hod, { name: "Second", email, password: "Password@123" }),
    ).rejects.toThrow(/already exists/);

    await expect(
      createGuide(hod, { name: "Weak", email: emailFor("weak"), password: "short" }),
    ).rejects.toThrow(/at least 8 characters/);
  });

  it("deactivating a guide blocks sign-in; without a guideId approval is refused", async () => {
    const email = emailFor("toggle");
    const { userId } = await createGuide(hod, {
      name: "Toggle Guide",
      email,
      password: "Password@123",
    });

    await setUserActive(hod, { userId, active: false });
    const blocked = await authenticate(email, "Password@123");
    expect(blocked).toEqual({ ok: false, reason: "ACCOUNT_INACTIVE" });

    await expect(setUserActive(hod, { userId: hod.id, active: false })).rejects.toThrow(
      /cannot deactivate your own account/,
    );
  });
});

describe("group lifecycle: SUBMITTED -> ACTIVE", () => {
  it("refuses to approve a group that is not SUBMITTED", async () => {
    const group = await makeGroup(student.id, "DRAFT");
    await expect(approveGroup(hod, { groupId: group.id, guideId: guide1.id })).rejects.toThrow(
      /submitted by the students/,
    );
  });

  it("requires a guide to approve", async () => {
    const group = await makeGroup(student.id, "SUBMITTED");
    await expect(approveGroup(hod, { groupId: group.id, guideId: "" })).rejects.toThrow(
      /Select the guide/,
    );
  });

  it("approves and assigns one guide, moving the group to ACTIVE", async () => {
    const group = await makeGroup(student.id, "SUBMITTED");
    await approveGroup(hod, { groupId: group.id, guideId: guide1.id });

    const updated = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(updated.status).toBe("ACTIVE");
    expect(updated.guideId).toBe(guide1.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "GROUP_APPROVE", entityId: group.id },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit!.after ?? "{}")).toMatchObject({ status: "ACTIVE", guideId: guide1.id });

    // approving again is refused (no longer SUBMITTED)
    await expect(approveGroup(hod, { groupId: group.id, guideId: guide2.id })).rejects.toThrow(
      /submitted by the students/,
    );
  });

  it("rejects a SUBMITTED group to DRAFT with a mandatory reason", async () => {
    const group = await makeGroup(student.id, "SUBMITTED");
    await expect(rejectGroup(hod, { groupId: group.id, reason: "no" })).rejects.toThrow(
      /reason is required/,
    );

    await rejectGroup(hod, { groupId: group.id, reason: "Add the guide name and sign" });
    const updated = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(updated.status).toBe("DRAFT");
    expect(updated.rejectReason).toBe("Add the guide name and sign");
  });

  it("reassigns a guide and records GROUP_REASSIGN_GUIDE", async () => {
    const group = await makeGroup(student.id, "SUBMITTED");
    await approveGroup(hod, { groupId: group.id, guideId: guide1.id });

    await assignGuide(hod, { groupId: group.id, guideId: guide2.id });
    const updated = await prisma.group.findUniqueOrThrow({ where: { id: group.id } });
    expect(updated.guideId).toBe(guide2.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: "GROUP_REASSIGN_GUIDE", entityId: group.id },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit!.before ?? "{}")).toMatchObject({ guideId: guide1.id });
    expect(JSON.parse(audit!.after ?? "{}")).toMatchObject({ guideId: guide2.id });
  });

  it("cannot assign a guide while the group is DRAFT", async () => {
    const group = await makeGroup(student.id, "DRAFT");
    await expect(assignGuide(hod, { groupId: group.id, guideId: guide1.id })).rejects.toThrow(
      /submitted or active/,
    );
  });
});
