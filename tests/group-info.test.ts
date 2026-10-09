import { afterAll, describe, expect, it } from "vitest";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { MAX_PHOTO_BYTES, uploadRoot } from "@/lib/upload";
import type { Role } from "@/lib/roles";
import {
  updateCover,
  updateMember,
  updateMemberPhoto,
} from "@/lib/services/group-info";
import { createGroup, joinByCode } from "@/lib/services/group";

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];
const uploadedUrls: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

type TestStudent = { id: string; role: Role; email: string; rollNo: string | null };

async function makeUser(
  role: Role,
  label: string,
  withRoll = true,
): Promise<TestStudent> {
  const id = rid();
  const email = `${label}.${id}@apcoer.edu.in`;
  const rollNo = withRoll ? `R${id}` : null;
  createdEmails.push(email);
  const user = await prisma.user.create({
    data: {
      name: `${label} ${id}`,
      email,
      rollNo,
      mobile: "9000000000",
      role,
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: role === "STUDENT" ? "SELF_SIGNUP" : "HOD_CREATED",
    },
  });
  return { id: user.id, role, email, rollNo };
}

async function newGroup(creator: TestStudent) {
  const { groupId, code } = await createGroup(creator, { projectTitle: "Test project" });
  createdGroupIds.push(groupId);
  return { groupId, code };
}

async function memberIdOf(groupId: string, userId: string): Promise<string> {
  const member = await prisma.groupMember.findFirstOrThrow({ where: { groupId, userId } });
  return member.id;
}

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdGroupIds } } });
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  for (const url of uploadedUrls) {
    const relative = url.replace(/^\/media\//, "");
    await unlink(path.join(uploadRoot(), relative)).catch(() => {});
  }
  await prisma.$disconnect();
});

describe("cover sheet", () => {
  it("a group member can save the cover, and the change is audited", async () => {
    const creator = await makeUser("STUDENT", "cover");
    const { groupId } = await newGroup(creator);

    await updateCover(creator, {
      department: "Computer",
      academicYear: "2025-26",
      projectTitle: "Smart Attendance System",
      area: "Artificial Intelligence",
      groupNo: "G9",
    });

    const group = await prisma.group.findUniqueOrThrow({ where: { id: groupId } });
    expect(group.projectTitle).toBe("Smart Attendance System");
    expect(group.groupNo).toBe("G9");

    const audit = await prisma.auditLog.findFirst({
      where: { action: "COVER_UPDATE", entityId: groupId },
    });
    expect(audit).not.toBeNull();
  });

  it("refuses a guide", async () => {
    const guide = await makeUser("GUIDE", "guide", false);
    await expect(updateCover(guide, { department: "X" })).rejects.toThrow(/Only students/);
  });

  it("only edits the caller's own group", async () => {
    const owner = await makeUser("STUDENT", "owner");
    const { groupId: ownerGroup } = await newGroup(owner);

    const outsider = await makeUser("STUDENT", "outsider");
    const { groupId: outsiderGroup } = await newGroup(outsider);

    // The outsider's save lands on their own group, never the owner's.
    await updateCover(outsider, { groupNo: "OUT" });

    const ownerRow = await prisma.group.findUniqueOrThrow({ where: { id: ownerGroup } });
    const outsiderRow = await prisma.group.findUniqueOrThrow({ where: { id: outsiderGroup } });
    expect(ownerRow.groupNo).toBeNull();
    expect(outsiderRow.groupNo).toBe("OUT");
  });

  it("is locked once the final PDF is generated", async () => {
    const creator = await makeUser("STUDENT", "locked");
    const { groupId } = await newGroup(creator);
    await prisma.group.update({ where: { id: groupId }, data: { status: "PDF_GENERATED" } });
    await expect(updateCover(creator, { projectTitle: "too late" })).rejects.toThrow(/locked/i);
  });
});

describe("group information sheet", () => {
  it("saves a member's details", async () => {
    const creator = await makeUser("STUDENT", "member-save");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    await updateMember(creator, {
      memberId,
      name: "Rahul Patil",
      teResult: "First Class with Distinction",
      rollNo: "TE2101",
      examSeatNo: "S-101",
      mobile: "9876543210",
      email: "rahul@apcoer.edu.in",
      contribution: "Requirement analysis and UML design",
    });

    const member = await prisma.groupMember.findUniqueOrThrow({ where: { id: memberId } });
    expect(member.name).toBe("Rahul Patil");
    expect(member.mobile).toBe("9876543210");
    expect(member.examSeatNo).toBe("S-101");
  });

  it("rejects a mobile number that is not 10 digits", async () => {
    const creator = await makeUser("STUDENT", "bad-mobile");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    await expect(
      updateMember(creator, { memberId, name: "A", mobile: "12345" }),
    ).rejects.toThrow(/10 digits/);
  });

  it("rejects an invalid email", async () => {
    const creator = await makeUser("STUDENT", "bad-email");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    await expect(
      updateMember(creator, { memberId, name: "A", email: "not-an-email" }),
    ).rejects.toThrow(/valid email/);
  });

  it("keeps roll numbers and exam seat numbers unique within the group", async () => {
    const creator = await makeUser("STUDENT", "unique");
    const { groupId, code } = await newGroup(creator);
    const second = await makeUser("STUDENT", "second");
    await joinByCode(second, { code });

    const firstId = await memberIdOf(groupId, creator.id);
    const secondId = await memberIdOf(groupId, second.id);

    await updateMember(creator, { memberId: firstId, name: "One", rollNo: "TE1", examSeatNo: "S1" });

    await expect(
      updateMember(second, { memberId: secondId, name: "Two", rollNo: "TE1" }),
    ).rejects.toThrow(/Roll number TE1/);
    await expect(
      updateMember(second, { memberId: secondId, name: "Two", examSeatNo: "S1" }),
    ).rejects.toThrow(/Exam seat number S1/);
  });

  it("refuses a member of another group", async () => {
    const owner = await makeUser("STUDENT", "owner2");
    const { groupId } = await newGroup(owner);
    const ownerMemberId = await memberIdOf(groupId, owner.id);

    const other = await makeUser("STUDENT", "other2");
    await newGroup(other);

    await expect(
      updateMember(other, { memberId: ownerMemberId, name: "Hack" }),
    ).rejects.toThrow(/not part of your group/);
  });
});

describe("member photo upload", () => {
  it("accepts a PNG under 2 MB and stores the URL", async () => {
    const creator = await makeUser("STUDENT", "photo");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    const file = new File([new Uint8Array(1024)], "photo.png", { type: "image/png" });
    const { url } = await updateMemberPhoto(creator, memberId, file);
    uploadedUrls.push(url);

    expect(url).toMatch(/^\/media\/group-members\/.+\.png$/);
    const member = await prisma.groupMember.findUniqueOrThrow({ where: { id: memberId } });
    expect(member.photoUrl).toBe(url);
  });

  it("rejects a non-image file", async () => {
    const creator = await makeUser("STUDENT", "photo-type");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    const file = new File([new Uint8Array(10)], "notes.pdf", { type: "application/pdf" });
    await expect(updateMemberPhoto(creator, memberId, file)).rejects.toThrow(/JPG or PNG/);
  });

  it("rejects a photo larger than 2 MB", async () => {
    const creator = await makeUser("STUDENT", "photo-big");
    const { groupId } = await newGroup(creator);
    const memberId = await memberIdOf(groupId, creator.id);

    const file = new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "big.png", { type: "image/png" });
    await expect(updateMemberPhoto(creator, memberId, file)).rejects.toThrow(/2 MB/);
  });
});
