import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { setGrabbing, suppressTextSelection } from "../../../shared/lib/drag";
import { ResizeHandle } from "../../../shared/ui/ResizeHandle";
import { Maximize2 } from "../../../shared/ui/icons";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import {
  paneDropFromPoint,
  useExternalPaneDrop,
} from "../model/paneDrop";
import type {
  ApprovalDecision,
  UserQuestionReply,
} from "../../../integrations/harness";
import type { EditorNavigationTarget } from "../../search/model/search";
import {
  layoutLeaves,
  layoutSashes,
  setSplitRatio,
  type EditorPane,
  type LayoutLeaf,
  type LayoutNode,
  type LayoutSash,
  type PaneEdge,
} from "../model/layout";
import {
  sameProjectPath,
  type RecentProject,
} from "../../projects/model/recents";
import type { TerminalMetaPatch } from "../../terminal/model/terminalTab";
import {
  sessionWorkCwd,
  type Attachment,
  type Block,
  type HarnessId,
  type LinkedWorkItem,
  type ModelTarget,
  type PlanBuildTarget,
  type RuntimeMode,
  type Session,
  type WorkspaceMode,
  type ComposerTurnOptions,
} from "../../sessions/model/session";
import { FilePane } from "../../files/ui/FilePane";
import { SessionPane } from "../../sessions/ui/SessionPane";
import type { TranscriptPool } from "../../sessions/ui/TranscriptPool";
import type { Worktree } from "../../source-control/model/worktrees";
import {
  SessionSurfaceToolbar,
  type SessionSurfaceMode,
} from "./SessionSurfaceToolbar";
import { SessionSurfacePane } from "./SessionSurfacePane";
import { sessionSurfaceGrid } from "./sessionSurfaceGrid";

