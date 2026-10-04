import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowUp,
  AiIdea,
  Check,
  ChevronDown,
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
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { AttachmentChip } from "../features/sessions/ui/AttachmentChip";
import { RuntimeModeIcon } from "../features/sessions/ui/RuntimeModeIcon";
import { MODE_COMMAND_STYLES } from "../features/sessions/ui/modeCommands";
import { PLAN_COMMAND } from "../features/sessions/model/plan";
import {
  HARNESS_TITLE,
  RUNTIME_MODES,
  RUNTIME_MODE_LABEL,
  RUNTIME_MODE_HINT,
  type Attachment,
} from "../features/sessions/model/session";
import { isEffortSettingId } from "../features/sessions/model/models";
import { remoteModelControls } from "../features/connections/model/remoteModels";
import type {
  HostModelCatalog,
  HostProject,
} from "../features/connections/model/protocol";
import {
  MobileModelControls,
  type MobileConfiguration,
} from "./MobileModelControls";
import { MobileSheet } from "./MobileSheet";

export type MobileComposerPanel =
  "actions" | "permissions" | "model" | "projects" | "plan" | null;
const planStyle = MODE_COMMAND_STYLES[PLAN_COMMAND.name];
type Props = {
  queue?: ReactNode;
  value: string;
  onChange: (text: string) => void;
  configuration: MobileConfiguration;
  catalog?: HostModelCatalog;
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
};

