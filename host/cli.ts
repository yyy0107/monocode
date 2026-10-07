import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  configureChildBackend,
  acquireHarnessBridge,
} from "../src/integrations/harness/core/child";
import { HostChildBackend } from "./child-backend";
import { HostStore } from "./store";
import { acquireHostOwner } from "./owner";
import { HostEngine } from "./engine";
import { hostProviders } from "./providers";
import { createHostServer } from "./server";
import {
  REMOTE_PROVIDERS,
  type RemoteProvider,
} from "../src/features/connections/model/protocol";
import { connectionInfo, installService, uninstallService } from "./service";
import { version } from "../package.json";
import { protectWindowsDirectory } from "./windows";
import { prepareDesktopHost } from "./desktop";
import { listenOnAdapters } from "./adapter-listeners";
import { runControlCli } from "./control";
import type { LegacyRetirementManifest } from "./legacy-orchestration";

process.umask(0o077);
// npm-based providers can launch Node subprocesses without a separate Node
// installation. Keep the packaged runtime first in the host's own PATH.
process.env.PATH = [dirname(process.execPath), process.env.PATH ?? ""].join(
  delimiter,
);
const args = process.argv.slice(2);
const command = args[0] ?? "help";
const option = (name: string, fallback: string): string => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  if (!args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error(`Missing --${name} value`);
  return args[i + 1];
};
const directory = resolve(
  option("data-dir", join(homedir(), ".monocode-host")),
);
const port = Number(option("port", "3774"));
// Only the desktop's own Host is reachable from paired phones on the network.
const listenAdapters = args.includes("--listen-adapters");
const statePath = join(directory, "running.json");
type Running = { pid: number; port: number; secret: string };
const readRunning = (): Running | undefined => {
  if (!existsSync(statePath)) return;
  return JSON.parse(readFileSync(statePath, "utf8")) as Running;
};
const lifecycle = async (state: Running, action: "status" | "stop") => {
  const response = await fetch(`http://127.0.0.1:${state.port}/lifecycle`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${state.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("Could not verify the running host");
};

async function main() {
  if (command === "control") {
    process.exitCode = await runControlCli(args.slice(1));
    return;
  }
  if (command === "assistant") {
    process.exitCode = await runControlCli(args.slice(1), "assistant");
    return;
  }
  if (command === "workflow") {
    process.exitCode = await runControlCli(args.slice(1), "workflow");
    return;
  }
  if (command === "--version") {
    console.log(version);
    return;
  }
  if (command === "help" || command === "--help") {
    console.log(`MonoCode Host (experimental; Node 24+; Windows/Linux/macOS)
  serve                 Run in foreground on 127.0.0.1
  start                 Run detached from this terminal
  service install       Install/start the persistent user service
  service uninstall     Stop the host and remove its service; keeps data
  connection-info       Print the running host's port (JSON)
  desktop --desktop-data-dir <directory>
                        Start/reuse shared Host and import desktop history
  status                Check the running host
  stop                  Stop the host and interrupt its running turns
  pair --name <device> [--token <token>]
                        Issue a device credential (shown once)
  devices               List paired devices
  revoke <device-id>    Revoke a device credential
Options: --data-dir <directory> --port <port> (default 3774)
         --listen-adapters  Also listen on this computer's network adapters
Connect another computer using an SSH forward to the loopback port.`);
    return;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid port");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") await protectWindowsDirectory(directory);
  else chmodSync(directory, 0o700);
  if (command === "desktop") {
    const desktopDirectory = option("desktop-data-dir", "");
    if (!desktopDirectory) throw new Error("Provide --desktop-data-dir");
    console.log(JSON.stringify(await prepareDesktopHost(directory, resolve(desktopDirectory),
      fileURLToPath(import.meta.url), port, option("legacy-orchestration-manifest", "") || undefined)));
    return;
  }
  if (command === "connection-info") {
    console.log(JSON.stringify(await connectionInfo(directory)));
    return;
  }
  if (command === "service" && args[1] === "uninstall") {
    const notes = await uninstallService();
    // Also stops a manually started host, or one the service manager left.
    const state = readRunning();
    if (state) {
      await lifecycle(state, "stop").catch(() => undefined);
      for (let i = 0; i < 200 && existsSync(statePath); i++)
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
    console.log(
      [
        existsSync(statePath)
          ? "The host service was removed, but the host is still running. Run stop, or end its process."
          : "The host is stopped and will not start automatically.",
        `Sessions, logs and device credentials are kept in ${directory}. Delete that directory only if you want to erase them.`,
        ...notes,
      ].join("\n"),
    );
    return;
  }
  if (command === "service") {
    if (args[1] !== "install")
      throw new Error("Use: service install, or service uninstall");
    console.log(
      JSON.stringify(
        await installService({
          directory,
          port,
          executable: process.execPath,
          entry: fileURLToPath(import.meta.url),
        }),
      ),
    );
    return;
  }
  if (command === "status" || command === "stop") {
    const state = readRunning();
    if (!state) {
      console.log("Host is stopped");
      return;
    }
    await lifecycle(state, command);
    console.log(
      command === "stop"
        ? "Host is stopping"
        : `Host is running (PID ${state.pid}, port ${state.port})`,
    );
    return;
  }
  if (command === "start") {
    const log = openSync(join(directory, "host.log"), "a", 0o600);
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.url),
        "serve",
        "--data-dir",
        directory,
        "--port",
        String(port),
        ...(listenAdapters ? ["--listen-adapters"] : []),
      ],
      {
        detached: true,
        windowsHide: true,
        stdio: ["ignore", log, log],
        env: process.env,
      },
    );
    child.unref();
    closeSync(log);
    for (let i = 0; i < (process.platform === "win32" ? 150 : 50); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const state = readRunning();
      if (state && state.pid === child.pid) {
        console.log(
          `Host started on 127.0.0.1:${state.port}. It will continue after this terminal closes.`,
        );
        return;
      }
    }
    throw new Error(`Host did not start. See ${join(directory, "host.log")}`);
  }
  const store = new HostStore(join(directory, "host.db"));
  if (command === "pair") {
    const device = store.issueDevice(
      option("name", "Desktop"),
      option("token", "") || undefined,
    );
    console.log(
      JSON.stringify(
        { ...device, environmentId: store.environmentId },
        null,
        args.includes("--json") ? undefined : 2,
      ),
    );
    store.close();
    return;
  }
  if (command === "devices") {
    console.log(
      JSON.stringify(
        store.db.prepare("SELECT id, name FROM devices").all(),
        null,
        2,
      ),
    );
    store.close();
    return;
  }
  if (command === "revoke") {
    if (!args[1] || args[1].startsWith("--"))
      throw new Error("Provide a device ID to revoke");
    const revoked = store.revokeDevice(args[1]);
    store.close();
    if (!revoked) throw new Error("Device not found");
    console.log("Device revoked");
    return;
  }
  if (command !== "serve") {
    store.close();
    throw new Error("Unknown command; run with --help");
  }
  const releaseOwner = await acquireHostOwner(directory);
  const backend = new HostChildBackend({}, join(directory, "desktop-owner.json"), store);
  let cleanup = () => {
    rmSync(statePath, { force: true });
    store.close();
    releaseOwner();
  };
  try {
    configureChildBackend(backend);
    const release = await acquireHarnessBridge();
    const discoverAvailableProviders = async (): Promise<RemoteProvider[]> => {
      const detected = await Promise.all(
        REMOTE_PROVIDERS.map(async (provider) => {
          try {
            await backend.resolve(provider);
            return provider;
          } catch {
            return undefined;
          }
        }),
      );
      return detected.filter(
        (provider): provider is RemoteProvider => provider !== undefined,
      );
    };
    const available = await discoverAvailableProviders();
    const engine = new HostEngine(store, hostProviders, undefined, { entry: fileURLToPath(import.meta.url) });
    backend.configureSessionEnvironment((id) => ({ ...engine.workflows.environment(id), ...engine.orchestration.environment(id), ...engine.assistant.environment(id) }));
    await engine.ready;
    const secret = randomBytes(32).toString("base64url");
    let stopping = false;
    let stop: () => Promise<void>;
    let closeAdapters = () => {};
    // A separate local administrative credential cannot be used as a paired
    // client credential, and is never sent to the desktop.
    const server = createHostServer(engine, available, (request, response) => {
      if (
        request.method !== "POST" ||
        request.headers.origin ||
        request.headers.authorization !== `Bearer ${secret}`
      ) {
        response.writeHead(403).end();
        return;
      }
      let body = "";
      request.on("data", (chunk) => {
        body += String(chunk);
        if (body.length > 4 * 1024 * 1024) request.destroy();
      });
      request.on("end", async () => {
        try {
          const input = JSON.parse(body);
          const action = input.action;
          if (action === "retireLegacyOrchestration") {
            await engine.retireLegacyOrchestration(input.manifest as LegacyRetirementManifest);
            response.end(JSON.stringify({ retired: true }));
            return;
          }
          if (action !== "status" && action !== "stop") {
            response.writeHead(400).end();
            return;
          }
          response.end(JSON.stringify({ sharedDesktop: 2, orchestrationHost: 1, nativeSessionAccess: 1, nativeSessionManager: 1, imHost: 1, orchestrationActive: engine.orchestration.hasActiveWork() }));
          if (action === "stop") void stop();
        } catch {
          response.writeHead(400).end();
        }
      });
    }, discoverAvailableProviders);
    stop = async () => {
      if (stopping) return;
      stopping = true;
      closeAdapters();
      server.close();
      server.closeAllConnections();
      await engine.close();
      await backend.close();
      release();
      cleanup();
    };
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", resolve);
    });
    if (listenAdapters) closeAdapters = listenOnAdapters(server, port);
    writeFileSync(
      statePath,
      JSON.stringify({ pid: process.pid, port, secret }),
      { mode: 0o600 },
    );
    process.once("SIGTERM", () => {
      void stop();
    });
    process.once("SIGINT", () => {
      void stop();
    });
    console.log(
      `MonoCode Host ${store.environmentId} listening on 127.0.0.1:${port}`,
    );
    console.log(
      `Providers: ${available.join(", ") || "none found; install and authenticate a supported provider on this host"}`,
    );
    cleanup = () => {
      rmSync(statePath, { force: true });
      store.close();
      releaseOwner();
    };
  } catch (error) {
    await backend.close();
    cleanup();
    throw error;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
