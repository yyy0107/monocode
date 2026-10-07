import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { StoredCursorSubagentRun } from "../src/integrations/harness/providers/cursor/cursorStore";

const MAX_MESSAGE_BYTES = 8 * 1024 * 1024;
const dirs = (path: string): string[] => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(path, entry.name));
  } catch {
    return [];
  }
};
const object = (value: unknown): Record<string, any> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : undefined;
function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value))
    return value.map((part) => object(part)?.text ?? "").join("\n");
  return object(value)?.text ?? "";
}
function matches(stored: string, wanted: string): boolean {
  return (
    stored === wanted ||
    stored
      .split(/\s+/)
      .some((part) => part.length >= 8 && wanted.split(/\s+/).includes(part))
  );
}
function validate(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 1024 ||
    /[/\\\0]/.test(value)
  )
    throw new Error("Invalid Cursor id");
}

/** Require both the native parent and spawn identity; never pair by title. */
export function readCursorSubagents(
  args: Record<string, unknown>,
  cursorDir = join(homedir(), ".cursor"),
): StoredCursorSubagentRun[] {
  validate(args.sessionId);
  if (!Array.isArray(args.toolCallIds) || args.toolCallIds.length > 256)
    throw new Error("Invalid Cursor tool ids");
  args.toolCallIds.forEach(validate);
  const ids = args.toolCallIds as string[];
  if (!ids.length) return [];
  const revisions = object(args.knownRevisions) ?? {};
  const runs: StoredCursorSubagentRun[] = [];
  const seen = new Set<string>();
  const roots = [
    join(cursorDir, "acp-sessions"),
    ...dirs(join(cursorDir, "chats")),
  ];
  for (const root of roots)
    for (const directory of dirs(root)) {
      const path = join(directory, "store.db");
      if (!existsSync(path)) continue;
      let db: DatabaseSync | undefined;
      try {
        db = new DatabaseSync(path, { readOnly: true });
        db.exec("PRAGMA busy_timeout=100");
        const row = db.prepare("SELECT value FROM meta WHERE key='0'").get();
        const raw = String(row?.value ?? "");
        if (!raw || raw.length > 64 * 1024) continue;
        const meta = JSON.parse(
          raw.startsWith("{") ? raw : Buffer.from(raw, "hex").toString("utf8"),
        );
        if (
          meta.subagentInfo?.parentAgentId !== args.sessionId ||
          typeof meta.agentId !== "string"
        )
          continue;
        const callId = ids.find(
          (id) =>
            typeof meta.subagentInfo.toolCallId === "string" &&
            matches(meta.subagentInfo.toolCallId, id),
        );
        if (!callId || seen.has(meta.agentId)) continue;
        seen.add(meta.agentId);
        const revision = String(
          db
            .prepare("SELECT COALESCE(MAX(rowid),0) AS revision FROM blobs")
            .get()!.revision,
        );
        if (revisions[meta.agentId] === revision) continue;
        const run: StoredCursorSubagentRun = {
          toolCallId: callId,
          agentId: meta.agentId,
          revision,
          agentType: meta.subagentInfo.typeName,
          steps: [],
        };
        const tools = new Map<
          string,
          StoredCursorSubagentRun["steps"][number]
        >();
        const results = new Map<string, { output: string; failed: boolean }>();
        let cursor = 0;
        while (true) {
          const batch = db
            .prepare(
              "SELECT rowid, id, CASE WHEN length(data)<=? THEN data END AS data FROM blobs WHERE rowid>? AND substr(data,1,1)=x'7b' ORDER BY rowid LIMIT 256",
            )
            .all(MAX_MESSAGE_BYTES, cursor);
          if (!batch.length) break;
          for (const blob of batch) {
            cursor = Number(blob.rowid);
            if (!blob.data) {
              run.partial = true;
              continue;
            }
            let message: Record<string, any>;
            try {
              message = JSON.parse(
                Buffer.from(blob.data as Uint8Array).toString("utf8"),
              );
            } catch {
              run.partial = true;
              continue;
            }
            if (message.role === "assistant")
              run.model =
                message.providerOptions?.cursor?.systemPromptFingerprint
                  ?.model ?? run.model;
            if (message.role === "user" && !run.prompt) {
              const query = text(message.content).split("<user_query>")[1];
              if (query) run.prompt = query.split("</user_query>")[0].trim();
            }
            if (!Array.isArray(message.content)) continue;
            message.content.forEach(
              (part: Record<string, any>, index: number) => {
                if (
                  message.role === "assistant" &&
                  (part.type === "text" || part.type === "reasoning") &&
                  typeof part.text === "string"
                ) {
                  run.steps.push({
                    id: `${run.agentId}:${blob.id}:${index}`,
                    kind: part.type === "text" ? "message" : "reasoning",
                    text: part.text,
                  });
                } else if (
                  message.role === "assistant" &&
                  part.type === "tool-call" &&
                  typeof part.toolCallId === "string"
                ) {
                  if (tools.has(part.toolCallId)) return;
                  const step: StoredCursorSubagentRun["steps"][number] = {
                    id: `${run.agentId}:tool:${part.toolCallId}`,
                    kind: "tool",
                    text: "",
                    toolCallId: part.toolCallId,
                    toolName: part.toolName,
                    args: part.args,
                    status: "in_progress",
                  };
                  tools.set(part.toolCallId, step);
                  run.steps.push(step);
                } else if (
                  message.role === "tool" &&
                  part.type === "tool-result" &&
                  typeof part.toolCallId === "string"
                ) {
                  results.set(part.toolCallId, {
                    output: text(part.result),
                    failed: part.isError === true,
                  });
                }
              },
            );
          }
        }
        for (const [id, outcome] of results) {
          const step = tools.get(id);
          if (step) {
            step.status = outcome.failed ? "failed" : "completed";
            step.output = outcome.output;
          }
        }
        runs.push(run);
      } catch {
        /* Stores being initialized are retried by the provider poll. */
      } finally {
        db?.close();
      }
    }
  return runs;
}