type Shared = {
  workspaceSwitchingSessionId?: string;
  visible: boolean;
  sessions: Session[];
  editorPanes: EditorPane[];
  dirtyFileIds: Set<string>;
  fileErrorCounts: Map<string, number>;
  focusedId: string;
  surfaceMode?: SessionSurfaceMode;
  onSurfaceModeChange?: (mode: SessionSurfaceMode) => void;
  windowControls?: ReactNode;
  reserveWindowNavigationSpace?: boolean;
  addToChatSessionId?: string;
  composerFocused: boolean;
  composerFocusToken?: number;
  recents: RecentProject[];
  hideProjectPicker?: boolean;
  onFocus: (paneId: string) => void;
  onClose: (sessionId: string) => void;
  onSelectFile: (paneId: string, fileId: string) => void;
  onCloseFile: (paneId: string, fileId: string) => void;
  onCloseOtherFiles: (paneId: string, fileId: string) => void;
  onPinFile?: (fileId: string) => void;
  onReorderFiles: (paneId: string, ids: string[]) => void;
  onFileDirtyChange: (fileId: string, dirty: boolean) => void;
  onFileErrorCountChange: (fileId: string, count: number) => void;
  onRatio: (splitId: string, index: number, ratio: number) => void;
  onCwdChange: (sessionId: string, cwd: string) => void;
  onBranchChange: (sessionId: string) => void;
  onWorktreeChange?: (sessionId: string, tree: Worktree) => Promise<void>;
  onWorkspaceModeChange: (
    sessionId: string,
    mode: WorkspaceMode,
    base?: string,
  ) => void;
  onWorktreeBaseChange: (sessionId: string, base: string) => void;
  onManageWorktrees?: () => void;
  onModelChange: (sessionId: string, harness: HarnessId, model: string) => void;
  onModelSettingsChange: (
    sessionId: string,
    settings: Record<string, string>,
  ) => void;
  onRuntimeModeChange: (sessionId: string, mode: RuntimeMode) => void;
  onSubmit: (
    sessionId: string,
    text: string,
    attachments: Attachment[],
    options?: ComposerTurnOptions,
  ) => boolean | void;
  onSaveDraft: (
    sessionId: string,
    text: string,
    attachments: Attachment[],
  ) => boolean | void;
  onRemoveDraft: (sessionId: string, draftBlockId: string) => boolean | void;
  onStop: (sessionId: string) => void;
  onCompactContext: (sessionId: string) => boolean;
  onDeleteQueuedMessage: (sessionId: string, messageId: string) => void;
  onEditQueuedMessage: (
    sessionId: string,
    messageId: string,
    text: string,
  ) => void;
  onQueuedMessageEditingChange: (sessionId: string, messageId?: string) => void;
  onSteerQueuedMessage: (sessionId: string, messageId: string) => void;
  onResumeQueue: (sessionId: string) => void;
  onUsageLimitResume: (sessionId: string) => void;
  onUsageLimitResumeAtReset: (sessionId: string, enabled: boolean) => void;
  onUsageLimitDismiss: (sessionId: string) => void;
  onInboxCardDismiss?: (sessionId: string) => void;
  onLinkedWorkItemUpdateCardDismiss?: (sessionId: string) => void;
  onNoteCardDismiss?: (sessionId: string) => void;
  onHandoffCardDismiss?: (sessionId: string) => void;
  onOpenLinkedWorkItem?: (item: LinkedWorkItem, sessionId: string) => void;
  onArchiveSession?: (sessionId: string, archived: boolean) => Promise<boolean>;
  onDeleteSession?: (sessionId: string) => Promise<boolean>;
  onApproval: (
    sessionId: string,
    requestId: number,
    decision: ApprovalDecision,
  ) => void;
  onQuestionReply: (
    sessionId: string,
    requestId: number,
    reply: UserQuestionReply,
  ) => void;
  onQuestionInteraction?: (sessionId: string, requestId: number) => void;
  onOpenFile: (path: string) => void;
  onOpenSessionFile?: (path: string, sessionId: string) => void;
  editorNavigation?: EditorNavigationTarget | null;
  onOpenDiff: (
    path?: string,
    session?: { sessionId: string; cwd: string },
  ) => void;
  onOpenPlan: (sessionId: string, blockId: string) => void;
  onUpdatePlan: (sessionId: string, blockId: string, text: string) => void;
  onBuildPlan: (
    sessionId: string,
    blockId: string,
    target?: PlanBuildTarget,
  ) => void;
  onSecondOpinion?: (
    sessionId: string,
    target: ModelTarget,
    turn: Block[],
  ) => void;
  onHandoff?: (sessionId: string, target: ModelTarget, turn: Block[]) => void;
  onBtwSubmit?: (
    sessionId: string,
    turn: Block[],
    threadId: string,
    messageId: string,
    text: string,
    model?: string,
    modelSettings?: Record<string, string>,
  ) => boolean | void;
  onBtwRetry?: (sessionId: string, turn: Block[], threadId: string) => void;
  onBtwDelete?: (sessionId: string, turn: Block[], threadId: string) => void;
  onBtwStop?: (sessionId: string, turn: Block[], threadId: string) => void;
  onBtwModelChange?: (
    sessionId: string,
    turn: Block[],
    threadId: string,
    model: string,
    modelSettings: Record<string, string>,
  ) => void;
  onMovePane: (fromId: string, toId: string, edge: PaneEdge) => void;
  onNewTerminal: (sessionId: string) => void;
  onTerminalMetaChange?: (fileId: string, patch: TerminalMetaPatch) => void;
  transcriptPool?: TranscriptPool;
};

type Props = Shared & { layout: LayoutNode };

type PaneDrag = {
  fromId: string;
  overId: string | null;
  edge: PaneEdge;
};

const DRAG_THRESHOLD = 5;
const PANE_BOUNDARY_EPSILON = 0.001;

// The owning chat's heading lives in the full-width top bar.
const emptyHeader = () => null;

