import { useEffect, useRef } from "react";
import {
  ArrowUp,
  AppWindow,
  Check,
  ChevronDown,
  File as FileIcon,
  Folder,
  ImagePlus,
  ListBullet,
  LoaderCircle,
  Plus,
  Shield,
  Square,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import { AttachmentChip } from "../features/sessions/ui/AttachmentChip";
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
  "actions" | "permissions" | "model" | "projects" | null;
type Props = {
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
  hostName?: string;
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
  const photos = useRef<HTMLInputElement>(null);
  const files = useRef<HTMLInputElement>(null);
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
  useEffect(() => {
    if (area.current) {
      area.current.style.height = "0px";
      area.current.style.height = `${Math.min(area.current.scrollHeight, 168)}px`;
    }
  }, [props.value]);
  useEffect(() => {
    if (props.disabled) props.onPanelChange(null);
  }, [props.disabled, props.onPanelChange]);
  const selectFiles = (input: HTMLInputElement) => {
    if (input.files?.length) props.onFiles(Array.from(input.files));
    input.value = "";
  };
  return (
    <>
      <div className="mobile-composer-dock">
        <div className="mobile-composer-context">
          <span className="mobile-composer-host">
            <AppWindow size={15} />
            <span>{props.hostName}</span>
          </span>
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => props.onPanelChange("projects")}
            aria-haspopup="dialog"
            aria-expanded={props.panel === "projects"}
            aria-label={t("Choose project")}
          >
            <Folder size={15} />
            <span>{props.project?.name ?? t("Project")}</span>
            <ChevronDown size={13} />
          </button>
        </div>
        <form
          className="mobile-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (props.canSend) props.onSend();
          }}
        >
          {props.attachments.length > 0 && (
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
          {props.planMode && (
            <div className="mobile-composer-plan">
              <ListBullet size={14} />
              <span>{t("Plan mode")}</span>
              <button
                type="button"
                disabled={props.disabled}
                onClick={() => props.onPlanModeChange(false)}
                aria-label={t("Turn off plan mode")}
              >
                {t("Turn off")}
              </button>
            </div>
          )}
          <div className="mobile-composer-toolbar">
            <button
              type="button"
              className="mobile-composer-action"
              aria-label={t("Add to message")}
              aria-haspopup="dialog"
              aria-expanded={props.panel === "actions"}
              disabled={props.disabled}
              onClick={() => props.onPanelChange("actions")}
            >
              <Plus size={24} />
            </button>
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
              disabled={props.disabled}
              onClick={() => props.onPanelChange("permissions")}
            >
              <Shield size={22} />
            </button>
            <button
              type="button"
              className="mobile-composer-model"
              disabled={props.disabled}
              aria-label={t("Model and reasoning")}
              aria-haspopup="dialog"
              aria-expanded={props.panel === "model"}
              onClick={() => props.onPanelChange("model")}
            >
              <HarnessIcon harness={props.configuration.harness} />
              <span>
                <strong>{modelName}</strong>
                {effort && <small>{t(effort)}</small>}
              </span>
              <ChevronDown size={12} />
            </button>
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
          catalog={props.catalog}
          configuration={props.configuration}
          lockedAgent={props.lockedAgent}
          disabled={props.disabled}
          onChange={props.onConfigurationChange}
          onClose={close}
        />
      )}
      {props.panel === "permissions" && (
        <MobileSheet title="Permissions" onClose={close}>
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
                <Shield size={22} />
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
        <MobileSheet title="Add to message" onClose={close}>
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
            <FileIcon size={22} />
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
            <ListBullet size={22} />
            <span>{t("Plan mode")}</span>
            {props.planMode && <Check size={20} />}
          </button>
        </MobileSheet>
      )}
      {props.panel === "projects" && (
        <MobileSheet title="Choose project" onClose={close}>
          <p className="mobile-sheet-hint">
            {t(
              "Changing projects starts a new conversation and keeps your message.",
            )}
          </p>
          <div role="radiogroup" aria-label={t("Projects")}>
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
