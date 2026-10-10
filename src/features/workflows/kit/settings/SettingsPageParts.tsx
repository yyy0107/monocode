import type { ReactNode } from "react";
import { Card, CardContent } from "../components/ui/card.js";
import { cn } from "../components/lib/utils.js";

// Ported from ZCode `packages/ui/src/settings/SettingsPageParts.tsx`; the
// code-preview theme helpers are not used by Monocode.

/** The content frame ZCode's settings pages use. */
export const SETTINGS_FRAME_CONTENT_CLASSNAME = "mx-auto w-full max-w-4xl px-4 pb-8 pt-0 lg:px-8 lg:pb-10";

export function SettingsRow({
  label,
  description,
  control,
  detail,
  controlLayout = "default",
}: {
  label: ReactNode;
  description?: ReactNode;
  control: ReactNode;
  detail?: ReactNode;
  controlLayout?: "default" | "wide";
}) {
  return (
    <div className="border-t border-border px-4 py-3 first:border-t-0">
      <div
        className={cn(
          "grid items-center gap-4",
          controlLayout === "wide"
            ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_280px]"
            : "grid-cols-[minmax(0,1fr)_192px]",
        )}
      >
        <div className="min-w-0">
          <div className="text-ui-base font-medium text-foreground">{label}</div>
          {description ? (
            <div className="mt-1 text-ui-base leading-6 text-foreground-subtle">{description}</div>
          ) : null}
        </div>
        <div className="flex w-full flex-nowrap items-center justify-end gap-2">
          {controlLayout === "wide" ? detail : null}
          {control}
        </div>
      </div>
      {detail && controlLayout !== "wide" ? <div className="mt-3">{detail}</div> : null}
    </div>
  );
}

export function SettingsGroupCard({ children }: { children: ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-xl border border-border panel-card py-0 shadow-none">
      <CardContent className="space-y-0 px-0">{children}</CardContent>
    </Card>
  );
}