function PaneTreeComponent({
  visible,
  layout,
  sessions,
  editorPanes,
  dirtyFileIds,
  fileErrorCounts,
  focusedId,
  surfaceMode = "split",
  onSurfaceModeChange,
  windowControls,
  reserveWindowNavigationSpace = false,
  addToChatSessionId,
  composerFocused,
  composerFocusToken,
  recents,
  hideProjectPicker,
  workspaceSwitchingSessionId,
  onFocus,
  onClose,
  onSelectFile,
  onCloseFile,
  onCloseOtherFiles,
  onPinFile,
  onReorderFiles,
  onFileDirtyChange,
  onFileErrorCountChange,
  onRatio,
  onCwdChange,
  onBranchChange,
  onWorktreeChange,
  onWorkspaceModeChange,
  onWorktreeBaseChange,
  onManageWorktrees,
  onModelChange,
  onModelSettingsChange,
  onRuntimeModeChange,
  onSaveDraft,
  onRemoveDraft,
  onSubmit,
  onStop,
  onCompactContext,
  onDeleteQueuedMessage,
  onEditQueuedMessage,
  onQueuedMessageEditingChange,
  onSteerQueuedMessage,
  onResumeQueue,
  onUsageLimitResume,
  onUsageLimitResumeAtReset,
  onUsageLimitDismiss,
  onInboxCardDismiss,
  onLinkedWorkItemUpdateCardDismiss,
  onNoteCardDismiss,
  onHandoffCardDismiss,
  onOpenLinkedWorkItem,
  onArchiveSession,
  onDeleteSession,
  onApproval,
  onQuestionReply,
  onQuestionInteraction,
  onOpenFile,
  onOpenSessionFile,
  editorNavigation,
  onOpenDiff,
  onOpenPlan,
  onUpdatePlan,
  onBuildPlan,
  onSecondOpinion,
  onBtwSubmit,
  onBtwRetry,
  onBtwDelete,
  onBtwStop,
  onBtwModelChange,
  onHandoff,
  onMovePane,
  onNewTerminal,
  onTerminalMetaChange,
  transcriptPool,
}: Props) {
  const treeRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const [draft, setDraft] = useState<LayoutNode | null>(null);
  const [resizing, setResizing] = useState(false);
  const [paneDrag, setPaneDrag] = useState<PaneDrag | null>(null);
  // A card can temporarily fill the chat area; the rest stay mounted.
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const externalDrop = useExternalPaneDrop(visible);
  const drop = paneDrag ?? externalDrop;
  const onMovePaneRef = useRef(onMovePane);
  onMovePaneRef.current = onMovePane;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  // Callers pass a fresh arrow per render. Reading it through a ref keeps the
  // toolbar props and session headers stable, so `SessionPane`'s shallow memo
  // can skip renders driven by another session's stream.
  const surfaceModeChangeRef = useRef(onSurfaceModeChange);
  surfaceModeChangeRef.current = onSurfaceModeChange;
  const stableSurfaceModeChange = useCallback(
    (mode: SessionSurfaceMode) => surfaceModeChangeRef.current?.(mode),
    [],
  );
  const surfaceModeChange = onSurfaceModeChange
    ? stableSurfaceModeChange
    : undefined;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const fileActionsRef = useRef({ onOpenFile, onOpenSessionFile });
  fileActionsRef.current = { onOpenFile, onOpenSessionFile };
  const sessionFileHandlers = useRef(new Map<string, (path: string) => void>());

  useEffect(() => {
    const paneIds = new Set(layoutLeaves(layout).map((leaf) => leaf.id));
    for (const sessionId of sessionFileHandlers.current.keys()) {
      if (
        !paneIds.has(sessionId) ||
        !sessions.some((session) => session.id === sessionId)
      ) {
        sessionFileHandlers.current.delete(sessionId);
      }
    }
  }, [layout, sessions]);

  const openSessionFileFor = (sessionId: string) => {
    const cached = sessionFileHandlers.current.get(sessionId);
    if (cached) return cached;
    const handler = (path: string) => {
      const actions = fileActionsRef.current;
      if (actions.onOpenSessionFile) actions.onOpenSessionFile(path, sessionId);
      else actions.onOpenFile(path);
    };
    sessionFileHandlers.current.set(sessionId, handler);
    return handler;
  };

  useEffect(() => {
    setDraft(null);
  }, [layout]);

  // A sash drag re-renders this tree every frame. Keep session callbacks and
  // file-pane controls stable so memoized transcript/editor subtrees can skip it.
  const dragHandlers = useRef(
    new Map<string, (event: ReactPointerEvent<HTMLElement>) => void>(),
  );
  // Stable per card so a sash drag never re-renders memoized file panes.
  const cardMaximize = useRef(
    new Map<string, { maximized: boolean; node: ReactNode }>(),
  );
  const cardMaximizeFor = (paneId: string, isMaximized: boolean) => {
    const cached = cardMaximize.current.get(paneId);
    if (cached?.maximized === isMaximized) return cached.node;
    const node = (
      <CardMaximizeButton
        maximized={isMaximized}
        onToggle={() =>
          setMaximizedId((current) => (current === paneId ? null : paneId))
        }
      />
    );
    cardMaximize.current.set(paneId, { maximized: isMaximized, node });
    return node;
  };
  const paneDragStartFor = (paneId: string) => {
    const cached = dragHandlers.current.get(paneId);
    if (cached) return cached;
    const handler = (event: ReactPointerEvent<HTMLElement>) =>
      startPaneDrag(paneId, event);
    dragHandlers.current.set(paneId, handler);
    return handler;
  };

  const tree = draft ?? layout;
  const leaves = layoutLeaves(tree);
  const sashes = layoutSashes(tree);
  const inSplit = leaves.length > 1;
  const sessionLeaves = leaves.filter((leaf) =>
    sessions.some((session) => session.id === leaf.id),
  );
  // `editorPanes` is rebuilt by the caller every render; keep the previous
  // array while its panes are the same so `toolbarProps` stays stable.
  const ownedPanesRef = useRef<EditorPane[]>([]);
  const ownedPanes = useMemo(() => {
    const paneIds = new Set(layoutLeaves(layout).map((leaf) => leaf.id));
    const next = editorPanes.filter((pane) => paneIds.has(pane.id));
    const previous = ownedPanesRef.current;
    return next.length === previous.length &&
      next.every((pane, index) => pane === previous[index])
      ? previous
      : next;
  }, [editorPanes, layout]);
  ownedPanesRef.current = ownedPanes;
  // Multi-chat split layouts retain their existing pane and sash behavior.
  const ownerSession =
    sessionLeaves.length === 1
      ? sessions.find((session) => session.id === sessionLeaves[0].id)
      : undefined;
  const hasOwnerSession = !!ownerSession;
  const unified = hasOwnerSession && surfaceMode === "unified";
  // A single chat owns a full-width top bar (title, tools, window controls);
  // its documents sit beside it as cards.
  const ownerTopBar = hasOwnerSession;
  // Without a window tab strip, the top corners of the layout carry the
  // window chrome: navigation space on the left, window controls on the right.
  const topLeftId = leaves.find(
    (leaf) =>
      leaf.rect.x < PANE_BOUNDARY_EPSILON &&
      leaf.rect.y < PANE_BOUNDARY_EPSILON,
  )?.id;
  const topRightId = leaves.find(
    (leaf) =>
      leaf.rect.y < PANE_BOUNDARY_EPSILON &&
      leaf.rect.x + leaf.rect.w > 1 - PANE_BOUNDARY_EPSILON,
  )?.id;
  const selectedId = leaves.some((leaf) => leaf.id === focusedId)
    ? focusedId
    : (ownerSession?.id ?? leaves[0]?.id);
  const maximized =
    !unified && ownerSession && leaves.some((leaf) => leaf.id === maximizedId)
      ? (maximizedId ?? undefined)
      : undefined;
  const surfaceGrid = ownerSession
    ? sessionSurfaceGrid(leaves, unified ? selectedId : maximized)
    : undefined;
  const toolbarProps = useMemo(
    () => ({
      panes: ownedPanes,
      focusedId: selectedId ?? "",
      mode: unified ? ("unified" as const) : ("split" as const),
      dirtyFileIds,
      fileErrorCounts,
      onFocus,
      onSelectFile,
      onCloseFile,
      onCloseOtherFiles,
      onPinFile,
      onReorderFiles,
      onModeChange: surfaceModeChange,
      windowControls: hasOwnerSession ? windowControls : undefined,
      reserveWindowNavigationSpace:
        hasOwnerSession && reserveWindowNavigationSpace,
    }),
    [
      ownedPanes,
      selectedId,
      unified,
      dirtyFileIds,
      fileErrorCounts,
      onFocus,
      onSelectFile,
      onCloseFile,
      onCloseOtherFiles,
      onPinFile,
      onReorderFiles,
      surfaceModeChange,
      hasOwnerSession,
      windowControls,
      reserveWindowNavigationSpace,
    ],
  );
  const gridStyle: CSSProperties | undefined = surfaceGrid
    ? {
        ...surfaceGrid.style,
        transitionProperty: resizing ? "none" : undefined,
      }
    : undefined;

  // A pane split into an existing layout slides in from the edge it was added
  // on, like the linked work item panel. The neighbours reflow once up front;
  // only the new pane's content moves, so nothing rewraps mid-animation.
  // Panes present when the tree mounts, or swapped in place, just appear.
  const knownLeafIds = useRef<ReadonlySet<string> | null>(null);
  const enteringPanes = useRef(new Map<string, PaneEnterFrom>());
  const [, rerender] = useReducer((tick: number) => tick + 1, 0);
  if (knownLeafIds.current && leaves.length > knownLeafIds.current.size) {
    for (const leaf of leaves) {
      if (knownLeafIds.current.has(leaf.id)) continue;
      enteringPanes.current.set(leaf.id, paneEnterFrom(leaf));
    }
  }
  knownLeafIds.current = new Set(leaves.map((leaf) => leaf.id));

  const startPaneDrag = useCallback(
    (fromId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      const handle = event.currentTarget;
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startY = event.clientY;
      let active = false;

      let lastX = startX;
      let lastY = startY;
      handle.setPointerCapture(pointerId);
      const restoreSelection = suppressTextSelection();

      const onMove = (ev: PointerEvent) => {
        lastX = ev.clientX;
        lastY = ev.clientY;
        if (!active) {
          if (
            Math.hypot(ev.clientX - startX, ev.clientY - startY) <
            DRAG_THRESHOLD
          ) {
            return;
          }
          active = true;
          setGrabbing(true);
          onFocusRef.current(fromId);
          setPaneDrag({ fromId, overId: null, edge: "left" });
        }
        const over = paneDropFromPoint(ev.clientX, ev.clientY);
        if (!over || over.id === fromId) {
          setPaneDrag({
            fromId,
            overId: over?.id === fromId ? fromId : null,
            edge: over?.edge ?? "left",
          });
          return;
        }
        setPaneDrag({ fromId, overId: over.id, edge: over.edge });
      };

      const onUp = () => finish(true);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape") return;
        ev.preventDefault();
        finish(false);
      };

      function finish(commit: boolean) {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("keydown", onKey);
        restoreSelection();
        setGrabbing(false);
        setPaneDrag(null);
        try {
          handle.releasePointerCapture(pointerId);
        } catch {
          /* already released */
        }
        if (!active || !commit) return;
        const over = paneDropFromPoint(lastX, lastY);
        if (over && over.id !== fromId) {
          onMovePaneRef.current(fromId, over.id, over.edge);
        }
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("keydown", onKey);
    },
    [],
  );

  // Keyed by the session ids only: a streamed token replaces a `Session`
  // object every frame, and a new header function would defeat the memo on
  // every visible `SessionPane`. The header reads the latest session at call
  // time, which is during that pane's own render.
  const sessionIdsKey = sessions.map((session) => session.id).join("\n");
  const sessionHeaders = useMemo(
    () =>
      new Map(
        (sessionIdsKey ? sessionIdsKey.split("\n") : []).map((sessionId) => [
          sessionId,
          unified
            ? undefined
            : ownerTopBar
              ? emptyHeader
              : (resolvedSession: Session) => {
                  const session =
                    sessionsRef.current.find(
                      (entry) => entry.id === sessionId,
                    ) ?? resolvedSession;
                  return (
                    <SessionSurfaceToolbar
                      {...toolbarProps}
                      session={{
                        ...session,
                        title: resolvedSession.title,
                        harness: resolvedSession.harness,
                      }}
                      showTools={false}
                      {...(hasOwnerSession
                        ? {}
                        : {
                            windowControls:
                              sessionId === topRightId
                                ? windowControls
                                : undefined,
                            reserveWindowNavigationSpace:
                              !!reserveWindowNavigationSpace &&
                              sessionId === topLeftId,
                          })}
                      onPaneDragStart={
                        inSplit ? paneDragStartFor(sessionId) : undefined
                      }
                      onClosePane={() => onClose(sessionId)}
                      paneFocused={
                        inSplit ? focusedId === sessionId : undefined
                      }
                    />
                  );
                },
        ]),
      ),
    [
      sessionIdsKey,
      unified,
      toolbarProps,
      hasOwnerSession,
      ownerTopBar,
      inSplit,
      onClose,
      focusedId,
      topLeftId,
      topRightId,
      windowControls,
      reserveWindowNavigationSpace,
    ],
  );

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      {ownerTopBar && ownerSession ? (
        <SessionSurfaceToolbar
          {...toolbarProps}
          session={ownerSession}
          showTools={unified}
          onPaneDragStart={
            inSplit && !unified ? paneDragStartFor(ownerSession.id) : undefined
          }
          onClosePane={() => onClose(ownerSession.id)}
        />
      ) : null}
      <div
        ref={treeRef}
        data-pane-tree-layout
        data-surface-mode={unified ? "unified" : "split"}
        className={`relative min-h-0 min-w-0 flex-1 ${surfaceGrid ? "animated-collapse-size grid" : ""}`}
        style={gridStyle}
      >
        {leaves.map((leaf) => {
          const editorPane = editorPanes.find((pane) => pane.id === leaf.id);
          // Documents beside a chat render as cards, like Claude Desktop.
          const asCard =
            !!editorPane &&
            !unified &&
            sessionLeaves.length > 0 &&
            !editorPane.files.some((file) => file.appView);
          const session = sessions.find((entry) => entry.id === leaf.id);
          const expanded = unified
            ? selectedId === leaf.id
            : !maximized || maximized === leaf.id;
          const paneVisible = visible && expanded;
          const dragging = drop?.fromId === leaf.id;
          const onPaneDragStart =
            inSplit && !unified ? paneDragStartFor(leaf.id) : undefined;
          const backgroundStyle = {
            "--chat-background-left": `${unified ? 0 : (-leaf.rect.x / leaf.rect.w) * 100}%`,
            "--chat-background-top": `${unified ? 0 : (-leaf.rect.y / leaf.rect.h) * 100}%`,
            "--chat-background-width": `${unified ? 100 : 100 / leaf.rect.w}%`,
            "--chat-background-height": `${unified ? 100 : 100 / leaf.rect.h}%`,
          } as CSSProperties;
          return (
            <SessionSurfacePane
              key={leaf.id}
              id={leaf.id}
              grid={!!surfaceGrid}
              expanded={expanded}
              visible={visible}
              dragging={dragging}
              // The new pane focuses its composer or editor while it is still
              // offscreen, and focus scrolls this clip box to reveal it, which
              // fights the slide. Scroll events land before paint, so undoing
              // it here never shows.
              onScroll={(event) => {
                if (!enteringPanes.current.has(leaf.id)) return;
                event.currentTarget.scrollLeft = 0;
                event.currentTarget.scrollTop = 0;
              }}
              style={
                surfaceGrid
                  ? {
                      ...surfaceGrid.placements.get(leaf.id),
                      ...backgroundStyle,
                    }
                  : unified
                    ? {
                        inset: 0,
                        ...backgroundStyle,
                      }
                    : {
                        left: `${leaf.rect.x * 100}%`,
                        top: `${leaf.rect.y * 100}%`,
                        width: `${leaf.rect.w * 100}%`,
                        height: `${leaf.rect.h * 100}%`,
                        ...backgroundStyle,
                      }
              }
            >
              {drop && drop.overId === leaf.id && drop.fromId !== leaf.id ? (
                <PaneDropHint edge={drop.edge} />
              ) : null}
              <div
                data-pane-enter={enteringPanes.current.get(leaf.id)}
                onAnimationEnd={(event) => {
                  if (event.animationName !== "pane-enter") return;
                  enteringPanes.current.delete(leaf.id);
                  rerender();
                }}
                className="flex min-h-0 min-w-0 flex-1 flex-col"
                style={{
                  paddingLeft:
                    !unified && leaf.rect.x > PANE_BOUNDARY_EPSILON
                      ? 16
                      : undefined,
                  paddingTop:
                    !unified && leaf.rect.y > PANE_BOUNDARY_EPSILON
                      ? 16
                      : undefined,
                }}
              >
                {editorPane ? (
                  <div
                    data-pane-card={asCard ? "" : undefined}
                    className={
                      asCard
                        ? "mb-2 mr-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-content/10 bg-background-base"
                        : "flex min-h-0 min-w-0 flex-1 flex-col"
                    }
                  >
                    <FilePane
                      pane={editorPane}
                      visible={paneVisible}
                      focused={paneVisible && focusedId === editorPane.id}
                      showTabs={
                        !unified &&
                        (inSplit ||
                          editorPane.files.length > 1 ||
                          (!hasOwnerSession && topRightId === editorPane.id))
                      }
                      tabsTrailing={
                        asCard && ownerSession
                          ? cardMaximizeFor(
                              editorPane.id,
                              maximized === editorPane.id,
                            )
                          : !hasOwnerSession && topRightId === editorPane.id
                            ? windowControls
                            : undefined
                      }
                      dirtyFileIds={dirtyFileIds}
                      fileErrorCounts={fileErrorCounts}
                      sessions={sessions}
                      onFocus={onFocus}
                      onSelectFile={onSelectFile}
                      onCloseFile={onCloseFile}
                      onCloseOtherFiles={onCloseOtherFiles}
                      onPinFile={onPinFile}
                      onReorderFiles={onReorderFiles}
                      onDirtyChange={onFileDirtyChange}
                      onErrorCountChange={onFileErrorCountChange}
                      onOpenFile={onOpenFile}
                      onUpdatePlan={onUpdatePlan}
                      onBuildPlan={onBuildPlan}
                      editorNavigation={editorNavigation}
                      onPaneDragStart={onPaneDragStart}
                      onTerminalMetaChange={onTerminalMetaChange}
                    />
                  </div>
                ) : session ? (
                  <SessionPane
                    session={session}
                    renderHeader={sessionHeaders.get(session.id)}
                    workspaceSwitchingSessionId={workspaceSwitchingSessionId}
                    reviewUndoLocked={sessions.some(
                      (other) =>
                        other.id !== session.id &&
                        other.busy &&
                        sameProjectPath(
                          sessionWorkCwd(other),
                          sessionWorkCwd(session),
                        ),
                    )}
                    visible={paneVisible}
                    focused={paneVisible && focusedId === session.id}
                    addToChatTarget={addToChatSessionId === session.id}
                    inSplit={inSplit && !unified}
                    composerFocused={paneVisible && composerFocused}
                    composerFocusToken={composerFocusToken}
                    recents={recents}
                    hideProjectPicker={hideProjectPicker}
                    onFocus={onFocus}
                    onClose={onClose}
                    onCwdChange={onCwdChange}
                    onBranchChange={onBranchChange}
                    onWorktreeChange={onWorktreeChange}
                    onWorkspaceModeChange={onWorkspaceModeChange}
                    onWorktreeBaseChange={onWorktreeBaseChange}
                    onManageWorktrees={onManageWorktrees}
                    onModelChange={onModelChange}
                    onModelSettingsChange={onModelSettingsChange}
                    onRuntimeModeChange={onRuntimeModeChange}
                    onSaveDraft={onSaveDraft}
                    onRemoveDraft={onRemoveDraft}
                    onSubmit={onSubmit}
                    onStop={onStop}
                    onCompactContext={onCompactContext}
                    onDeleteQueuedMessage={onDeleteQueuedMessage}
                    onEditQueuedMessage={onEditQueuedMessage}
                    onQueuedMessageEditingChange={onQueuedMessageEditingChange}
                    onSteerQueuedMessage={onSteerQueuedMessage}
                    onResumeQueue={onResumeQueue}
                    onUsageLimitResume={onUsageLimitResume}
                    onUsageLimitResumeAtReset={onUsageLimitResumeAtReset}
                    onUsageLimitDismiss={onUsageLimitDismiss}
                    onInboxCardDismiss={onInboxCardDismiss}
                    onLinkedWorkItemUpdateCardDismiss={
                      onLinkedWorkItemUpdateCardDismiss
                    }
                    onNoteCardDismiss={onNoteCardDismiss}
                    onHandoffCardDismiss={onHandoffCardDismiss}
                    onOpenLinkedWorkItem={onOpenLinkedWorkItem}
                    onArchiveSession={onArchiveSession}
                    onDeleteSession={onDeleteSession}
                    onApproval={onApproval}
                    onQuestionReply={onQuestionReply}
                    onQuestionInteraction={onQuestionInteraction}
                    onOpenFile={openSessionFileFor(session.id)}
                    onOpenDiff={onOpenDiff}
                    onOpenPlan={onOpenPlan}
                    onBuildPlan={onBuildPlan}
                    onSecondOpinion={onSecondOpinion}
                    onHandoff={onHandoff}
                    onBtwSubmit={onBtwSubmit}
                    onBtwRetry={onBtwRetry}
                    onBtwDelete={onBtwDelete}
                    onBtwStop={onBtwStop}
                    onBtwModelChange={onBtwModelChange}
                    onNewTerminal={onNewTerminal}
                    onPaneDragStart={onPaneDragStart}
                    transcriptPool={transcriptPool}
                  />
                ) : null}
              </div>
            </SessionSurfacePane>
          );
        })}
        {!unified &&
          sashes.map((sash) => (
            <Sash
              key={`${sash.splitId}:${sash.index}`}
              sash={sash}
              containerRef={treeRef}
              onResizingChange={setResizing}
              onPreview={(ratio) =>
                setDraft(
                  setSplitRatio(
                    layoutRef.current,
                    sash.splitId,
                    sash.index,
                    ratio,
                  ),
                )
              }
              onCommit={(ratio) => {
                setDraft(null);
                onRatio(sash.splitId, sash.index, ratio);
              }}
              onCancel={() => setDraft(null)}
            />
          ))}
      </div>
    </div>
  );
}

