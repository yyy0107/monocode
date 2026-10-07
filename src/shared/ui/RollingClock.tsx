import { useState, useSyncExternalStore } from "react";
import { reducedMotionQuery } from "../lib/reducedMotion";
import "./RollingClock.css";

function subscribeMotion(listener: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionReduced = () => reducedMotionQuery().matches;
const serverMotionReduced = () => true;

/** Changed digits slide up; unchanged digits and units stay still. */
export function RollingClock({ value }: { value: string }) {
  const reduced = useSyncExternalStore(subscribeMotion, motionReduced, serverMotionReduced);
  const groups = [...value.matchAll(/(\d+)([^\d]*)/g)];
  return (
    <span className="rolling-clock" role="timer" aria-label={value} aria-live="off" dir="ltr">
      <span className="rolling-clock-face" aria-hidden="true">
        {groups.map((group) => (
          <span className="rolling-clock-group" key={group[2].trim()}>
            {[...group[1]].map((digit, index) => (
              <RollingDigit key={group[1].length - index} value={digit} reduced={reduced} />
            ))}
            <span className="rolling-clock-unit">{group[2]}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingDigit({ value, reduced }: { value: string; reduced: boolean }) {
  const [frame, setFrame] = useState({ value, previous: value, revision: 0 });
  if (frame.value !== value) {
    setFrame({ value, previous: reduced ? value : frame.value, revision: frame.revision + 1 });
  } else if (reduced && frame.previous !== value) {
    setFrame({ ...frame, previous: value });
  }
  const rolling = !reduced && frame.previous !== frame.value;
  return (
    <span className="rolling-clock-digit" data-rolling={rolling || undefined}>
      <span className="rolling-clock-current">{value}</span>
      {rolling && (
        <span key={frame.revision} className="rolling-clock-transition">
          <span className="rolling-clock-glyph rolling-clock-outgoing" data-glyph={frame.previous} />
          <span
            className="rolling-clock-glyph rolling-clock-incoming"
            data-glyph={value}
            onAnimationEnd={() => setFrame(current => current.revision === frame.revision
              ? { ...current, previous: current.value }
              : current)}
          />
        </span>
      )}
    </span>
  );
}
