import type { Attachment } from "../features/sessions/model/session";

export const MOBILE_ATTACHMENT_LIMIT = 20;
export const MOBILE_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function readMobileAttachments(
  files: File[],
  existing = 0,
): Promise<Attachment[]> {
  if (files.length + existing > MOBILE_ATTACHMENT_LIMIT)
    throw new Error("Attach up to 20 files per message.");
  for (const file of files) {
    if (file.size > MOBILE_ATTACHMENT_BYTES)
      throw new Error("Each attachment must be 20 MB or smaller.");
    if (!file.name.trim() || file.name.length > 255)
      throw new Error("Invalid attachment name.");
  }
  const output: Attachment[] = [];
  for (const file of files) {
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () =>
        reject(new Error("Unable to read the selected file."));
      reader.onabort = () =>
        reject(new Error("Unable to read the selected file."));
      reader.readAsDataURL(file);
    });
    const mimeType = file.type || "application/octet-stream";
    output.push({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      mimeType,
      kind: mimeType.startsWith("image/")
        ? "image"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "file",
      data,
    });
  }
  return output;
}
