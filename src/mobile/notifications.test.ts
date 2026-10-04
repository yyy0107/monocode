// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { setUiLanguage } from "../shared/i18n/language";
import { mobileNotificationTexts } from "./notifications";

afterEach(() => {
  setUiLanguage("en");
  localStorage.clear();
});

it("updates native Remote status when language changes and preserves the computer name", () => {
  const host = "wy-ubuntu <工作站> {host}";
  setUiLanguage("en");
  expect(mobileNotificationTexts(host).connected).toBe(`Connected to ${host}`);
  setUiLanguage("zh-CN");
  const texts = mobileNotificationTexts(host);
  expect(texts.remote).toBe("Remote");
  expect(texts.connected).toBe(`已连接到 ${host}`);
  expect(texts.reconnecting).toBe(`正在重新连接到 ${host}`);
  expect(texts.reply).toBe("收到了一条新回复。");
});
