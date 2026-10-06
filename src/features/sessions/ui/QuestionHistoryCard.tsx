import { useState } from "react";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { ChevronDown, MessageSquare } from "../../../shared/ui/icons";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import type { QuestionAnswer, UserQuestionRecord } from "../model/userQuestion";
import { questionRecordAnswers } from "../model/questionHistory";
import { QuestionForm } from "./QuestionForm";

export function QuestionHistoryCard({
  blockId,
  question,
  pending,
  onAnswer,
}: {
  blockId: string;
  question: UserQuestionRecord;
  pending: boolean;
  onAnswer?: (
    answer: QuestionAnswer,
  ) => boolean | void | Promise<boolean | void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const canAnswer =
    question.allowLateReply &&
    !pending &&
    !question.reply &&
    question.decision !== "answered" &&
    !!onAnswer;
  const status =
    question.reply || question.decision === "answered"
      ? t("Answered")
      : pending
        ? t("Waiting for answers")
        : t("Not answered");
  return (
    <div
      className="question-history mx-4 my-2 rounded-lg border border-content/10 font-sans"
      data-question-history={blockId}
    >
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-content/5"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MessageSquare className="size-3.5 shrink-0 text-content/50" />
        <span className="min-w-0 flex-1 break-words">
          {question.title || question.questions[0]?.prompt || t("Question")}
        </span>
        <span className="shrink-0 text-[11px] text-content/50">
          {canAnswer ? t("Answer question") : status}
        </span>
        <ChevronDown
          className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatedCollapse expanded={open}>
        {canAnswer ? (
          <fieldset
            disabled={sending}
            className="mobile-shared-question m-0 min-w-0 border-0 p-0"
          >
            <QuestionForm
              prompt={{ ...question, autoResolveAt: undefined }}
              onReply={async (_, reply) => {
                if (reply.kind === "skipped") {
                  setOpen(false);
                  return;
                }
                if (sending) return;
                setSending(true);
                setError(undefined);
                try {
                  const accepted = await onAnswer?.({ blockId, reply });
                  if (accepted !== false) setOpen(false);
                } catch (reason) {
                  setError(
                    t(reason instanceof Error ? reason.message : String(reason)),
                  );
                } finally {
                  setSending(false);
                }
              }}
            />
          </fieldset>
        ) : (
          <div className="space-y-3 px-3 pb-3 text-[12px]">
            {question.questions.map((item) => {
              const labels = question.reply
                ? questionRecordAnswers(item, question.reply)
                : [];
              return (
                <div key={item.id}>
                  <p className="whitespace-pre-wrap font-medium">
                    {item.prompt}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-content/65">
                    {labels.length
                      ? labels.join("\n")
                      : pending
                        ? t("Waiting for answers")
                        : t("Not answered")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
        {error ? (
          <p role="alert" className="px-3 pb-3 text-[12px] text-red-400">
            {error}
          </p>
        ) : null}
      </AnimatedCollapse>
    </div>
  );
}
