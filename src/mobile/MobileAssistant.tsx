import { AttachmentList } from "../features/sessions/ui/AttachmentList";
import { AssistantAttachmentPreview } from "../features/assistant/ui/AssistantAttachmentPreview";
import {
  createContext,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type Ref,
  type ReactNode,
} from "react";
import { AssistantChat } from "../features/assistant/ui/AssistantChat";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import { mobileTranscriptPlatform } from "./transcriptPlatform";
import type {
  AssistantChatChrome,
  AssistantComposerProps,
  AssistantControlsProps,
  AssistantHeaderProps,
  AssistantMessageMenuProps,
  AssistantSelectProps,
  AssistantSettingsPanelProps,
} from "../features/assistant/ui/AssistantChatChrome";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import { Shimmer } from "../shared/ui/Shimmer";
import { useTranslation } from "../shared/i18n/useTranslation";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  CornerDownRight,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Settings,
  Square,
  X,
} from "../shared/ui/icons";
import { MobileSheet, SHEET_WIDTH } from "./MobileSheet";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { HARNESS_TITLE } from "../features/sessions/model/session";
import { preserveInputFocus, usePreserveInputFocusOnTouch } from "./inputFocus";
import { useMobileTextareaAutosize } from "./useMobileTextareaAutosize";
import { keyboardHeight, keyboardMotionRemaining, onKeyboardMotion } from "./keyboardMotion";
import "./assistant.css";

const BackHandlers = createContext(new Map<number, () => void>());
function useAssistantBack(priority: number, open: boolean, close: () => void) {
  const handlers = useContext(BackHandlers);
  useEffect(() => {
    if (!open) return;
    handlers.set(priority, close);
    return () => {
      handlers.delete(priority);
    };
  }, [handlers, priority, open, close]);
}

function MobileAssistantHeader({
  name,
  hostName,
  harness,
  status,
  activity,
  lifecycle,
  busy,
  onSettings,
  onClose,
  controls,
}: AssistantHeaderProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const lastActivity = useRef(activity);
  useLayoutEffect(() => {
    if (activity) lastActivity.current = activity;
  }, [activity]);
  useAssistantBack(2, menuOpen, () => setMenuOpen(false));
  const action = (run?: () => void) => {
    setMenuOpen(false);
    run?.();
  };
  return (
    <>
      <header
        className="mobile-header mobile-assistant-header"
        data-floating="true"
      >
        <button
          type="button"
          className="mobile-icon-button"
          onClick={onClose}
          aria-label={t("Back")}
        >
          <ArrowLeft size={22} />
        </button>
        <div className="mobile-header-title" data-capsule="true">
          <div className="mobile-assistant-profile">
            <strong>{name}</strong>
            <span className="mobile-assistant-identity">
              <span title={hostName}>{hostName}</span>
              {harness && (
                <span
                  className="mobile-assistant-agent"
                  aria-label={`${t("Agent")}: ${HARNESS_TITLE[harness]}`}
                >
                  <HarnessIcon harness={harness} className="size-3.5" />
                  <span>{HARNESS_TITLE[harness]}</span>
                </span>
              )}
              <span data-lifecycle={lifecycle}>{status}</span>
            </span>
          </div>
          <AnimatedCollapse
            expanded={!!activity}
            className="mobile-assistant-activity-collapse"
            motion="height"
            animateContentResize
          >
            <div className="mobile-assistant-activity" role="status">
              <Shimmer as="p" className="mobile-assistant-activity-label">
                {activity ?? lastActivity.current ?? ""}
              </Shimmer>
            </div>
          </AnimatedCollapse>
        </div>
        <button
          ref={menu}
          type="button"
          className="mobile-icon-button"
          aria-label={t("Assistant options")}
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          disabled={!onSettings}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreHorizontal size={22} />
        </button>
      </header>
      <MobileSheet
        open={menuOpen}
        title="Assistant options"
        placement="anchor"
        anchor={menu}
        width={SHEET_WIDTH.menu}
        align="end"
        onClose={() => setMenuOpen(false)}
      >
        <button
          type="button"
          className="mobile-sheet-row"
          disabled={busy}
          onClick={() => action(onSettings)}
        >
          <Settings size={20} />
          <span>{t("Settings")}</span>
          <ChevronRight size={18} />
        </button>
        {controls && (
          <>
            <button
              type="button"
              className="mobile-sheet-row"
              disabled={busy}
              onClick={() => action(controls.onToggle)}
            >
              {controls.continuable ? <Play size={20} /> : <Pause size={20} />}
              <span>{t(controls.continuable ? "Continue" : "Pause")}</span>
            </button>
            <button
              type="button"
              className="mobile-sheet-row mobile-assistant-disable"
              disabled={busy || !controls.enabled}
              onClick={() => action(controls.onDisable)}
            >
              <Square size={20} />
              <span>{t("Disable assistant")}</span>
            </button>
          </>
        )}
      </MobileSheet>
    </>
  );
}

