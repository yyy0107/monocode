import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AiIdea,
  Check,
  ChevronsUpDown,
  FilePlus,
  Folder,
  ImagePlus,
  LoaderCircle,
  ListEnd,
  Plus,
  Square,
  X,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { AnimatedCollapse } from "../shared/ui/AnimatedCollapse";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { AttachmentChip } from "../features/sessions/ui/AttachmentChip";
import { RuntimeModeIcon } from "../features/sessions/ui/RuntimeModeIcon";
import { MODE_COMMAND_STYLES } from "../features/sessions/ui/modeCommands";
import { PLAN_COMMAND } from "../features/sessions/model/plan";
import { COMPACT_COMMAND } from "../features/sessions/model/compact";
import { rankSkills, slashTokenAt, type SlashToken } from "../features/skills/model/slashCommands";
import type { Skill } from "../features/skills/model/skillTypes";
import { insertMobileSkill } from "./skillCommands";
import { useMobileSkills, type MobileSkillsLoader } from "./useMobileSkills";
import { MobileSkillList } from "./MobileSkillList";
import {
  RUNTIME_MODES,
  RUNTIME_MODE_LABEL,
  RUNTIME_MODE_HINT,
  type Attachment,
} from "../features/sessions/model/session";
import type {
  HostModelCatalog,
  HostProject,
} from "../features/connections/model/protocol";
import {
  MobileModelControls,
  configurationLabels,
  type MobileConfiguration,
} from "./MobileModelControls";
import { MobileSheet, SHEET_WIDTH } from "./MobileSheet";
import { preserveInputFocus, usePreserveInputFocusOnTouch } from "./inputFocus";
import { useMobileTextareaAutosize } from "./useMobileTextareaAutosize";

export type MobileComposerPanel =
  | "actions"
  | "permissions"
  | "model"
  | "projects"
  | "plan"
  | null;
const planStyle = MODE_COMMAND_STYLES[PLAN_COMMAND.name];
type Props = {
  queue?: ReactNode;
  value: string;
  onChange: (text: string) => void;
  configuration: MobileConfiguration;
  catalog?: HostModelCatalog;
  catalogLoading?: boolean;
  onConfigurationChange: (value: MobileConfiguration) => void;
  lockedAgent: boolean;
  disabled: boolean;
  running: boolean;
  canSend: boolean;
  canStop: boolean;
  working: boolean;
  onSend: () => void;
  onStop: () => void;
  panel: MobileComposerPanel;
  onPanelChange: (panel: MobileComposerPanel) => void;
  project?: HostProject;
  projects: HostProject[];
  onProjectChange: (project: HostProject) => void;
  attachments: Attachment[];
  onFiles: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  planMode: boolean;
  onPlanModeChange: (enabled: boolean) => void;
  skillsContextKey?: string;
  loadSkills?: MobileSkillsLoader;
  canCompact?: boolean;
};

function MobileComposerAttachments({ attachments, disabled, onRemoveAttachment }: Pick<Props, "attachments" | "disabled" | "onRemoveAttachment">) {
  const [rendered, setRendered] = useState(attachments);
  useLayoutEffect(() => {
    if (attachments.length) setRendered(attachments);
  }, [attachments]);
  // Keep the last chips during closing. AnimatedCollapse unmounts this child
  // when finished, releasing their data without a separate removal timer.
  return <div className="mobile-composer-attachments">
    {rendered.map(attachment => <AttachmentChip
      key={attachment.id}
      attachment={attachment}
      onRemove={disabled || !attachments.length ? undefined : () => onRemoveAttachment(attachment.id)}
    />)}
  </div>;
}

