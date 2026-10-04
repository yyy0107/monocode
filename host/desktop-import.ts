import { sanitizeTitleState } from "../src/features/sessions/model/titlePolicy";
import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
  realpathSync,
  unlinkSync,
  readFileSync,
} from "node:fs";
import { basename, resolve, join, dirname } from "node:path";
import type { Block, Session } from "../src/features/sessions/model/session";
import { isRemoteProvider } from "../src/features/connections/model/protocol";
import { attachmentPath, MAX_REMOTE_ATTACHMENT_BYTES } from "./attachments";
import { summary, type HostStore } from "./store";

export function refreshNativeDesktopSession(
  store: HostStore,
  id: string,
  busy: boolean,
) {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(id))
    throw new Error("Invalid desktop session ID");
  const config = JSON.parse(
    readFileSync(
      join(dirname(store.attachmentDir), "desktop-owner.json"),
      "utf8",
    ),
  );
  if (typeof config.desktopDirectory !== "string")
    throw new Error("Desktop history is unavailable");
  importDesktopSessions(store, join(config.desktopDirectory, "monocode.db"), {
    id,
    busy,
  });
  return summary(store.session(id));
}

/** Import once per source row, including a tombstone after Host deletion.
 * Never modify the source or replace an existing canonical conversation. */
