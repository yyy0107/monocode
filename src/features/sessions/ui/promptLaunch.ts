/** Where a phone composer's text sat when it was sent, in viewport pixels. */
export type PromptLaunchOrigin = {
  left: number;
  bottom: number;
  width: number;
  height: number;
};

// A send waits on a Host round trip; an origin older than this no longer
// matches what the reader remembers, so the bubble rises from the dock instead.
const LAUNCH_TTL_MS = 15_000;

let launch: { origin: PromptLaunchOrigin; at: number } | undefined;

/** Record the composer text the next transcript prompt should fly out of. */
export function notePromptLaunch(element: Element | null) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  launch = {
    origin: { left: rect.left, bottom: rect.bottom, width: rect.width, height: rect.height },
    at: performance.now(),
  };
}

/** The pending launch origin, consumed once by the prompt it introduces. */
export function takePromptLaunch(): PromptLaunchOrigin | undefined {
  const current = launch;
  launch = undefined;
  return current && performance.now() - current.at <= LAUNCH_TTL_MS
    ? current.origin
    : undefined;
}
