// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import {
  loadSidebarPinnedOrder,
  reorderSidebarPins,
  saveSidebarPinnedOrder,
} from "./sidebarPinnedOrder";

afterEach(() => localStorage.clear());

it("persists mixed ordering without moving hidden or unloaded pins", () => {
  const order = [
    "session:a",
    "/project",
    "session:hidden",
    "session:b",
    "/unloaded",
  ];
  const reordered = reorderSidebarPins(order, [
    "session:b",
    "session:a",
    "/project",
  ]);
  expect(reordered).toEqual([
    "session:b",
    "session:a",
    "session:hidden",
    "/project",
    "/unloaded",
  ]);
  saveSidebarPinnedOrder(reordered);
  expect(loadSidebarPinnedOrder()).toEqual(reordered);
});

it("retains newly pinned rows when only the visible preview is reordered", () => {
  expect(
    reorderSidebarPins(
      ["/project", "session:a", "session:offscreen"],
      ["session:new", "/project"],
    ),
  ).toEqual(["session:new", "session:a", "session:offscreen", "/project"]);
});
