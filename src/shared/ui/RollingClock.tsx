import { useState, useSyncExternalStore, type CSSProperties } from "react";
import { reducedMotionQuery } from "../lib/reducedMotion";
import "./RollingClock.css";

function subscribeMotion(listener: () => void) {
  const query = reducedMotionQuery();
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
const motionReduced = () => reducedMotionQuery().matches;
const serverMotionReduced = () => true;

export const CLOCK_MOTIONS = ["slide", "roll", "fade", "cascade"] as const;
export type ClockMotion = typeof CLOCK_MOTIONS[number];

/** Pick once per clock origin, independently of the ticking value or status copy. */
export function rollingClockMotion(seed: string, startedAt: number): ClockMotion {
  const text = `${seed}:${startedAt}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return CLOCK_MOTIONS[(hash >>> 0) % CLOCK_MOTIONS.length];
}

/** Changed digits move up in one of several styles; units stay still. */
export function RollingClock({ value, motion = "slide" }: { value: string; motion?: ClockMotion }) {
  const reduced = useSyncExternalStore(subscribeMotion, motionReduced, serverMotionReduced);
  const groups = [...value.matchAll(/(\d+)([^\d]*)/g)];
  return (
    <span className="rolling-clock" data-motion={motion} role="timer" aria-label={value} aria-live="off" dir="ltr">
      <span className="rolling-clock-face" aria-hidden="true">
        {groups.map((group) => (
          <span className="rolling-clock-group" key={group[2].trim()}>
            {[...group[1]].map((digit, index) => (
              <RollingDigit
                key={group[1].length - index}
                value={digit}
                reduced={reduced}
                delay={motion === "cascade" ? (group[1].length - index - 1) * 45 : 0}
              />
            ))}
            <span className="rolling-clock-unit">{group[2]}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

function RollingDigit({ value, reduced, delay }: { value: string; reduced: boolean; delay: number }) {
  const [frame, setFrame] = useState({ value, previous: value, revision: 0 });
  if (frame.value !== value) {
    setFrame({ value, previous: reduced ? value : frame.value, revision: frame.revision + 1 });
  } else if (reduced && frame.previous !== value) {
    setFrame({ ...frame, previous: value });
  }
  const rolling = !reduced && frame.previous !== frame.value;
  return (
    <span
      className="rolling-clock-digit"
      data-rolling={rolling || undefined}
      style={{ "--clock-delay": `${delay}ms` } as CSSProperties}
    >
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
