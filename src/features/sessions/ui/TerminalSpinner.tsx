import { useCallback, useRef, useState } from "react";
import { useAnimationActivity } from "../../../shared/hooks/useAnimationActivity";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export function TerminalSpinner({
  className = "inline-block w-3.5 select-none text-center text-[11px] leading-none",
}: {
  className?: string;
}) {
  const [frame, setFrame] = useState(0);
  const interval = useRef<number | undefined>(undefined);
  const changeActivity = useCallback(
    (_element: HTMLSpanElement, active: boolean) => {
      if (active) {
        interval.current ??= window.setInterval(
          () => setFrame((n) => (n + 1) % FRAMES.length),
          80,
        );
      } else if (interval.current !== undefined) {
        window.clearInterval(interval.current);
        interval.current = undefined;
      }
    },
    [],
  );
  const activityRef = useAnimationActivity(changeActivity);

  return (
    <span ref={activityRef} aria-hidden className={className}>
      {FRAMES[frame]}
    </span>
  );
}
