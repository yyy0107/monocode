import { useState } from "react";
import { useTranslation } from "../../../../../shared/i18n/useTranslation";
import type { ToolQuestionRecord } from "../../../model/session";
import { selectedAnswerLabels } from "../../../model/userQuestion";
import { useLivePhaseScroll } from "../useLivePhaseScroll";

/**
 * What a call printed. A running command's output scrolls in a short window
 * pinned to its newest line; once it settles the window keeps its place.
 */
export function ToolOutput({
  text,
  live,
  failed,
}: {
  text: string;
  live: boolean;
  failed: boolean;
}) {
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  useLivePhaseScroll(scroller, live, text);
  return (
    <div
      ref={setScroller}
      data-tool-output=""
      className="max-h-60 min-w-0 overflow-auto rounded-md bg-content/4 px-2.5 py-1.5"
    >
      <pre
        className={`min-w-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-5 ${
          failed ? "text-red-400/80" : "text-content/60"
        }`}
      >
        {text}
      </pre>
    </div>
  );
}

/** Each question the agent asked, with the answer it got back. */
export function QuestionRecord({ record }: { record: ToolQuestionRecord }) {
  const { t } = useTranslation();
  const reply = record.reply;
  return (
    <ol data-tool-questions="" className="flex min-w-0 flex-col gap-2 py-1">
      {record.items.map((question) => {
        const answers =
          reply?.kind === "answered"
            ? selectedAnswerLabels(question, reply)
            : [];
        const status = !reply
          ? t("Waiting for an answer")
          : reply.kind === "skipped"
            ? t("Skipped")
            : reply.kind === "cancelled"
              ? t("Cancelled")
              : answers.length === 0
                ? t("No answer")
                : undefined;
        return (
          <li key={question.id} className="flex min-w-0 flex-col gap-0.5">
            {question.header ? (
              <span className="font-sans text-[11px] uppercase tracking-wide text-content/40">
                {question.header}
              </span>
            ) : null}
            <span className="whitespace-pre-wrap break-words font-sans text-sm text-content/75">
              {question.prompt}
            </span>
            {status ? (
              <span className="font-sans text-sm text-content/45">
                {status}
              </span>
            ) : (
              <span className="whitespace-pre-wrap break-words font-sans text-sm text-content/90">
                {answers.join(", ")}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
