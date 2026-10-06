import type { CSSProperties } from "react";

/** Frosted drop target with a centered label, like Claude Desktop's split drop. */
export function DropTargetHint({
  label,
  rect,
}: {
  label: string;
  /** The covered part of the parent; the whole parent when omitted. */
  rect?: CSSProperties;
}) {
  return (
    <div className="pane-drop-hint pointer-events-none absolute inset-0 z-20">
      <div
        className="pane-drop-hint-target"
        style={rect ?? { left: 0, top: 0, width: "100%", height: "100%" }}
      >
        <div className="pane-drop-hint-panel">
          <span className="pane-drop-hint-label">{label}</span>
        </div>
      </div>
    </div>
  );
}
