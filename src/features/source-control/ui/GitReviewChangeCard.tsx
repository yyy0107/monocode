// Adapted from ZCode (Apache-2.0).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { basename, revealPath } from "../../../platform/tauri/fs";
import { copyText } from "../../../platform/tauri/clipboard";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { Popover } from "../../../shared/ui/Popover";
import {
  ChevronDown,
  Copy,
  FolderOpen,
  Minus,
  MoreHorizontal,
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

export function GitReviewChangeCard({
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
  onToggle: () => void;
  onAction: (action: "stage" | "unstage" | "discard") => void;
  onStageHunk: (pos: number) => void;
  onError: (error: unknown) => void;
}) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const menuRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (expanded && !diffState) loadDiff(file.relative);
  }, [diffState, expanded, file.relative, loadDiff]);
  const name = basename(file.relative);
  const dir = file.relative.slice(0, -name.length).replace(/[\\/]$/, "");
  const unified = diffState?.state === "loaded" ? diffState.diff.unified : null;
  const additions = unified?.additions ?? file.additions;
  const deletions = unified?.deletions ?? file.deletions;
  const perform = (operation: Promise<void>) => {
    setMenu(false);
    void operation.catch(onError);
  };

  return (
    <section
      data-review-file={file.relative}
      className="min-w-0 border-b border-content/8"
    >
      <header
        className={`sticky top-0 z-10 flex h-9 items-center gap-1 bg-background-base px-2 ${focused ? "ring-1 ring-inset ring-accent/30" : ""}`}
      >
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          title={file.relative}
          className="flex h-full min-w-0 flex-1 items-center gap-2 text-left hover:text-content"
        >
          <FileTypeIcon name={file.relative} isDir={false} />
          <span className="truncate text-[12px] text-content/90">{name}</span>
          {dir ? (
            <span className="min-w-0 truncate text-[11px] text-content/40">
              {dir}
            </span>
          ) : null}
        </button>
        <span className="mr-2 flex shrink-0 gap-2 font-mono text-[11px] tabular-nums">
          <span className="text-emerald-500">+{additions}</span>
          <span className="text-rose-500">-{deletions}</span>
        </span>
        {source === "unstaged" || source === "staged" ? (
          <>
            <ReviewIconButton
              disabled={busy}
              title={source === "staged" ? t("Unstage file") : t("Stage file")}
              onClick={() =>
                onAction(source === "staged" ? "unstage" : "stage")
              }
            >
              {source === "staged" ? (
                <Minus className="size-3.5" />
              ) : (
                <Plus className="size-3.5" />
              )}
            </ReviewIconButton>
            {source === "unstaged" ? (
              <ReviewIconButton
                disabled={busy}
                title={t("Discard changes")}
                onClick={() => onAction("discard")}
              >
                <Undo2 className="size-3.5" />
              </ReviewIconButton>
            ) : null}
          </>
        ) : null}
        <button
          ref={menuRef}
          type="button"
          title={t("File actions")}
          aria-label={t("File actions")}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
          className="grid size-6 shrink-0 place-items-center rounded text-content/45 hover:bg-content/10 hover:text-content"
        >
          <MoreHorizontal className="size-3.5" />
        </button>
        <ReviewIconButton
          title={expanded ? t("Collapse file") : t("Expand file")}
          onClick={onToggle}
        >
          <ChevronDown
            className={`size-3.5 transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
          />
        </ReviewIconButton>
      </header>
      {menu && visible ? (
        <Popover
          anchor={menuRef}
          onDismiss={() => setMenu(false)}
          side="bottom"
          align="end"
          width={210}
          role="menu"
          className="p-1"
        >
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
      ) : null}
      <AnimatedCollapse
        expanded={expanded}
        motion="height"
        animateContentResize
      >
        {() =>
          diffState?.state === "loaded" ? (
            <ReviewDiffViewer
              path={file.path}
              relative={file.relative}
              diff={diffState.diff}
              busy={busy}
              onStageHunk={source === "unstaged" ? onStageHunk : undefined}
            />
          ) : (
            <p
              className="px-4 py-4 text-[12px] text-content/45"
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
          )
        }
      </AnimatedCollapse>
    </section>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: ReactNode;
  children: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] text-content/75 hover:bg-content/10"
    >
      {icon}
      {children}
    </button>
  );
}

export function ReviewIconButton({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="grid size-6 shrink-0 place-items-center rounded text-content/45 hover:bg-content/10 hover:text-content disabled:opacity-40"
    >
      {children}
    </button>
  );
}
