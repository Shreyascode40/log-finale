import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";

/**
 * File storage with two providers, selected by UPLOAD_PROVIDER:
 *   - "local" (dev default): writes to `var/uploads` on local disk and serves
 *     through the `/media/[...path]` route handler (files added to `public/`
 *     at runtime are not served by `next start`).
 *   - "supabase" (production): uploads to a public Supabase Storage bucket and
 *     stores the public URL, so photos render on screen and in the PDF.
 * Only the persistence step differs per provider; validation rules, file
 * naming and the StoredFile shape are identical, so call-sites stay a
 * one-line change.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB (SPEC.md B3)
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

/** Certificates, papers and content files (SPEC.md B12): PDF or scans. */
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type StoredFile = { url: string; bytes: number };

export function uploadProvider(): string {
  return process.env.UPLOAD_PROVIDER || "local";
}

/** Absolute path of the local upload root (local provider only). */
export function uploadRoot(): string {
  return path.join(process.cwd(), "var", "uploads");
}

function fileNameFor(baseName: string, ext: string): string {
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "file";
  return `${safeBase}-${Date.now()}.${ext}`;
}

/**
 * Persists bytes via the configured provider and returns the public URL.
 * Local URLs are served by the /media route; Supabase URLs are absolute.
 */
async function persistFile(
  subdir: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  if (uploadProvider() === "supabase") {
    return uploadToSupabase(subdir, fileName, bytes, contentType);
  }
  const dir = path.join(uploadRoot(), subdir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), bytes);
  return `/media/${subdir}/${fileName}`;
}

/**
 * Uploads to the public Supabase Storage bucket. Throws AppError (not raw SDK
 * errors) so actions surface a clean message. The service-role key never
 * leaves the server: this module is imported by server code only.
 */
async function uploadToSupabase(
  subdir: string,
  fileName: string,
  bytes: Buffer,
  contentType: string,
): Promise<string> {
  const url = process.env.SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const bucket = process.env.SUPABASE_BUCKET ?? "";
  if (!url || !serviceKey || !bucket) {
    throw new AppError(
      "UPLOAD_NOT_CONFIGURED",
      "Supabase uploads are not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_BUCKET.",
    );
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objectPath = `${subdir}/${fileName}`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    throw new AppError("UPLOAD_FAILED", `Supabase upload failed: ${error.message}`);
  }
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Persists an uploaded file and returns the public URL: served by the `/media`
 * route on the local provider, absolute Supabase URL otherwise. The file name
 * is namespaced with a timestamp so re-uploads never collide and the browser
 * cache is busted.
 */
export async function saveUpload(file: File, subdir: string, baseName: string): Promise<StoredFile> {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await persistFile(subdir, fileNameFor(baseName, ext), bytes, file.type);

  return { url, bytes: bytes.byteLength };
}

/**
 * Persists a document (PDF or scanned image) for competitions, papers and
 * content pages. Type and size are enforced here so every call-site is safe.
 */
export async function saveDocument(file: File, subdir: string, baseName: string): Promise<StoredFile> {
  if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(file.type)) {
    throw new AppError("INVALID_FILE", "Only PDF, JPG or PNG files can be uploaded");
  }
  if (file.size > MAX_DOC_BYTES) {
    throw new AppError("FILE_TOO_BIG", "Files must be at most 10 MB");
  }
  const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const bytes = Buffer.from(await file.arrayBuffer());
  const url = await persistFile(subdir, fileNameFor(baseName, ext), bytes, file.type);

  return { url, bytes: bytes.byteLength };
}