function MobileAssistantSettingsPanel({
  open,
  initialSetup,
  onClose,
  children,
}: AssistantSettingsPanelProps) {
  const { t } = useTranslation();
  useAssistantBack(1, open, onClose);
  return (
    <MobileSheet
      open={open}
      title={initialSetup ? "Set up assistant" : "Assistant settings"}
      surface="solid"
      onClose={onClose}
    >
      <section className="mobile-assistant-settings-page">
        <header className="mobile-assistant-settings-header">
          <button
            type="button"
            className="mobile-icon-button"
            onClick={onClose}
            aria-label={t("Back")}
          >
            <ArrowLeft size={22} />
          </button>
          <strong>
            {t(initialSetup ? "Set up assistant" : "Assistant settings")}
          </strong>
          <span aria-hidden="true" />
        </header>
        <div className="mobile-assistant-settings-content">{children}</div>
      </section>
    </MobileSheet>
  );
}

function MobileAssistantSettingsActions({ children }: { children: ReactNode }) {
  const [motion, setMotion] = useState(() => ({
    height: keyboardHeight(),
    duration: keyboardMotionRemaining(),
  }));
  useLayoutEffect(() => onKeyboardMotion(setMotion), []);
  return (
    <AnimatedCollapse
      className="mobile-assistant-settings-actions"
      expanded={motion.height === 0}
      durationMs={motion.duration}
      motion="height"
    >
      {children}
    </AnimatedCollapse>
  );
}

