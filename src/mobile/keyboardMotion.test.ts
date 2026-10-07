// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import {
  anchoredTurnHeight,
  installKeyboardMotion,
  keyboardMotionRemaining,
  onKeyboardMotion,
  KEYBOARD_EVENT,
  settledEasing,
  transcriptFollow,
} from "./keyboardMotion";

const scroller = (
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
) => ({
  scrollTop,
  scrollHeight,
  clientHeight,
});

describe("transcript keyboard follow", () => {
  it("follows the whole rise when pinned to a long transcript", () => {
    expect(transcriptFollow(scroller(1200, 2000, 800), 2000, 300)).toBe(1);
  });
  it("stays put when the reader has scrolled away from the bottom", () => {
    expect(transcriptFollow(scroller(400, 2000, 800), 2000, 300)).toBe(0);
  });
  it("stops following at a long reply's top instead of hiding its beginning", () => {
    expect(transcriptFollow(scroller(1200, 2000, 800), 2000, 300, 1350)).toBe(0.5);
    expect(transcriptFollow(scroller(1200, 2000, 800), 2000, 300, 1200)).toBe(0);
  });
  it("follows only as far as a short transcript can scroll", () => {
    // 900px of content: the 500px viewport can scroll 400px, from 100px.
    expect(transcriptFollow(scroller(100, 900, 800), 900, 300)).toBe(1);
    // 600px of content: the 500px viewport can scroll 100px, from 0.
    expect(transcriptFollow(scroller(0, 800, 800), 600, 300)).toBeCloseTo(
      1 / 3,
    );
  });
  it("lowers with the keyboard as far as the taller viewport clamps the offset", () => {
    expect(transcriptFollow(scroller(1500, 2000, 500), 2000, -300)).toBe(1);
    expect(transcriptFollow(scroller(1000, 2000, 500), 2000, -300)).toBe(0);
    expect(transcriptFollow(scroller(100, 600, 500), 600, -300)).toBeCloseTo(
      1 / 3,
    );
  });
});

it("follows the active assistant only as far as its latest bubble and preserves manual scrolling", () => {
  const chat = document.createElement("div");
  chat.className = "assistant-chat";
  chat.dataset.layout = "mobile";
  const log = document.createElement("div");
  log.className = "assistant-messages";
  log.style.scrollPaddingTop = "80px";
  log.style.paddingBottom = "100px";
  const row = document.createElement("div");
  row.className = "assistant-message-row";
  log.append(row);
  chat.append(log);
  document.body.append(chat);
  Object.defineProperties(log, {
    clientHeight: { value: 800 }, scrollHeight: { value: 2000 },
  });
  log.scrollTop = 1200;
  log.getBoundingClientRect = () => new DOMRect(0, 0, 400, 800);
  row.getBoundingClientRect = () => new DOMRect(0, 230, 400, 470);
  const root = document.createElement("div");
  root.append(chat);
  document.body.append(root);
  const stop = installKeyboardMotion(root);
  const keyboard = (height: number) => window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
    detail: { height, viewport: 800, duration: 200, easing: "linear" },
  }));
  try {
    keyboard(300);
    expect(log.style.getPropertyValue("--mobile-assistant-keyboard-follow")).toBe("0.5");
    keyboard(0);
    log.dataset.followLatest = "false";
    keyboard(300);
    expect(log.style.getPropertyValue("--mobile-assistant-keyboard-follow")).toBe("0");
    keyboard(0);
    log.dataset.followLatest = "true";
    chat.inert = true;
    keyboard(300);
    expect(log.style.getPropertyValue("--mobile-assistant-keyboard-follow")).toBe("0");
  } finally {
    stop();
    root.remove();
  }
});

describe("anchored turn under the keyboard", () => {
  it("lets the keyboard cover a short reply's empty space without lifting it", () => {
    // The turn fills an 800px viewport but its prompt and reply need 200px.
    const turn = { height: 800, minHeight: 800, natural: 200 };
    const after = anchoredTurnHeight(turn, 300);
    expect(after).toBe(500);
    // Pinned, 400px above: the content shrinks with the viewport.
    expect(
      transcriptFollow(scroller(400, 1200, 800), 1200 + after - turn.height, 300),
    ).toBe(0);
  });
  it("follows only the part of the rise the reply fills", () => {
    const turn = { height: 800, minHeight: 800, natural: 650 };
    const after = anchoredTurnHeight(turn, 300);
    expect(after).toBe(650);
    expect(
      transcriptFollow(scroller(400, 1200, 800), 1200 + after - turn.height, 300),
    ).toBeCloseTo(0.5);
  });
  it("keeps a short reply in place while the keyboard lowers", () => {
    const turn = { height: 500, minHeight: 500, natural: 200 };
    const after = anchoredTurnHeight(turn, -300);
    expect(after).toBe(800);
    expect(
      transcriptFollow(scroller(400, 900, 500), 900 + after - turn.height, -300),
    ).toBe(0);
  });
});
describe("keyboard easing", () => {
  it("clamps an overshooting keyboard spring so controls settle once", () => {
    expect(settledEasing("linear(0.0000,0.6000,1.0800,1.0200,1.0000)")).toBe(
      "linear(0, 0.6, 1, 1, 1)",
    );
    expect(settledEasing("linear(-0.05, 0.5 40%, 1)")).toBe(
      "linear(0, 0.5 40%, 1)",
    );
  });
  it("leaves other curves unchanged", () => {
    expect(settledEasing("cubic-bezier(0.2, 0, 0, 1)")).toBe(
      "cubic-bezier(0.2, 0, 0, 1)",
    );
  });
});

