import { translate } from "../../../shared/i18n/language";
import type { Block } from "../../../features/sessions/model/session";

export type NativeSessionFile = {
  provider: "codex" | "pi";
  providerSessionId: string;
  cwd: string;
  path: string;
  revision: string;
  modifiedAt: number;
};

export type NativeTranscript = {
  createdAt: number;
  blocks: Block[];
  model?: string;
  modelSettings: Record<string, string>;
  title?: string;
};

type RecordValue = Record<string, unknown>;
export const nativeRecord = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
export const nativeString = (value: unknown): string =>
  typeof value === "string" ? value : "";

/** Only an unfinished last line may be ignored; corruption must never replace saved history. */
export function nativeJsonLines(content: string): RecordValue[] {
  const lines = content.split("\n");
  const records: RecordValue[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    try {
      records.push(nativeRecord(JSON.parse(line)));
    } catch {
      if (index === lines.length - 1 && !content.endsWith("\n")) break;
      throw new Error(
        translate("Invalid native session JSON at line {line}", {
          line: index + 1,
        }),
      );
    }
  }
  return records;
}

/** Read textual blocks without ever rendering embedded image/base64 data. */
export function nativeText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((part) => {
      const item = nativeRecord(part);
      if (
        ["image", "image_url", "input_image", "output_image"].includes(
          nativeString(item.type),
        )
      )
        return [translate("[Image retained in the native session]")];
      return ["text", "input_text", "output_text", "summary_text"].includes(
        nativeString(item.type),
      ) && typeof item.text === "string"
        ? [item.text]
        : [];
    })
    .join("\n");
}

export type NativeSessionAccess = {
  state: "idle" | "external" | "unknown" | "checking";
  reason: string;
  checkedAt: number;
  path: string;
};

export type NativeSessionProbe = { file: NativeSessionFile; access: NativeSessionAccess };
