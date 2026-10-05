import type { RefObject } from "react";
import { Internet, Settings } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet } from "./MobileSheet";

export function MobileHomeMenu({
  open,
  anchor,
  onClose,
  onAddConnection,
  onSettings,
}: {
  open: boolean;
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onAddConnection: () => void;
  onSettings: () => void;
}) {
  const { t } = useTranslation();
  return (
    <MobileSheet
      open={open}
      title="Home menu"
      placement="anchor"
      anchor={anchor}
      align="center"
      side="bottom"
      overlapAnchor
      constrainWidthToAnchor
      width={180}
      onClose={onClose}
    >
      <button
        type="button"
        className="mobile-sheet-row"
        onClick={onAddConnection}
      >
        <Internet size={20} />
        <span>{t("Add connection")}</span>
      </button>
      <button type="button" className="mobile-sheet-row" onClick={onSettings}>
        <Settings size={20} />
        <span>{t("Settings")}</span>
      </button>
    </MobileSheet>
  );
}
