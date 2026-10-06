import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import type { AssistantMemory } from "../model/assistant";
import type { AssistantRpc } from "../model/assistantClient";

type MemoryControl =
  | { action: "addMemory"; fact: string }
  | { action: "editMemory"; index: number; fact: string }
  | { action: "forgetMemory"; index: number };

/**
 * The assistant's resident memory, editable in place. Edits apply at once,
 * like cancelling a reminder, and never touch the settings draft. Each edit
 * carries the version it was made against, so one written meanwhile by the
 * assistant or another device is reloaded instead of overwritten.
 */
export function AssistantMemoryEditor({
  rpc,
  revision,
  disabled,
}: {
  rpc: AssistantRpc;
  /** The Host's current memory version; a change reloads the list. */
  revision: number;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [memory, setMemory] = useState<AssistantMemory>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<{ index: number; text: string }>();
  const [adding, setAdding] = useState("");
  const loads = useRef(0);
  const load = useCallback(async () => {
    const load = ++loads.current;
    try {
      const next = await rpc<AssistantMemory | null>("assistant.memory");
      if (load === loads.current && next) setMemory(next);
    } catch (cause) {
      if (load === loads.current)
        setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [rpc]);
  useEffect(() => {
    void load();
  }, [load, revision]);
  const control = async (input: MemoryControl) => {
    if (!memory) return false;
    setPending(true);
    setError(undefined);
    try {
      await rpc("assistant.control", {
        commandId: crypto.randomUUID(),
        expectedRevision: memory.revision,
        ...input,
      });
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setPending(false);
      await load();
    }
  };
  const busy = disabled || pending || !memory;
  const facts = memory?.facts.filter((fact) => !fact.struck) ?? [];
  const saveEdit = async () => {
    if (!editing?.text.trim()) return;
    if (
      await control({
        action: "editMemory",
        index: editing.index,
        fact: editing.text,
      })
    )
      setEditing(undefined);
  };
  const add = async () => {
    if (!adding.trim()) return;
    if (await control({ action: "addMemory", fact: adding })) setAdding("");
  };
  // The editor sits inside the settings form; Enter must not submit it.
  const onEnter =
    (submit: () => Promise<void>) => (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
      event.preventDefault();
      void submit();
    };
  return (
    <div className="assistant-memory">
      {memory && !facts.length && (
        <p className="assistant-memory-empty">
          {t("Nothing remembered yet. The assistant saves lasting facts and preferences as it learns them.")}
        </p>
      )}
      {facts.length > 0 && (
        <ul className="assistant-memory-list" aria-label={t("Remembered facts")}>
          {facts.map((fact) => (
            <li key={`${fact.index}:${fact.text}`}>
              {editing?.index === fact.index ? (
                <>
                  <input
                    aria-label={t("Edit fact")}
                    value={editing.text}
                    maxLength={1000}
                    disabled={busy}
                    autoFocus
                    onChange={(e) =>
                      setEditing({ index: fact.index, text: e.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditing(undefined);
                      else onEnter(saveEdit)(event);
                    }}
                  />
                  <button
                    type="button"
                    className="assistant-link-button"
                    disabled={busy || !editing.text.trim()}
                    onClick={() => void saveEdit()}
                  >
                    {t("Save")}
                  </button>
                  <button
                    type="button"
                    className="assistant-link-button"
                    disabled={pending}
                    onClick={() => setEditing(undefined)}
                  >
                    {t("Cancel")}
                  </button>
                </>
              ) : (
                <>
                  <span className="assistant-memory-fact">
                    {fact.text}
                    {(fact.date || fact.until) && (
                      <small>
                        {[
                          fact.date,
                          fact.until && t("until {date}", { date: fact.until }),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    )}
                  </span>
                  <button
                    type="button"
                    className="assistant-link-button"
                    disabled={busy}
                    onClick={() =>
                      setEditing({ index: fact.index, text: fact.text })
                    }
                  >
                    {t("Edit")}
                  </button>
                  <button
                    type="button"
                    className="assistant-link-button"
                    disabled={busy}
                    onClick={() =>
                      void control({ action: "forgetMemory", index: fact.index })
                    }
                  >
                    {t("Forget")}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="assistant-memory-add">
        <input
          aria-label={t("Add a fact for the assistant to remember")}
          placeholder={t("Add a fact for the assistant to remember")}
          value={adding}
          maxLength={1000}
          disabled={busy}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={onEnter(add)}
        />
        <button
          type="button"
          disabled={busy || !adding.trim()}
          onClick={() => void add()}
        >
          {t("Add")}
        </button>
      </div>
      {!!memory?.topics.length && (
        <small>
          {t("Topic notes: {topics}", { topics: memory.topics.join(", ") })}
        </small>
      )}
      {error && (
        <small className="assistant-field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  );
}
