import { setLiquidGlassRefraction } from "./liquidGlass";
import { activePreferenceStore, preferenceStorage } from "../features/settings/model/sharedPreferences";

/** Material for floating controls, sheets, drawers and popovers. */
export type GlassEffect = "liquid" | "frosted" | "solid";

export interface GlassSettings {
  effect: GlassEffect;
  /** 0–100: refraction, highlights and blur for the chosen effect. */
  intensity: number;
  /** 0–100: how much of the background shows through. */
  transparency: number;
}

export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
  effect: "liquid",
  intensity: 50,
  transparency: 78,
};

export const GLASS_SETTINGS_KEY = "monocode.mobileGlass";

const EFFECTS: readonly GlassEffect[] = ["liquid", "frosted", "solid"];

function percent(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(0, value)))
    : fallback;
}

export function normalizeGlassSettings(value: unknown): GlassSettings {
  const input =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof GlassSettings, unknown>>)
      : {};
  return {
    effect: EFFECTS.includes(input.effect as GlassEffect)
      ? (input.effect as GlassEffect)
      : DEFAULT_GLASS_SETTINGS.effect,
    intensity: percent(input.intensity, DEFAULT_GLASS_SETTINGS.intensity),
    transparency: percent(
      input.transparency,
      DEFAULT_GLASS_SETTINGS.transparency,
    ),
  };
}

export function readGlassSettings(): GlassSettings {
  try {
    return normalizeGlassSettings(
      JSON.parse(preferenceStorage.getItem(GLASS_SETTINGS_KEY)
        ?? (activePreferenceStore() ? null : localStorage.getItem("monocode-mobile-glass")) ?? "null"),
    );
  } catch {
    return DEFAULT_GLASS_SETTINGS;
  }
}

export function saveGlassSettings(settings: GlassSettings) {
  try {
    preferenceStorage.setItem(GLASS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable; the material still applies for this run.
  }
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * CSS variables for a setting. Floating controls use the chosen fill and
 * blur; panels full of text (sheets, drawer, popovers) close part of the
 * remaining fill and blur harder so lists stay readable at the same setting.
 */
export function glassVariables(settings: GlassSettings) {
  const k = settings.intensity / 100;
  const solid = settings.effect === "solid";
  const fill = solid ? 100 : 100 - settings.transparency;
  const panelFill = solid ? 100 : fill + (100 - fill) * 0.45;
  const blur =
    settings.effect === "liquid" ? 1 + 4 * k : settings.effect === "frosted" ? 4 + 36 * k : 0;
  const panelBlur = settings.effect === "liquid" ? blur + 12 : blur;
  const shine =
    settings.effect === "liquid" ? 0.3 + 1.4 * k : settings.effect === "frosted" ? 0.25 + 0.5 * k : 0;
  const saturation =
    settings.effect === "liquid" ? 100 + 200 * k : settings.effect === "frosted" ? 120 + 100 * k : 100;
  return {
    "--mobile-glass-fill": `${round(fill)}%`,
    "--mobile-glass-panel-fill": `${round(panelFill)}%`,
    "--mobile-glass-blur": `${round(blur)}px`,
    "--mobile-glass-panel-blur": `${round(panelBlur)}px`,
    "--mobile-glass-shine": String(round(shine)),
    "--mobile-glass-saturation": `${round(saturation)}%`,
  };
}

/** Edge refraction multiplier: only Liquid glass bends the backdrop. */
export function glassRefraction(settings: GlassSettings) {
  return settings.effect === "liquid" ? round((settings.intensity / 100) * 2) : 0;
}

export function applyGlassSettings(
  settings: GlassSettings,
  root: HTMLElement = document.documentElement,
) {
  root.dataset.mobileGlass = settings.effect;
  for (const [name, value] of Object.entries(glassVariables(settings)))
    root.style.setProperty(name, value);
  setLiquidGlassRefraction(glassRefraction(settings));
}
