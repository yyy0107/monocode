import { MobileSettingsIcon as SettingsIcon, MobileSettingsGlyph } from "./MobileSettingsIcon";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  ChevronRight,
  Sparkles,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import type { HostConnectionStatus } from "./client";
import type { GlassEffect, GlassSettings } from "./glassSettings";
import { MobileAppUpdates, type useMobileAppUpdates } from "./MobileAppUpdates";
import { MobileConnections, type SettingsConnection } from "./MobileConnections";
import type { ConnectionAppearance } from "./connectionAppearance";
import { MobileSelect } from "./MobileSelect";
import type { useMobileActivity } from "./useMobileActivity";
import type { FollowUpBehavior } from "../features/settings/model/settings";
import {
  ACCENT_COLOR_PRESET_LABELS,
  ACCENT_COLOR_PRESETS,
  type TranscriptLayout,
} from "../features/settings/model/appearance";

export type MobileSettingsPage =
  "root" | "connections" | "updates" | "glass" | "archive";
export type MobilePreferencePanel =
  "theme" | "accent" | "language" | "glass" | "follow-up" | "transcript-layout" |
  "agent-defaults" | "account-claude" | "account-codex" |
  "connection-menu" | "connection-edit" | "connection-delete" | null;

export function mobileSettingsTitle(page: MobileSettingsPage) {
  return page === "connections"
    ? "Connections"
    : page === "updates"
      ? "App updates"
      : page === "glass"
        ? "Glass"
        : page === "archive"
          ? "Archived conversations"
          : "Settings";
}

function GlassPreview({ label }: { label: string }) {
  return (
    <div className="mobile-glass-preview" aria-hidden="true">
      <div className="mobile-glass-preview-scene">
        <span>Aa</span>
        <span>玻璃</span>
        <span>Glass</span>
      </div>
      <div className="mobile-glass-preview-chip">
        <Sparkles size={16} />
        {label}
      </div>
    </div>
  );
}

function GlassSlider({
  id,
  icon,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mobile-settings-row mobile-settings-slider">
      {icon}
      <label className="mobile-settings-label" htmlFor={id}>
        <span className="mobile-settings-slider-heading">
          <span>{label}</span>
          <output htmlFor={id}>{value}%</output>
        </span>
        <input
          id={id}
          type="range"
          className="mobile-range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          style={{ "--mobile-range-value": `${value}%` } as CSSProperties}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
        />
      </label>
    </div>
  );
}

