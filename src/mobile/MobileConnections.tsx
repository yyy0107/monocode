import { MobileSettingsGlyph } from "./MobileSettingsIcon";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Pencil,
  Trash2,
  X,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet, type MobileSheetPoint } from "./MobileSheet";
import { MobileHostStatus } from "./MobileHostStatus";
import type { HostConnectionStatus } from "./client";
import type { MobilePreferencePanel } from "./MobileSettings";
import {
  CONNECTION_ICONS,
  type ConnectionAppearance,
} from "./connectionAppearance";

const iconNames = {
  code: "Code",
  terminal: "Terminal",
  laptop: "Laptop",
  desktop: "Desktop",
};
export type SettingsConnection = {
  name: string;
  endpoint: string;
  environmentId?: string;
  disabled?: boolean;
};

export function MobileConnections({
  connection,
  appearance,
  hostStatus,
  disabled,
  panel,
  onPanelChange,
  onSave,
  onDisconnect,
  onReconnect,
  onDelete,
  addConnection,
}: {
  connection?: SettingsConnection;
  appearance: ConnectionAppearance;
  hostStatus: HostConnectionStatus;
  disabled: boolean;
  panel: MobilePreferencePanel;
  onPanelChange: (panel: MobilePreferencePanel) => void;
  onSave: (value: ConnectionAppearance) => void;
  onDisconnect: () => Promise<void>;
  onDelete: () => Promise<void>;
  onReconnect: () => void;
  addConnection: ReactNode;
}) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  const lastConnection = useRef(connection);
  if (connection) lastConnection.current = connection;
  const details = connection ?? lastConnection.current;
  const name = appearance.displayName || details?.name || "";
  const [point, setPoint] = useState<MobileSheetPoint>();
  const [draft, setDraft] = useState<ConnectionAppearance>(appearance);
  const [error, setError] = useState("");
  const hold = useRef<
    { x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined
  >(undefined);
  const cancelHold = () => {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = undefined;
  };
  useEffect(() => {
    cancelHold();
    return cancelHold;
  }, [connection?.environmentId, disabled, panel]);
  const openMenu = (position?: MobileSheetPoint) => {
    cancelHold();
    if (disabled || !connection) return;
    setPoint(position);
    setError("");
    onPanelChange("connection-menu");
  };
  const edit = () => {
    setDraft({ displayName: name, icon: appearance.icon });
    setError("");
    onPanelChange("connection-edit");
  };
  const close = () => {
    if (!disabled) onPanelChange(null);
  };
  const changed =
    draft.displayName.trim() !== name || draft.icon !== appearance.icon;
  const header = (title: string) => (
    <div className="mobile-connection-editor-header">
      <h2>{t(title)}</h2>
      <button
        type="button"
        className="mobile-icon-button"
        aria-label={t("Close")}
        disabled={disabled}
        onClick={close}
      >
        <X size={24} />
      </button>
    </div>
  );

  return (
    <>
      <section className="mobile-settings-group" aria-label={t("Connections")}>
        <h2>{t("Connection")}</h2>
        <ul className="mobile-connection-list">
          {connection && (
            <li className="mobile-settings-row mobile-connection-row mobile-connection-device">
              <button
                ref={trigger}
                type="button"
                className="mobile-connection-details"
                aria-label={t("Connection options for {host}", { host: name })}
                aria-haspopup="dialog"
                aria-expanded={panel === "connection-menu"}
                disabled={disabled}
                onPointerDown={(event) => {
                  cancelHold();
                  if (event.button !== 0) return;
                  const x = event.clientX,
                    y = event.clientY;
                  hold.current = {
                    x,
                    y,
                    timer: setTimeout(() => openMenu({ x, y }), 450),
                  };
                }}
                onPointerMove={(event) => {
                  if (
                    hold.current &&
                    Math.hypot(
                      event.clientX - hold.current.x,
                      event.clientY - hold.current.y,
                    ) > 10
                  )
                    cancelHold();
                }}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openMenu(
                    event.clientX || event.clientY
                      ? { x: event.clientX, y: event.clientY }
                      : undefined,
                  );
                }}
                onClick={(event) => {
                  if (event.detail === 0) openMenu();
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "ContextMenu" ||
                    (event.shiftKey && event.key === "F10")
                  ) {
                    event.preventDefault();
                    openMenu();
                  }
                }}
              >
                <MobileSettingsGlyph name={appearance.icon} />
                <span className="mobile-settings-label">
                  <span className="mobile-connection-name" title={name}>
                    {name}
                  </span>
                  <small>
                    {hostStatus.state === "connected" ? (
                      t("Connected")
                    ) : (
                      <MobileHostStatus status={hostStatus} />
                    )}
                  </small>
                </span>
              </button>
              <label className="mobile-connection-toggle">
                <input
                  type="checkbox"
                  role="switch"
                  className="mobile-switch"
                  aria-label={t("Connection to {host}", { host: name })}
                  checked={connection.disabled !== true}
                  disabled={disabled}
                  onChange={(event) => {
                    if (event.currentTarget.checked) onReconnect();
                    else void onDisconnect().catch(() => {});
                  }}
                />
              </label>
            </li>
          )}
          <li>{addConnection}</li>
        </ul>
      </section>
      <MobileSheet
        open={!!connection && panel === "connection-menu"}
        title="Connection options"
        placement="anchor"
        anchor={trigger}
        anchorPoint={point}
        width={220}
        onClose={close}
      >
        <div className="mobile-connection-menu">
          <p className="mobile-connection-menu-name">{name}</p>
          <button
            type="button"
            className="mobile-sheet-row"
            disabled={disabled}
            onClick={edit}
          >
            <Pencil size={22} />
            <span>{t("Edit")}</span>
          </button>
          <button
            type="button"
            className="mobile-sheet-row mobile-menu-danger"
            disabled={disabled}
            onClick={() => {
              setError("");
              onPanelChange("connection-delete");
            }}
          >
            <Trash2 size={22} />
            <span>{t("Delete")}</span>
          </button>
        </div>
      </MobileSheet>
      <MobileSheet
        open={!!connection && panel === "connection-edit"}
        title="Edit connection"
        anchor={trigger}
        onClose={close}
      >
        <form
          className="mobile-connection-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (disabled || !changed || !draft.displayName.trim()) return;
            try {
              onSave({ ...draft, displayName: draft.displayName.trim() });
              close();
            } catch {
              setError(t("Could not save connection preferences. Try again."));
            }
          }}
        >
          {header("Edit connection")}
          <label className="mobile-connection-name-field">
            <span>{t("Display name")}</span>
            <input
              value={draft.displayName}
              maxLength={100}
              required
              disabled={disabled}
              onChange={(event) =>
                setDraft({ ...draft, displayName: event.target.value })
              }
            />
          </label>
          <div
            className="mobile-connection-icons"
            role="group"
            aria-label={t("Connection icon")}
          >
            {CONNECTION_ICONS.map((icon) => {
              return (
                <button
                  key={icon}
                  type="button"
                  aria-label={t(iconNames[icon])}
                  aria-pressed={draft.icon === icon}
                  disabled={disabled}
                  onClick={() => setDraft({ ...draft, icon })}
                >
                  <MobileSettingsGlyph name={icon} />
                </button>
              );
            })}
          </div>
          <dl className="mobile-connection-info">
            <div>
              <dt>{t("Host name")}</dt>
              <dd>{details?.name}</dd>
            </div>
            <div>
              <dt>{t("Type")}</dt>
              <dd>MonoCode Host</dd>
            </div>
            <div>
              <dt>{t("Host URL")}</dt>
              <dd>{details?.endpoint}</dd>
            </div>
          </dl>
          {error && (
            <p className="mobile-form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="mobile-button mobile-primary mobile-connection-editor-action"
            type="submit"
            disabled={disabled || !changed || !draft.displayName.trim()}
          >
            {t("Save")}
          </button>
          <button
            className="mobile-button mobile-connection-editor-action mobile-connection-delete"
            type="button"
            disabled={disabled}
            onClick={() => {
              setError("");
              onPanelChange("connection-delete");
            }}
          >
            {t("Delete connection")}
          </button>
        </form>
      </MobileSheet>
      <MobileSheet
        open={!!connection && panel === "connection-delete"}
        title="Delete connection"
        anchor={trigger}
        onClose={close}
      >
        <div className="mobile-connection-editor">
          {header("Delete connection")}
          <p>
            {t(
              "Remove {host} from this device? Sessions on the Host will keep running.",
              { host: name },
            )}
          </p>
          {error && (
            <p className="mobile-form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="mobile-button mobile-connection-editor-action mobile-connection-delete"
            disabled={disabled}
            onClick={() => {
              void onDelete()
                .then(() => onPanelChange(null))
                .catch(() =>
                  setError(t("Could not delete the connection. Try again.")),
                );
            }}
          >
            {t("Delete connection")}
          </button>
          <button
            className="mobile-button mobile-connection-editor-action"
            disabled={disabled}
            onClick={close}
          >
            {t("Cancel")}
          </button>
        </div>
      </MobileSheet>
    </>
  );
}
