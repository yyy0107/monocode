import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  ArrowDownCircle,
  ChevronRight,
  Computer,
  Eye,
  Gauge,
  Globe,
  Inbox,
  Palette,
  Plus,
  Sparkles,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import type { HostConnectionStatus } from "./client";
import type { GlassEffect, GlassSettings } from "./glassSettings";
import { MobileAppUpdates, type useMobileAppUpdates } from "./MobileAppUpdates";
import { MobileHostStatus } from "./MobileHostStatus";
import { MobileSelect } from "./MobileSelect";
import type { useMobileActivity } from "./useMobileActivity";

export type MobileSettingsPage = "root" | "connections" | "updates";
export type MobilePreferencePanel = "theme" | "language" | "glass" | null;

export function mobileSettingsTitle(page: MobileSettingsPage) {
  return page === "connections"
    ? "Connections"
    : page === "updates"
      ? "App updates"
      : "Settings";
}

/** iOS-style colored tile behind each row's glyph. */
type IconTone = "blue" | "gray" | "red" | "green" | "orange" | "cyan" | "purple";
function SettingsIcon({
  tone,
  children,
}: {
  tone: IconTone;
  children: ReactNode;
}) {
  return (
    <span className="mobile-settings-icon" data-tone={tone} aria-hidden="true">
      {children}
    </span>
  );
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
  connected,
  connection,
  hostStatus,
  busy,
  loading,
  addingConnection,
  connectionTrigger,
  onAddConnection,
  onDisconnect,
  theme,
  onThemeChange,
  language,
  onLanguageChange,
  glass,
  onGlassChange,
  preferencePanel,
  onPreferencePanelChange,
  activity,
  appUpdates,
}: {
  page: MobileSettingsPage;
  onPageChange: (page: MobileSettingsPage) => void;
  connected: boolean;
  connection?: { name: string; endpoint: string };
  hostStatus: HostConnectionStatus;
  busy: boolean;
  loading: boolean;
  addingConnection: boolean;
  connectionTrigger: RefObject<HTMLButtonElement | null>;
  onAddConnection: () => void;
  onDisconnect: () => void;
  theme: string;
  onThemeChange: (theme: string) => void;
  language: string;
  onLanguageChange: (language: "en" | "zh-CN") => void;
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
      className="mobile-settings-row mobile-settings-action"
      ref={connectionTrigger}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={addingConnection}
      disabled={busy || loading}
      onClick={onAddConnection}
    >
      <SettingsIcon tone="green">
        <Plus size={17} />
      </SettingsIcon>
      <span className="mobile-settings-label">{t("Add connection")}</span>
    </button>
  );

  if (page === "updates")
    return (
      <main className="mobile-content mobile-settings">
        <MobileAppUpdates state={appUpdates} />
      </main>
    );

  if (page === "connections")
    return (
      <main className="mobile-content mobile-settings">
        {connection && (
          <Group title="Current computer">
            <div className="mobile-settings-row mobile-current-host">
              <SettingsIcon tone="blue">
                <Computer size={17} />
              </SettingsIcon>
              <div>
                <strong className="mobile-current-host-name">
                  <span>{connection.name}</span>
                  <MobileHostStatus status={hostStatus} />
                </strong>
                <small>{connection.endpoint}</small>
              </div>
              <button
                className="mobile-button"
                disabled={busy}
                onClick={onDisconnect}
              >
                {t("Disconnect")}
              </button>
            </div>
          </Group>
        )}
        <Group
          title="Connections"
          footer={t("Continue your projects and conversations from your phone.")}
        >
          {addConnection}
        </Group>
      </main>
    );

  return (
    <main className="mobile-content mobile-settings">
      <Group title="Connection">
        {connection ? (
          <button
            type="button"
            className="mobile-settings-row mobile-settings-hero"
            onClick={() => onPageChange("connections")}
          >
            <SettingsIcon tone="blue">
              <Computer size={26} />
            </SettingsIcon>
            <span className="mobile-settings-label">
              <strong className="mobile-current-host-name">
                <span>{connection.name}</span>
                <MobileHostStatus status={hostStatus} />
              </strong>
              <small>{connection.endpoint}</small>
            </span>
            <ChevronRight size={18} />
          </button>
        ) : null}
        {!connected && addConnection}
      </Group>
      <Group title="General">
        <div className="mobile-settings-row">
          <SettingsIcon tone="blue">
            <Palette size={17} />
          </SettingsIcon>
          <label className="mobile-settings-label" htmlFor="mobile-theme">
            {t("Appearance")}
          </label>
          <MobileSelect
            id="mobile-theme"
            label={t("Appearance")}
            value={theme}
            open={preferencePanel === "theme"}
            onOpenChange={(open) => onPreferencePanelChange(open ? "theme" : null)}
            onChange={onThemeChange}
            options={[
              { value: "dark", label: t("Dark") },
              { value: "light", label: t("Light") },
              { value: "system", label: t("System") },
            ]}
          />
        </div>
        <div className="mobile-settings-row">
          <SettingsIcon tone="gray">
            <Globe size={17} />
          </SettingsIcon>
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
          <SettingsIcon tone="red">
            <Inbox size={17} />
          </SettingsIcon>
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
        {activity.enabled && activity.permission === "prompt" ? (
          <div className="mobile-settings-row">
            <button
              className="mobile-button"
              onClick={() => void activity.requestPermission()}
            >
              {t("Allow notifications")}
            </button>
          </div>
        ) : activity.enabled && activity.permission === "denied" ? (
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
        {activity.notificationError ? (
          <p className="mobile-form-error mobile-settings-note" role="status">
            {activity.notificationError}
          </p>
        ) : null}
      </Group>
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
          <SettingsIcon tone="purple">
            <Sparkles size={17} />
          </SettingsIcon>
          <label className="mobile-settings-label" htmlFor="mobile-glass-effect">
            {t("Effect")}
          </label>
          <MobileSelect
            id="mobile-glass-effect"
            label={t("Effect")}
            value={glass.effect}
            open={preferencePanel === "glass"}
            onOpenChange={(open) => onPreferencePanelChange(open ? "glass" : null)}
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
            <SettingsIcon tone="orange">
              <Gauge size={17} />
            </SettingsIcon>
          }
          label={t("Intensity")}
          value={glass.intensity}
          disabled={glass.effect === "solid"}
          onChange={(intensity) => onGlassChange({ ...glass, intensity })}
        />
        <GlassSlider
          id="mobile-glass-transparency"
          icon={
            <SettingsIcon tone="cyan">
              <Eye size={17} />
            </SettingsIcon>
          }
          label={t("Transparency")}
          value={glass.transparency}
          disabled={glass.effect === "solid"}
          onChange={(transparency) => onGlassChange({ ...glass, transparency })}
        />
      </Group>
      <Group title="About">
        <button
          type="button"
          className="mobile-settings-row"
          onClick={() => onPageChange("updates")}
        >
          <SettingsIcon tone="gray">
            <ArrowDownCircle size={17} />
          </SettingsIcon>
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
