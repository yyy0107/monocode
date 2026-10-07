import { useContext, useState } from "react";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { ChevronDown, ChevronRight, MessageSquare } from "../../../shared/ui/icons";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import type { QuestionAnswer, UserQuestionRecord } from "../model/userQuestion";
import { questionRecordAnswers } from "../model/questionHistory";
import { QuestionHistoryForm } from "./QuestionHistoryForm";
import { TranscriptPlatformContext } from "./TranscriptPlatform";

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
  const { openQuestion } = useContext(TranscriptPlatformContext);
  const [open, setOpen] = useState(false);
  const canAnswer =
    question.allowLateReply &&
    !pending &&
    !question.reply &&
    question.decision !== "answered" &&
    !!onAnswer;
  const sheet = canAnswer && !!openQuestion;
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
        aria-expanded={sheet ? undefined : open}
        aria-haspopup={sheet ? "dialog" : undefined}
        onClick={() => sheet ? openQuestion?.(blockId) : setOpen((value) => !value)}
      >
        <MessageSquare className="size-3.5 shrink-0 text-content/50" />
        <span className="min-w-0 flex-1 break-words">
          {question.title || question.questions[0]?.prompt || t("Question")}
        </span>
        <span className="shrink-0 text-[11px] text-content/50">
          {canAnswer ? t("Answer question") : status}
        </span>
        {sheet ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown
          className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />}
      </button>
      <AnimatedCollapse expanded={open && !sheet}>
        {canAnswer && !sheet ? (
          <QuestionHistoryForm
            blockId={blockId}
            question={question}
            onAnswer={onAnswer!}
            onClose={() => setOpen(false)}
          />
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
      </AnimatedCollapse>
    </div>
  );
}