export function MobileComposer(props: Props) {
  const { t } = useTranslation();
  const area = useRef<HTMLTextAreaElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const dock = useRef<HTMLDivElement>(null);
  const pressingAction = useRef(false);
  // "Engaged" survives sheets, system file pickers and short busy states.
  // Only a deliberate move away (an outside tap or focusing another control)
  // collapses the composer again.
  const [engaged, setEngaged] = useState(false);
  const expanded = engaged || props.panel !== null;
  const photos = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
  const panelAnchor = useRef<HTMLButtonElement>(null);
  const controls = remoteModelControls(
    props.catalog,
    props.configuration.harness,
    props.configuration.model,
    props.configuration.modelSettings,
    props.lockedAgent ? props.configuration.model : undefined,
  );
  const reasoning = controls.settings.find((setting) =>
    isEffortSettingId(setting.id),
  );
  const effort = reasoning?.options.find(
    (option) =>
      option.value ===
      (props.configuration.modelSettings[reasoning.id] ?? reasoning.value),
  )?.label;
  const modelName =
    (controls.model?.name ??
      (props.configuration.model.split(":").slice(1).join(":") ||
        props.configuration.model)) ||
    HARNESS_TITLE[props.configuration.harness];
  const close = () => props.onPanelChange(null);
  // The dock floats over the transcript; publish its height so content can
  // scroll past it without hiding the last message.
  useLayoutEffect(() => {
    const element = dock.current;
    const host = element?.parentElement;
    if (!element || !host) return;
    const publish = () =>
      host.style.setProperty("--mobile-dock-height", `${element.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      host.style.removeProperty("--mobile-dock-height");
    };
  }, []);
  useLayoutEffect(() => {
    const element = area.current;
    if (!element) return;
    const finishAt = performance.now() + 240;
    element.style.transitionDuration = "240ms, 240ms";
    const resize = () => {
      if (!expanded) {
        element.style.height = "28px";
        element.scrollTop = 0;
        element.scrollLeft = 0;
        return;
      }
      // An offscreen copy measures wrapping without resetting the live field
      // mid-animation or moving its caret.
      const measure = element.cloneNode() as HTMLTextAreaElement;
      measure.value = element.value;
      measure.removeAttribute("id");
      measure.setAttribute("aria-hidden", "true");
      measure.inert = true;
      measure.tabIndex = -1;
      Object.assign(measure.style, {
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        transition: "none",
        width: `${element.getBoundingClientRect().width}px`,
        height: "0px",
        minHeight: "0px",
        maxHeight: "none",
      });
      element.after(measure);
      const nextHeight = `${Math.max(44, Math.min(measure.scrollHeight, 168))}px`;
      measure.remove();
      if (element.style.height === nextHeight) return;
      // Width changes can alter line wrapping. Keep those corrections within
      // the same transition instead of extending it with every resize frame.
      element.style.transitionDuration = `${Math.max(0, finishAt - performance.now())}ms, 240ms`;
      element.style.height = nextHeight;
    };
    resize();
    if (!expanded) return;
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(() => {
      const nextWidth = element.getBoundingClientRect().width;
      if (Math.abs(nextWidth - width) < 0.5) return;
      width = nextWidth;
      resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [props.value, expanded]);
  useEffect(() => {
    // Applying a setting, switching project or reading attachments briefly
    // disables the composer. Close any open sheet but keep the expanded layout.
    if (props.disabled) props.onPanelChange(null);
  }, [props.disabled, props.onPanelChange]);
  useEffect(() => {
    if (!engaged || props.panel !== null) return;
    // Collapse on a tap outside the composer, not on a scroll gesture: touch
    // scrolling cancels the pointer or moves it past the tap threshold.
    let start: { id: number; x: number; y: number } | undefined;
    const outside = (target: EventTarget | null) =>
      target instanceof Element &&
      !form.current?.parentElement?.contains(target) &&
      !target.closest(".mobile-sheet-backdrop");
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
      setEngaged(false);
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
  }, [engaged, props.panel]);
  const selectFiles = (input: HTMLInputElement) => {
    if (input.files?.length) props.onFiles(Array.from(input.files));
    input.value = "";
  };
  return (
    <>
      <div ref={dock} className="mobile-composer-dock">
        {props.queue ? <div className="mobile-message-queue">{props.queue}</div> : null}
        <form
          ref={form}
          className="mobile-composer"
          data-collapsed={!expanded}
          onPointerDownCapture={(event) => {
            pressingAction.current = !!(event.target as Element).closest("button");
          }}
          onPointerUpCapture={() => {
            // Touch browsers can focus a button between pointerup and click.
            setTimeout(() => {
              pressingAction.current = false;
            }, 0);
          }}
          onPointerCancelCapture={() => {
            pressingAction.current = false;
          }}
          onFocus={() => {
            if (!pressingAction.current) setEngaged(true);
          }}
          onBlur={(event) => {
            // No related target means focus left for the system (file picker,
            // backgrounding) or the field was disabled; that is not leaving.
            // Focus moving into a sheet opened from the composer is not either.
            const next = event.relatedTarget;
            if (
              next instanceof Element &&
              !event.currentTarget.contains(next) &&
              !next.closest(".mobile-sheet-backdrop")
            )
              setEngaged(false);
          }}
          onClick={(event) => {
            pressingAction.current = false;
            if (props.disabled) return;
            if (event.target === event.currentTarget) area.current?.focus();
            else setEngaged(true);
          }}
          onSubmit={(event) => {
            event.preventDefault();
            if (props.canSend) props.onSend();
          }}
        >
          {props.attachments.length > 0 && (
            <div
              className="mobile-composer-attachment-region"
              hidden={!expanded}
              inert={!expanded}
              aria-hidden={!expanded}
            >
              <div className="mobile-composer-attachment-clip">
                <div className="mobile-composer-attachments">
                  {props.attachments.map((attachment) => (
                    <AttachmentChip
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={
                        props.disabled
                          ? undefined
                          : () => props.onRemoveAttachment(attachment.id)
                      }
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <textarea
            ref={area}
            aria-label={t("Message")}
            placeholder={t(
              props.running ? "Agent is working…" : "Ask {agent} anything",
              { agent: HARNESS_TITLE[props.configuration.harness] },
            )}
            rows={1}
            value={props.value}
            onChange={(event) => props.onChange(event.target.value)}
            disabled={props.disabled}
            onKeyDown={(event) => {
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
                props.onPanelChange("actions");
              }}
            >
              <Plus size={24} />
            </button>
            <div
              className="mobile-composer-controls"
              hidden={!expanded}
              inert={!expanded}
              aria-hidden={!expanded}
            >
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
                  size={22}
                  className={
                    props.configuration.runtimeMode === "full-access"
                      ? "text-amber-400/90"
                      : undefined
                  }
                />
              </button>
              <button
                type="button"
                className="mobile-composer-model"
                title={modelName}
                disabled={props.disabled || props.running}
                aria-label={t("Model and reasoning")}
                aria-haspopup="dialog"
                aria-expanded={props.panel === "model"}
                onClick={(event) => {
                  panelAnchor.current = event.currentTarget;
                  props.onPanelChange("model");
                }}
              >
                <HarnessIcon
                  harness={props.configuration.harness}
                  className="mobile-composer-agent-icon size-3.5"
                />
                <span className="mobile-composer-model-label">
                  <strong>{modelName}</strong>
                  {effort && <small>{t(effort)}</small>}
                </span>
                <ChevronDown size={12} />
              </button>
              {props.running && props.canSend ? (
                <button type="submit" className="mobile-composer-action" aria-label={t("Queue message")}>
                  {props.working ? <LoaderCircle size={20} className="mobile-spin" /> : <ListEnd size={21} />}
                </button>
              ) : null}
            </div>
            {props.running ? (
              <button
                type="button"
                className="mobile-send"
                disabled={!props.canStop}
                aria-label={t("Stop")}
                onClick={props.onStop}
              >
                <Square size={18} />
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
                  <ArrowUp size={23} />
                )}
              </button>
            )}
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
      {props.panel === "model" && (
        <MobileModelControls
          anchor={panelAnchor}
          catalog={props.catalog}
          configuration={props.configuration}
          lockedAgent={props.lockedAgent}
          disabled={props.disabled}
          onChange={props.onConfigurationChange}
          onClose={close}
        />
      )}
      {props.panel === "plan" && (
        <MobileSheet
          title="Plan mode"
          placement="anchor"
          anchor={panelAnchor}
          width={180}
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
      )}
      {props.panel === "permissions" && (
        <MobileSheet
          title="Permissions"
          placement="anchor"
          anchor={panelAnchor}
          width={340}
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
      )}
      {props.panel === "actions" && (
        <MobileSheet
          title="Add to message"
          placement="anchor"
          anchor={panelAnchor}
          width={280}
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
        </MobileSheet>
      )}
      {props.panel === "projects" && (
        <MobileSheet
          title="Choose project"
          placement="anchor"
          anchor={panelAnchor}
          width={340}
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
      )}
    </>
  );
}
