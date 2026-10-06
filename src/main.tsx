import React, { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  activateWindowAppearance,
  initAppearance,
} from "./features/settings/model/appearance";
import { initSounds } from "./features/settings/model/sounds";
import {
  abortQuit,
  askQuitConfirmation,
  commitQuit,
  loadBootWorkspace,
  reportQuitPoll,
} from "./app/model/appLifecycle";
import { homeDir } from "./platform/tauri/fs";
import { setHomeDir } from "./shared/lib/paths";
import { consumeInstalledUpdate } from "./app/model/updateNotice";
import { initializeProviderBinaryPaths } from "./features/providers/model/providerBinaryPaths";
import { initProviderAccountPublishing, loadSharedProviderDefaults } from "./features/providers/model/providerAccountCredentials";
// Lets file commands reach a connected machine for `remote://` paths.
import "./features/connections/model/remoteCommands";
import "./styles/index.css";
import { initUiLanguage } from "./shared/i18n/languageSync";
import { initializeSharedHost } from "./features/connections/model/sharedHost";
import { useTranslation } from "./shared/i18n/useTranslation";
import { WindowResizeHandles } from "./app/shell/WindowResizeHandles";

performance.mark("monocode:bootstrap");
// Let local boot IPC overlap loading/evaluating the workspace UI.
const appLoaded = import("./app/App");

initUiLanguage();
initAppearance();
initSounds();
initProviderAccountPublishing();
const sharedDefaultsPrimed = loadSharedProviderDefaults().catch(() => undefined);
// Prime the real home directory before the first render so every `~/` file
// reference resolves consistently. The IPC call is local and failures remain
// best-effort, falling back to inference from a session's cwd.
const homeDirPrimed = homeDir()
  .then(setHomeDir)
  .catch(() => {});
const providerBinaryPathsPrimed = initializeProviderBinaryPaths().catch(
  () => undefined,
);

function dismissBootSplash() {
  const splash = document.getElementById("boot-splash");
  if (!splash || splash.dataset.dismissed === "1") return;
  splash.dataset.dismissed = "1";
  const fade = () => {
    activateWindowAppearance();
    splash.classList.add("boot-splash-out");
    window.setTimeout(() => {
      splash.remove();
      performance.mark("monocode:ui-ready");
      performance.measure("monocode:navigation-to-ui", {
        start: 0,
        end: "monocode:ui-ready",
      });
    }, 300);
  };
  // useLayoutEffect runs before paint. Two frames later the app is on
  // screen, so the fade reveals UI instead of the desktop blur.
  requestAnimationFrame(() => {
    requestAnimationFrame(fade);
  });
}

function BootGate({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    dismissBootSplash();
  }, []);
  return (
    <>
      {children}
      <WindowResizeHandles />
    </>
  );
}

void listen<number>("quit_poll", (event) => {
  void reportQuitPoll(event.payload);
});
// Scoped to this window on purpose: a global `listen` is registered as `Any`,
// which Tauri matches for every event regardless of the emitter's target, so
// one dialog would become one per window.
void getCurrentWebviewWindow().listen<{ id: number; inFlight: number }>(
  "quit_confirm",
  (event) => {
    void askQuitConfirmation(event.payload.id, event.payload.inFlight);
  },
);
void listen<number>("quit_commit", (event) => {
  void commitQuit(event.payload);
});
void listen("quit_aborted", () => {
  abortQuit();
});

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement,
);
function BootFailure({ error }: { error: unknown }) {
  const { t } = useTranslation();
  useLayoutEffect(dismissBootSplash, []);
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 p-8 text-content">
      <p>{t("Could not connect to shared conversations.")}</p>
      <pre className="max-w-xl whitespace-pre-wrap text-sm text-content/60">
        {String(error)}
      </pre>
      <button onClick={() => void boot()}>{t("Retry")}</button>
    </div>
  );
}
async function boot() {
  try {
    await providerBinaryPathsPrimed;
    await initializeSharedHost();
    await sharedDefaultsPrimed;
    const [
      ,
      ,
      { windowTransfer, resumed, history, historyCwd },
      { default: App },
    ] = await Promise.all([
      homeDirPrimed,
      providerBinaryPathsPrimed,
      loadBootWorkspace(),
      appLoaded,
    ]);
    performance.mark("monocode:workspace-ready");
    const installedUpdate = windowTransfer ? null : consumeInstalledUpdate();
    root.render(
      <React.StrictMode>
        <BootGate>
          <App
            windowTransfer={windowTransfer}
            resumed={resumed}
            installedUpdate={installedUpdate}
            history={history}
            historyCwd={historyCwd}
          />
        </BootGate>
      </React.StrictMode>,
    );
  } catch (error) {
    root.render(
      <BootGate>
        <BootFailure error={error} />
      </BootGate>,
    );
  }
}
void boot();
