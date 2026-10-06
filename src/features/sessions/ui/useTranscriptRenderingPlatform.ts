import { useCallback, useContext, useMemo, useRef } from "react";
import { TranscriptPlatformContext } from "./TranscriptPlatform";

/** Shared character reveal: seed loaded history, pace new replies and chunks. */
export function useTranscriptRenderingPlatform(
  entries: readonly { id: string; text: string }[],
  {
    historyReady = entries.length > 0,
    animateFrom,
  }: { historyReady?: boolean; animateFrom?: string } = {},
) {
  const platform = useContext(TranscriptPlatformContext);
  const lengths = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry.text.length])),
    [entries],
  );
  const currentLengths = useRef(lengths);
  currentLengths.current = lengths;
  const seenLengths = useRef(new Map<string, number>());
  const seededReveal = useRef(false);
  if (!seededReveal.current && historyReady) {
    const start = animateFrom
      ? entries.findIndex((entry) => entry.id === animateFrom)
      : -1;
    seenLengths.current = new Map(
      entries.map((entry, index) => [
        entry.id,
        start >= 0 && index > start ? 0 : entry.text.length,
      ]),
    );
    seededReveal.current = true;
  }
  const revealText = useCallback((id?: string) => {
    if (!id) return { unit: "character" as const };
    const initialLength = seenLengths.current.get(id) ?? 0;
    // Reopening a previously presented reply must not replay it.
    seenLengths.current.set(id, currentLengths.current.get(id) ?? 0);
    return { unit: "character" as const, initialLength };
  }, []);
  return useMemo(
    () => ({ ...platform, textReveal: revealText }),
    [platform, revealText],
  );
}
