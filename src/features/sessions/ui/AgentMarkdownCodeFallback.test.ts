// @vitest-environment happy-dom
import { act, createElement, lazy } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentMarkdown } from "./AgentMarkdown";
import { MarkdownDocumentPreview } from "./MarkdownDocumentPreview";

const mocked = vi.hoisted(() => ({ fail: false }));
vi.mock("streamdown", async (importOriginal) => {
  const original = await importOriginal<typeof import("streamdown")>();
  const FailedHighlight = lazy(() =>
    Promise.reject(
      new Error(
        "Failed to fetch dynamically imported module: highlighted-body.js",
      ),
    ),
  );
  return {
    ...original,
    CodeBlock: ({ code }: { code: string }) =>
      mocked.fail
        ? createElement(FailedHighlight)
        : createElement("pre", { "data-highlighted": true }, code),
  };
});

describe("code highlighting failure containment (desktop and mobile)", () => {
  let root: Root;
  let node: HTMLDivElement;
  let uncaught: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocked.fail = false;
    uncaught = vi.fn();
    node = document.createElement("div");
    document.body.append(node);
    root = createRoot(node, { onUncaughtError: uncaught });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    node.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the complete code, copy control and surrounding text when a lazy chunk rejects", async () => {
    mocked.fail = true;
    await act(async () =>
      root.render(
        createElement(AgentMarkdown, {
          text: 'Before\n\n```json\n{"name":"test", "last":true}\n```\n\nAfter',
        }),
      ),
    );
    expect(uncaught).not.toHaveBeenCalled();
    expect(node.textContent).toContain("Before");
    expect(node.textContent).toContain("After");
    expect(node.querySelector("pre")?.textContent).toBe(
      '{"name":"test", "last":true}\n',
    );
    expect(node.querySelector('button[aria-label="Copy code"]')).not.toBeNull();
  });

  it("also contains highlight failures in desktop document previews", async () => {
    mocked.fail = true;
    await act(async () =>
      root.render(
        createElement(MarkdownDocumentPreview, {
          text: "# Document\n\n```ts\nconst value = 1;\n```\n\nStill readable",
          metadataLabel: "Metadata",
          cwd: "/repo",
        }),
      ),
    );
    expect(uncaught).not.toHaveBeenCalled();
    expect(node.querySelector("pre")?.textContent).toBe("const value = 1;\n");
    expect(node.textContent).toContain("Still readable");
  });

  it("still highlights normally and keeps inline file navigation", async () => {
    const onOpenFile = vi.fn();
    await act(async () =>
      root.render(
        createElement(AgentMarkdown, {
          text: '```json\n{"ok":true}\n```\n\n`package.json`',
          cwd: "/repo",
          onOpenFile,
        }),
      ),
    );
    expect(node.querySelector("[data-highlighted]")?.textContent).toBe(
      '{"ok":true}\n',
    );
    await act(async () =>
      node.querySelector<HTMLElement>('code[role="link"]')!.click(),
    );
    expect(onOpenFile).toHaveBeenCalledWith("/repo/package.json", undefined);
    expect(uncaught).not.toHaveBeenCalled();
  });
});
