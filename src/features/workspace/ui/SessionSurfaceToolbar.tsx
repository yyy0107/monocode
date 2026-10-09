import { useTranslation } from "../../../shared/i18n/useTranslation";
import {
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  GitCompare,
  Maximize2,
  MessageSquare,
  PanelRight,
  Terminal,
  X,
} from "../../../shared/ui/icons";
import {
  sessionDisplayTitle,
  type Session,
} from "../../sessions/model/session";
import { useShortcutLabel } from "../../../app/commands/useCommandShortcut";
import type { EditorPane, FilePaneTab } from "../model/layout";
import { SurfaceTabs } from "./SurfaceTabs";
import { startWindowDrag } from "../../../app/shell/startWindowDrag";
import { WindowNavigationSpace } from "../../../app/shell/WindowChrome";
import { projectName } from "../../../shared/lib/paths";
import { SessionRenamePopover } from "./SessionTitleMenu";
import { SessionOverflowMenu } from "./SessionOverflowMenu";
import { useSessionHeaderActions } from "./SessionHeaderActions";
import { SessionWorktreeIcon } from "../../sessions/ui/SessionWorktreeIcon";

export type SessionSurfaceMode = "split" | "unified";

export function SessionSurfaceActions({
  mode,
  onModeChange,
  windowControls,
}: {
  mode: SessionSurfaceMode;
  onModeChange?: (mode: SessionSurfaceMode) => void;
  windowControls?: ReactNode;
}) {
  const { t } = useTranslation();
  const modeLabel =
    mode === "split" ? t("Enter full view") : t("Use split view");
  return (
    <div className="flex shrink-0 items-stretch">
      {onModeChange ? (
        <button
          type="button"
          data-surface-mode-toggle
          data-tauri-drag-region="false"
          aria-label={modeLabel}
          title={modeLabel}
          onClick={() => onModeChange(mode === "split" ? "unified" : "split")}
          className="mr-1 grid size-7.5 shrink-0 self-center place-items-center rounded-md text-content/60 hover:bg-content/5 hover:text-content"
        >
          {mode === "split" ? (
            <Maximize2 className="size-4" />
          ) : (
            <PanelRight className="size-4" />
          )}
        </button>
      ) : null}
      {windowControls}
    </div>
  );
}

