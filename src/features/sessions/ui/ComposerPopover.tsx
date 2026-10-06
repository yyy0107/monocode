import { useRef, type ComponentProps } from "react";
import { useCollapseMotion } from "../../../shared/ui/AnimatedCollapse";
import { Popover } from "../../../shared/ui/Popover";
import {
  SurfaceVisibilityContext,
  useSurfaceVisibility,
} from "../../../shared/ui/SurfaceVisibility";

/** Composer menus keep their surface through closing, including rapid reversal. */
export function ComposerPopover({
  open,
  enabled = true,
  children,
  className,
  autoFocus,
  onDismiss,
  onTransitionEnd,
  ...props
}: ComponentProps<typeof Popover> & { open: boolean; enabled?: boolean }) {
  const visible = useSurfaceVisibility();
  const { foldState, finish } = useCollapseMotion(open && visible, 170);
  const retainedChildren = useRef(children);
  if (open) retainedChildren.current = children;

  // Compact composers and other consumers retain their existing menu treatment.
  if (!enabled) {
    return open ? (
      <Popover
        {...props}
        className={className}
        autoFocus={autoFocus}
        onDismiss={onDismiss}
        onTransitionEnd={onTransitionEnd}
      >
        {children}
      </Popover>
    ) : null;
  }
  if (!visible || (!open && foldState === "closed")) return null;
  return (
    <Popover
      {...props}
      bare
      className={`composer-popover ${className ?? ""}`}
      data-fold-state={foldState}
      inert={!open}
      aria-hidden={!open || undefined}
      autoFocus={open && autoFocus}
      onDismiss={open ? onDismiss : undefined}
      onTransitionEnd={(event) => {
        onTransitionEnd?.(event);
        if (
          event.target === event.currentTarget &&
          event.propertyName === "opacity"
        )
          finish();
      }}
    >
      <SurfaceVisibilityContext.Provider value={visible && open}>
        {open ? children : retainedChildren.current}
      </SurfaceVisibilityContext.Provider>
    </Popover>
  );
}