export const PaneTree = memo(
  PaneTreeComponent,
  (previous, next) => !previous.visible && !next.visible,
);

type PaneEnterFrom = "left" | "right" | "top" | "bottom" | "fade";

function paneEnterFrom({ rect, axis }: LayoutLeaf): PaneEnterFrom {
  const edge = 0.001;
  if (axis === "x") {
    if (rect.x + rect.w >= 1 - edge) return "right";
    if (rect.x <= edge) return "left";
  } else {
    if (rect.y + rect.h >= 1 - edge) return "bottom";
    if (rect.y <= edge) return "top";
  }
  return "fade";
}

function PaneDropHint({ edge }: { edge: PaneEdge }) {
  const wash =
    edge === "left"
      ? "absolute inset-y-0 left-0 w-1/2 bg-accent/15"
      : edge === "right"
        ? "absolute inset-y-0 right-0 w-1/2 bg-accent/15"
        : edge === "top"
          ? "absolute inset-x-0 top-0 h-1/2 bg-accent/15"
          : "absolute inset-x-0 bottom-0 h-1/2 bg-accent/15";
  const line =
    edge === "left"
      ? "absolute inset-y-0 left-0 w-0.5 bg-accent"
      : edge === "right"
        ? "absolute inset-y-0 right-0 w-0.5 bg-accent"
        : edge === "top"
          ? "absolute inset-x-0 top-0 h-0.5 bg-accent"
          : "absolute inset-x-0 bottom-0 h-0.5 bg-accent";
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div className={wash} />
      <div className={line} />
    </div>
  );
}

