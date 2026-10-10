// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyFontSize,
  enableSeparateSchemes,
  initTypography,
  loadFontSize,
  loadProfile,
  loadReducedMotion,
  saveFontSize,
  saveProfile,
  saveReducedMotion,
  saveSeparateSchemes,
} from "./typography";
import {
  loadAccentColor,
  SCHEME_CHANGE_EVENT,
  saveAccentColor,
} from "./appearance";
import {
  prefersReducedMotion,
  reducedMotionQuery,
} from "../../../shared/lib/reducedMotion";

const root = () => document.documentElement;

beforeEach(() => {
  localStorage.clear();
  root().removeAttribute("style");
  root().className = "";
  delete root().dataset.reducedMotion;
});

afterEach(() => vi.restoreAllMocks());

describe("font sizes", () => {
  it("clamps, rounds and falls back to the default", () => {
    expect(loadFontSize("ui")).toBe(14);
    expect(saveFontSize("ui", 30)).toBe(20);
    expect(loadFontSize("ui")).toBe(20);
    expect(saveFontSize("code", 9.6)).toBe(10);
    localStorage.setItem("monocode.contentFontSize", "abc");
    expect(loadFontSize("content")).toBe(14);
  });

  it("exposes each size as a scale of its base", () => {
    applyFontSize("ui", 16);
    applyFontSize("code", 15);
    expect(root().style.getPropertyValue("--ui-font-scale")).toBe("1.1429");
    expect(root().style.getPropertyValue("--code-font-scale")).toBe("1.25");
  });

  it("keeps the default when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadFontSize("code")).toBe(12);
    expect(loadReducedMotion()).toBe("system");
  });
});

describe("reduced motion override", () => {
  it("wins over the system preference in both directions", () => {
    const listener = vi.fn();
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const query = reducedMotionQuery();
    query.addEventListener("change", listener);

    expect(prefersReducedMotion()).toBe(true);
    saveReducedMotion("off");
    initTypography();
    expect(root().dataset.reducedMotion).toBe("off");
    expect(query.matches).toBe(false);
    expect(listener).toHaveBeenCalled();

    saveReducedMotion("system");
    initTypography();
    expect(root().dataset.reducedMotion).toBeUndefined();
    expect(query.matches).toBe(true);
    query.removeEventListener("change", listener);
  });
});

describe("appearance profiles", () => {
  it("keeps shared colour in the original keys", () => {
    saveAccentColor("#123456");
    const shared = loadProfile("shared");
    expect(shared.accentColor).toBe("#123456");
    saveProfile("shared", { ...shared, accentColor: "#abcdef", contrast: 80 });
    expect(loadAccentColor()).toBe("#abcdef");
    expect(loadProfile("shared").contrast).toBe(80);
  });

  it("sanitizes font names and rejects unknown weights", () => {
    const next = saveProfile("dark", {
      ...loadProfile("dark"),
      codeFont: 'Evil"; } body { color: red',
      uiWeight: 450 as never,
    });
    expect(next.codeFont).toBe("Evil  body  color: red");
    expect(next.uiWeight).toBe(500);
  });

  it("starts both modes from the shared look and follows the active mode", () => {
    saveProfile("shared", { ...loadProfile("shared"), contrast: 70 });
    enableSeparateSchemes();
    expect(loadProfile("light").contrast).toBe(70);
    expect(loadProfile("dark").contrast).toBe(70);

    saveProfile("light", { ...loadProfile("light"), contrast: 100 });
    initTypography();
    expect(root().style.getPropertyValue("--contrast-offset")).toBe("0.4");

    root().classList.add("theme-light");
    window.dispatchEvent(new CustomEvent(SCHEME_CHANGE_EVENT));
    expect(root().style.getPropertyValue("--contrast-offset")).toBe("1");

    saveSeparateSchemes(false);
    window.dispatchEvent(new CustomEvent(SCHEME_CHANGE_EVENT));
    // Turning separate modes off leaves the next apply to the caller.
    expect(loadProfile("shared").contrast).toBe(70);
  });

  it("writes font stacks as optional prefixes", () => {
    saveProfile("shared", {
      ...loadProfile("shared"),
      contentFont: "Inter",
      codeFont: "",
    });
    initTypography();
    expect(root().style.getPropertyValue("--user-content-font")).toBe(
      '"Inter",',
    );
    expect(root().style.getPropertyValue("--user-code-font")).toBe("");
  });
});
