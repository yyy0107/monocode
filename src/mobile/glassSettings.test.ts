import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_GLASS_SETTINGS,
  GLASS_SETTINGS_KEY,
  glassRefraction,
  glassVariables,
  normalizeGlassSettings,
  readGlassSettings,
  saveGlassSettings,
} from "./glassSettings";

function installStorage(initial: Record<string, string> = {}, fail = false) {
  const values = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        if (fail) throw new Error("blocked");
        return values.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (fail) throw new Error("blocked");
        values.set(key, value);
      },
    },
  });
  return values;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("mobile glass settings", () => {
  it("keeps valid values and repairs invalid ones", () => {
    expect(
      normalizeGlassSettings({ effect: "frosted", intensity: 130, transparency: -4.6 }),
    ).toEqual({ effect: "frosted", intensity: 100, transparency: 0 });
    expect(normalizeGlassSettings({ effect: "neon", intensity: "50" })).toEqual(
      DEFAULT_GLASS_SETTINGS,
    );
    expect(normalizeGlassSettings(null)).toEqual(DEFAULT_GLASS_SETTINGS);
  });

  it("persists settings and survives broken or blocked storage", () => {
    const values = installStorage();
    saveGlassSettings({ effect: "solid", intensity: 20, transparency: 40 });
    expect(JSON.parse(values.get(GLASS_SETTINGS_KEY)!)).toEqual({
      effect: "solid",
      intensity: 20,
      transparency: 40,
    });
    expect(readGlassSettings()).toEqual({
      effect: "solid",
      intensity: 20,
      transparency: 40,
    });

    installStorage({ [GLASS_SETTINGS_KEY]: "{not json" });
    expect(readGlassSettings()).toEqual(DEFAULT_GLASS_SETTINGS);

    installStorage({}, true);
    expect(readGlassSettings()).toEqual(DEFAULT_GLASS_SETTINGS);
    expect(() => saveGlassSettings(DEFAULT_GLASS_SETTINGS)).not.toThrow();
  });

  it("maps transparency to a lighter fill for controls than for panels", () => {
    const vars = glassVariables({ effect: "liquid", intensity: 50, transparency: 78 });
    expect(vars["--mobile-glass-fill"]).toBe("22%");
    expect(vars["--mobile-glass-panel-fill"]).toBe("57.1%");
    expect(
      glassVariables({ effect: "liquid", intensity: 50, transparency: 100 })[
        "--mobile-glass-fill"
      ],
    ).toBe("0%");
  });

  it("scales the material with intensity for each effect", () => {
    const liquid = glassVariables({ effect: "liquid", intensity: 50, transparency: 78 });
    expect(liquid["--mobile-glass-blur"]).toBe("3px");
    expect(liquid["--mobile-glass-panel-blur"]).toBe("15px");
    expect(liquid["--mobile-glass-shine"]).toBe("1");
    expect(liquid["--mobile-glass-saturation"]).toBe("200%");
    const frosted = glassVariables({ effect: "frosted", intensity: 100, transparency: 78 });
    expect(frosted["--mobile-glass-blur"]).toBe("40px");
    expect(frosted["--mobile-glass-panel-blur"]).toBe("40px");
    const solid = glassVariables({ effect: "solid", intensity: 100, transparency: 100 });
    expect(solid["--mobile-glass-fill"]).toBe("100%");
    expect(solid["--mobile-glass-panel-fill"]).toBe("100%");
    expect(solid["--mobile-glass-blur"]).toBe("0px");
    expect(solid["--mobile-glass-shine"]).toBe("0");
  });

  it("refracts only with Liquid glass", () => {
    expect(glassRefraction({ effect: "liquid", intensity: 50, transparency: 78 })).toBe(1);
    expect(glassRefraction({ effect: "liquid", intensity: 0, transparency: 78 })).toBe(0);
    expect(glassRefraction({ effect: "liquid", intensity: 100, transparency: 78 })).toBe(2);
    expect(glassRefraction({ effect: "frosted", intensity: 100, transparency: 78 })).toBe(0);
  });
});
