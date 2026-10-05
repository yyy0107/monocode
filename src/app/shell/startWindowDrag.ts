import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";
import { IS_LINUX, IS_WIN } from "../../platform/tauri/platform";

const CONTROLS = [
  "button",
  "input",
  "select",
  "textarea",
  "a[href]",
  "label",
  "summary",
  "[contenteditable]:not([contenteditable='false'])",
  "[tabindex]:not([tabindex='-1'])",
  "[role='button']",
  "[role='link']",
  "[role='menuitem']",
  "[role='tab']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='option']",
  "[role='slider']",
  "[role='combobox']",
  "[role='spinbutton']",
  "[role='treeitem']",
  "[data-tauri-drag-region='false']",
].join(",");

/** Start a native move before bubbling reaches Tauri's document drag listener. */
export function startWindowDrag(event: MouseEvent<HTMLElement>): boolean {
  if (
    !(IS_LINUX || IS_WIN) ||
    !isTauri() ||
    event.button !== 0 ||
    event.detail !== 1 ||
    event.defaultPrevented ||
    event.currentTarget.getAttribute("data-tauri-drag-region") !== "deep"
  )
    return false;
  const target =
    event.target instanceof Element
      ? event.target
      : event.target instanceof Node
        ? event.target.parentElement
        : null;
  if (!target || !event.currentTarget.contains(target)) return false;
  const control = target.closest(CONTROLS);
  if (control && event.currentTarget.contains(control)) return false;

  event.preventDefault();
  event.stopPropagation();
  void getCurrentWindow()
    .startDragging()
    .catch(() => {});
  return true;
}
