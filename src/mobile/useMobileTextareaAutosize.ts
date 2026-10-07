import { useLayoutEffect, useRef, type RefObject } from "react";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { keyboardViewportHeight, onKeyboardMotion } from "./keyboardMotion";

type Options = {
  minHeight: number;
  maxHeight?: number;
  viewportHeightRatio?: number;
  widthSource?: RefObject<HTMLElement | null>;
  measureWidth?: () => number;
};

/** Measure wrapping without shrinking the focused field or recreating observers per key. */
export function useMobileTextareaAutosize(
  field: RefObject<HTMLTextAreaElement | null>,
  value: string,
  { minHeight, maxHeight = 168, viewportHeightRatio, widthSource, measureWidth }: Options,
) {
  const visible = useSurfaceVisibility();
  const widthReader = useRef(measureWidth);
  widthReader.current = measureWidth;
  const resizeRef = useRef<(() => void) | undefined>(undefined);

  useLayoutEffect(() => {
    const element = field.current;
    const source = widthSource?.current ?? element;
    if (!visible || !element || !source) return;
    const measure = element.cloneNode() as HTMLTextAreaElement;
    for (const name of ["id", "name", "aria-label", "aria-labelledby", "aria-controls", "aria-activedescendant", "autofocus", "required"])
      measure.removeAttribute(name);
    measure.setAttribute("aria-hidden", "true");
    measure.dataset.autosizeMeasure = "true";
    measure.inert = true;
    measure.tabIndex = -1;
    measure.classList.add("mobile-composer-measure");
    Object.assign(measure.style, {
      position: "absolute", visibility: "hidden", pointerEvents: "none",
      transition: "none", height: "0px", minHeight: "0px", maxHeight: "none",
      whiteSpace: "pre-wrap", overflow: "hidden",
    });
    let previous = "";
    let width = source.clientWidth;
    let naturalHeight = minHeight;
    const applyHeight = () => {
      const cap = viewportHeightRatio === undefined
        ? maxHeight : Math.min(maxHeight, keyboardViewportHeight() * viewportHeightRatio);
      const height = `${Math.max(minHeight, Math.min(naturalHeight, cap))}px`;
      if (element.style.height !== height) element.style.height = height;
    };
    const resize = () => {
      const availableWidth = Math.max(0, widthReader.current?.() ?? element.clientWidth);
      const key = `${availableWidth}\0${element.value}`;
      if (key !== previous) {
        previous = key;
        measure.value = element.value;
        measure.style.width = `${availableWidth}px`;
        element.after(measure);
        naturalHeight = measure.scrollHeight;
        measure.remove();
      }
      applyHeight();
    };
    resizeRef.current = resize;
    resize();
    const observer = new ResizeObserver(() => {
      const next = source.clientWidth;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      resize();
    });
    observer.observe(source);
    window.addEventListener("resize", resize);
    // A keyboard event changes the height limit, not wrapping. Reuse the last
    // measurement instead of forcing layout after the shell's motion writes.
    const unsubscribe = onKeyboardMotion(applyHeight);
    return () => {
      resizeRef.current = undefined;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      unsubscribe();
      measure.remove();
    };
  }, [field, widthSource, minHeight, maxHeight, viewportHeightRatio, visible]);

  useLayoutEffect(() => resizeRef.current?.(), [value]);
}
