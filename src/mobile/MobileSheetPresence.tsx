import { cloneElement, useRef, useState, type ReactElement } from "react";

/** Freeze a sheet's payload on close; MobileSheet owns the exit lifetime. */
export function MobileSheetPresence({ open, children }: {
  open: boolean;
  children: ReactElement<{ open?: boolean; onExited?: () => void }> | null;
}) {
  const [mounted, setMounted] = useState(open);
  const retained = useRef(children);
  const currentOpen = useRef(open);
  currentOpen.current = open;
  if (open) {
    retained.current = children;
    if (!mounted) setMounted(true);
  }
  if (!mounted || !retained.current) return null;
  const child = open ? children : retained.current;
  if (!child) return null;
  return cloneElement(child, {
    open,
    onExited: () => {
      if (currentOpen.current) return;
      child.props.onExited?.();
      retained.current = null;
      setMounted(false);
    },
  });
}
