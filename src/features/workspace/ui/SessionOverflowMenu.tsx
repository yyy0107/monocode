import { useEffect, useRef, useState } from "react";
import { useCommandShortcut } from "../../../app/commands/useCommandShortcut";
import {
  ProviderUsageBar,
  usageSessionFor,
} from "../../../app/shell/ProviderUsageBar";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import {
  Archive,
  ChevronLeft,
  MoreHorizontal,
  PanelRight,
  Pencil,
} from "../../../shared/ui/icons";
import { Popover } from "../../../shared/ui/Popover";
import { useSurfaceVisibility } from "../../../shared/ui/SurfaceVisibility";
import { ExplorerMenu } from "../../files/ui/ExplorerMenu";
import type { Session } from "../../sessions/model/session";
import { useSessionHeaderActions } from "./SessionHeaderActions";
import { delegateDesktopSession } from "../../assistant/model/delegateDesktopSession";
import { remoteProjectFor } from "../../connections/model/remoteProjects";
import { remoteSessionFor } from "../../connections/model/connections";

/** The chat column's ⋯ menu: session actions plus this session's usage. */
export function SessionOverflowMenu({
  session,
  onRename,
}: {
  session: Session;
  onRename: (anchor: HTMLElement) => void;
}) {
  const { t } = useTranslation();
  const actions = useSessionHeaderActions();
  const visible = useSurfaceVisibility();
  const button = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<"menu" | "usage" | null>(null);
  const splitShortcut = useCommandShortcut("Pane: Split Right");
  const archiveShortcut = useCommandShortcut("Session: Archive");
  useEffect(() => {
    if (!visible) setMode(null);
  }, [visible]);
  if (!actions) return null;

  const close = () => {
    setMode(null);
    button.current?.focus();
  };
  const usage = (expanded: boolean) => (
    <ProviderUsageBar
      session={usageSessionFor(session)}
      project={session.cwd}
      onSelectAccount={(provider, accountId) =>
        actions.selectProviderAccount?.(session.id, provider, accountId)
      }
      onManageAccounts={actions.manageProviderAccounts}
      inline={{
        expanded,
        onExpand: () => setMode("usage"),
        onCollapse: () => setMode("menu"),
      }}
    />
  );

  return (
    <>
      <button
        ref={button}
        type="button"
        data-session-overflow-menu={session.id}
        data-tauri-drag-region="false"
        aria-label={t("More actions")}
        title={t("More actions")}
        aria-haspopup="menu"
        aria-expanded={mode !== null}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setMode((current) => (current ? null : "menu"))}
        className="mr-1 grid size-7.5 shrink-0 self-center place-items-center rounded-md text-content/60 hover:bg-content/5 hover:text-content"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {visible && mode === "menu" && button.current ? (
        <ExplorerMenu
          anchor={button.current}
          ownerId={session.id}
          side="bottom"
          align="end"
          width={280}
          ariaLabel={t("Session actions")}
          header={
            <div
              data-session-usage
              className="flex min-w-0 items-center gap-0.5 text-[11px] text-content/55"
              // Keys on the usage controls belong to them, not the menu list.
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget)
                  event.stopPropagation();
              }}
            >
              {usage(false)}
            </div>
          }
          items={[
            ...(remoteProjectFor(session.cwd) ? [{
              kind: "item" as const,
              id: "delegate-assistant",
              label: t("Hand over to assistant"),
              description: t("Follow this conversation and allow configured assistant actions"),
            }] : []),
            {
              kind: "item",
              id: "rename",
              label: t("Rename"),
              icon: <Pencil className="size-4" />,
            },
            {
              kind: "item",
              id: "split",
              label: t("Split Right"),
              icon: <PanelRight className="size-4" />,
              shortcut: splitShortcut ?? undefined,
            },
            { kind: "sep" },
            {
              kind: "item",
              id: "archive",
              label: t("Archive"),
              icon: <Archive className="size-4" />,
              shortcut: archiveShortcut ?? undefined,
            },
          ]}
          onPick={(id) => {
            if (id === "rename") {
              setMode(null);
              onRename(button.current!);
              return;
            }
            close();
            if (id === "delegate-assistant") void delegateDesktopSession(session.cwd, remoteSessionFor(session.id) ?? session.id);
            else if (id === "split") actions.splitRight(session.id);
            else if (id === "archive") actions.archive(session.id);
          }}
          onClose={close}
        />
      ) : null}
      {visible && mode === "usage" && button.current ? (
        <Popover
          anchor={button.current}
          side="bottom"
          align="end"
          gap={4}
          width={320}
          maxHeight={480}
          autoFocus
          onDismiss={(reason) => {
            if (reason === "escape") setMode("menu");
            else close();
          }}
          role="dialog"
          tabIndex={-1}
          aria-label={t("Usage details")}
          className="overflow-y-auto overscroll-none p-1 text-content"
        >
          <button
            type="button"
            data-session-usage-back
            onClick={() => setMode("menu")}
            className="flex h-7 w-full items-center gap-1.5 rounded-lg px-2 text-left text-[12px] text-content/65 hover:bg-content/5 hover:text-content"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {t("Back")}
          </button>
          {usage(true)}
        </Popover>
      ) : null}
    </>
  );
}
