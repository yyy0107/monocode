import { createContext } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { copyMessage, copyText } from "../../../platform/tauri/clipboard";
import { readBinaryFile } from "../../../platform/tauri/fs";
import type { TextRevealOptions } from "./wordFade";
import type { TextRevealQueue } from "./textRevealQueue";
import type { Block } from "../model/session";

/** Rendering stays shared; each client supplies its native services. */
const desktopPlatform = {
  copyMessage: (...args: Parameters<typeof copyMessage>) =>
    copyMessage(...args),
  copyText: (text: string) => copyText(text),
  openExternal: (url: string) => openUrl(url),
  readBinaryFile: (path: string) => readBinaryFile(path),
  localFiles: true,
};
export const TranscriptPlatformContext = createContext<
  typeof desktopPlatform & {
    textReveal?: (blockId?: string) => TextRevealOptions;
    textRevealQueue?: TextRevealQueue;
    /** Clients without a side panel show a finished tool call's details on tap. */
    openTool?: (block: Block) => void;
  }
>(desktopPlatform);
