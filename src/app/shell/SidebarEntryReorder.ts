import { createContext, type PointerEvent } from "react";
import type { ReorderExternalDrop } from "../../shared/hooks/useAnimatedReorder";

/** Let shortcut cards share the project list's gesture without losing pane drops. */
export const SidebarEntryReorderContext = createContext<{
  dragging: boolean;
  onPointerDown: (
    event: PointerEvent,
    externalDrop?: ReorderExternalDrop<string>,
  ) => void;
  consumeClick: () => boolean;
} | null>(null);