describe("keyboard page pan", () => {
  it("undoes a WebView pan that would lift the composer twice", () => {
    const uninstall = installKeyboardMotion();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const scrollY = vi.spyOn(window, "scrollY", "get");
    try {
      scrollY.mockReturnValue(0);
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).not.toHaveBeenCalled();
      scrollY.mockReturnValue(280);
      window.dispatchEvent(new Event("scroll"));
      expect(scrollTo).toHaveBeenCalledWith(0, 0);
    } finally {
      uninstall();
      scrollTo.mockRestore();
      scrollY.mockRestore();
    }
  });
});


it("exposes remaining keyboard motion to late subscribers and honors reduced motion", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  const reduced = vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
  const uninstall = installKeyboardMotion();
  const listener = vi.fn();
  const unsubscribe = onKeyboardMotion(listener);
  const dispatch = () => window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
    detail: { height: 300, viewport: 800, duration: 200, easing: "linear" },
  }));
  try {
    dispatch();
    now = 80;
    expect(keyboardMotionRemaining()).toBe(120);
    reduced.mockReturnValue({ matches: true } as MediaQueryList);
    dispatch();
    expect(keyboardMotionRemaining()).toBe(0);
    expect(listener.mock.lastCall?.[0].duration).toBe(0);
  } finally {
    unsubscribe();
    uninstall();
    clock.mockRestore();
    reduced.mockRestore();
  }
});

it("scopes motion styles to controls, initializes late sheets without replaying motion, and releases removed surfaces", async () => {
  const root = document.createElement("div");
  const dock = document.createElement("div");
  dock.className = "mobile-composer-dock";
  const history = document.createElement("div");
  root.append(dock, history);
  const uninstall = installKeyboardMotion(root);
  try {
    window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
      detail: { height: 300, viewport: 800, duration: 200, easing: "linear" },
    }));
    expect(dock.style.getPropertyValue("--mobile-keyboard-height")).toBe("300px");
    expect(dock.style.getPropertyValue("--mobile-keyboard-duration")).toBe("200ms");
    expect(history.style.length).toBe(0);
    expect(root.style.getPropertyValue("--mobile-keyboard-height")).toBe("");
    const sheet = document.createElement("div");
    sheet.className = "mobile-sheet-backdrop";
    root.append(sheet);
    // Mutation observers run after the mount and before the next paint.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sheet.style.getPropertyValue("--mobile-keyboard-height")).toBe("300px");
    expect(sheet.style.getPropertyValue("--mobile-keyboard-duration")).toBe("0ms");
    sheet.remove();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sheet.style.length).toBe(0);
  } finally {
    uninstall();
  }
  expect(dock.style.length).toBe(0);
});


it.each(["inert", "aria-hidden"])("ignores a departing transcript marked %s when following the keyboard", (attribute) => {
  const pages = document.createElement("div");
  const layer = (inactive: boolean) => {
    const page = document.createElement("div");
    if (inactive) page.setAttribute(attribute, attribute === "aria-hidden" ? "true" : "");
    const transcript = document.createElement("div");
    transcript.className = "mobile-desktop-transcript";
    const scroller = document.createElement("div");
    scroller.className = "agent-transcript";
    const content = document.createElement("div");
    Object.defineProperty(content, "offsetHeight", { value: 1000 });
    Object.defineProperty(scroller, "clientHeight", { value: 500 });
    Object.defineProperty(scroller, "scrollHeight", { value: 1000 });
    scroller.scrollTop = inactive ? 0 : 500;
    scroller.append(content);
    transcript.append(scroller);
    page.append(transcript);
    pages.append(page);
  };
  layer(true);
  layer(false);
  document.body.append(pages);
  const root = pages;
  const uninstall = installKeyboardMotion(root);
  try {
    window.dispatchEvent(new CustomEvent(KEYBOARD_EVENT, {
      detail: { height: 300, viewport: 800, duration: 200, easing: "linear" },
    }));
    expect(pages.querySelector<HTMLElement>(".mobile-desktop-transcript")!
      .style.getPropertyValue("--mobile-keyboard-follow")).toBe("1");
  } finally {
    uninstall();
    pages.remove();
  }
});