function Sash({
  sash,
  containerRef,
  onPreview,
  onCommit,
  onCancel,
  onResizingChange,
}: {
  sash: LayoutSash;
  containerRef: { current: HTMLDivElement | null };
  onPreview: (ratio: number) => void;
  onCommit: (ratio: number) => void;
  onCancel: () => void;
  onResizingChange: (resizing: boolean) => void;
}) {
  const row = sash.dir === "right";
  const [dragging, setDragging] = useState(false);
  const boundary = sash.sizes
    .slice(0, sash.index + 1)
    .reduce((sum, size) => sum + size, 0);
  const group = sash.group;

  return (
    <div
      role="separator"
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(boundary * 100)}
      className={
        row ? "absolute z-10 w-px bg-stroke" : "absolute z-10 h-px bg-stroke"
      }
      style={
        row
          ? {
              left: `${(group.x + boundary * group.w) * 100}%`,
              top: `${group.y * 100}%`,
              height: `${group.h * 100}%`,
            }
          : {
              left: `${group.x * 100}%`,
              top: `${(group.y + boundary * group.h) * 100}%`,
              width: `${group.w * 100}%`,
            }
      }
    >
      <ResizeHandle
        edge={row ? "left" : "top"}
        role="presentation"
        dragging={dragging}
        style={row ? { left: "50%" } : { top: "50%" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          const handle = e.currentTarget;
          const parent = containerRef.current;
          if (!parent) return;
          handle.setPointerCapture(e.pointerId);
          setDragging(true);
          onResizingChange(true);
          const rect = parent.getBoundingClientRect();
          const restoreSelection = suppressTextSelection();
          const previousCursor = document.body.style.cursor;
          document.body.style.cursor = row ? "col-resize" : "row-resize";
          const startPointer = row ? e.clientX : e.clientY;
          const span = row ? group.w * rect.width : group.h * rect.height;
          let nextBoundary = boundary;
          let moved = false;
          let frame: number | null = null;

          const move = (ev: PointerEvent) => {
            const pos = row ? ev.clientX : ev.clientY;
            if (span <= 0) return;
            moved = true;
            nextBoundary = boundary + (pos - startPointer) / span;
            if (frame != null) return;
            frame = requestAnimationFrame(() => {
              frame = null;
              onPreview(nextBoundary);
            });
          };
          const finish = (commit: boolean) => {
            if (frame != null) {
              cancelAnimationFrame(frame);
              frame = null;
            }
            if (handle.hasPointerCapture(e.pointerId)) {
              handle.releasePointerCapture(e.pointerId);
            }
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            handle.removeEventListener("pointercancel", cancel);
            window.removeEventListener("keydown", keydown);
            restoreSelection();
            document.body.style.cursor = previousCursor;
            setDragging(false);
            onResizingChange(false);
            if (!moved) return;
            if (commit) onCommit(nextBoundary);
            else onCancel();
          };
          const up = () => finish(true);
          const cancel = () => finish(false);
          const keydown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            finish(false);
          };
          handle.addEventListener("pointermove", move);
          handle.addEventListener("pointerup", up);
          handle.addEventListener("pointercancel", cancel);
          window.addEventListener("keydown", keydown);
        }}
      />
    </div>
  );
}

/** Card header control: fill the chat area with this card, or restore it. */
function CardMaximizeButton({
  maximized,
  onToggle,
}: {
  maximized: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = maximized ? t("Restore") : t("Maximize");
  return (
    <button
      type="button"
      data-card-maximize
      data-tauri-drag-region="false"
      aria-label={label}
      aria-pressed={maximized}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onToggle}
      className={`mr-1 grid size-7 shrink-0 self-center place-items-center rounded-md hover:bg-content/5 hover:text-content ${
        maximized ? "bg-content/8 text-content" : "text-content/55"
      }`}
    >
      <Maximize2 className="size-3.5" strokeWidth={1.75} />
    </button>
  );
}
