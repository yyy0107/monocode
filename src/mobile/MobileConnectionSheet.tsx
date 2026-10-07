import { Internet, LoaderCircle } from "../shared/ui/icons";
import type { RefObject } from "react";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet } from "./MobileSheet";

export function MobileConnectionSheet({
  open = true,
  onExited,
  url,
  token,
  disabled,
  error,
  onUrlChange,
  onTokenChange,
  onConnect,
  onClose,
  anchor,
}: {
  open?: boolean;
  onExited?: () => void;
  url: string;
  token: string;
  disabled: boolean;
  error: string;
  onUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onConnect: () => void;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <MobileSheet open={open} onExited={onExited}
      title="Add connection"
      placement="anchor"
      anchor={anchor}
      onClose={onClose}
    >
      <p className="mobile-muted">
        {t("Continue your projects and conversations from your phone.")}
      </p>
      <form
        className="mobile-form mobile-connection-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!disabled && url.trim() && token.trim()) onConnect();
        }}
      >
        <label>
          {t("Host URL")}
          <input
            type="url"
            placeholder="http://192.168.1.10:3774"
            value={url}
            onChange={(event) => onUrlChange(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            disabled={disabled}
          />
        </label>
        <label>
          {t("Device token")}
          <input
            type="password"
            placeholder={t("Paste your device token")}
            value={token}
            onChange={(event) => onTokenChange(event.target.value)}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={disabled}
          />
        </label>
        {error && (
          <p className="mobile-form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="mobile-button mobile-primary"
          type="submit"
          disabled={disabled || !url.trim() || !token.trim()}
        >
          {disabled ? (
            <LoaderCircle size={16} className="mobile-spin" />
          ) : (
            <Internet size={16} />
          )}
          {t(disabled ? "Connecting…" : "Connect by URL")}
        </button>
      </form>
    </MobileSheet>
  );
}
