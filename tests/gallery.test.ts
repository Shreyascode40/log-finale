import { afterAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getGalleryData, getGallerySummary, isImageFile } from "../apps/api/src/modules/gallery";

/**
 * HOD media gallery: file detection, group/guide mapping, newest-first order,
 * exclusion of records without an upload, and the summary/missing counts.
 * The service is read-only, so there are no audit rows to clean up.
 */

const createdEmails: string[] = [];
const createdGroupIds: string[] = [];

const rid = () => Math.random().toString(36).slice(2, 10);

async function makeGuide() {
  const id = rid();
  const email = `gallery.guide.${id}@apcoer.edu.in`;
  createdEmails.push(email);
  return prisma.user.create({
    data: {
      name: `Gallery Guide ${id}`,
      email,
      role: "GUIDE",
      passwordHash: await hashPassword("Password@123"),
      emailVerifiedAt: new Date(),
      createdVia: "HOD_CREATED",
    },
  });
}

async function makeGroup(guideId: string) {
  const group = await prisma.group.create({
    data: {
      groupNo: `G${rid()}`,
      projectTitle: "Gallery test project",
      guideId,
      creatorId: guideId,
    },
  });
  createdGroupIds.push(group.id);
  return group;
}

afterAll(async () => {
  await prisma.group.deleteMany({ where: { id: { in: createdGroupIds } } });
  await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
});

describe("HOD media gallery", () => {
  it("detects image uploads from their stored extension", () => {
    expect(isImageFile("/media/certificates/cert-123.jpg")).toBe(true);
    expect(isImageFile("/media/certificates/cert-123.png")).toBe(true);
    expect(isImageFile("https://example.supabase.co/storage/v1/object/public/bucket/cert.PNG?token=1")).toBe(true);
    expect(isImageFile("https://example.supabase.co/storage/v1/object/public/bucket/paper.pdf")).toBe(false);
  });

  it("lists only uploaded certificates, newest first, with group and guide details", async () => {
    const guide = await makeGuide();
    const group = await makeGroup(guide.id);
    const before = await getGallerySummary();

    const older = await prisma.competition.create({
      data: {
        groupId: group.id,
        name: "Older poster",
        type: "POSTER",
        award: "Runner up",
        date: "01 Jan 2026",
        certificateUrl: "/media/certificates/older.png",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    });
    const newer = await prisma.competition.create({
      data: {
        groupId: group.id,
        name: "Newer demo",
        type: "DEMO",
        award: "Winner",
        date: "01 Feb 2026",
        certificateUrl: "/media/certificates/newer.pdf",
        createdAt: new Date("2026-02-01T00:00:00Z"),
      },
    });
    await prisma.competition.create({
      data: { groupId: group.id, name: "No certificate yet" },
    });

    const data = await getGalleryData("CERTIFICATE");
    const mine = data.items.filter((item) => item.groupId === group.id);

    expect(mine).toHaveLength(2);
    expect(mine.map((item) => item.id)).toEqual([newer.id, older.id]);
    expect(mine[0]).toMatchObject({
      kind: "CERTIFICATE",
      title: "Newer demo",
      isImage: false,
      groupLabel: `Group ${group.groupNo}`,
      projectTitle: "Gallery test project",
      guideName: guide.name,
    });
    expect(mine[0].meta).toContain("Demo");
    expect(mine[0].meta).toContain("Winner");
    expect(mine[1].isImage).toBe(true);

    expect(data.summary.certificates).toBe(before.certificates + 2);
    expect(data.summary.missingCertificates).toBe(before.missingCertificates + 1);
  });

  it("lists paper files, flags image scans and counts missing uploads", async () => {
    const guide = await makeGuide();
    const group = await makeGroup(guide.id);
    const before = await getGallerySummary();

    const paper = await prisma.paperPublication.create({
      data: {
        groupId: group.id,
        title: "AI for logbooks",
        conference: "ICAI 2026",
        issn: "1234-5678",
        volIssue: "Vol 2, Issue 1",
        pageNo: "10-20",
        fileUrl: "/media/papers/paper.png",
      },
    });
    await prisma.paperPublication.create({
      data: { groupId: group.id, title: "Missing file" },
    });

    const data = await getGalleryData("PAPER");
    const mine = data.items.filter((item) => item.groupId === group.id);

    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      id: paper.id,
      kind: "PAPER",
      title: "AI for logbooks",
      isImage: true,
      guideName: guide.name,
    });
    expect(mine[0].meta).toContain("ICAI 2026");
    expect(mine[0].meta).toContain("ISSN 1234-5678");
    expect(mine[0].meta).toContain("Page 10-20");

    expect(data.summary.papers).toBe(before.papers + 1);
    expect(data.summary.missingPapers).toBe(before.missingPapers + 1);
  });

  it("excludes records that only have an empty file URL", async () => {
    const guide = await makeGuide();
    const group = await makeGroup(guide.id);

    await prisma.competition.create({
      data: { groupId: group.id, name: "Blank url", certificateUrl: "" },
    });

    const data = await getGalleryData("CERTIFICATE");
    const mine = data.items.filter((item) => item.groupId === group.id);
    expect(mine).toHaveLength(0);
  });
});
