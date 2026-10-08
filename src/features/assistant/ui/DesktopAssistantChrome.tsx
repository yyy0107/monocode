import { AttachmentList } from "../../sessions/ui/AttachmentList";
import { AssistantAttachmentPreview } from "./AssistantAttachmentPreview";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
  AssistantChatChrome,
  AssistantComposerProps,
  AssistantControlsProps,
  AssistantHeaderProps,
  AssistantMessageMenuProps,
  AssistantSettingsPanelProps,
} from "./AssistantChatChrome";
import {
  AnimatedCollapse,
  useCollapseMotion,
} from "../../../shared/ui/AnimatedCollapse";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import {
  ArrowLeft,
  ArrowUp,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Settings,
  Sparkles,
  Square,
  X,
} from "../../../shared/ui/icons";
import { ExplorerMenu } from "../../files/ui/ExplorerMenu";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";

export function DesktopAssistantMessageMenu({
  open,
  point,
  disabled,
  onReply,
  onClose,
}: AssistantMessageMenuProps) {
  const { t } = useTranslation();
  return open && point ? (
    <ExplorerMenu
      x={point.x}
      y={point.y}
      ariaLabel={t("Reply")}
      items={[{ kind: "item", id: "reply", label: t("Reply"), disabled }]}
      onPick={onReply}
      onClose={onClose}
    />
  ) : null;
}

function DesktopAssistantHeader({
  name,
  hostName,
  hostPicker,
  status,
  lifecycle,
  settingsOpen,
  busy,
  onSettings,
  onClose,
  controls,
}: AssistantHeaderProps) {
  const { t } = useTranslation();
  const toggleLabel = t(controls?.continuable ? "Continue" : "Pause");
  return (
    <header className="assistant-header">
      <div className="assistant-header-profile">
        <span className="assistant-avatar" aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <div className="assistant-identity">
          <strong>{name}</strong>
          <span>
            {hostPicker ?? <span title={hostName}>{hostName}</span>}
            <span className="assistant-status" data-lifecycle={lifecycle}>
              {status}
            </span>
          </span>
        </div>
      </div>
      <div className="assistant-header-actions">
        {controls && (
          <>
            <button
              type="button"
              className="assistant-icon-button"
              aria-label={toggleLabel}
              title={toggleLabel}
              disabled={busy}
              onClick={controls.onToggle}
            >
              {controls.continuable ? <Play size={18} /> : <Pause size={18} />}
            </button>
            <button
              type="button"
              className="assistant-icon-button assistant-danger"
              aria-label={t("Disable assistant")}
              title={t("Disable assistant")}
              disabled={busy || !controls.enabled}
              onClick={controls.onDisable}
            >
              <Square size={16} />
            </button>
          </>
        )}
        {onSettings && (
          <button
            type="button"
            className="assistant-icon-button"
            aria-label={t("Settings")}
            title={t("Settings")}
            aria-expanded={settingsOpen}
            disabled={busy}
            onClick={onSettings}
          >
            <Settings size={18} />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            className="assistant-icon-button"
            aria-label={t("Close")}
            title={t("Close")}
            onClick={onClose}
          >
            <X size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

function DesktopAssistantControls({
  nextRetryAt,
  backlog,
}: AssistantControlsProps) {
  const { t } = useTranslation();
  if (!nextRetryAt && !backlog) return null;
  return (
    <div className="assistant-notices" role="status">
      {nextRetryAt && (
        <span>
          {t("Next retry")}: {new Date(nextRetryAt).toLocaleTimeString()}
        </span>
      )}
      {backlog && (
        <span>
          {t("Some follow-ups are delayed while the assistant is busy.")}
        </span>
      )}
    </div>
  );
}

function DesktopAssistantSettingsPanel({
  open,
  initialSetup,
  onClose,
  children,
}: AssistantSettingsPanelProps) {
  const { t } = useTranslation();
  const visible = useSurfaceVisibility();
  const { foldState, finish } = useCollapseMotion(open);
  const page = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open || !visible) return;
    const previous = document.activeElement as HTMLElement | null;
    page.current?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected && !previous.closest("[inert]"))
        previous.focus({ preventScroll: true });
    };
  }, [open, visible]);
  if (!open && foldState === "closed") return null;
  const title = t(initialSetup ? "Set up assistant" : "Assistant settings");
  return (
    <section
      ref={page}
      className="assistant-settings-page"
      data-fold-state={foldState}
      aria-label={title}
      aria-hidden={!open || undefined}
      tabIndex={-1}
      inert={!open}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) finish();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !initialSetup) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="assistant-settings-header">
        {!initialSetup && (
          <button
            type="button"
            className="assistant-icon-button"
            onClick={onClose}
            aria-label={t("Back")}
            title={t("Back")}
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <strong>{title}</strong>
      </header>
      <div className="assistant-settings-content">{children}</div>
    </section>
  );
}

