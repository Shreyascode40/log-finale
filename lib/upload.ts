import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";

/**
 * File storage. Development writes to `var/uploads` on local disk and serves it
 * through the `/media/[...path]` route handler (files added to `public/` at
 * runtime are not served by `next start`). Production switches to Cloudinary via
 * UPLOAD_PROVIDER (see .env.example); only the local provider is implemented so
 * far, so the call-site stays a one-line change.
 */

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024; // 2 MB (SPEC.md B3)
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png"] as const;

/** Certificates, papers and content files (SPEC.md B12): PDF or scans. */
export const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_DOC_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

export type StoredFile = { url: string; bytes: number };

/** Absolute path of the local upload root. */
export function uploadRoot(): string {
  return path.join(process.cwd(), "var", "uploads");
}

/**
 * Persists an uploaded file under `<uploadRoot>/<subdir>/` and returns the
 * public URL served by the `/media` route. The file name is namespaced with a
 * timestamp so re-uploads never collide and the browser cache is busted.
 */
export async function saveUpload(file: File, subdir: string, baseName: string): Promise<StoredFile> {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "file";
  const fileName = `${safeBase}-${Date.now()}.${ext}`;
  const dir = path.join(uploadRoot(), subdir);

  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), bytes);

  return { url: `/media/${subdir}/${fileName}`, bytes: bytes.byteLength };
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
  const safeBase = baseName.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 60) || "file";
  const fileName = `${safeBase}-${Date.now()}.${ext}`;
  const dir = path.join(uploadRoot(), subdir);

  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, fileName), bytes);

  return { url: `/media/${subdir}/${fileName}`, bytes: bytes.byteLength };
}
