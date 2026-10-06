import type { ComponentPropsWithRef } from "react";

type Props = Omit<ComponentPropsWithRef<"button">, "className"> & {
  danger?: boolean;
};

export function SecondaryButton({
  danger = false,
  type = "button",
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      type={type}
      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-stroke px-2.5 text-ui-sm transition-colors ${
        danger
          ? "text-red-400 hover:border-red-400/40 hover:bg-red-400/10"
          : "text-content hover:border-border-hover hover:bg-surface-hover"
      } focus-visible:border-border-hover focus-visible:outline-none disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent`}
    >
      {children}
    </button>
  );
}
