import { LAYER } from "./layers";

export const EXPLORER_FILE_POINTER_DRAG_EVENT =
  "monocode:explorer-file-pointer-drag";

export type ExplorerFilePointerDragDetail =
  | { type: "move" | "drop"; path: string; x: number; y: number }
  | { type: "end"; path: string };

export function emitExplorerFilePointerDrag(
  detail: ExplorerFilePointerDragDetail,
) {
  window.dispatchEvent(
    new CustomEvent<ExplorerFilePointerDragDetail>(
      EXPLORER_FILE_POINTER_DRAG_EVENT,
      { detail },
    ),
  );
}

export function setGrabbing(on: boolean) {
  document.body.style.cursor = on ? "grabbing" : "";
}

/** Block native text selection for the duration of a reorder gesture. */
export function suppressTextSelection() {
  const onSelectStart = (event: Event) => {
    event.preventDefault();
  };
  window.addEventListener("selectstart", onSelectStart);
  document.documentElement.classList.add("is-reordering");
  window.getSelection()?.removeAllRanges();
  return () => {
    window.removeEventListener("selectstart", onSelectStart);
    document.documentElement.classList.remove("is-reordering");
    window.getSelection()?.removeAllRanges();
  };
}

/**
 * A ghost that follows the pointer during a drag, outside React so moves never
 * re-render. It shows `idle` until the pointer is over a target, then `target`.
 */
export function createDragLabel(idle: string, target: string) {
  const label = document.createElement("div");
  label.className = "drag-label";
  label.style.zIndex = String(LAYER.dragLabel);
  document.body.append(label);
  let over: boolean | undefined;
  return {
    move(x: number, y: number, onTarget: boolean) {
      label.style.transform = `translate(${x + 14}px, ${y + 12}px)`;
      if (over !== onTarget) {
        over = onTarget;
        label.textContent = onTarget ? target : idle;
        label.dataset.target = String(onTarget);
      }
      label.dataset.visible = "true";
    },
    dispose() {
      label.remove();
    },
  };
}

/**
 * A lifted copy of `source` that follows the pointer from where it was
 * grabbed. Over a drop target it gives way to a compact `target` label.
 */
export function createDragGhost(
  source: HTMLElement,
  startX: number,
  startY: number,
  target: string,
) {
  const rect = source.getBoundingClientRect();
  const offsetX = startX - rect.left;
  const offsetY = startY - rect.top;
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.style.zIndex = String(LAYER.dragLabel);
  const card = source.cloneNode(true) as HTMLElement;
  // The copy must not be found as the real card, or steal focus or labels.
  for (const node of [card, ...card.querySelectorAll<HTMLElement>("*")]) {
    node.removeAttribute("id");
    node.removeAttribute("tabindex");
    for (const name of node.getAttributeNames()) {
      if (name.startsWith("data-session-") || name.startsWith("aria-"))
        node.removeAttribute(name);
    }
  }
  card.setAttribute("aria-hidden", "true");
  card.classList.add("drag-ghost-card");
  card.style.width = `${rect.width}px`;
  card.style.height = `${rect.height}px`;
  const label = document.createElement("div");
  label.className = "drag-label drag-ghost-label";
  label.textContent = target;
  ghost.append(card, label);
  document.body.append(ghost);
  return {
    move(x: number, y: number, onTarget: boolean) {
      card.style.transform = `translate(${x - offsetX}px, ${y - offsetY}px)`;
      label.style.transform = `translate(${x - 10}px, ${y}px) translate(-100%, -50%)`;
      ghost.dataset.target = String(onTarget);
    },
    dispose() {
      ghost.remove();
    },
  };
}
