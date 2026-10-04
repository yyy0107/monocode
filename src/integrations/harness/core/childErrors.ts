export const HOST_OUTPUT_LIMIT_ERROR =
  "Agent output exceeded the 64 MiB message limit.";
export const HOST_DIAGNOSTIC_LIMIT_ERROR =
  "Agent diagnostic output exceeded the 8 MiB message limit.";

/** Translate only errors owned by the Host; provider/user text stays intact. */
export function localizeChildExitError(
  message: string,
  translate: (key: string) => string,
): string {
  return message === HOST_OUTPUT_LIMIT_ERROR ||
    message === HOST_DIAGNOSTIC_LIMIT_ERROR
    ? translate(message)
    : message;
}