export function importDesktopSessions(
  store: HostStore,
  path: string,
  refresh?: { id: string; busy: boolean },
): number {
  if (!existsSync(path)) return 0;
  const sourceKey = createHash("sha256").update(resolve(path)).digest("hex");
  const source = new DatabaseSync(path, { readOnly: true });
  let imported = 0;
  try {
    const rows = source.prepare("SELECT id, cwd, harness FROM sessions").all();
    for (const reference of rows) {
      if (refresh && reference.id !== refresh.id) continue;
      const marker = `desktop-import:${sourceKey}:${reference.id}`;
      if (
        !refresh &&
        store.db.prepare("SELECT 1 FROM metadata WHERE key=?").get(marker)
      )
        continue;
      const row = source
        .prepare("SELECT * FROM sessions WHERE id=?")
        .get(reference.id)!;
      if (
        !isRemoteProvider(row.harness) ||
        typeof row.cwd !== "string" ||
        row.cwd === "~" ||
        row.cwd.startsWith("remote://") ||
        row.inbox_ask
      )
        continue;
      const id = String(row.id);
      const cwd = existsSync(row.cwd) ? realpathSync(row.cwd) : row.cwd;
      const harness = row.harness;
      const nativeSession = row.native_session_json
        ? (JSON.parse(
            String(row.native_session_json),
          ) as Session["nativeSession"])
        : undefined;
      if (refresh && !nativeSession)
        throw new Error(
          "Only imported native sessions can refresh desktop history",
        );
      if (
        nativeSession &&
        (nativeSession.provider !== harness ||
          nativeSession.providerSessionId !== row.provider_session_id)
      )
        throw new Error("Native session binding changed");
      const copied: string[] = [];
      try {
        store.transaction(() => {
          if (
            !refresh &&
            store.db.prepare("SELECT 1 FROM metadata WHERE key=?").get(marker)
          )
            return;
          const existing = store.db
            .prepare("SELECT snapshot FROM sessions WHERE id=?")
            .get(id);
          const previous = existing
            ? JSON.parse(String(existing.snapshot))
            : undefined;
          if (
            previous &&
            refresh &&
            (previous.session.nativeSession?.path !== nativeSession?.path ||
              previous.session.providerSessionId !== row.provider_session_id)
          )
            throw new Error("Native session binding changed");
          if (existing && !refresh) {
            const value = previous;
            if (
              value.session.harness !== harness ||
              store.project(value.projectId).cwd !== cwd
            )
              throw new Error(
                `Conversation ID collision while importing ${id}`,
              );
          } else {
            const copy = (
              originalPath: string | undefined,
              originalId: string,
            ) => {
              const key = `desktop-file:${sourceKey}:${id}:${createHash("sha256").update(originalId).digest("hex")}`;
              const cached = store.db
                .prepare("SELECT value FROM metadata WHERE key=?")
                .get(key);
              if (cached) {
                const path = attachmentPath(store, String(cached.value));
                if (existsSync(path))
                  return {
                    id: String(cached.value),
                    path,
                    size: statSync(path).size,
                  };
              }
              if (!originalPath || !existsSync(originalPath))
                throw new Error(
                  `Cannot import missing image or attachment: ${originalPath}`,
                );
              const size = statSync(originalPath).size;
              if (size > MAX_REMOTE_ATTACHMENT_BYTES)
                throw new Error("Attachment is too large to import");
              const attachmentId = randomUUID();
              const path = attachmentPath(store, attachmentId);
              mkdirSync(store.attachmentDir, { recursive: true, mode: 0o700 });
              copyFileSync(originalPath, path);
              copied.push(path);
              store.db
                .prepare("INSERT OR REPLACE INTO metadata VALUES (?, ?)")
                .run(key, attachmentId);
              return { id: attachmentId, path, size };
            };
            const blocks = JSON.parse(
              String(row.blocks_json ?? "[]"),
            ) as Block[];
            if (!Array.isArray(blocks))
              throw new Error(`Invalid transcript for ${id}`);
            for (const block of blocks) {
              for (const file of block.attachments ?? []) {
                const copiedFile = copy(file.path, file.id);
                Object.assign(file, copiedFile);
                // Device-specific preview URLs are rebuilt from Host bytes.
                delete file.previewUrl;
                delete file.data;
                if (block.image) block.image.path = copiedFile.path;
              }
              if (block.image && !block.attachments?.length) {
                const imagePath = block.image.path;
                const file = copy(imagePath, imagePath);
                block.image.path = file.path;
                block.attachments = [
                  {
                    ...file,
                    name: basename(imagePath),
                    kind: "image",
                    mimeType: block.image.mimeType,
                  },
                ];
              }
            }
            const project = store.addProject(cwd, basename(cwd) || cwd);
            const session: Session = {
              id,
              cwd:
                row.worktree_cwd && existsSync(String(row.worktree_cwd))
                  ? realpathSync(String(row.worktree_cwd))
                  : String(row.worktree_cwd || cwd),
              harness,
              title: String(row.title),
              titleState: row.title_state_json ? sanitizeTitleState(JSON.parse(String(row.title_state_json))) : undefined,
              model: String(row.model),
              modelSettings: JSON.parse(String(row.model_settings ?? "{}")),
              runtimeMode: row.runtime_mode as Session["runtimeMode"],
              blocks,
              busy: refresh?.busy ?? false,
              nativeSession,
              providerSessionId: row.provider_session_id
                ? String(row.provider_session_id)
                : undefined,
              providerAccountId: row.provider_account_id
                ? String(row.provider_account_id)
                : undefined,
              branch: row.branch ? String(row.branch) : undefined,
              worktreeRemoved: !!row.worktree_removed,
              linkedWorkItem: row.linked_work_item_json
                ? JSON.parse(String(row.linked_work_item_json))
                : undefined,
              automationId: row.automation_id
                ? String(row.automation_id)
                : undefined,
              ...(row.context_used != null
                ? {
                    context: {
                      used: Number(row.context_used),
                      ...(row.context_window != null
                        ? { window: Number(row.context_window) }
                        : {}),
                    },
                  }
                : {}),
            };
            store.save(
              {
                session,
                projectId: project.id,
                revision: (previous?.revision ?? 0) + 1,
                status: refresh?.busy ? "running" : "idle",
                createdAt: Number(row.created_at),
                updatedAt: Number(row.updated_at),
                archived: previous?.archived ?? !!row.archived,
                pinned: previous?.pinned ?? !!row.pinned,
              },
              { type: "desktop.import" },
            );
            imported++;
          }
          store.db
            .prepare("INSERT OR IGNORE INTO metadata VALUES (?, ?)")
            .run(marker, "1");
        });
      } catch (error) {
        for (const file of copied) {
          try {
            unlinkSync(file);
          } catch {
            /* Keep the import error. */
          }
        }
        throw error;
      }
    }
    return imported;
  } finally {
    source.close();
  }
}
