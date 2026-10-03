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
}: {
  catalog?: HostModelCatalog;
  configuration: MobileConfiguration;
  lockedAgent: boolean;
  disabled: boolean;
  onChange: (configuration: MobileConfiguration) => void;
}) {
  const providers = REMOTE_PROVIDERS.filter(
    (provider) =>
      catalog?.models[provider] ||
      catalog?.errors[provider] ||
      provider === configuration.harness,
  );
  const models = catalog?.models[configuration.harness] ?? [];
  const controls = remoteModelControls(
    catalog,
    configuration.harness,
    configuration.model,
    configuration.modelSettings,
    lockedAgent ? configuration.model : undefined,
  );
  const listed = models.some((model) => model.id === configuration.model);
  return (
    <div className="mobile-agent-models">
      <label className="mobile-agent-control">
        <span>
          <HarnessIcon harness={configuration.harness} />
          Agent
        </span>
        <select
          aria-label="Agent"
          value={configuration.harness}
          disabled={disabled || lockedAgent}
          onChange={(event) => {
            const next =
              catalog?.models[event.target.value as RemoteProvider]?.[0];
            if (next)
              onChange(
                configurationForModel(next, {}, configuration.runtimeMode),
              );
          }}
        >
          {providers.map((provider) => (
            <option
              key={provider}
              value={provider}
              disabled={!catalog?.models[provider]?.length}
            >
              {HARNESS_TITLE[provider]}
            </option>
          ))}
        </select>
      </label>
      <label className="mobile-model-control">
        <span>Model</span>
        <select
          aria-label="Model"
          value={configuration.model}
          disabled={disabled || !models.length}
          onChange={(event) => {
            const next = models.find(
              (model) => model.id === event.target.value,
            );
            if (next)
              onChange(
                configurationForModel(
                  next,
                  configuration.modelSettings,
                  configuration.runtimeMode,
                ),
              );
          }}
        >
          {!listed && (
            <option value={configuration.model}>
              {configuration.model || "No models available"}
            </option>
          )}
          {models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </label>
      {controls.settings.map((setting) => (
        <label className="mobile-setting-control" key={setting.id}>
          <span>
            {isEffortSettingId(setting.id) ? "Reasoning" : setting.label}
          </span>
          <select
            aria-label={
              isEffortSettingId(setting.id) ? "Reasoning effort" : setting.label
            }
            value={configuration.modelSettings[setting.id] ?? setting.value}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...configuration,
                modelSettings: {
                  ...configuration.modelSettings,
                  [setting.id]: event.target.value,
                },
              })
            }
          >
            {setting.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      {lockedAgent && (
        <small className="mobile-agent-hint">
          Start a new conversation to choose another agent.
        </small>
      )}
      {catalog?.errors[configuration.harness] && (
        <small className="mobile-agent-hint">
          {catalog.errors[configuration.harness]}
        </small>
      )}
    </div>
  );
}
