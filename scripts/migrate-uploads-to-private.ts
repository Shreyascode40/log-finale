import path from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

try {
  loadEnvFile(process.env.ENV_FILE ?? ".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const prisma = new PrismaClient();

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const legacyBucket = process.env.SUPABASE_BUCKET ?? "";
  const privateBucket = process.env.SUPABASE_PRIVATE_BUCKET ?? "";
  if (!supabaseUrl || !serviceKey || !legacyBucket || !privateBucket) {
    throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET and SUPABASE_PRIVATE_BUCKET.");
  }
  if (legacyBucket === privateBucket) throw new Error("Use a separate private bucket for the migration.");

  const storage = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage;
  const existingBucket = await storage.getBucket(privateBucket);
  if (existingBucket.error) {
    const created = await storage.createBucket(privateBucket, { public: false });
    if (created.error) throw new Error(`Could not create private bucket: ${created.error.message}`);
  } else if (existingBucket.data.public) {
    throw new Error(`Bucket ${privateBucket} is public. Make it private before migrating.`);
  }

  const expectedPrefix = `/storage/v1/object/public/${legacyBucket}/`;
  let migrated = 0;
  const migrateUrl = async (url: string | null, update: (url: string) => Promise<unknown>) => {
    if (!url || url.startsWith("/api/files/")) return;
    let objectPath: string;
    try {
      const parsed = new URL(url);
      const start = parsed.pathname.indexOf(expectedPrefix);
      if (start < 0) return; // Leave local URLs and other storage providers alone.
      objectPath = decodeURIComponent(parsed.pathname.slice(start + expectedPrefix.length));
    } catch {
      return;
    }
    if (!objectPath || objectPath.includes("..")) throw new Error(`Unsafe storage path: ${objectPath}`);

    const { data, error } = await storage.from(legacyBucket).download(objectPath);
    if (error || !data) throw new Error(`Could not read ${objectPath}: ${error?.message ?? "missing object"}`);
    const contentType = data.type || (path.extname(objectPath).toLowerCase() === ".pdf" ? "application/pdf" : "application/octet-stream");
    const upload = await storage.from(privateBucket).upload(objectPath, Buffer.from(await data.arrayBuffer()), {
      contentType,
      upsert: true,
    });
    if (upload.error) throw new Error(`Could not copy ${objectPath}: ${upload.error.message}`);

    const token = Buffer.from(`${privateBucket}/${objectPath}`).toString("base64url");
    const privateUrl = `/api/files/${token}${path.extname(objectPath).toLowerCase()}`;
    await update(privateUrl);
    migrated += 1;
    console.log(`Migrated ${objectPath}`);
  };

  const members = await prisma.groupMember.findMany({ where: { photoUrl: { not: null } }, select: { id: true, photoUrl: true } });
  for (const row of members) await migrateUrl(row.photoUrl, (photoUrl) => prisma.groupMember.update({ where: { id: row.id }, data: { photoUrl } }));

  const competitions = await prisma.competition.findMany({ where: { certificateUrl: { not: null } }, select: { id: true, certificateUrl: true } });
  for (const row of competitions) await migrateUrl(row.certificateUrl, (certificateUrl) => prisma.competition.update({ where: { id: row.id }, data: { certificateUrl } }));

  const papers = await prisma.paperPublication.findMany({ where: { fileUrl: { not: null } }, select: { id: true, fileUrl: true } });
  for (const row of papers) await migrateUrl(row.fileUrl, (fileUrl) => prisma.paperPublication.update({ where: { id: row.id }, data: { fileUrl } }));

  const pages = await prisma.contentPage.findMany({ where: { fileUrl: { not: null } }, select: { id: true, fileUrl: true } });
  for (const row of pages) await migrateUrl(row.fileUrl, (fileUrl) => prisma.contentPage.update({ where: { id: row.id }, data: { fileUrl } }));

  const feedback = await prisma.sponsorFeedback.findMany({ where: { sealUrl: { not: null } }, select: { id: true, sealUrl: true } });
  for (const row of feedback) await migrateUrl(row.sealUrl, (sealUrl) => prisma.sponsorFeedback.update({ where: { id: row.id }, data: { sealUrl } }));

  console.log(`Migrated ${migrated} referenced files. Verify them before making the legacy bucket private.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
