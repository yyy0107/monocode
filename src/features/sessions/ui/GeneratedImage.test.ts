// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../../platform/tauri/fs", () => ({ readBinaryFile: mocks.read }));
import { GeneratedImage } from "./GeneratedImage";

it("renders remote preview bytes without reading a private Host path", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        createElement(GeneratedImage, {
          image: {
            path: "/private/host/image",
            name: "saved.png",
            mimeType: "image/png",
            size: 5,
          },
          attachment: {
            id: "asset",
            name: "saved.png",
            mimeType: "image/png",
            kind: "image",
            size: 5,
            data: "aW1hZ2U=",
          },
        }),
      ),
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "data:image/png;base64,aW1hZ2U=",
    );
    expect(mocks.read).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
