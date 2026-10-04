import { invoke, isTauri } from "@tauri-apps/api/core";
import { translate } from "../../../shared/i18n/language";
import type { HarnessId } from "../../../features/sessions/model/session";
import type { HarnessSessionInput } from "./types";

/** The last UI probe is advisory; every provider mutation gets a fresh backend check. */
export async function withNativeSessionAccess<T>(
  input: HarnessSessionInput & { harness: HarnessId },
  run: () => Promise<T>,
): Promise<T> {
  const source = input.nativeSession;
  if (!source) return run();
  if (
    source.provider !== input.harness ||
    typeof isTauri !== "function" ||
    !isTauri()
  )
    throw new Error(
      translate("Native session ownership cannot be verified on this platform"),
    );
  let token: string;
  try {
    token = await invoke<string>("native_session_acquire", {
      sessionId: input.sessionId,
      path: source.path,
      providerSessionId: source.providerSessionId,
    });
  } catch (error) {
    throw new Error(
      translate(error instanceof Error ? error.message : String(error)),
    );
  }
  if (typeof token !== "string" || !token)
    throw new Error(
      translate("Native session ownership could not be verified"),
    );
  try {
    return await run();
  } finally {
    await invoke("native_session_release", {
      sessionId: input.sessionId,
      token,
    });
  }
}

export async function assertNativeSessionAccess(
  input: Pick<HarnessSessionInput, "sessionId" | "nativeSession">,
): Promise<void> {
  if (!input.nativeSession) return;
  if (typeof isTauri !== "function" || !isTauri())
    throw new Error(
      translate("Native session ownership cannot be verified on this platform"),
    );
  const probe = await invoke<{ access: { state: string } }>(
    "native_session_probe",
    {
      sessionId: input.sessionId,
      ownOperationActive: true,
      path: input.nativeSession.path,
      providerSessionId: input.nativeSession.providerSessionId,
    },
  );
  if (probe?.access?.state !== "idle")
    throw new Error(
      translate(
        "Native session is open in another CLI or its ownership is unknown",
      ),
    );
}
