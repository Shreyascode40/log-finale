import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/lib/validation/auth";
import {
  authenticate,
  resetPassword,
  signupStudent,
  verifyEmail,
} from "@/lib/services/auth";
import { canAccessPath, homeForRole } from "@/lib/roles";
import {
  canApproveMarks,
  canEnterMarks,
  canGeneratePdf,
  canViewGroup,
  type CurrentUser,
} from "@/lib/permissions";

const unique = () => Math.random().toString(36).slice(2, 10);
const createdEmails: string[] = [];

function newStudentInput() {
  const id = unique();
  const email = `t${id}@apcoer.edu.in`;
  createdEmails.push(email);
  return {
    name: `Test Student ${id}`,
    email,
    rollNo: `R${id}`,
    mobile: "9876543210",
    password: "Password@123",
  };
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await prisma.$disconnect();
});

describe("student sign up cannot choose a role", () => {
  it("strips a client-supplied role at the schema layer", () => {
    const parsed = signupSchema.parse({
      name: "Mallory",
      email: "mallory@apcoer.edu.in",
      rollNo: "TE9999",
      mobile: "9123456780",
      password: "Password@123",
      role: "HOD",
    });
    expect(parsed).not.toHaveProperty("role");
  });

  it("always creates a STUDENT in the database", async () => {
    const input = newStudentInput();
    const { userId } = await signupStudent({ ...input, role: "HOD" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.role).toBe("STUDENT");
    expect(user.emailVerifiedAt).toBeNull();
  });

  it("rejects a duplicate email and a duplicate roll number", async () => {
    const input = newStudentInput();
    await signupStudent(input);
    await expect(signupStudent(newStudentInput())).resolves.toBeTruthy();
    await expect(signupStudent({ ...input, rollNo: `R${unique()}` })).rejects.toThrow(
      /already exists/,
    );
  });
});

describe("login requires a verified email", () => {
  it("refuses an unverified account and accepts it after verification", async () => {
    const input = newStudentInput();
    const { userId, verificationUrl } = await signupStudent(input);
    expect(verificationUrl).toBeDefined();

    const before = await authenticate(input.email, input.password);
    expect(before).toEqual({ ok: false, reason: "EMAIL_NOT_VERIFIED" });

    const token = new URL(verificationUrl!).searchParams.get("token")!;
    await verifyEmail(token);

    const after = await authenticate(input.email, input.password);
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.user.id).toBe(userId);
  });

  it("rejects a wrong password", async () => {
    const input = newStudentInput();
    const { verificationUrl } = await signupStudent(input);
    await verifyEmail(new URL(verificationUrl!).searchParams.get("token")!);

    const result = await authenticate(input.email, "not-the-password");
    expect(result).toEqual({ ok: false, reason: "INVALID_CREDENTIALS" });
  });

  it("consumes verification and reset tokens exactly once", async () => {
    const input = newStudentInput();
    const { verificationUrl } = await signupStudent(input);
    const token = new URL(verificationUrl!).searchParams.get("token")!;
    await verifyEmail(token);
    await expect(verifyEmail(token)).rejects.toThrow(/invalid or has expired/);

    await expect(resetPassword({ token: "x".repeat(30), password: "Password@456" })).rejects.toThrow(
      /invalid or has expired/,
    );
  });
});

describe("role-based routing", () => {
  it("sends a student away from /hod but allows /student", () => {
    expect(canAccessPath("STUDENT", "/hod")).toBe(false);
    expect(canAccessPath("STUDENT", "/hod/users")).toBe(false);
    expect(canAccessPath("STUDENT", "/student")).toBe(true);
    expect(canAccessPath("STUDENT", "/student/cover")).toBe(true);
  });

  it("allows each role only its own section, and maps each to a home", () => {
    expect(canAccessPath("GUIDE", "/guide/groups/1/activity")).toBe(true);
    expect(canAccessPath("GUIDE", "/student")).toBe(false);
    expect(canAccessPath("HOD", "/hod/audit")).toBe(true);
    expect(canAccessPath(null, "/student")).toBe(false);
    expect(homeForRole("STUDENT")).toBe("/student");
    expect(homeForRole("GUIDE")).toBe("/guide");
    expect(homeForRole("HOD")).toBe("/hod");
    expect(homeForRole(null)).toBe("/login");
  });
});

describe("marks permissions are group-scoped", () => {
  const group = { guideId: "guide-1", members: [{ userId: "student-1" }], pdfPermission: false };
  const assignedGuide: CurrentUser = { id: "guide-1", name: "G1", email: "g1@x", role: "GUIDE" };
  const otherGuide: CurrentUser = { id: "guide-2", name: "G2", email: "g2@x", role: "GUIDE" };
  const member: CurrentUser = { id: "student-1", name: "S1", email: "s1@x", role: "STUDENT" };
  const hod: CurrentUser = { id: "hod-1", name: "H", email: "h@x", role: "HOD" };

  it("only the assigned guide may write marks; HOD may not write but may approve", () => {
    expect(canEnterMarks(assignedGuide, group)).toBe(true);
    expect(canEnterMarks(otherGuide, group)).toBe(false);
    expect(canEnterMarks(member, group)).toBe(false);
    expect(canEnterMarks(hod, group)).toBe(false);

    expect(canApproveMarks(assignedGuide, group)).toBe(true);
    expect(canApproveMarks(hod, group)).toBe(true);
    expect(canApproveMarks(otherGuide, group)).toBe(false);
  });

  it("lets members, the assigned guide and the HOD view the group", () => {
    expect(canViewGroup(member, group)).toBe(true);
    expect(canViewGroup(assignedGuide, group)).toBe(true);
    expect(canViewGroup(hod, group)).toBe(true);
    expect(canViewGroup(otherGuide, group)).toBe(false);
  });

  it("only opens the PDF gate when permission is granted AND sections are complete", () => {
    expect(canGeneratePdf(member, group, true)).toBe(false);
    expect(canGeneratePdf(hod, group, true)).toBe(false);
    expect(canGeneratePdf(member, { ...group, pdfPermission: true }, false)).toBe(false);
    expect(canGeneratePdf(member, { ...group, pdfPermission: true }, true)).toBe(true);
    expect(canGeneratePdf(otherGuide, { ...group, pdfPermission: true }, true)).toBe(false);
  });
});
