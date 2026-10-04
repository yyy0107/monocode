import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { isImeComposition } from "../../../shared/lib/keyboard";
import {
  Check,
  CornerDownRight,
  ListEnd,
  Pause,
  Pencil,
  Play,
  Trash2,
  X,
} from "../../../shared/ui/icons";
import type { QueuedMessage, MessageQueueStatus } from "../model/session";

export function MessageQueue({
  messages,
  status,
  onDelete,
  onEdit,
  onEditingChange,
  onSteer,
  onResume,
  disabled = false,
  canSteer = true,
  canResume = true,
  remote = false,
}: {
  messages: QueuedMessage[];
  status?: MessageQueueStatus;
  onDelete?: (messageId: string) => void | Promise<void>;
  onEdit?: (messageId: string, text: string) => void | Promise<void>;
  onEditingChange?: (messageId?: string) => void | Promise<void>;
  onSteer?: (messageId: string) => void | Promise<void>;
  onResume?: () => void | Promise<void>;
  disabled?: boolean;
  canSteer?: boolean;
  canResume?: boolean;
  remote?: boolean;
}) {
  const { t: uiT } = useTranslation();
  const [editingId, setEditingId] = useState<string>();
  const [editDraft, setEditDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const invoke = (
    action: (() => void | Promise<void>) | undefined,
    done?: () => void,
  ) => {
    if (!action || working || disabled) return;
    setError("");
    try {
      const result = action();
      if (result && typeof result.then === "function") {
        setWorking(true);
        void result
          .then(done)
          .catch((reason) => setError(String(reason).replace(/^Error: /, "")))
          .finally(() => setWorking(false));
      } else done?.();
    } catch (reason) {
      setError(String(reason).replace(/^Error: /, ""));
    }
  };
  const onEditingChangeRef = useRef(onEditingChange);
  onEditingChangeRef.current = onEditingChange;
  const editingIdRef = useRef(editingId);
  editingIdRef.current = editingId;
  useEffect(() => {
    return () => {
      if (editingIdRef.current)
        void Promise.resolve(onEditingChangeRef.current?.()).catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (editingId && !messages.some((row) => row.id === editingId)) {
      setEditingId(undefined);
      setEditDraft("");
    }
  }, [editingId, messages]);
  useEffect(() => {
    if (!remote || !editingId) return;
    const timer = setInterval(() => {
      void Promise.resolve(onEditingChangeRef.current?.(editingId)).catch(
        (reason) => setError(String(reason)),
      );
    }, 30_000);
    return () => clearInterval(timer);
  }, [remote, editingId]);
  if (messages.length === 0) return null;
  const paused = status === "paused";

  const clearEdit = () => {
    setEditingId(undefined);
    setEditDraft("");
  };
  const startEdit = (message: QueuedMessage) =>
    invoke(
      () => onEditingChange?.(message.id),
      () => {
        setEditingId(message.id);
        setEditDraft(message.text);
      },
    );
  const cancelEdit = () => invoke(() => onEditingChange?.(), clearEdit);
  const saveEdit = (message: QueuedMessage) => {
    if (!editDraft.trim() && message.attachments.length === 0) return;
    invoke(() => onEdit?.(message.id, editDraft), clearEdit);
  };

  return (
    <div className="px-2 text-content/55" data-message-queue>
      <div
        className="relative z-0 rounded-t-[10px] border border-b-0 border-content/10 bg-content/3 px-2 py-1"
        data-message-queue-card
      >
        {paused ? (
          <div className="flex h-7 items-center gap-2 border-b border-stroke text-[12px]">
            <Pause className="size-3.5" />
            <span className="min-w-0 flex-1 truncate">
              {uiT(
                remote
                  ? "Queue paused"
                  : "Queue paused because you interrupted",
              )}
            </span>
            <button
              type="button"
              disabled={disabled || working || !canResume || !onResume}
              onClick={() => invoke(onResume)}
              className="flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-content/10 hover:text-content"
            >
              <Play className="size-3.5" />
              {uiT("Resume")}
            </button>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="py-1 text-[12px] text-danger">
            {error}
          </p>
        ) : null}
        {messages.map((message, index) => {
          const editing = editingId === message.id;
          const label =
            message.text.trim() ||
            `${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}`;
          return (
            <div
              key={message.id}
              className={`flex min-h-7 items-center gap-2 text-[12px] ${
                index > 0 ? "border-t border-stroke" : ""
              }`}
            >
              <ListEnd className="size-3.5 shrink-0" />
              {editing ? (
                <>
                  <textarea
                    autoFocus
                    aria-label={uiT("Edit queued message")}
                    value={editDraft}
                    disabled={disabled || working}
                    rows={1}
                    onChange={(event) => setEditDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (isImeComposition(event.nativeEvent)) return;
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      } else if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        saveEdit(message);
                      }
                    }}
                    className="min-h-6 min-w-0 flex-1 resize-none rounded-md border border-content/15 bg-content/5 px-1.5 py-0.5 text-[12px] text-content outline-none focus:border-content/30"
                  />
                  <button
                    type="button"
                    title={uiT("Save queued message")}
                    aria-label={uiT("Save queued message")}
                    disabled={
                      disabled ||
                      working ||
                      (!editDraft.trim() && message.attachments.length === 0)
                    }
                    onClick={() => saveEdit(message)}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content disabled:opacity-30"
                  >
                    <Check className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title={uiT("Cancel queued message edit")}
                    aria-label={uiT("Cancel queued message edit")}
                    disabled={disabled || working}
                    onClick={cancelEdit}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-content/80">
                    {label}
                  </span>
                  <button
                    type="button"
                    disabled={disabled || working || !canSteer || !onSteer}
                    onClick={() => invoke(() => onSteer?.(message.id))}
                    className="flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-content/10 hover:text-content"
                  >
                    <CornerDownRight className="size-3.5" />
                    {uiT("Steer")}
                  </button>
                  <button
                    type="button"
                    title={uiT("Edit queued message")}
                    aria-label={uiT("Edit queued message")}
                    disabled={disabled || working || !onEdit}
                    onClick={() => startEdit(message)}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title={uiT("Remove queued message")}
                    aria-label={uiT("Remove queued message")}
                    disabled={disabled || working || !onDelete}
                    onClick={() => invoke(() => onDelete?.(message.id))}
                    className="grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