export function SessionSurfaceToolbar({
  session,
  panes,
  focusedId,
  showTools,
  dirtyFileIds,
  fileErrorCounts,
  onFocus,
  onSelectFile,
  onCloseFile,
  onCloseOtherFiles,
  onPinFile,
  onReorderFiles,
  windowControls,
  reserveWindowNavigationSpace = false,
  onPaneDragStart,
  onClosePane,
  paneFocused,
}: {
  session: Session;
  panes: EditorPane[];
  focusedId: string;
  showTools: boolean;
  dirtyFileIds: Set<string>;
  fileErrorCounts: Map<string, number>;
  onFocus: (paneId: string) => void;
  onSelectFile: (paneId: string, fileId: string) => void;
  onCloseFile: (paneId: string, fileId: string) => void;
  onCloseOtherFiles: (paneId: string, fileId: string) => void;
  onPinFile?: (fileId: string) => void;
  onReorderFiles: (paneId: string, ids: string[]) => void;
  windowControls?: ReactNode;
  reserveWindowNavigationSpace?: boolean;
  onPaneDragStart?: (event: ReactPointerEvent<HTMLElement>) => void;
  onClosePane?: () => void;
  paneFocused?: boolean;
}) {
  const { t } = useTranslation();
  const closePaneLabel = useShortcutLabel("Close Pane", "Pane: Close");
  const actions = useSessionHeaderActions();
  const [renameAnchor, setRenameAnchor] = useState<HTMLElement | null>(null);
  const files = showTools ? panes.flatMap((pane) => pane.files) : [];
  const owner = (fileId: string) =>
    panes.find((pane) => pane.files.some((file) => file.id === fileId));
  const withOwner = (
    fileId: string,
    action: (paneId: string, fileId: string) => void,
  ) => {
    const pane = owner(fileId);
    if (pane) action(pane.id, fileId);
  };
  const activeFileId =
    panes.find((pane) => pane.id === focusedId)?.activeFileId ?? "";
  const chatActive = !showTools || focusedId === session.id;
  const title = sessionDisplayTitle(session.title, session.harness).trim();
  const project = projectName(session.cwd);

  return (
    <div
      data-session-surface-tabs={session.id}
      data-tauri-drag-region="deep"
      onMouseDownCapture={startWindowDrag}
      className="min-w-0 shrink-0"
    >
      <SurfaceTabs
        files={files}
        activeFileId={chatActive ? "" : activeFileId}
        dirtyFileIds={dirtyFileIds}
        fileErrorCounts={fileErrorCounts}
        label={t("Session tabs")}
        onPaneDragStart={onPaneDragStart}
        leading={
          <>
            {reserveWindowNavigationSpace ? <WindowNavigationSpace /> : null}
            <div className="group relative flex h-full min-w-20 max-w-56 shrink-0 items-center">
              <button
                type="button"
                role="tab"
                data-tauri-drag-region="false"
                data-session-chat-tab={session.id}
                aria-selected={chatActive}
                title={title || t("Chat")}
                onClick={() => onFocus(session.id)}
                onDoubleClick={
                  actions
                    ? (event) => setRenameAnchor(event.currentTarget)
                    : undefined
                }
                className={`surface-tab flex h-7 min-w-0 flex-1 items-center gap-1.5 self-center px-2 text-ui-caption ${onClosePane ? "pr-7" : ""}`}
              >
                <MessageSquare
                  className="size-3.5 shrink-0"
                />
                {paneFocused !== undefined ? (
                  <span
                    className={`size-2 shrink-0 rounded-full ${paneFocused ? "bg-accent" : "bg-transparent"}`}
                  />
                ) : null}
                <span className="truncate">{title || t("Chat")}</span>
                <SessionWorktreeIcon session={session} />
              </button>
              {onClosePane ? (
                <button
                  type="button"
                  data-no-drag
                  data-tauri-drag-region="false"
                  title={closePaneLabel}
                  aria-label={t("Close {value0}", {
                    value0: title || t("Chat"),
                  })}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClosePane();
                  }}
                  className={`absolute right-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-content/50 hover:bg-content/10 hover:text-content group-hover:opacity-100 group-focus-within:opacity-100 ${chatActive ? "opacity-100" : "opacity-0"}`}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
            {project && project !== "~" ? (
              <span
                data-session-project-chip
                title={session.cwd}
                className="ml-1 max-w-32 shrink-0 self-center truncate rounded border border-stroke bg-window px-1.5 py-0.5 text-ui-xs text-foreground-subtle"
              >
                {project}
              </span>
            ) : null}
          </>
        }
        onSelectFile={(fileId) => withOwner(fileId, onSelectFile)}
        onCloseFile={(fileId) => withOwner(fileId, onCloseFile)}
        onCloseOtherFiles={(fileId) => {
          const pane = owner(fileId);
          if (!pane) return;
          onCloseOtherFiles(pane.id, fileId);
        }}
        onPinFile={onPinFile}
        onReorder={(ids) => {
          for (const pane of panes) {
            const owned = new Set(
              pane.files.map((file: FilePaneTab) => file.id),
            );
            onReorderFiles(
              pane.id,
              ids.filter((id) => owned.has(id)),
            );
          }
        }}
        trailing={
          <>
            <SessionToolToggles />
            <SessionOverflowMenu session={session} onRename={setRenameAnchor} />
            {windowControls}
          </>
        }
      />
      {renameAnchor ? (
        <SessionRenamePopover
          key={session.id}
          sessionId={session.id}
          title={title}
          anchor={renameAnchor}
          onClose={() => setRenameAnchor(null)}
        />
      ) : null}
    </div>
  );
}

/** Claude Desktop style terminal / changes switches in the chat header. */
function SessionToolToggles() {
  const { t } = useTranslation();
  const actions = useSessionHeaderActions();
  if (!actions) return null;
  const button = (active: boolean) =>
    `mr-1 grid size-7.5 shrink-0 self-center place-items-center rounded-md hover:bg-content/5 hover:text-content ${
      active ? "bg-content/8 text-content" : "text-content/60"
    }`;
  return (
    <div className="flex shrink-0 items-stretch">
      {actions.terminalAvailable ? (
        <button
          type="button"
          data-session-tool-toggle="terminal"
          data-tauri-drag-region="false"
          aria-label={t("Terminal")}
          aria-pressed={actions.terminalOpen}
          title={t("Terminal")}
          onClick={actions.toggleTerminal}
          className={button(actions.terminalOpen)}
        >
          <Terminal className="size-4" />
        </button>
      ) : null}
      <button
        type="button"
        data-session-tool-toggle="changes"
        data-tauri-drag-region="false"
        aria-label={t("Changes")}
        aria-pressed={actions.changesOpen}
        title={t("Changes")}
        onClick={actions.toggleChanges}
        className={button(actions.changesOpen)}
      >
        <GitCompare className="size-4" />
      </button>
    </div>
  );
}
