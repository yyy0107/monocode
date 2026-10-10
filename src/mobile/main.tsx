import "./browserCrypto";
import { createRoot } from "react-dom/client";
import { MobileApp } from "./MobileApp";
import { installLiquidGlass } from "./liquidGlass";
import { installKeyboardMotion } from "./keyboardMotion";
import { applyGlassSettings, readGlassSettings } from "./glassSettings";
import { refreshUiLanguage } from "../shared/i18n/language";
import { disableStatusToasts } from "../shared/ui/StatusToast";
import {
  applyAccentColor,
  loadAccentColor,
  applyThemePreference,
  loadThemePreference,
  applyThemeTint,
  loadThemeHue,
  loadThemeSaturation,
  applyThemeDarkLightness,
  loadThemeDarkLightness,
  applyChatBackground,
  loadChatBackgroundPath,
  applyChatBackgroundEmptyOpacity,
  loadChatBackgroundEmptyOpacity,
  applyChatBackgroundSessionOpacity,
  loadChatBackgroundSessionOpacity,
  applyChatBackgroundScope,
  loadChatBackgroundScope,
} from "../features/settings/model/appearance";
import { initSounds } from "../features/settings/model/sounds";
import { initTypography } from "../features/settings/model/typography";
import { subscribeSharedPreferences } from "../features/settings/model/sharedPreferences";
import { parsePreferenceAsset } from "../features/settings/model/preferenceAssets";
import "../styles/index.css";
import "./mobile.css";
import "./motion.css";

refreshUiLanguage();
disableStatusToasts();
installKeyboardMotion();
applyGlassSettings(readGlassSettings());
applyAccentColor(loadAccentColor());
applyThemePreference(loadThemePreference());
initSounds();
initTypography();
const applyBackground = () => {
  const path = loadChatBackgroundPath();
  applyChatBackground(path && parsePreferenceAsset(path) ? path : null);
  applyChatBackgroundEmptyOpacity(loadChatBackgroundEmptyOpacity());
  applyChatBackgroundSessionOpacity(loadChatBackgroundSessionOpacity());
  applyChatBackgroundScope(loadChatBackgroundScope());
};
applyBackground();
subscribeSharedPreferences(() => {
  refreshUiLanguage();
  initTypography();
  initSounds();
  applyAccentColor(loadAccentColor());
  applyThemeTint(loadThemeHue(), loadThemeSaturation());
  applyThemeDarkLightness(loadThemeDarkLightness());
  applyBackground();
});

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
