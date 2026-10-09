/** Wire allowlist. Caches, bearer credentials, native paths and command logs are never preferences. */
export type PreferenceKind = "flag" | "number" | "string" | "object" | "array";
const groups: Record<PreferenceKind, readonly string[]> = {
  flag: ["composerRunner", "composerEffortVisible", "tabAnimationsEnabled", "notesEnabled", "quickComposerEnabled", "liveAgentsEnabled", "closeToTray", "gridArcadeEnabled", "formatOnSave", "autosave", "menuBarVisible", "claudeHooks", "projectRailOpen", "sessionSidebarOpen", "bodyGlass", "transcriptAnchor", "showExcludedFiles", "separateSchemeAppearance", "sounds", "showRemainingUsage", "maskEmails", "notifications", "sessionsShowArchived", "projectRailOrderVersion"],
  number: ["themeHue", "themeSaturation", "themeDarkLightness", "sidebarOpacity", "popoverOpacity", "sidebarBlur", "sidebarWidth", "chatBackgroundOpacity", "chatBackgroundEmptyOpacity", "chatBackgroundSessionOpacity", "uiFontSize", "contentFontSize", "codeFontSize", "uiScale", "soundsEnabledAt"],
  string: ["followUpBehavior", "modelControls", "fileTabMode", "quickComposerShortcut", "diffViewer", "accentColor", "colorScheme", "transcriptLayout", "chatBackgroundScope", "newThreadBackgroundEffect", "changesView", "reducedMotion", "modelPickerTab", "uiLanguage", "chatBackgroundAsset"],
  object: ["keybindingOverrides", "typographyProfile", "appearanceProfile.light", "appearanceProfile.dark", "projectSidebarTabs.v1", "lastModel", "lastModelSettings", "defaultModels", "projectProviderSettings.v1", "providerAccountSelections.v1", "sessionFolders", "pinnedSessionsCollapsed", "reminderSessionsCollapsed", "sessionSidebarOrder.v1", "sessionSidebarFilters", "projectGroupAssignments", "projectNotifications.v1", "agentDefaults", "projectBackgroundAssets", "mobileGlass"],
  array: ["sidebarPinnedOrder.v1", "recentModels", "sidebarTabOrder", "sidebarSectionsCollapsed.v1", "favoriteModels", "hiddenPickerProviders", "recentProjects", "projectRailOrder", "projectRailPinned", "archivedProjects", "projectGroups", "projectTreeExpanded.v1"],
};
export const SHARED_PREFERENCE_KINDS: Readonly<Record<string, PreferenceKind>> = Object.freeze(Object.fromEntries(
  [...Object.entries(groups).flatMap(([kind, names]) => names.map(name => [`monocode.${name}`, kind as PreferenceKind])),
    ...["colors", "custom-colors", "labels", "mascots"].map(name => [`monocode:tab-group:${name}`, "object" as PreferenceKind]),
    ["monocode:tab-groups:collapsed", "array" as PreferenceKind]],
));
export const PROJECT_MAP_PREFERENCES = new Set([
  "monocode:tab-group:colors", "monocode:tab-group:custom-colors", "monocode:tab-group:labels", "monocode:tab-group:mascots",
  "monocode.projectSidebarTabs.v1", "monocode.projectProviderSettings.v1", "monocode.providerAccountSelections.v1", "monocode.sessionFolders", "monocode.pinnedSessionsCollapsed", "monocode.reminderSessionsCollapsed", "monocode.sessionSidebarOrder.v1", "monocode.projectGroupAssignments", "monocode.projectNotifications.v1", "monocode.projectBackgroundAssets",
]);
export const PROJECT_LIST_PREFERENCES = new Set([
  "monocode.sidebarPinnedOrder.v1",
  "monocode:tab-groups:collapsed",
  "monocode.recentProjects", "monocode.projectRailOrder", "monocode.projectRailPinned", "monocode.archivedProjects", "monocode.projectTreeExpanded.v1",
]);
export function preferenceField(key: string): { base: string; path: string[] } | undefined {
  const split = key.indexOf("::");
  const base = split < 0 ? key : key.slice(0, split);
  if (!Object.hasOwn(SHARED_PREFERENCE_KINDS, base)) return;
  if (split < 0) return { base, path: [] };
  if (SHARED_PREFERENCE_KINDS[base] !== "object") return;
  try {
    const path: unknown = JSON.parse(key.slice(split + 2));
    if (Array.isArray(path) && path.length > 0 && path.length <= 12 && path.every(p => typeof p === "string" && p.length <= 1024 && !["__proto__", "prototype", "constructor"].includes(p))) return { base, path };
  } catch { /* Invalid field paths must not reach object assignment. */ }
}
export const isSharedPreferenceKey = (key: string) => !!preferenceField(key);
export function validateSharedPreferenceValue(key: string, value: unknown): boolean {
  const field = preferenceField(key);
  if (!field) return false;
  if (value === null) return true;
  if (typeof value !== "string" || value.length > 512_000) return false;
  if (field.path.length) {
    try { JSON.parse(value); return true; } catch { return false; }
  }
  switch (SHARED_PREFERENCE_KINDS[field.base]) {
    case "flag": return value === "0" || value === "1";
    case "number": return value.trim() !== "" && Number.isFinite(Number(value));
    case "string": return value.length <= 4096 && !value.includes("\0");
    case "array": case "object":
      try { const parsed: unknown = JSON.parse(value); return SHARED_PREFERENCE_KINDS[field.base] === "array" ? Array.isArray(parsed) : !!parsed && typeof parsed === "object" && !Array.isArray(parsed); } catch { return false; }
  }
}
