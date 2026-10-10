// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getUiLanguage,
  loadUiLanguage,
  refreshUiLanguage,
  resolveUiLanguage,
  setUiLanguage,
  subscribeUiLanguage,
  translate,
  UI_LANGUAGE_KEY,
} from "./language";
import {
  searchSettings,
  settingsSectionsByGroup,
  filterKeybindings,
  KEYBINDINGS,
} from "../../features/settings/model/settings";
import {
  HARNESS_LABEL,
  sessionDisplayTitle,
} from "../../features/sessions/model/session";

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
  refreshUiLanguage();
});
afterEach(() => {
  vi.restoreAllMocks();
  setUiLanguage("en");
  localStorage.clear();
});

describe("interface language", () => {
  it("uses Chinese system locales and keeps explicit English after a restart", () => {
    expect(resolveUiLanguage("zh-TW")).toBe("zh-CN");
    expect(resolveUiLanguage("zh_Hans_CN")).toBe("zh-CN");
    expect(resolveUiLanguage("fr-FR")).toBe("en");
    vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
    localStorage.setItem(UI_LANGUAGE_KEY, "invalid");
    expect(loadUiLanguage()).toBe("zh-CN");
    setUiLanguage("en");
    refreshUiLanguage();
    expect(getUiLanguage()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("notifies subscribers once and stays usable when persistence is unavailable", () => {
    const changed = vi.fn();
    const unsubscribe = subscribeUiLanguage(changed);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setUiLanguage("zh-CN");
    setUiLanguage("zh-CN");
    expect(getUiLanguage()).toBe("zh-CN");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(changed).toHaveBeenCalledTimes(1);
    unsubscribe();
    setUiLanguage("en");
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it("updates existing windows when another window changes or clears the preference", () => {
    const changed = vi.fn();
    const unsubscribe = subscribeUiLanguage(changed);
    localStorage.setItem(UI_LANGUAGE_KEY, "zh-CN");
    window.dispatchEvent(
      new StorageEvent("storage", { key: UI_LANGUAGE_KEY, newValue: "zh-CN" }),
    );
    expect(translate("Settings")).toBe("设置");
    localStorage.clear();
    window.dispatchEvent(new StorageEvent("storage", { key: null }));
    expect(translate("Settings")).toBe("Settings");
    expect(changed).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it("preserves interpolated project names, unknown text, and protocol commands", () => {
    setUiLanguage("zh-CN");
    expect(
      translate("What should we work on in {project}?", {
        project: "Settings <测试> {project}",
      }),
    ).toBe("我们在 Settings <测试> {project} 中做些什么？");
    expect(translate("/operator /plan ~/projects/code")).toBe(
      "/operator /plan ~/projects/code",
    );
    expect(translate("toString")).toBe("toString");
    expect(translate("Unknown {value}", { value: "原文" })).toBe(
      "Unknown 原文",
    );
    expect(translate("Settings", undefined, "en")).toBe("Settings");
    expect(sessionDisplayTitle(HARNESS_LABEL.codex, "codex")).toBe("新会话");
    expect(sessionDisplayTitle("Settings", "codex")).toBe("Settings");
  });

  it("finds translated settings and commands without changing their stable IDs", () => {
    setUiLanguage("zh-CN");
    expect(searchSettings("界面语言")[0]).toMatchObject({
      settingId: "ui-language",
      section: "general",
      label: "界面语言",
    });
    expect(searchSettings("language")[0]?.settingId).toBe("ui-language");
    expect(
      searchSettings("侧栏透明度").some(
        (row) => row.settingId === "sidebar-opacity",
      ),
    ).toBe(true);
    expect(settingsSectionsByGroup()[0]).toMatchObject({
      id: "app",
      label: "应用",
    });
    expect(filterKeybindings(KEYBINDINGS, "应用：设置")[0]?.command).toBe(
      "App: Settings",
    );
  });
});