export function MobileComposer(props: Props) {
  const { t } = useTranslation();
  const area = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  usePreserveInputFocusOnTouch(form, area, true);
  const photos = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const panelAnchor = useRef<HTMLButtonElement>(null);
  const skillListId = useId();
  const [slash, setSlash] = useState<SlashToken | null>(null);
  const [skillActive, setSkillActive] = useState(0);
  const dismissedSlash = useRef<string | null>(null);
  const insertion = useRef({ start: props.value.length, end: props.value.length });
  const skillsKey = props.skillsContextKey ?? `${props.project?.id ?? ""}\0${props.configuration.harness}`;
  const nativeGuess = props.configuration.harness === "pi" || props.configuration.harness === "omp";
  const inlineOpen = !!slash && props.panel === null && !props.disabled;
  const skillsState = useMobileSkills(skillsKey, props.loadSkills, inlineOpen || props.panel === "actions", nativeGuess);
  const native = skillsState.catalog?.native ?? nativeGuess;
  const commands = useMemo(() => [PLAN_COMMAND,
    ...(props.canCompact && (skillsState.catalog?.canCompact ?? true) ? [COMPACT_COMMAND] : []),
    ...(skillsState.catalog?.skills ?? []).filter(skill => !["operator", "mono", "monocode"].includes(skill.name) &&
      (skill.kind === "native" || !["plan", "compact", "orchestrator", "draft", "btw", "mcp", "add-to-folder"].includes(skill.name))),
  ], [props.canCompact, skillsState.catalog]);
  const options = rankSkills(commands, props.panel === "actions" ? "" : slash?.query ?? "");
  useEffect(() => { setSlash(null); setSkillActive(0); }, [skillsKey]);
  useEffect(() => { setSkillActive(0); }, [slash?.query]);
  useEffect(() => {
    if (props.disabled) setSlash(null);
  }, [props.disabled]);
  const syncSkillToken = (element: HTMLTextAreaElement) => {
    insertion.current = { start: element.selectionStart, end: element.selectionEnd };
    if (dismissedSlash.current === `${element.value}\0${element.selectionStart}\0${element.selectionEnd}`) return;
    dismissedSlash.current = null;
    setSlash(slashTokenAt(element.value, element.selectionStart, native));
  };
  const dismissSkills = () => {
    const element = area.current;
    if (element) dismissedSlash.current = `${element.value}\0${element.selectionStart}\0${element.selectionEnd}`;
    setSlash(null);
  };
  const pickSkill = (skill: Skill) => {
    if (props.disabled || !area.current) return;
    const point = slash ? { start: slash.start + 1 + slash.query.length, end: slash.end } : insertion.current;
    const result = insertMobileSkill(props.value, point.start, point.end, skill);
    setSlash(null);
    props.onPanelChange(null);
    props.onChange(result.text);
    requestAnimationFrame(() => {
      const element = area.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(result.cursor, result.cursor);
      insertion.current = { start: result.cursor, end: result.cursor };
    });
  };
  const { modelName, effort } = configurationLabels(
    props.catalog,
    props.configuration,
    props.lockedAgent ? props.configuration.model : undefined,
  );
  const close = () => props.onPanelChange(null);
  // The dock floats over the transcript; publish its height so content can
  // scroll past it without hiding the last message.
  useLayoutEffect(() => {
    const element = dock.current;
    const host = element?.parentElement;
    if (!element || !host) return;
    // Queued pills float on their own glass, so the dock blur starts at the
    // composer rather than behind the queue. Measure the composer's own top:
    // the queue's height omits its collapsed margin and the dock padding,
    // which left a blurred strip showing in the gap.
    const publish = () => {
      const height = `calc(${element.offsetHeight}px + max(0px, var(--mobile-safe-bottom) - 8px))`;
      const queue = element.querySelector<HTMLElement>(":scope > .mobile-message-queue");
      const composer = element.querySelector<HTMLElement>(":scope > .mobile-composer");
      const queueHeight = `${queue && composer ? composer.offsetTop : 0}px`;
      // Complete layout reads before publishing anything to the transcript.
      if (host.style.getPropertyValue("--mobile-dock-height") !== height)
        host.style.setProperty("--mobile-dock-height", height);
      if (
        element.style.getPropertyValue("--mobile-dock-queue-height") !== queueHeight
      )
        element.style.setProperty("--mobile-dock-queue-height", queueHeight);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--mobile-dock-height");
    };
  }, []);
  useMobileTextareaAutosize(area, props.value, {
    minHeight: 36,
    widthSource: dock,
    measureWidth: () => {
      const container = form.current;
      const source = dock.current;
      if (!container || !source) return 0;
      const formStyle = getComputedStyle(container);
      const dockStyle = getComputedStyle(source);
      const inset = parseFloat(formStyle.getPropertyValue("--mobile-composer-input-inset")) || 18;
      return source.clientWidth -
        (parseFloat(dockStyle.paddingLeft) || 0) -
        (parseFloat(dockStyle.paddingRight) || 0) -
        (parseFloat(formStyle.borderLeftWidth) || 0) -
        (parseFloat(formStyle.borderRightWidth) || 0) - inset * 2;
    },
  });
  useEffect(() => {
    // Applying a setting, switching project or reading attachments briefly
    // disables the composer. Close any open sheet without disturbing the draft.
    if (props.disabled) props.onPanelChange(null);
  }, [props.disabled, props.onPanelChange]);
  useEffect(() => {
    if (props.panel !== null) return;
    // Dismiss the keyboard on an outside tap while keeping the card visible. Touch
    // scrolling cancels the pointer or moves it past the tap threshold.
    let start: { id: number; x: number; y: number } | undefined;
    const outside = (target: EventTarget | null) =>
      target instanceof Element &&
      !form.current?.parentElement?.contains(target) &&
      !target.closest(".mobile-sheet-backdrop") &&
      // Jumping to the latest message should not lower the keyboard under the
      // finger before the click lands.
      !target.closest(".mobile-jump");
    const down = (event: PointerEvent) => {
      start = outside(event.target)
        ? { id: event.pointerId, x: event.clientX, y: event.clientY }
        : undefined;
    };
    const up = (event: PointerEvent) => {
      if (!start || start.id !== event.pointerId) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      start = undefined;
      if (moved > 10) return;
      if (form.current?.contains(document.activeElement))
        (document.activeElement as HTMLElement).blur();
    };
    const cancel = () => {
      start = undefined;
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
    };
  }, [props.panel]);
  const selectFiles = (input: HTMLInputElement) => {
    if (input.files?.length) props.onFiles(Array.from(input.files));
    input.value = "";
  };
  return (
    <>
      <div ref={dock} className="mobile-composer-dock">
        {inlineOpen && <div className="mobile-sheet mobile-command-suggestions">
          <div className="mobile-skill-heading"><strong>{t("Skills and commands")}</strong>
            <button type="button" className="mobile-icon-button" aria-label={t("Close suggestions")}
              onPointerDown={event => event.preventDefault()} onClick={dismissSkills}><X size={18} /></button>
          </div>
          <MobileSkillList skills={options} loading={skillsState.loading} failed={!!skillsState.failed} error={skillsState.error}
            active={skillActive} id={skillListId} onPick={pickSkill} onActive={setSkillActive} onRetry={() => void skillsState.reload(true)} />
        </div>}
        {props.queue ? <div className="mobile-message-queue">{props.queue}</div> : null}
        <form
          ref={form}
          className="mobile-composer mobile-composer-card"
          onPointerDownCapture={(event) => {
            if ((event.target as Element).closest("button"))
              preserveInputFocus(event, area.current);
          }}
          onMouseDownCapture={(event) => {
            if ((event.target as Element).closest("button"))
              preserveInputFocus(event, area.current);
          }}
          onClick={(event) => {
            if (!props.disabled && (event.target === event.currentTarget ||
              (event.target as Element).classList.contains("mobile-composer-input")))
              area.current?.focus();
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (props.canSend) props.onSend();
          }}
        >
          <div className="mobile-composer-context">
            <button
              type="button"
              className="mobile-composer-model"
              title={[modelName, effort && t(effort)].filter(Boolean).join(" · ")}
              disabled={props.disabled || props.running}
              aria-label={t("Model and reasoning")}
              aria-haspopup="dialog"
              aria-expanded={props.panel === "model"}
              aria-busy={props.catalogLoading || undefined}
              onClick={(event) => {
                panelAnchor.current = event.currentTarget;
                props.onPanelChange("model");
              }}
            >
              <HarnessIcon harness={props.configuration.harness} className="mobile-composer-agent-icon" />
              <span className="mobile-composer-model-label">
                <strong>{modelName}</strong>
                {effort && <small>{t(effort)}</small>}
              </span>
              {props.catalogLoading ? (
                <LoaderCircle size={16} className="mobile-spin" role="status" aria-label={t("Loading…")} />
              ) : (
                <ChevronsUpDown size={16} aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mobile-composer-input">
            <div className="mobile-composer-attachment-region">
              <AnimatedCollapse expanded={props.attachments.length > 0}>
                <MobileComposerAttachments
                attachments={props.attachments}
                disabled={props.disabled}
                onRemoveAttachment={props.onRemoveAttachment}
              />
            </AnimatedCollapse>
            </div>
            <textarea
              ref={area}
              aria-label={t("Message")}
              placeholder={t(
                props.running ? "Agent is working…" : "Assign a task or type / for more",
              )}
              rows={1}
              value={props.value}
              onChange={(event) => { dismissedSlash.current = null; props.onChange(event.target.value); syncSkillToken(event.currentTarget); }}
              onSelect={(event) => syncSkillToken(event.currentTarget)}
              aria-autocomplete="list"
              aria-expanded={inlineOpen}
              aria-controls={inlineOpen ? skillListId : undefined}
              aria-activedescendant={inlineOpen && options.length ? `${skillListId}-${Math.min(skillActive, options.length - 1)}` : undefined}
              disabled={props.disabled}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (inlineOpen && !event.metaKey && !event.ctrlKey) {
                  if (event.key === "Escape") { event.preventDefault(); dismissSkills(); return; }
                  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
                    event.preventDefault();
                    setSkillActive(index => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
                    return;
                  }
                  if ((event.key === "Tab" || (event.key === "Enter" && !event.shiftKey)) && options.length) {
                    event.preventDefault(); pickSkill(options[Math.min(skillActive, options.length - 1)]!); return;
                  }
                }
                if (
                  event.key === "Enter" &&
                  (event.metaKey || event.ctrlKey) &&
                  !event.nativeEvent.isComposing &&
                  props.canSend
                ) {
                  event.preventDefault();
                  props.onSend();
                }
              }}
            />
            <div className="mobile-composer-toolbar">
              <button
                type="button"
                className="mobile-composer-action mobile-composer-add"
                aria-label={t("Add to message")}
                aria-haspopup="dialog"
                aria-expanded={props.panel === "actions"}
                disabled={props.disabled}
                onClick={(event) => {
                  panelAnchor.current = event.currentTarget;
                  setSkillActive(0);
                  props.onPanelChange("actions");
                }}
              >
                <Plus size={22} />
              </button>
              <div className="mobile-composer-controls">
                {props.planMode && (
                  <button
                    type="button"
                    className={`mobile-composer-plan ${planStyle.pill?.className ?? planStyle.className}`}
                    disabled={props.disabled}
                    aria-label={t("Plan mode")}
                    title={t("Plan mode")}
                    aria-haspopup="dialog"
                    aria-expanded={props.panel === "plan"}
                    onClick={(event) => {
                      panelAnchor.current = event.currentTarget;
                      props.onPanelChange("plan");
                    }}
                  >
                    <planStyle.Icon size={18} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className="mobile-composer-action mobile-composer-permissions"
                  data-full-access={
                    props.configuration.runtimeMode === "full-access"
                  }
                  aria-label={t("Permissions: {mode}", {
                    mode: t(RUNTIME_MODE_LABEL[props.configuration.runtimeMode]),
                  })}
                  title={t(RUNTIME_MODE_LABEL[props.configuration.runtimeMode])}
                  aria-haspopup="dialog"
                  aria-expanded={props.panel === "permissions"}
                  disabled={props.disabled || props.running}
                  onClick={(event) => {
                    panelAnchor.current = event.currentTarget;
                    props.onPanelChange("permissions");
                  }}
                >
                  <RuntimeModeIcon
                    mode={props.configuration.runtimeMode}
                    size={20}
                    className={
                      props.configuration.runtimeMode === "full-access"
                        ? "text-amber-400/90"
                        : undefined
                    }
                  />
                </button>
                {props.running && props.canSend ? (
                  <button type="submit" className="mobile-composer-action" aria-label={t("Queue message")}>
                    {props.working ? <LoaderCircle size={20} className="mobile-spin" /> : <ListEnd size={20} />}
                  </button>
                ) : null}
              </div>
              {props.running && !props.value.trim() && !props.attachments.length ? (
                <button
                  type="button"
                  className="mobile-send"
                  disabled={!props.canStop}
                  aria-label={t("Stop")}
                  onClick={props.onStop}
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="mobile-send"
                  disabled={!props.canSend}
                  aria-label={t("Send message")}
                >
                  {props.working ? (
                    <LoaderCircle size={20} className="mobile-spin" />
                  ) : (
                    <ArrowUp size={20} />
                  )}
                </button>
              )}
            </div>
          </div>
          <input
            ref={photos}
            type="file"
            hidden
            accept="image/*"
            multiple
            aria-label={t("Upload photos")}
            onChange={(event) => selectFiles(event.currentTarget)}
          />
          <input
            ref={files}
            type="file"
            hidden
            multiple
            aria-label={t("Upload files")}
            onChange={(event) => selectFiles(event.currentTarget)}
          />
        </form>
      </div>
      <MobileModelControls
        open={props.panel === "model"}
        anchor={panelAnchor}
        preserveFocus={area}
        catalog={props.catalog}
        loading={props.catalogLoading}
        configuration={props.configuration}
        lockedAgent={props.lockedAgent}
        disabled={props.disabled}
        onChange={props.onConfigurationChange}
        onClose={close}
      />
      <MobileSheet
        open={props.panel === "plan"}
        title="Plan mode"
        placement="anchor"
        anchor={panelAnchor}
        preserveFocus={area}
        width={SHEET_WIDTH.menu}
        side="top"
        onClose={close}
      >
        <button
          type="button"
          className="mobile-sheet-row"
          aria-label={t("Turn off plan mode")}
          disabled={props.disabled}
          onClick={() => {
            close();
            props.onPlanModeChange(false);
          }}
        >
          <X size={18} />
          <span>{t("Turn off")}</span>
        </button>
      </MobileSheet>
      <MobileSheet
        open={props.panel === "permissions"}
        title="Permissions"
        placement="anchor"
        anchor={panelAnchor}
        preserveFocus={area}
        width={SHEET_WIDTH.list}
        onClose={close}
      >
        <div role="radiogroup" aria-label={t("Permissions")}>
          {RUNTIME_MODES.map((mode) => (
            <button
              type="button"
              role="radio"
              className="mobile-sheet-row"
              key={mode}
              aria-checked={props.configuration.runtimeMode === mode}
              disabled={props.disabled}
              onClick={() => {
                close();
                props.onConfigurationChange({
                  ...props.configuration,
                  runtimeMode: mode,
                });
              }}
            >
              <RuntimeModeIcon
                mode={mode}
                size={22}
                className={
                  mode === "full-access"
                    ? "text-amber-400/90"
                    : "text-content/70"
                }
              />
              <span className="mobile-sheet-row-text">
                <strong>{t(RUNTIME_MODE_LABEL[mode])}</strong>
                <small>{t(RUNTIME_MODE_HINT[mode])}</small>
              </span>
              {props.configuration.runtimeMode === mode && (
                <Check size={20} />
              )}
            </button>
          ))}
        </div>
      </MobileSheet>
      <MobileSheet
        open={props.panel === "actions"}
        title="Add to message"
        placement="anchor"
        anchor={panelAnchor}
        preserveFocus={area}
        width={SHEET_WIDTH.list}
        side="top"
        onClose={close}
      >
        <button
          type="button"
          className="mobile-sheet-row"
          disabled={props.disabled}
          onClick={() => {
            close();
            photos.current?.click();
          }}
        >
          <ImagePlus size={22} />
          <span>{t("Upload photos")}</span>
        </button>
        <button
          type="button"
          className="mobile-sheet-row"
          disabled={props.disabled}
          onClick={() => {
            close();
            files.current?.click();
          }}
        >
          <FilePlus size={22} />
          <span>{t("Upload files")}</span>
        </button>
        <button
          type="button"
          className="mobile-sheet-row"
          role="switch"
          aria-checked={props.planMode}
          disabled={props.disabled}
          onClick={() => {
            close();
            props.onPlanModeChange(!props.planMode);
          }}
        >
          <AiIdea size={22} className="text-yellow-300/80" />
          <span>{t("Plan mode")}</span>
          {props.planMode && <Check size={20} />}
        </button>
        {!props.lockedAgent && (
          <button type="button" className="mobile-sheet-row" aria-label={t("Choose project")}
            disabled={props.disabled || props.running || !props.projects.length}
            onClick={() => props.onPanelChange("projects")}>
            <Folder size={22} />
            <span>{t("Choose project")}</span>
          </button>
        )}
        {props.loadSkills && <>
          <div className="mobile-menu-divider" role="separator" />
          <div className="mobile-skill-picker">
            <MobileSkillList skills={options.filter(skill => skill !== PLAN_COMMAND)} loading={skillsState.loading} failed={!!skillsState.failed} error={skillsState.error}
              active={skillActive} id={skillListId} onPick={pickSkill} onActive={setSkillActive} onRetry={() => void skillsState.reload(true)} />
          </div>
        </>}
      </MobileSheet>
      <MobileSheet
        open={props.panel === "projects" && !props.lockedAgent}
        title="Choose project"
        placement="anchor"
        anchor={panelAnchor}
        preserveFocus={area}
        width={SHEET_WIDTH.list}
        side="top"
        onClose={close}
      >
        <div
          className="mobile-project-options"
          role="radiogroup"
          aria-label={t("Projects")}
        >
          {props.projects.map((project) => (
            <button
              type="button"
              className="mobile-sheet-row"
              role="radio"
              key={project.id}
              disabled={props.disabled}
              aria-checked={props.project?.id === project.id}
              onClick={() => {
                close();
                if (project.id !== props.project?.id)
                  props.onProjectChange(project);
              }}
            >
              <Folder size={22} />
              <span className="mobile-sheet-row-text">
                <strong>{project.name}</strong>
                <small>{project.cwd}</small>
              </span>
              {project.id === props.project?.id && <Check size={20} />}
            </button>
          ))}
        </div>
      </MobileSheet>
    </>
  );
}
