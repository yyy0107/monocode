import type { AssistantRpc } from "./assistantClient";
import type { SessionReference } from "./assistant";
import { assistantErrorMessage } from "./assistantErrors";
import { translate } from "../../../shared/i18n/language";
import { withStatusToast } from "../../../shared/ui/StatusToast";

export function delegateSession(
  rpc: AssistantRpc,
  ref: SessionReference,
): Promise<unknown> {
  return withStatusToast(
    () =>
      rpc("assistant.control", {
        action: "delegateSession",
        commandId: crypto.randomUUID(),
        ...ref,
      }),
    {
      loading: translate("Handing over to assistant…"),
      success: translate("Conversation handed over to assistant"),
      error: (error) => translate(delegateErrorMessage(error)),
    },
  );
}

const HOST_TOO_OLD =
  "This Host is too old to take over conversations. Update MonoCode on that Host and try again.";

/** Hosts from before hand-over validate these fields as another control and reject them. */
function delegateErrorMessage(error: unknown): string {
  const message = assistantErrorMessage(error);
  return /unknown input field/i.test(message) ? HOST_TOO_OLD : message;
}
