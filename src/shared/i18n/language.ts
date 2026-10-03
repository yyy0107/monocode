import chinese from "./zh-CN.json";

export type UiLanguage = "en" | "zh-CN";
export type TranslationValues = Record<string, string | number>;

export const UI_LANGUAGE_KEY = "monocode.uiLanguage";
const translations: Readonly<Record<string, string>> = chinese;
const listeners = new Set<() => void>();
let language: UiLanguage | null = null;

export function resolveUiLanguage(value: unknown): UiLanguage {
  return typeof value === "string" && /^zh(?:[-_]|$)/i.test(value)
    ? "zh-CN"
    : "en";
}

export function loadUiLanguage(): UiLanguage {
  try {
    const saved = localStorage.getItem(UI_LANGUAGE_KEY);
    if (saved === "en" || saved === "zh-CN") return saved;
  } catch {
    // Storage can be unavailable in private windows.
  }
  return resolveUiLanguage(
    typeof navigator === "undefined" ? "en" : navigator.language,
  );
}

export function getUiLanguage(): UiLanguage {
  return (language ??= loadUiLanguage());
}

function applyLanguage(next: UiLanguage) {
  if (typeof document !== "undefined") document.documentElement.lang = next;
  if (language === next) return;
  language = next;
  for (const listener of listeners) listener();
}

export function setUiLanguage(next: UiLanguage) {
  if (next !== "en" && next !== "zh-CN") return;
  try {
    localStorage.setItem(UI_LANGUAGE_KEY, next);
  } catch {
    // Keep the selection usable for this window even when saving fails.
  }
  applyLanguage(next);
}

export function refreshUiLanguage() {
  applyLanguage(loadUiLanguage());
}

function onStorage(event: StorageEvent) {
  if (event.key === UI_LANGUAGE_KEY || event.key === null) refreshUiLanguage();
}

export function subscribeUiLanguage(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Only application-owned UI strings are translated; unknown text passes through. */
export function translate(
  text: string,
  values?: TranslationValues,
  locale: UiLanguage = getUiLanguage(),
): string {
  const template =
    locale === "zh-CN" &&
    Object.prototype.hasOwnProperty.call(translations, text)
      ? translations[text]
      : text;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (marker, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key)
      ? String(values[key])
      : marker,
  );
}
