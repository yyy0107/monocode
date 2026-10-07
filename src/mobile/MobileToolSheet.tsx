import { useContext, useState, type ReactNode } from "react";
import { isReadTool } from "../integrations/harness/core/preview";
import { FilePreview } from "../features/files/ui/FilePreview";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import {
  toolCallLabel,
  toolCallState,
} from "../features/sessions/model/transcriptActivity";
import type { Block } from "../features/sessions/model/session";
import { resolveWorkspacePath } from "../shared/lib/paths";
import { useTranslation } from "../shared/i18n/useTranslation";
import { Check, Copy, File as FileIcon } from "../shared/ui/icons";
import { MobileSheet } from "./MobileSheet";

type ReadOutput = { count: number; start?: number; end?: number };

/** Numbered results identify a range; plain output only identifies a count. */
function returnedReadLines(output: string): ReadOutput {
  const lines = output.trimEnd().split(/\r?\n/);
  const numbers = lines.map((line) => {
    const match = /^\s*(\d+)[\t→]/.exec(line);
    return match ? Number(match[1]) : NaN;
  });
  const start = numbers[0];
  if (
    start > 0 &&
    numbers.every(
      (number, index) =>
        Number.isSafeInteger(number) && number === start + index,
    )
  ) {
    return { count: lines.length, start, end: numbers[numbers.length - 1] };
  }
  return { count: lines.length };
}

/** The parts of a tool call worth reading on a phone, in display order. */
export function toolDetails(block: Block, cwd?: string) {
  const tool = block.tool;
  const label = toolCallLabel(block, cwd);
  const preview = tool?.preview;
  const state = toolCallState(block);
  const detail = tool?.detail?.trim();
  const body = detail && detail !== label ? detail : undefined;
  const result = preview?.output?.trimEnd() || undefined;
  // Most adapters replace detail with the returned text on completion. Older
  // shell previews may carry output separately and leave the request in detail.
  const output = result ?? (state !== "pending" ? body : undefined);
  const input = result && body && body !== result ? body : undefined;
  // A running detail can be a request or partial output; do not mislabel it.
  const details = !input && !output ? body : undefined;
  const path = preview?.path
    ? (resolveWorkspacePath(preview.path, cwd) ?? preview.path)
    : undefined;
  const showsDiff =
    !!preview &&
    (preview.contentOnly ||
      !!preview.lines?.some((line) => line.kind !== "context"));
  return {
    label,
    state,
    input,
    output,
    details,
    readOutput:
      output && state === "accepted" && isReadTool(tool?.kind, label, preview)
        ? returnedReadLines(output)
        : undefined,
    path,
    preview: showsDiff ? preview : undefined,
  };
}

const STATE_LABEL = {
  accepted: "Completed",
  rejected: "Failed",
  pending: "Running",
} as const;

/** Bottom sheet with a finished tool call's input, output and diff. */
export function MobileToolSheet({
  open = true,
  onExited,
  block,
  cwd,
  onOpenFile,
  onBack,
  onClose,
}: {
  open?: boolean;
  onExited?: () => void;
  block: Block;
  cwd?: string;
  onOpenFile?: (path: string) => void;
  /** Returns to the step list this call was opened from. */
  onBack?: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { copyText } = useContext(TranscriptPlatformContext);
  const [copied, setCopied] = useState<string>();
  const { label, state, input, output, details, readOutput, path, preview } =
    toolDetails(block, cwd);

  const copy = (key: string, text: string) => {
    void copyText(text).then(() => {
      setCopied(key);
      window.setTimeout(
        () => setCopied((value) => (value === key ? undefined : value)),
        1200,
      );
    });
  };

  const outputNotice = readOutput ? (
    <p className="mobile-detail-note mobile-read-notice" role="note">
      <span>
        {readOutput.start === 1
          ? t(
              "Tool returned the first {count} lines; this may not be the complete file.",
              { count: readOutput.count },
            )
          : readOutput.start !== undefined
            ? t(
                "Tool returned lines {start}–{end}; this may not be the complete file.",
                { start: readOutput.start, end: readOutput.end! },
              )
            : t(
                "Tool returned {count} lines; this may not be the complete file.",
                { count: readOutput.count },
              )}
      </span>
      {path && onOpenFile ? (
        <span>{t("Tap “View file” to see the complete contents.")}</span>
      ) : null}
    </p>
  ) : undefined;

  const section = (
    key: string,
    title: string,
    text: string,
    notice?: ReactNode,
  ) => (
    <section className="mobile-detail-section">
      <div className="mobile-detail-section-head">
        <h3>{t(title)}</h3>
        <button
          type="button"
          className="mobile-detail-copy"
          aria-label={t(copied === key ? "Copied" : "Copy")}
          onClick={() => copy(key, text)}
        >
          {copied === key ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      {notice}
      <pre className="mobile-detail-pre">{text}</pre>
    </section>
  );

  return (
    <MobileSheet open={open} onExited={onExited} title="Tool details" onBack={onBack} onClose={onClose}>
      <div className="mobile-tool-sheet">
        <header className="mobile-detail-header">
          <div className="mobile-detail-title">
            <strong className="mobile-detail-mono">{label}</strong>
            <small data-state={state}>{t(STATE_LABEL[state])}</small>
          </div>
        </header>
        {preview ? (
          <div className="mobile-detail-section">
            <FilePreview
              preview={preview}
              status={state}
              cwd={cwd}
              onOpenFile={onOpenFile}
            />
          </div>
        ) : null}
        {input ? section("input", "Input", input) : null}
        {output ? section("output", "Output", output, outputNotice) : null}
        {details ? section("details", "Details", details) : null}
        {!preview && !input && !output && !details ? (
          <p className="mobile-muted mobile-detail-note">
            {t("This tool call has no further details.")}
          </p>
        ) : null}
        {path && onOpenFile ? (
          <button
            type="button"
            className="mobile-button mobile-detail-action"
            onClick={() => onOpenFile(path)}
          >
            <FileIcon size={16} />
            {t("View file")}
          </button>
        ) : null}
      </div>
    </MobileSheet>
  );
}
