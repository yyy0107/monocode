import { useState } from "react";
import { Check, ChevronRight } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet } from "./MobileSheet";
import {
  HARNESS_TITLE,
  type RuntimeMode,
} from "../features/sessions/model/session";
import { HarnessIcon } from "../features/sessions/ui/HarnessIcon";
import {
  isEffortSettingId,
  type AgentModel,
} from "../features/sessions/model/models";
import {
  remoteModelControls,
  carryModelSettings,
} from "../features/connections/model/remoteModels";
import {
  REMOTE_PROVIDERS,
  type RemoteProvider,
  type HostModelCatalog,
  type HostSession,
} from "../features/connections/model/protocol";

export type MobileConfiguration = {
  harness: RemoteProvider;
  model: string;
  modelSettings: Record<string, string>;
  runtimeMode: RuntimeMode;
};
export function configurationForModel(
  model: AgentModel,
  values: Record<string, string> = {},
  runtimeMode: RuntimeMode = "supervised",
): MobileConfiguration {
  return {
    harness: model.harness as RemoteProvider,
    model: model.id,
    modelSettings: carryModelSettings(model.settings ?? [], values),
    runtimeMode,
  };
}
export function configurationForSession(
  snapshot: HostSession,
): MobileConfiguration {
  const { harness, model, modelSettings, runtimeMode } = snapshot.session;
  return {
    harness: harness as RemoteProvider,
    model,
    modelSettings,
    runtimeMode,
  };
}
export function firstConfiguration(
  catalog: HostModelCatalog,
): MobileConfiguration | undefined {
  for (const models of Object.values(catalog.models))
    if (models?.[0]) return configurationForModel(models[0]);
}
export function MobileModelControls({
  catalog,
  configuration,
  lockedAgent,
  disabled,
  onChange,
  onClose,
}: {
  catalog?: HostModelCatalog;
  configuration: MobileConfiguration;
  lockedAgent: boolean;
  disabled: boolean;
  onChange: (configuration: MobileConfiguration) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState<"settings" | "models" | "agents">(
    "settings",
  );
  const models = catalog?.models[configuration.harness] ?? [];
  const controls = remoteModelControls(
    catalog,
    configuration.harness,
    configuration.model,
    configuration.modelSettings,
    lockedAgent ? configuration.model : undefined,
  );
  const providers = REMOTE_PROVIDERS.filter(
    (provider) =>
      catalog?.models[provider] ||
      catalog?.errors[provider] ||
      provider === configuration.harness,
  );
  const choose = (next: MobileConfiguration) => {
    onClose();
    onChange(next);
  };
  return (
    <MobileSheet
      title={
        page === "models"
          ? "Model"
          : page === "agents"
            ? "Agent"
            : "Model and reasoning"
      }
      onClose={onClose}
      onBack={page === "settings" ? undefined : () => setPage("settings")}
    >
      {page === "settings" ? (
        <>
          {controls.settings.map((setting) => (
            <div className="mobile-sheet-group" key={setting.id}>
              <h3>
                {t(isEffortSettingId(setting.id) ? "Reasoning" : setting.label)}
              </h3>
              <div
                role="radiogroup"
                aria-label={t(
                  isEffortSettingId(setting.id)
                    ? "Reasoning effort"
                    : setting.label,
                )}
              >
                {setting.options.map((option) => {
                  const selected =
                    (configuration.modelSettings[setting.id] ??
                      setting.value) === option.value;
                  return (
                    <button
                      type="button"
                      className="mobile-sheet-row"
                      role="radio"
                      aria-checked={selected}
                      key={option.value}
                      disabled={disabled}
                      onClick={() =>
                        choose({
                          ...configuration,
                          modelSettings: {
                            ...configuration.modelSettings,
                            [setting.id]: option.value,
                          },
                        })
                      }
                    >
                      <span className="mobile-sheet-row-text">
                        <strong>{t(option.label)}</strong>
                      </span>
                      {selected && <Check size={20} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="mobile-sheet-group">
            <button
              type="button"
              className="mobile-sheet-row"
              disabled={disabled || !models.length}
              onClick={() => setPage("models")}
            >
              <span className="mobile-sheet-row-text">
                <strong>{t("Model")}</strong>
                <small>
                  {(controls.model?.name ?? configuration.model) ||
                    t("No models available")}
                </small>
              </span>
              <ChevronRight size={20} />
            </button>
            <button
              type="button"
              className="mobile-sheet-row"
              disabled={disabled || lockedAgent}
              onClick={() => setPage("agents")}
            >
              <HarnessIcon harness={configuration.harness} />
              <span className="mobile-sheet-row-text">
                <strong>{t("Agent")}</strong>
                <small>{HARNESS_TITLE[configuration.harness]}</small>
              </span>
              <ChevronRight size={20} />
            </button>
            {lockedAgent && (
              <p className="mobile-sheet-hint">
                {t("Start a new conversation to choose another agent.")}
              </p>
            )}
            {catalog?.errors[configuration.harness] && (
              <p className="mobile-form-error" role="alert">
                {catalog.errors[configuration.harness]}
              </p>
            )}
          </div>
        </>
      ) : page === "models" ? (
        <div role="radiogroup" aria-label={t("Model")}>
          {models.map((model) => (
            <button
              type="button"
              className="mobile-sheet-row"
              role="radio"
              key={model.id}
              aria-checked={
                controls.model?.id === model.id ||
                configuration.model === model.id
              }
              disabled={disabled}
              onClick={() =>
                choose(
                  configurationForModel(
                    model,
                    configuration.modelSettings,
                    configuration.runtimeMode,
                  ),
                )
              }
            >
              <span className="mobile-sheet-row-text">
                <strong>{model.name}</strong>
              </span>
              {(controls.model?.id === model.id ||
                configuration.model === model.id) && <Check size={20} />}
            </button>
          ))}
        </div>
      ) : (
        <div role="radiogroup" aria-label={t("Agent")}>
          {providers.map((provider) => (
            <button
              type="button"
              className="mobile-sheet-row"
              role="radio"
              key={provider}
              aria-checked={configuration.harness === provider}
              disabled={
                disabled || lockedAgent || !catalog?.models[provider]?.length
              }
              onClick={() => {
                const next = catalog?.models[provider]?.[0];
                if (next)
                  choose(
                    configurationForModel(next, {}, configuration.runtimeMode),
                  );
              }}
            >
              <HarnessIcon harness={provider} />
              <span className="mobile-sheet-row-text">
                <strong>{HARNESS_TITLE[provider]}</strong>
              </span>
              {configuration.harness === provider && <Check size={20} />}
            </button>
          ))}
        </div>
      )}
    </MobileSheet>
  );
}
