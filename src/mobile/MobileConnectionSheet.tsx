import {
  Internet,
  LoaderCircle,
  PairingCode,
  ScanQrCode,
} from "../shared/ui/icons";
import { useRef, useState, type CSSProperties, type RefObject } from "react";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet } from "./MobileSheet";
import { MobileSwap } from "./MobileSwap";
import { MobileQrScanner } from "./MobileQrScanner";
import { parsePairingOffer } from "./pairing";

type Method = "scan" | "code";

const METHODS: { id: Method; label: string; Icon: typeof ScanQrCode }[] = [
  { id: "scan", label: "Scan", Icon: ScanQrCode },
  { id: "code", label: "Pairing code", Icon: PairingCode },
];

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
  onConnectWith,
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
  /** Connect with the Host URL and pairing code read from a QR code. */
  onConnectWith: (credentials: { url: string; token: string }) => void;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation();
  const [method, setMethod] = useState<Method>("scan");
  // Unset until the first switch, so the panel does not animate on open.
  const [direction, setDirection] = useState<"forward" | "back">();
  const methodIndex = METHODS.findIndex(({ id }) => id === method);
  const [scanError, setScanError] = useState("");
  // A failed connection restarts the camera; do not resubmit the same QR code
  // in a loop. Switching methods allows that code to be scanned again.
  const scanned = useRef("");
  const shownError = method === "scan" ? scanError || error : error;
  return (
    <MobileSheet
      open={open}
      onExited={onExited}
      title="Add connection"
      header={{ title: t("Add connection") }}
      anchor={anchor}
      surface="solid"
      onClose={onClose}
    >
      <div className="mobile-pairing">
        <div
          className="mobile-pairing-methods mobile-segmented"
          role="tablist"
          aria-label={t("Connection method")}
          data-direction={direction}
          style={
            {
              "--segment-count": METHODS.length,
              "--segment-index": methodIndex,
            } as CSSProperties
          }
        >
          <span className="mobile-segmented-indicator" aria-hidden="true" />
          {METHODS.map(({ id, label, Icon }, index) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`mobile-pairing-tab-${id}`}
              aria-controls="mobile-pairing-panel"
              aria-selected={method === id}
              disabled={disabled}
              onClick={() => {
                if (id !== method)
                  setDirection(index > methodIndex ? "forward" : "back");
                setMethod(id);
                setScanError("");
                scanned.current = "";
              }}
            >
              <Icon size={18} />
              <span>{t(label)}</span>
            </button>
          ))}
        </div>
        <div
          key={method}
          data-content-enter={direction}
          id="mobile-pairing-panel"
          role="tabpanel"
          aria-labelledby={`mobile-pairing-tab-${method}`}
          className="mobile-pairing-panel"
        >
          {method === "scan" && (
            <>
              <MobileQrScanner
                active={open && !disabled}
                onDetected={(text) => {
                  if (text === scanned.current) return;
                  scanned.current = text;
                  try {
                    const offer = parsePairingOffer(text);
                    setScanError("");
                    onConnectWith({ url: offer.host, token: offer.token });
                  } catch (problem) {
                    setScanError(
                      t(problem instanceof Error ? problem.message : String(problem)),
                    );
                  }
                }}
              />
              <p className="mobile-muted mobile-pairing-hint">
                {disabled
                  ? t("Connecting…")
                  : t("Scan the QR code shown by MonoCode Host on your computer.")}
              </p>
            </>
          )}
          {method === "code" && (
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
                {t("Pairing code")}
                <input
                  className="mobile-pairing-code"
                  placeholder="XD5J-2J3U"
                  value={token}
                  onChange={(event) => onTokenChange(event.target.value)}
                  autoCapitalize="characters"
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
                <MobileSwap swapKey={disabled ? "busy" : "idle"}>
                  {disabled ? (
                    <LoaderCircle size={16} className="mobile-spin" />
                  ) : (
                    <Internet size={16} />
                  )}
                  {t(disabled ? "Connecting…" : "Connect")}
                </MobileSwap>
              </button>
            </form>
          )}
          {method === "scan" && shownError && (
            <>
              <p className="mobile-form-error" role="alert">
                {shownError}
              </p>
              <button
                type="button"
                className="mobile-button"
                disabled={disabled}
                onClick={() => {
                  scanned.current = "";
                  setScanError("");
                }}
              >
                {t("Scan again")}
              </button>
            </>
          )}
        </div>
      </div>
    </MobileSheet>
  );
}
