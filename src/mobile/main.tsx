import "./browserCrypto";
import { createRoot } from "react-dom/client";
import { MobileApp } from "./MobileApp";
import { installLiquidGlass } from "./liquidGlass";
import { installKeyboardMotion } from "./keyboardMotion";
import { applyGlassSettings, readGlassSettings } from "./glassSettings";
import { refreshUiLanguage } from "../shared/i18n/language";
import "../styles/index.css";
import "./mobile.css";

refreshUiLanguage();
installKeyboardMotion();
applyGlassSettings(readGlassSettings());

createRoot(document.getElementById("root")!, {
  onRecoverableError(error) {
    console.error(
      "[monocode mobile] render recovery",
      error instanceof Error && "cause" in error ? error.cause : error,
    );
  },
}).render(<MobileApp />);

// Popovers portal to the body, so watch it rather than the React root.
installLiquidGlass(document.body);
