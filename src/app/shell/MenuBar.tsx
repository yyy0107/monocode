import { useTranslation } from "../../shared/i18n/useTranslation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ExplorerMenu } from "../../features/files/ui/ExplorerMenu";
import {
  loadAutosave,
  loadKeybindingOverrides,
  loadMenuBarVisible,
  subscribeAutosave,
  subscribeKeybindings,
  subscribeMenuBarVisible,
} from "../../features/settings/model/settings";
import {
  MENUS,
  menuItems,
  type CommandHandlers,
  type MenuId,
} from "../commands/registry";
import type { CommandDispatch } from "../commands/useCommandDispatcher";
import { TabVisitNav, WINDOW_NAVIGATION_END } from "./WindowChrome";
import { WindowControls } from "./WindowControls";
import { startWindowDrag } from "./startWindowDrag";

type Props = {
  handlers: CommandHandlers;
  dispatch: CommandDispatch;
  canGoBack?: boolean;
  canGoForward?: boolean;
  sidebarOpen?: boolean;
};

export const MENU_BAR_HEIGHT = 36;

/**
 * The Windows/Linux in-window menu bar. It stays visible by default; with the
 * menu bar turned off, tapping Alt alone reveals it over the title bar.
 */
export function MenuBar({
  handlers,
  dispatch,
  canGoBack = false,
  canGoForward = false,
  sidebarOpen = false,
}: Props) {
  const { t: uiT } = useTranslation();
  const visible = useSyncExternalStore(
    subscribeMenuBarVisible,
    loadMenuBarVisible,
  );
  const autosave = useSyncExternalStore(subscribeAutosave, loadAutosave);
  const [revealed, setRevealed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuId | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [, refreshShortcuts] = useState(loadKeybindingOverrides);
  const buttons = useRef(new Map<MenuId, HTMLButtonElement>());
  const bar = useRef<HTMLDivElement>(null);

  useEffect(
    () =>
      subscribeKeybindings(() => refreshShortcuts(loadKeybindingOverrides())),
    [],
  );

  const shown = visible || revealed || activeMenu !== null;
  const available = MENUS.filter(
    (menu) => menuItems(menu.id, { handlers, translate: uiT }).length > 0,
  );

  const openMenu = useCallback((key: MenuId) => {
    const button = buttons.current.get(key);
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setActiveMenu(key);
    setMenuAnchor({ x: rect.left, y: rect.bottom + 2 });
  }, []);

  const closeMenu = useCallback(() => {
    setActiveMenu(null);
    setMenuAnchor(null);
  }, []);

  // Alt tapped alone: open File when the bar is pinned, else reveal the bar.
  const activeRef = useRef(activeMenu);
  activeRef.current = activeMenu;
  useEffect(() => {
    let altPressedAlone = false;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Alt") altPressedAlone = false;
      else if (!e.repeat) altPressedAlone = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== "Alt" || !altPressedAlone) return;
      altPressedAlone = false;
      if (activeRef.current) {
        closeMenu();
        setRevealed(false);
      } else if (loadMenuBarVisible()) {
        openMenu("file");
      } else {
        setRevealed((prev) => !prev);
      }
    };
    const onBlur = () => {
      altPressedAlone = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [closeMenu, openMenu]);

  // Before a dropdown opens, the temporary row owns its own dismissal.
  useEffect(() => {
    if (visible || !revealed || activeMenu) return;
    const dismiss = () => setRevealed(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    };
    const onOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !bar.current?.contains(event.target)
      ) {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onOutside);
    window.addEventListener("blur", dismiss);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("blur", dismiss);
    };
  }, [visible, revealed, activeMenu]);

  // Left/Right move between open menus; the menu itself ignores them.
  useEffect(() => {
    if (!activeMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.defaultPrevented && e.key === "ArrowLeft") return;
      const ids = available.map((menu) => menu.id);
      const index = ids.indexOf(activeMenu);
      if (index < 0) return;
      const step = e.key === "ArrowRight" ? 1 : -1;
      openMenu(ids[(index + step + ids.length) % ids.length]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeMenu, available, openMenu]);

  if (!shown) return null;

  const onPick = (id: string) => {
    closeMenu();
    setRevealed(false);
    // Let the menu hand focus back before the command moves it again.
    requestAnimationFrame(() => void dispatch(id));
  };

  const checked = (id: string) =>
    id === "File: Autosave"
      ? autosave
      : id === "View: Toggle Menu Bar"
        ? visible
        : false;

  return (
    <div
      ref={bar}
      data-menu-bar
      data-tauri-drag-region="deep"
      onMouseDownCapture={(event) => {
        if (!startWindowDrag(event)) return;
        closeMenu();
        setRevealed(false);
      }}
      className={`shell-chrome flex shrink-0 select-none items-center gap-0.5 border-b border-stroke text-[12px] ${
        visible ? "relative pl-2" : "sidebar-glass absolute z-30 px-2"
      }`}
      style={{
        height: MENU_BAR_HEIGHT,
        // Alt-reveal leaves the title-row navigation and window buttons usable.
        ...(!visible
          ? {
              left: WINDOW_NAVIGATION_END,
              right: 120,
              top: (40 - MENU_BAR_HEIGHT) / 2,
            }
          : {}),
      }}
    >
      {visible ? (
        <nav
          aria-label={uiT("Window navigation")}
          data-window-navigation
          data-tauri-drag-region="false"
          className="mr-2 flex shrink-0 items-center"
        >
          <TabVisitNav
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onGoBack={() => onPick("Tab: Back")}
            onGoForward={() => onPick("Tab: Forward")}
            onTogglePanel={() => onPick("App: Toggle Sidebar")}
            panelActive={sidebarOpen}
          />
        </nav>
      ) : null}
      {available.map(({ id, label }) => {
        const isActive = activeMenu === id;
        return (
          <button
            key={id}
            ref={(node) => {
              if (node) buttons.current.set(id, node);
              else buttons.current.delete(id);
            }}
            type="button"
            data-tauri-drag-region="false"
            aria-haspopup="menu"
            aria-expanded={isActive}
            onClick={() => (isActive ? closeMenu() : openMenu(id))}
            onMouseEnter={() => {
              if (activeMenu && activeMenu !== id) openMenu(id);
            }}
            className={`rounded px-2 py-0.5 transition-colors ${
              isActive
                ? "bg-selection-hover text-content"
                : "text-content/70 hover:bg-content/10 hover:text-content"
            }`}
          >
            {uiT(label)}
          </button>
        );
      })}

      {visible ? (
        <>
          <div className="min-w-0 flex-1" />
          <WindowControls />
        </>
      ) : null}

      {activeMenu && menuAnchor ? (
        <ExplorerMenu
          key={activeMenu}
          x={menuAnchor.x}
          y={menuAnchor.y}
          items={menuItems(activeMenu, {
            handlers,
            checked,
            translate: uiT,
          })}
          ariaLabel={uiT(
            MENUS.find((menu) => menu.id === activeMenu)?.label ?? "",
          )}
          onPick={onPick}
          onClose={() => {
            closeMenu();
            setRevealed(false);
          }}
        />
      ) : null}
    </div>
  );
}
