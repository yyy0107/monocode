// Adapted from ZCode (Apache-2.0).
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { basename, revealPath } from "../../../platform/tauri/fs";
import { copyText } from "../../../platform/tauri/clipboard";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { Popover } from "../../../shared/ui/Popover";
import {
  ChevronDown,
  Copy,
  FolderOpen,
  Minus,
  Plus,
  Undo2,
} from "../../../shared/ui/icons";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";
import { FileTypeIcon } from "../../files/ui/FileTypeIcon";
import type {
  ReviewDiffState,
  ReviewFile,
  ReviewSource,
} from "../model/reviewDiff";
import { ReviewDiffViewer } from "./ReviewDiffViewer";

/**
 * Memoized with pane-level callbacks that receive the file, so toggling one card
 * or a virtualizer resize frame does not re-render every mounted diff.
 */
export const GitReviewChangeCard = memo(function GitReviewChangeCard({
  file,
  source,
  expanded,
  focused,
  busy,
  diffState,
  placeholderHeight,
  loadDiff,
  onToggle,
  onAction,
  onStageHunk,
  onError,
}: {
  file: ReviewFile;
  source: ReviewSource;
  expanded: boolean;
  focused: boolean;
  busy: boolean;
  diffState?: ReviewDiffState;
  /** Reserved while loading so neighbours are not pulled into view. */
  placeholderHeight?: number;
  loadDiff: (path: string) => void;
  onToggle: (file: ReviewFile) => void;
  onAction: (file: ReviewFile, action: "stage" | "unstage" | "discard") => void;
  onStageHunk: (
    file: ReviewFile,
    diffState: ReviewDiffState | undefined,
    pos: number,
  ) => void;
  onError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!visible) setMenu(null);
  }, [visible]);
  useEffect(() => {
    if (expanded && !diffState) loadDiff(file.relative);
  }, [diffState, expanded, file.relative, loadDiff]);
  // Mount the diff two frames into the open animation: the motion starts
  // without waiting on diff layout, and content still arrives while opening.
  // Cards mounted already expanded (e.g. scrolled back into view) render at once.
  const [entered, setEntered] = useState(expanded);
  if (!expanded && entered) setEntered(false);
  useEffect(() => {
    if (!expanded || entered) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [entered, expanded]);
  const toggle = () => onToggle(file);
  // Start fetching on press so the diff is often ready when the card opens.
  const prefetch = () => {
    if (!diffState) loadDiff(file.relative);
  };
  const stageHunk = useCallback(
    (pos: number) => onStageHunk(file, diffState, pos),
    [diffState, file, onStageHunk],
  );
  const name = basename(file.relative);
  const dir = file.relative.slice(0, -name.length).replace(/[\\/]$/, "");
  const unified = diffState?.state === "loaded" ? diffState.diff.unified : null;
  const additions = unified?.additions ?? file.additions;
  const deletions = unified?.deletions ?? file.deletions;
  const perform = (operation: Promise<void>) => {
    setMenu(null);
    menuRef.current?.focus();
    void operation.catch(onError);
  };
  const actOnFile = (action: "stage" | "unstage" | "discard") => {
    setMenu(null);
    menuRef.current?.focus();
    onAction(file, action);
  };

  return (
    <section data-review-file={file.relative} className="min-w-0">
      <header className="content-sticky sticky top-0 z-10">
        <button
          ref={menuRef}
          type="button"
          aria-expanded={expanded}
          aria-label={`${expanded ? t("Collapse file") : t("Expand file")}: ${file.relative}`}
          onPointerDown={(event) => {
            if (event.button === 0) prefetch();
          }}
          onClick={toggle}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenu({ x: event.clientX, y: event.clientY });
          }}
          onKeyDown={(event) => {
            if (
              event.key !== "ContextMenu" &&
              !(event.shiftKey && event.key === "F10")
            )
              return;
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu({ x: rect.left + 12, y: rect.bottom });
          }}
          title={file.relative}
          className={`flex h-8 w-full min-w-0 items-center gap-3 px-3 text-left transition-colors hover:bg-surface-hover focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent motion-reduce:transition-none ${expanded ? "bg-surface-hover" : ""} ${focused ? "ring-1 ring-inset ring-accent/30" : ""}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            <FileTypeIcon name={file.relative} isDir={false} />
            <span className="truncate text-ui-base text-content">{name}</span>
            {dir ? (
              <span className="min-w-0 truncate text-ui-base text-foreground-subtlest">
                {dir}
              </span>
            ) : null}
          </span>
          <span className="flex shrink-0 items-center justify-end gap-3 pl-3">
            <span className="whitespace-nowrap text-ui-base tabular-nums">
              <span className="text-[var(--review-added)]">+{additions}</span>
              <span className="ml-2 text-[var(--review-removed)]">
                -{deletions}
              </span>
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-foreground-subtle transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
            />
          </span>
        </button>
      </header>
      <Popover
        open={menu !== null && visible}
        anchor={menu ?? menuRef}
        onDismiss={(reason) => {
          setMenu(null);
          if (reason === "escape") menuRef.current?.focus();
        }}
        side="bottom"
        align="start"
        width={224}
        role="menu"
        aria-label={t("File actions")}
        autoFocus
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "Tab") setMenu(null);
          else reviewMenuKeyDown(event);
        }}
        className="p-1"
      >
        {source === "unstaged" || source === "staged" ? (
          <>
            <MenuItem
              disabled={busy}
              onClick={() =>
                actOnFile(source === "staged" ? "unstage" : "stage")
              }
              icon={
                source === "staged" ? (
                  <Minus className="size-4" />
                ) : (
                  <Plus className="size-4" />
                )
              }
            >
              {source === "staged" ? t("Unstage file") : t("Stage file")}
            </MenuItem>
            {source === "unstaged" ? (
              <MenuItem
                disabled={busy}
                onClick={() => actOnFile("discard")}
                icon={<Undo2 className="size-4" />}
              >
                {t("Discard changes")}
              </MenuItem>
            ) : null}
            <div role="separator" className="my-1 h-px bg-stroke" />
          </>
        ) : null}
        <MenuItem
          onClick={() => perform(copyText(file.path))}
          icon={<Copy className="size-3.5" />}
        >
          {t("Copy absolute path")}
        </MenuItem>
        <MenuItem
          onClick={() => perform(copyText(file.relative))}
          icon={<Copy className="size-3.5" />}
        >
          {t("Copy relative path")}
        </MenuItem>
        <MenuItem
          onClick={() => perform(revealPath(file.path))}
          icon={<FolderOpen className="size-3.5" />}
        >
          {t("Reveal in file manager")}
        </MenuItem>
      </Popover>
      <AnimatedCollapse
        expanded={expanded}
        motion="height"
        animateContentResize
      >
        {() => (
          <DeferredMount
            ready={entered}
            fallback={
              <p
                className="flex items-center justify-center py-4 text-ui-base text-foreground-subtle"
                style={{ minHeight: placeholderHeight }}
              >
                {diffState?.state === "loaded" ? null : t("Loading…")}
              </p>
            }
          >
            {diffState?.state === "loaded" ? (
              <ReviewDiffViewer
                path={file.path}
                relative={file.relative}
                diff={diffState.diff}
                busy={busy}
                onStageHunk={source === "unstaged" ? stageHunk : undefined}
              />
            ) : (
              <p
                className="flex items-center justify-center px-4 py-4 text-ui-base text-foreground-subtle"
                role={diffState?.state === "error" ? "alert" : undefined}
                style={
                  diffState?.state === "error"
                    ? undefined
                    : { minHeight: placeholderHeight }
                }
              >
                {diffState?.state === "error"
                  ? t("Couldn’t load diff: {error}", { error: diffState.error })
                  : t("Loading…")}
              </p>
            )}
          </DeferredMount>
        )}
      </AnimatedCollapse>
    </section>
  );
});

/**
 * Latches once ready, so content stays during a closing animation and resets
 * only when the collapse unmounts it.
 */
function DeferredMount({
  ready,
  fallback,
  children,
}: {
  ready: boolean;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(ready);
  if (ready && !shown) setShown(true);
  return shown || ready ? children : fallback;
}

function MenuItem({
  onClick,
  disabled,
  icon,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: ReactNode;
  children: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={children}
      onClick={onClick}
      className="flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-ui-base text-content outline-none hover:bg-menu-hover focus-visible:bg-menu-hover disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

/** Keyboard navigation for the file context menu. */
function reviewMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const items = [
    ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]:not(:disabled)',
    ),
  ];
  if (!items.length) return;
  const index = items.findIndex((item) => item === document.activeElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (index + 1) % items.length
          : index < 0
            ? items.length - 1
            : (index + items.length - 1) % items.length;
  items[next].focus();
}

export function ReviewIconButton({
  title,
  disabled,
  onClick,
  onPointerDown,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  onPointerDown?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className="grid size-6 shrink-0 place-items-center rounded text-content/45 hover:bg-content/10 hover:text-content disabled:opacity-40"
    >
      {children}
    </button>
  );
}
