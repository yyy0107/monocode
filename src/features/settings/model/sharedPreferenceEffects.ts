import { initAppearance, loadTranscriptAnchor, loadTranscriptLayout, loadShowExcludedFiles, TRANSCRIPT_ANCHOR_CHANGE_EVENT, TRANSCRIPT_LAYOUT_CHANGE_EVENT, SHOW_EXCLUDED_FILES_CHANGE_EVENT } from "./appearance";
import { initTypography } from "./typography";
import { initSounds, loadSoundsEnabled, SOUNDS_CHANGE_EVENT } from "./sounds";
import { refreshUiLanguage } from "../../../shared/i18n/language";
import * as settings from "./settings";
import { SHARED_PREFERENCES_CHANGED } from "./sharedPreferences";

/** Replays presentation side effects only: receiving a value must never save it again. */
export function installSharedPreferenceEffects() {
  const apply = () => {
    initAppearance();
    initTypography();
    initSounds();
    refreshUiLanguage();
    const events: [string, unknown][] = [
      [TRANSCRIPT_ANCHOR_CHANGE_EVENT, loadTranscriptAnchor()],
      [TRANSCRIPT_LAYOUT_CHANGE_EVENT, loadTranscriptLayout()],
      [SHOW_EXCLUDED_FILES_CHANGE_EVENT, loadShowExcludedFiles()],
      [SOUNDS_CHANGE_EVENT, loadSoundsEnabled()],
      [settings.MODEL_CONTROLS_CHANGE_EVENT, settings.loadModelControls()],
      [settings.COMPOSER_RUNNER_CHANGE_EVENT, settings.loadComposerRunner()],
      [settings.NOTES_ENABLED_CHANGE_EVENT, settings.loadNotesEnabled()],
      [settings.LIVE_AGENTS_ENABLED_CHANGE_EVENT, settings.loadLiveAgentsEnabled()],
      [settings.GRID_ARCADE_ENABLED_CHANGE_EVENT, settings.loadGridArcadeEnabled()],
      [settings.DIFF_VIEWER_CHANGE_EVENT, settings.loadDiffViewer()],
    ];
    for (const [name, detail] of events) window.dispatchEvent(new CustomEvent(name, { detail }));
  };
  window.addEventListener(SHARED_PREFERENCES_CHANGED, apply);
  return () => window.removeEventListener(SHARED_PREFERENCES_CHANGED, apply);
}