function MobileAssistantControls({
  nextRetryAt,
  backlog,
}: AssistantControlsProps) {
  const { t } = useTranslation();
  if (!nextRetryAt && !backlog) return null;
  return (
    <div className="mobile-assistant-notices" role="status">
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

function MobileAssistantComposer({
  draft,
  replyText,
  onCancelReply,
  onDraftChange,
  onSend,
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
  const dock = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const [renderedAttachments, setRenderedAttachments] = useState(attachments);
  const lastReply = useRef(replyText);
  useLayoutEffect(() => {
    if (replyText !== undefined) lastReply.current = replyText;
  }, [replyText]);
  useAssistantBack(1, replyText !== undefined, () => onCancelReply?.());
  usePreserveInputFocusOnTouch(form, input, true);
  useLayoutEffect(() => {
    if (attachments.length) setRenderedAttachments(attachments);
  }, [attachments]);
  // Reserve the floating capsule's full height, including attachments and the
  // safe area, so the last message can still scroll clear of it.
  useLayoutEffect(() => {
    const element = dock.current;
    const conversation = element?.parentElement;
    if (!element || !conversation) return;
    const publish = () => {
      const height = `calc(${element.offsetHeight}px + max(0px, var(--mobile-safe-bottom) - 14px))`;
      if (conversation.style.getPropertyValue("--mobile-assistant-dock-height") !== height)
        conversation.style.setProperty("--mobile-assistant-dock-height", height);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      conversation.style.removeProperty("--mobile-assistant-dock-height");
    };
  }, []);
  useMobileTextareaAutosize(input, draft, { minHeight: 28, viewportHeightRatio: 0.25 });
  return (
    <div ref={dock} className="mobile-assistant-compose-dock">
      <AnimatedCollapse expanded={replyText !== undefined} className="mobile-assistant-reply-collapse">
        <div className="mobile-assistant-reply-preview" aria-label={t("Replying to")}>
          <blockquote>{replyText ?? lastReply.current}</blockquote>
          <button
            type="button"
            className="mobile-assistant-reply-cancel"
            aria-label={t("Cancel reply")}
            onPointerDown={(e) => preserveInputFocus(e, input.current)}
            onMouseDown={(e) => preserveInputFocus(e, input.current)}
            onClick={onCancelReply}
          >
            <X size={18} />
          </button>
        </div>
      </AnimatedCollapse>
      {retry && (
        <button
          type="button"
          className="mobile-assistant-retry"
          disabled={busy}
          onClick={onRetry}
        >
          {t("Retry message")}
        </button>
      )}
      <form
        ref={form}
        className="mobile-composer mobile-assistant-compose"
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
        onPointerDownCapture={(e) => preserveInputFocus(e, input.current)}
        onMouseDownCapture={(e) => preserveInputFocus(e, input.current)}
      >
        <AnimatedCollapse expanded={!!attachments.length}>
          <AttachmentList
            className="mobile-assistant-attachments mobile-composer-attachments"
            aria-label={t("Attachments")}
            attachments={renderedAttachments}
            renderAttachment={file => <AssistantAttachmentPreview
              key={file.id}
              file={file}
              onRemove={busy || !attachments.length ? undefined : () => onRemoveAttachment(file.id)}
            />}
          />
        </AnimatedCollapse>
        <div className="mobile-assistant-compose-row">
          <button
            type="button"
            className="mobile-assistant-add"
            aria-label={t("Attach files")}
            disabled={attachDisabled}
            onClick={() => files.current?.click()}
          >
            <Plus size={22} />
          </button>
          <input
            ref={files}
            type="file"
            multiple
            className="mobile-assistant-file-input"
            tabIndex={-1}
            aria-hidden="true"
            aria-label={t("Attach files")}
            disabled={attachDisabled}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (selected.length) onAttach(selected);
            }}
          />
          <textarea
            ref={input}
            rows={1}
            aria-label={t("Message assistant")}
            placeholder={t(replyText !== undefined ? "Reply" : "Ask your assistant…")}
            value={draft}
            disabled={inputDisabled}
            onPaste={onPaste}
            onChange={(e) => onDraftChange(e.target.value)}
          />
          <button
            type="submit"
            className="mobile-assistant-send"
            aria-label={t(sending ? "Sending..." : "Send")}
            aria-busy={sending || undefined}
            disabled={sendDisabled}
          >
            {sending ? (
              <LoaderCircle size={21} className="mobile-spin" aria-hidden="true" />
            ) : (
              <ArrowUp size={21} aria-hidden="true" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function MobileAssistantMessageMenu({
  open,
  point,
  text = "",
  replyable = true,
  disabled,
  onReply,
  onClose,
}: AssistantMessageMenuProps) {
  const { t } = useTranslation();
  const { copyMessage } = useContext(TranscriptPlatformContext);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string>();
  const copyRequest = useRef(0);
  const lastMessage = useRef({ text, replyable });
  useLayoutEffect(() => {
    if (open) lastMessage.current = { text, replyable };
  }, [open, text, replyable]);
  useEffect(() => {
    setCopying(false);
    setCopyError(undefined);
    return () => { copyRequest.current++; };
  }, [open, text]);
  const message = open ? { text, replyable } : lastMessage.current;
  useAssistantBack(3, open, onClose);
  return (
    <MobileSheet
      open={open}
      title="Message actions"
      placement="anchor"
      anchorPoint={point}
      width={SHEET_WIDTH.menu}
      onClose={onClose}
    >
      {message.replyable && <button
        type="button"
        className="mobile-sheet-row"
        disabled={disabled}
        onClick={onReply}
      >
        <CornerDownRight size={20} />
        <span>{t("Reply")}</span>
      </button>}
      <button
        type="button"
        className="mobile-sheet-row"
        disabled={copying || !message.text}
        onClick={() => {
          const request = ++copyRequest.current;
          setCopying(true);
          setCopyError(undefined);
          void copyMessage(message.text).then(() => {
            if (copyRequest.current === request) onClose();
          }, (error: unknown) => {
            if (copyRequest.current !== request) return;
            setCopying(false);
            setCopyError(error instanceof Error ? error.message : String(error));
          });
        }}
      >
        <Copy size={20} />
        <span>{t("Copy")}</span>
      </button>
      {copyError && <p role="alert">{t("Copy failed. ")}{copyError}</p>}
    </MobileSheet>
  );
}

/** A settings row that opens a bottom sheet instead of the native picker. */
function MobileAssistantSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  hint,
  hideLabel,
  searchable,
}: AssistantSelectProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const close = () => {
    setOpen(false);
    setFilter("");
  };
  useAssistantBack(4, open, close);
  const selected = options.find((option) => option.value === value);
  const needle = filter.trim().toLocaleLowerCase();
  const visible = needle
    ? options.filter((option) =>
        option.label.toLocaleLowerCase().includes(needle),
      )
    : options;
  return (
    <div
      className="mobile-assistant-select"
      data-compact={hideLabel || undefined}
    >
      <button
        type="button"
        className="mobile-assistant-select-trigger"
        aria-label={`${label}: ${selected?.label ?? placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {!hideLabel && (
          <span className="mobile-assistant-select-label">{label}</span>
        )}
        <span
          className="mobile-assistant-select-value"
          data-empty={!selected || undefined}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {hint && <small className="mobile-assistant-select-hint">{hint}</small>}
      <MobileSheet open={open} title={label} onClose={close}>
        {searchable && (
          <input
            type="search"
            className="mobile-assistant-select-search"
            aria-label={t("Search options…")}
            placeholder={t("Search options…")}
            value={filter}
            onChange={(e) => setFilter(e.currentTarget.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        )}
        <div
          className="mobile-assistant-select-options"
          role="radiogroup"
          aria-label={label}
        >
          {visible.map((option) => {
            const checked = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className="mobile-sheet-row"
                role="radio"
                aria-checked={checked}
                onClick={() => {
                  onChange(option.value);
                  close();
                }}
              >
                {option.icon}
                <span className="mobile-sheet-row-text">
                  <strong>{option.label}</strong>
                </span>
                {checked && <Check size={20} />}
              </button>
            );
          })}
          {!visible.length && (
            <p className="mobile-assistant-select-empty">
              {t("No matching options")}
            </p>
          )}
        </div>
      </MobileSheet>
    </div>
  );
}

const chrome: AssistantChatChrome = {
  Header: MobileAssistantHeader,
  Controls: MobileAssistantControls,
  SettingsPanel: MobileAssistantSettingsPanel,
  SettingsActions: MobileAssistantSettingsActions,
  Composer: MobileAssistantComposer,
  MessageMenu: MobileAssistantMessageMenu,
  Select: MobileAssistantSelect,
};
export type MobileAssistantHandle = { back: () => void };
export function MobileAssistant({
  ref,
  ...props
}: Omit<ComponentProps<typeof AssistantChat>, "chrome"> & {
  ref?: Ref<MobileAssistantHandle>;
}) {
  const handlers = useMemo(() => new Map<number, () => void>(), []);
  const back = () => {
    const priority = Math.max(...handlers.keys());
    const handler = handlers.get(priority);
    if (handler) handler();
    else props.onClose?.();
  };
  useImperativeHandle(ref, () => ({ back }));
  return (
    <aside
      className="mobile-assistant-overlay bg-background-base text-content"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          back();
        }
      }}
    >
      <BackHandlers.Provider value={handlers}>
        <TranscriptPlatformContext.Provider value={mobileTranscriptPlatform}>
          <AssistantChat {...props} chrome={chrome} />
        </TranscriptPlatformContext.Provider>
      </BackHandlers.Provider>
    </aside>
  );
}
