import { expect, it } from "vitest";
import { translate } from "../../../shared/i18n/language";
import { HOST_OUTPUT_LIMIT_ERROR, HOST_DIAGNOSTIC_LIMIT_ERROR, localizeChildExitError } from "./childErrors";

it("localizes Host limit errors at display time and preserves provider text", () => {
  const t = (text: string) => translate(text, undefined, "zh-CN");
  expect(localizeChildExitError(HOST_OUTPUT_LIMIT_ERROR, t)).toBe("Agent 输出超过了 64 MiB 的消息大小上限。");
  expect(localizeChildExitError(HOST_DIAGNOSTIC_LIMIT_ERROR, t)).toBe("Agent 诊断输出超过了 8 MiB 的消息大小上限。");
  expect(localizeChildExitError("Server error: image unavailable", t)).toBe("Server error: image unavailable");
});