function DesktopAssistantComposer({
  draft,
  onDraftChange,
  onSend,
  onStop,
  onAttach,
  onPaste,
  onDrop,
  onRemoveAttachment,
  attachments,
  busy,
  sending,
  inputDisabled,
  attachDisabled,
  sendDisabled,
  retry,
  onRetry,
}: AssistantComposerProps) {
  const { t } = useTranslation();
  const input = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const stoppable = !!onStop && !sending && !draft.trim() && !attachments.length;
  // Chips stay rendered while the tray collapses after the last removal.
  const [renderedAttachments, setRenderedAttachments] = useState(attachments);
  useLayoutEffect(() => {
    if (attachments.length) setRenderedAttachments(attachments);
  }, [attachments]);
  useLayoutEffect(() => {
    const field = input.current;
    if (!field) return;
    field.style.height = "0px";
    field.style.height = `${Math.min(Math.max(field.scrollHeight, 24), 200)}px`;
  }, [draft]);
  return (
    <div className="assistant-compose-dock">
      <AnimatedCollapse expanded={retry}>
        <div className="assistant-retry" role="alert">
          <span>{t("Your last message was not delivered.")}</span>
          <button type="button" disabled={busy} onClick={onRetry}>
            {t("Retry message")}
          </button>
        </div>
      </AnimatedCollapse>
      <form
        className="assistant-compose"
        onDrop={onDrop}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer.types).includes("Files")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = attachDisabled ? "none" : "copy";
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!sendDisabled) onSend();
        }}
      >
        <AnimatedCollapse expanded={!!attachments.length}>
          <AttachmentList
            className="assistant-attachments"
            aria-label={t("Attachments")}
            attachments={renderedAttachments}
            renderAttachment={file => <AssistantAttachmentPreview
              key={file.id}
              file={file}
              onRemove={busy || !attachments.length ? undefined : () => onRemoveAttachment(file.id)}
            />}
          />
        </AnimatedCollapse>
        <textarea
          ref={input}
          rows={1}
          aria-label={t("Message assistant")}
          placeholder={t("Ask your assistant…")}
          value={draft}
          disabled={inputDisabled}
          onPaste={onPaste}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              if (!sendDisabled) onSend();
            }
          }}
        />
        <div className="assistant-compose-actions">
          <button
            type="button"
            className="assistant-icon-button"
            aria-label={t("Attach files")}
            title={t("Attach files")}
            disabled={attachDisabled}
            onClick={() => files.current?.click()}
          >
            <Plus size={18} />
          </button>
          <input
            ref={files}
            type="file"
            multiple
            className="assistant-file-input"
            tabIndex={-1}
            aria-hidden="true"
            disabled={attachDisabled}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (selected.length) onAttach(selected);
            }}
          />
          <small className="assistant-compose-hint">
            {t("Enter to send · Shift+Enter for a new line")}
          </small>
          {stoppable ? (
            <button
              type="button"
              className="assistant-send"
              aria-label={t("Stop")}
              title={t("Stop")}
              disabled={busy}
              onClick={onStop}
            >
              <Square size={14} fill="currentColor" aria-hidden="true" />
            </button>
          ) : <button
            type="submit"
            className="assistant-send"
            aria-label={t(sending ? "Sending..." : "Send")}
            title={t(sending ? "Sending..." : "Send")}
            aria-busy={sending || undefined}
            disabled={sendDisabled}
          >
            {sending ? (
              <LoaderCircle size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            ) : (
              <ArrowUp size={18} aria-hidden="true" />
            )}
          </button>}
        </div>
      </form>
    </div>
  );
}

export const desktopAssistantChrome: AssistantChatChrome = {
  Header: DesktopAssistantHeader,
  Controls: DesktopAssistantControls,
  SettingsPanel: DesktopAssistantSettingsPanel,
  Composer: DesktopAssistantComposer,
};