function AccentSelect({
  value,
  onChange,
  open,
  onOpenChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const options: { color: string | null; label: string }[] = [
    { color: null, label: "Default" },
    ...ACCENT_COLOR_PRESETS.map((color, index) => ({
      color,
      label: ACCENT_COLOR_PRESET_LABELS[index],
    })),
  ];
  if (value && !options.some((option) => option.color === value)) {
    options.push({ color: value, label: value });
  }
  return (
    <MobileSelect
      id="mobile-accent"
      label={t("Accent color")}
      value={value ?? "default"}
      open={open}
      onOpenChange={onOpenChange}
      onChange={(color) => onChange(color === "default" ? null : color)}
      options={options.map(({ color, label }) => ({
        value: color ?? "default",
        label: t(label),
        icon: (
          <span
            className="mobile-accent-preview"
            aria-hidden="true"
            style={{ background: color ?? "var(--color-content)" }}
          />
        ),
      }))}
    />
  );
}

function Group({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="mobile-settings-group" aria-label={t(title)}>
      <h2>{t(title)}</h2>
      <div className="mobile-settings-card">{children}</div>
      {footer ? <p className="mobile-settings-footer">{footer}</p> : null}
    </section>
  );
}

export function MobileSettings({
  page,
  onPageChange,
  connection,
  hostStatus,
  busy,
  loading,
  addingConnection,
  connectionTrigger,
  onAddConnection,
  onDisconnect,
  onReconnect,
  onDeleteConnection,
  connectionAppearance,
  onSaveConnectionAppearance,
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  followUpBehavior,
  onFollowUpBehaviorChange,
  transcriptLayout,
  onTranscriptLayoutChange,
  accentColor,
  onAccentColorChange,
  soundsEnabled,
  onSoundsEnabledChange,
  archive,
  agentDefaults,
  glass,
  onGlassChange,
  preferencePanel,
  onPreferencePanelChange,
  activity,
  appUpdates,
}: {
  page: MobileSettingsPage;
  onPageChange: (page: MobileSettingsPage) => void;
  connection?: SettingsConnection;
  hostStatus: HostConnectionStatus;
  busy: boolean;
  loading: boolean;
  addingConnection: boolean;
  connectionTrigger: RefObject<HTMLButtonElement | null>;
  onAddConnection: () => void;
  onDisconnect: () => Promise<void>;
  onReconnect: () => void;
  onDeleteConnection: () => Promise<void>;
  connectionAppearance: ConnectionAppearance;
  onSaveConnectionAppearance: (value: ConnectionAppearance) => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  language: string;
  onLanguageChange: (language: "en" | "zh-CN") => void;
  followUpBehavior: FollowUpBehavior;
  onFollowUpBehaviorChange: (behavior: FollowUpBehavior) => void;
  transcriptLayout: TranscriptLayout;
  onTranscriptLayoutChange: (layout: TranscriptLayout) => void;
  accentColor: string | null;
  onAccentColorChange: (color: string | null) => void;
  soundsEnabled: boolean;
  onSoundsEnabledChange: (enabled: boolean) => void;
  archive: ReactNode;
  agentDefaults?: ReactNode;
  glass: GlassSettings;
  onGlassChange: (glass: GlassSettings) => void;
  preferencePanel: MobilePreferencePanel;
  onPreferencePanelChange: (panel: MobilePreferencePanel) => void;
  activity: ReturnType<typeof useMobileActivity>;
  appUpdates: ReturnType<typeof useMobileAppUpdates>;
}) {
  const { t } = useTranslation();
  const addConnection = (
    <button
      className="mobile-settings-row mobile-connection-row mobile-connection-add"
      ref={connectionTrigger}
      type="button"
      aria-label={t("Add connection")}
      aria-haspopup="dialog"
      aria-expanded={addingConnection}
      disabled={busy || loading}
      onClick={onAddConnection}
    >
      <MobileSettingsGlyph name="link" />
      <span className="mobile-settings-label">
        <span>{t("Add connection")}</span>
        <small>{t("Connect using a Host URL and device token.")}</small>
      </span>
    </button>
  );
  const connections = (
    <MobileConnections
      connection={connection}
      appearance={connectionAppearance}
      hostStatus={hostStatus}
      disabled={busy || loading}
      panel={preferencePanel}
      onPanelChange={onPreferencePanelChange}
      onSave={onSaveConnectionAppearance}
      onDisconnect={onDisconnect}
      onReconnect={onReconnect}
      onDelete={onDeleteConnection}
      addConnection={addConnection}
    />
  );

  if (page === "updates")
    return (
      <main className="mobile-content mobile-settings">
        <MobileAppUpdates state={appUpdates} />
      </main>
    );

  if (page === "archive")
    return (
      <main key="archive" className="mobile-content mobile-settings">
        {archive}
      </main>
    );

  if (page === "connections")
    return (
      <main className="mobile-content mobile-settings">
        {connections}
      </main>
    );

  if (page === "glass")
    return (
      <main key="glass" className="mobile-content mobile-settings">
        <Group
          title="Glass"
          footer={
            glass.effect === "liquid"
              ? t("Edge refraction is available on Android.")
              : undefined
          }
        >
          <GlassPreview
            label={
              glass.effect === "liquid"
                ? t("Liquid glass")
                : glass.effect === "frosted"
                  ? t("Frosted glass")
                  : t("Solid")
            }
          />
          <div className="mobile-settings-row">
            <SettingsIcon name="glass" />
            <label
              className="mobile-settings-label"
              htmlFor="mobile-glass-effect"
            >
              {t("Effect")}
            </label>
            <MobileSelect
              id="mobile-glass-effect"
              label={t("Effect")}
              value={glass.effect}
              open={preferencePanel === "glass"}
              onOpenChange={(open) =>
                onPreferencePanelChange(open ? "glass" : null)
              }
              onChange={(effect) =>
                onGlassChange({ ...glass, effect: effect as GlassEffect })
              }
              options={[
                { value: "liquid", label: t("Liquid glass") },
                { value: "frosted", label: t("Frosted glass") },
                { value: "solid", label: t("Solid") },
              ]}
            />
          </div>
          <GlassSlider
            id="mobile-glass-intensity"
            icon={
              <SettingsIcon name="intensity" />
            }
            label={t("Intensity")}
            value={glass.intensity}
            disabled={glass.effect === "solid"}
            onChange={(intensity) => onGlassChange({ ...glass, intensity })}
          />
          <GlassSlider
            id="mobile-glass-transparency"
            icon={
              <SettingsIcon name="transparency" />
            }
            label={t("Transparency")}
            value={glass.transparency}
            disabled={glass.effect === "solid"}
            onChange={(transparency) => onGlassChange({ ...glass, transparency })}
          />
        </Group>
      </main>
    );

  return (
    <main className="mobile-content mobile-settings">
      {connections}
      {agentDefaults}
      <Group title="General">
        <div className="mobile-settings-row">
          <SettingsIcon name="appearance" />
          <label className="mobile-settings-label" htmlFor="mobile-theme">
            {t("Appearance")}
          </label>
          <MobileSelect
            id="mobile-theme"
            label={t("Appearance")}
            value={theme}
            open={preferencePanel === "theme"}
            onOpenChange={(open) =>
              onPreferencePanelChange(open ? "theme" : null)
            }
            onChange={onThemeChange}
            options={[
              { value: "dark", label: t("Dark") },
              { value: "light", label: t("Light") },
              { value: "system", label: t("System") },
            ]}
          />
        </div>
        <div className="mobile-settings-row">
          <SettingsIcon name="accent" />
          <label className="mobile-settings-label" htmlFor="mobile-accent">
            {t("Accent color")}
          </label>
          <AccentSelect
            value={accentColor}
            onChange={onAccentColorChange}
            open={preferencePanel === "accent"}
            onOpenChange={(open) =>
              onPreferencePanelChange(open ? "accent" : null)
            }
          />
        </div>
        <div className="mobile-settings-row">
          <SettingsIcon name="language" />
          <label className="mobile-settings-label" htmlFor="mobile-language">
            {t("Language")}
          </label>
          <MobileSelect
            id="mobile-language"
            label={t("Language")}
            value={language}
            open={preferencePanel === "language"}
            onOpenChange={(open) =>
              onPreferencePanelChange(open ? "language" : null)
            }
            onChange={(value) => onLanguageChange(value as "en" | "zh-CN")}
            options={[
              { value: "en", label: "English" },
              { value: "zh-CN", label: "简体中文" },
            ]}
          />
        </div>
        <div className="mobile-settings-row mobile-settings-notifications">
          <SettingsIcon name="sounds" />
          <label className="mobile-settings-label">
            <span>{t("Sounds")}</span>
            <small>
              {t(
                "Play a sound when a reply finishes or a conversation needs your input while the app is open.",
              )}
            </small>
            <input
              type="checkbox"
              role="switch"
              className="mobile-switch"
              checked={soundsEnabled}
              onChange={(event) =>
                onSoundsEnabledChange(event.currentTarget.checked)
              }
            />
          </label>
        </div>
        <div className="mobile-settings-row mobile-settings-notifications">
          <SettingsIcon name="notifications" />
          <label className="mobile-settings-label">
            <span>{t("System notifications")}</span>
            <small>
              {activity.permission === "unsupported"
                ? t("System notifications are unavailable on this platform.")
                : t(
                    "Notify when a new reply is ready or a conversation needs your input.",
                  )}
            </small>
            <input
              type="checkbox"
              role="switch"
              className="mobile-switch"
              checked={activity.enabled}
              disabled={activity.permission === "unsupported"}
              onChange={(event) =>
                void activity.setNotificationsEnabled(
                  event.currentTarget.checked,
                )
              }
            />
          </label>
        </div>
        {(activity.enabled || activity.canOpenSettings) &&
        activity.permission === "prompt" ? (
          <div className="mobile-settings-row">
            <button
              className="mobile-button"
              onClick={() => void activity.requestPermission()}
            >
              {t("Allow notifications")}
            </button>
          </div>
        ) : (activity.enabled || activity.canOpenSettings) &&
          activity.permission === "denied" ? (
          <div className="mobile-settings-row mobile-settings-note">
            <span className="mobile-muted">
              {t("Notifications are blocked in system settings.")}
            </span>
            {activity.canOpenSettings ? (
              <button
                className="mobile-button"
                onClick={() => void activity.openSettings()}
              >
                {t("Open settings")}
              </button>
            ) : null}
          </div>
        ) : null}
        {activity.enabled &&
        activity.permission === "granted" &&
        activity.canOpenSettings ? (
          <div className="mobile-settings-row">
            <button
              className="mobile-button"
              onClick={() => void activity.openSettings()}
            >
              {t("Notification settings…")}
            </button>
          </div>
        ) : null}
        {activity.notificationError ? (
          <p className="mobile-form-error mobile-settings-note" role="status">
            {activity.notificationError}
          </p>
        ) : null}
      </Group>
      <Group title="Message composer">
        <div className="mobile-settings-row">
          <SettingsIcon name="followUp" />
          <label className="mobile-settings-label" htmlFor="mobile-follow-up">
            {t("Follow-up behavior")}
          </label>
          <MobileSelect
            id="mobile-follow-up"
            label={t("Follow-up behavior")}
            value={followUpBehavior}
            open={preferencePanel === "follow-up"}
            onOpenChange={(open) =>
              onPreferencePanelChange(open ? "follow-up" : null)
            }
            onChange={onFollowUpBehaviorChange}
            options={[
              { value: "queue", label: t("Queue") },
              { value: "steer", label: t("Steer") },
            ]}
          />
        </div>
        <div className="mobile-settings-row">
          <SettingsIcon name="layout" />
          <label
            className="mobile-settings-label"
            htmlFor="mobile-transcript-layout"
          >
            {t("Transcript layout")}
          </label>
          <MobileSelect
            id="mobile-transcript-layout"
            label={t("Transcript layout")}
            value={transcriptLayout}
            open={preferencePanel === "transcript-layout"}
            onOpenChange={(open) =>
              onPreferencePanelChange(open ? "transcript-layout" : null)
            }
            onChange={onTranscriptLayoutChange}
            options={[
              { value: "full", label: t("Full width") },
              { value: "chat", label: t("Chat") },
            ]}
          />
        </div>
      </Group>
      <section className="mobile-settings-group" aria-label={t("Glass")}>
        <div className="mobile-settings-card">
          <button
            type="button"
            className="mobile-settings-row"
            aria-label={t("Glass")}
            onClick={() => onPageChange("glass")}
          >
            <SettingsIcon name="glass" />
            <span className="mobile-settings-label">{t("Glass")}</span>
            <span className="mobile-settings-value">
              {t(glass.effect === "liquid" ? "Liquid glass" : glass.effect === "frosted" ? "Frosted glass" : "Solid")}
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <section
        className="mobile-settings-group"
        aria-label={t("Archived conversations")}
      >
        <div className="mobile-settings-card">
          <button
            type="button"
            className="mobile-settings-row"
            onClick={() => onPageChange("archive")}
          >
            <SettingsIcon name="archive" />
            <span className="mobile-settings-label">
              {t("Archived conversations")}
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <Group title="About">
        <button
          type="button"
          className="mobile-settings-row"
          onClick={() => onPageChange("updates")}
        >
          <SettingsIcon name="updates" />
          <span className="mobile-settings-label">{t("App updates")}</span>
          <span className="mobile-settings-value">
            {appUpdates.available ? (
              <span className="mobile-unread-dot" aria-hidden="true" />
            ) : null}
            {appUpdates.installed ? t(appUpdates.installed.version) : ""}
          </span>
          <ChevronRight size={18} />
        </button>
      </Group>
    </main>
  );
}
