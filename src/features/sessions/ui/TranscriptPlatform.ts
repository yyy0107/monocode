import { createContext } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { copyMessage, copyText } from "../../../platform/tauri/clipboard";
import { readBinaryFile } from "../../../platform/tauri/fs";

/** Rendering stays shared; each client supplies its native services. */
export const TranscriptPlatformContext = createContext({
  copyMessage: (...args: Parameters<typeof copyMessage>) =>
    copyMessage(...args),
  copyText: (text: string) => copyText(text),
  openExternal: (url: string) => openUrl(url),
  readBinaryFile: (path: string) => readBinaryFile(path),
  localFiles: true,
});
