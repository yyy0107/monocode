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
      error: (error) => translate(assistantErrorMessage(error)),
    },
  );
}
