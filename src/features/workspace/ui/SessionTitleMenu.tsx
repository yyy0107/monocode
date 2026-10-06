import { useRef, useState } from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { ChevronDown } from "../../../shared/ui/icons";
import { Popover } from "../../../shared/ui/Popover";
import { ExplorerMenu } from "../../files/ui/ExplorerMenu";
import { useSessionHeaderActions } from "./SessionHeaderActions";

/** Title dropdown of a chat column: rename, new chat beside it, archive. */
export function SessionTitleMenu({
  sessionId,
  title,
}: {
  sessionId: string;
  title: string;
}) {
  const { t } = useTranslation();
  const actions = useSessionHeaderActions();
  const button = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"menu" | "rename" | null>(null);
  const [draft, setDraft] = useState("");
  if (!actions) return null;

  const commitRename = () => {
    const next = draft.trim();
    setMode(null);
    if (next && next !== title) actions.rename(sessionId, next);
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        data-session-title-menu={sessionId}
        data-tauri-drag-region="false"
        aria-label={t("Session actions")}
        aria-haspopup="menu"
        aria-expanded={mode === "menu"}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setMode((current) => (current ? null : "menu"))}
        className="grid size-6 shrink-0 self-center place-items-center rounded-md text-content/50 hover:bg-content/8 hover:text-content"
      >
        <ChevronDown className="size-3.5" strokeWidth={1.75} />
      </button>
      {mode === "menu" && button.current ? (
        <ExplorerMenu
          anchor={button.current}
          ariaLabel={t("Session actions")}
          items={[
            { kind: "item", id: "rename", label: t("Rename") },
            { kind: "item", id: "split", label: t("Split Right") },
            { kind: "sep" },
            { kind: "item", id: "archive", label: t("Archive") },
          ]}
          onPick={(id) => {
            if (id === "rename") {
              setDraft(title);
              setMode("rename");
              return;
            }
            setMode(null);
            if (id === "split") actions.splitRight(sessionId);
            else if (id === "archive") actions.archive(sessionId);
          }}
          onClose={() =>
            setMode((current) => (current === "menu" ? null : current))
          }
        />
      ) : null}
      {mode === "rename" && button.current ? (
        <Popover
          anchor={button.current}
          side="bottom"
          align="start"
          width={280}
          constrainHeight={false}
          onDismiss={() => setMode(null)}
        >
          <form
            className="p-2"
            onSubmit={(event) => {
              event.preventDefault();
              commitRename();
            }}
          >
            <input
              autoFocus
              aria-label={t("Rename")}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              className="h-8 w-full rounded-md border border-content/15 bg-transparent px-2 text-[13px] text-content outline-none focus:border-accent"
            />
          </form>
        </Popover>
      ) : null}
    </>
  );
}
