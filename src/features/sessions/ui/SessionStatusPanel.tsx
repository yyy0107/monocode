import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import {
  Bot,
  ChevronRight,
  FileScript,
  FoldVertical,
  Gauge,
  GitBranch,
  GitCompare,
  ListEnd,
  Terminal,
} from "../../../shared/ui/icons";
import { GlassBackdrop } from "../../../app/shell/GlassBackdrop";
import { useSessionHeaderActions } from "../../workspace/ui/SessionHeaderActions";
import type { Block } from "../model/session";
import {
  buildSessionStatusPanelModel,
  focusedTaskWindow,
  sessionStatusSummary,
  type SessionStatusGit,
  type SessionStatusPanelModel,
} from "../model/sessionStatusPanel";
import { taskListProgressLabel } from "../model/taskList";
import { TaskState } from "./TaskListPreview";
import { TerminalSpinner } from "./TerminalSpinner";

/** Transcript width at which the panel opens on its own, as in ZCode. */
const AUTO_EXPAND_WIDTH = 1280;
const MOTION_MS = 340;

// Manual choices outlive pane remounts but not the app; auto mode is the default.
const overrides = new Map<string, boolean>();

function useWide(scope: RefObject<HTMLElement | null>): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const element = scope.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const update = () =>
      setWide(element.getBoundingClientRect().width >= AUTO_EXPAND_WIDTH);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scope]);
  return wide;
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      query?.addEventListener("change", listener);
      return () => query?.removeEventListener("change", listener);
    },
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    () => false,
  );
}

export function SessionStatusPanel({
  sessionId,
  blocks,
  backgroundTasks,
  busy,
  git,
  scope,
  onNavigate,
}: {
  sessionId: string;
  blocks: Block[];
  backgroundTasks?: string[];
  busy: boolean;
  git: SessionStatusGit | null;
  scope: RefObject<HTMLElement | null>;
  onNavigate: (blockId: string) => void;
}) {
  const model = useMemo(
    () => buildSessionStatusPanelModel({ blocks, backgroundTasks, busy, git }),
    [blocks, backgroundTasks, busy, git],
  );
  const wide = useWide(scope);
  const [override, setOverride] = useState(() => overrides.get(sessionId));
  useEffect(() => setOverride(overrides.get(sessionId)), [sessionId]);
  const expanded = override ?? wide;
  const reduced = useReducedMotion();
  const { t: uiT } = useTranslation();
  const toggle = (next: boolean) => {
    overrides.set(sessionId, next);
    setOverride(next);
  };

  if (!model.hasContent) return null;
  return (
    <aside
      aria-label={uiT("Status")}
      data-state={expanded ? "expanded" : "collapsed"}
      className={`pointer-events-auto absolute top-2 right-3 z-30 isolate max-w-[calc(100%_-_24px)] overflow-hidden border border-content/10 text-content shadow-xl ${
        expanded ? "w-80 rounded-2xl" : "w-60 rounded-[17px]"
      }`}
      style={{
        transition: reduced
          ? "none"
          : `width ${MOTION_MS}ms var(--collapse-easing, cubic-bezier(0.22, 1, 0.36, 1)), border-radius ${MOTION_MS}ms ease`,
      }}
    >
      <GlassBackdrop />
      <div className="relative z-[1] flex max-h-[min(64dvh,32rem)] flex-col">
        <PanelHeader
          model={model}
          expanded={expanded}
          onToggle={() => toggle(!expanded)}
        />
        <AnimatedCollapse
          expanded={expanded}
          motion="height"
          durationMs={MOTION_MS}
          className="min-h-0"
        >
          <div className="max-h-[calc(min(64dvh,32rem)_-_34px)] overflow-x-hidden overflow-y-auto px-1.5 pb-1.5">
            <PanelSections model={model} onNavigate={onNavigate} />
          </div>
        </AnimatedCollapse>
      </div>
    </aside>
  );
}

function PanelHeader({
  model,
  expanded,
  onToggle,
}: {
  model: SessionStatusPanelModel;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t: uiT } = useTranslation();
  if (expanded) {
    return (
      <div className="flex h-8 shrink-0 items-center justify-between gap-2 pr-1 pl-3">
        <span className="text-[12px] font-semibold text-content/80">
          {uiT("Status")}
        </span>
        <button
          type="button"
          title={uiT("Collapse")}
          aria-label={uiT("Collapse")}
          aria-expanded
          onClick={onToggle}
          className="grid size-6 place-items-center rounded-md text-content/45 hover:bg-content/10 hover:text-content"
        >
          <FoldVertical className="size-3.5" />
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      title={uiT("Show status")}
      aria-label={uiT("Show status")}
      aria-expanded={false}
      onClick={onToggle}
      className="flex h-8 w-full min-w-0 shrink-0 items-center gap-2 px-3 text-left text-[12px] text-content/75 hover:text-content"
    >
      <SummaryContent model={model} />
    </button>
  );
}

function SummaryContent({ model }: { model: SessionStatusPanelModel }) {
  const { t: uiT } = useTranslation();
  const summary = sessionStatusSummary(model);
  if (!summary) return null;
  const icon = (node: ReactNode) => (
    <span className="grid size-4 shrink-0 place-items-center text-content/55">
      {node}
    </span>
  );
  switch (summary.kind) {
    case "task":
      return (
        <>
          {icon(
            <TaskState
              status={summary.status === "current" ? "in_progress" : "completed"}
            />,
          )}
          <span className="min-w-0 flex-1 truncate">{summary.text}</span>
        </>
      );
    case "git":
      return (
        <>
          {icon(<GitCompare className="size-3.5" />)}
          <DiffCounts
            additions={summary.additions}
            deletions={summary.deletions}
          />
        </>
      );
    case "progress":
      return (
        <>
          {icon(<ListEnd className="size-3.5" />)}
          <span className="font-mono text-[11px]">
            {summary.completed}/{summary.total}
          </span>
        </>
      );
    case "plan":
      return (
        <>
          {icon(<FileScript className="size-3.5" />)}
          <span className="min-w-0 flex-1 truncate">{summary.text}</span>
        </>
      );
    case "running": {
      const Icon =
        summary.agents && summary.background
          ? Gauge
          : summary.agents
            ? Bot
            : Terminal;
      return (
        <>
          {icon(<Icon className="size-3.5" />)}
          <span className="min-w-0 flex-1 truncate">
            {uiT("{count} running", { count: String(summary.count) })}
          </span>
        </>
      );
    }
  }
}

function DiffCounts({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  return (
    <span className="shrink-0 font-mono text-[11px] tabular-nums">
      <span className="text-emerald-400">+{additions}</span>
      <span className="text-content/30"> / </span>
      <span className="text-rose-400">-{deletions}</span>
    </span>
  );
}

function PanelSections({
  model,
  onNavigate,
}: {
  model: SessionStatusPanelModel;
  onNavigate: (blockId: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const actions = useSessionHeaderActions();
  const [moreTasks, setMoreTasks] = useState(false);
  const tasks = model.tasks;
  const span = tasks ? focusedTaskWindow(tasks) : null;
  const folded = tasks && span ? tasks.length - (span.end - span.start) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      {model.git ? (
        <Section icon={GitCompare} title={uiT("Changes")}>
          <button
            type="button"
            disabled={!actions}
            onClick={() => {
              if (actions && !actions.changesOpen) actions.toggleChanges();
            }}
            className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] enabled:hover:bg-content/7"
          >
            <DiffCounts
              additions={model.git.additions}
              deletions={model.git.deletions}
            />
            {model.git.branch ? (
              <span className="flex min-w-0 flex-1 items-center gap-1 text-content/55">
                <GitBranch className="size-3 shrink-0" />
                <span className="truncate font-mono text-[11px]">
                  {model.git.branch}
                </span>
              </span>
            ) : (
              <span className="flex-1" />
            )}
            <ChevronRight
              className="size-3 shrink-0 text-content/35"
            />
          </button>
        </Section>
      ) : null}
      {tasks && span ? (
        <Section
          icon={ListEnd}
          title={uiT("Tasks")}
          meta={taskListProgressLabel(tasks)}
        >
          <ol>
            {folded > 0 ? (
              <>
                <AnimatedCollapse expanded={moreTasks} motion="height">
                  {() => <TaskRows items={tasks.slice(0, span.start)} />}
                </AnimatedCollapse>
                <TaskRows items={tasks.slice(span.start, span.end)} />
                <AnimatedCollapse expanded={moreTasks} motion="height">
                  {() => <TaskRows items={tasks.slice(span.end)} />}
                </AnimatedCollapse>
                <li>
                  <button
                    type="button"
                    onClick={() => setMoreTasks((value) => !value)}
                    className="w-full rounded-md px-2 py-1 text-left font-mono text-[11px] text-content/45 hover:bg-content/7 hover:text-content/70"
                  >
                    {moreTasks
                      ? uiT("Show fewer")
                      : uiT("+{count} more", { count: String(folded) })}
                  </button>
                </li>
              </>
            ) : (
              <TaskRows items={tasks} />
            )}
          </ol>
        </Section>
      ) : null}
      {model.plans.length ? (
        <Section icon={FileScript} title={uiT("Plans")}>
          {model.plans.map((plan) => (
            <RowButton key={plan.blockId} onClick={() => onNavigate(plan.blockId)}>
              <span className="min-w-0 flex-1 truncate">{plan.title}</span>
            </RowButton>
          ))}
        </Section>
      ) : null}
      {model.subagents.length ? (
        <Section icon={Bot} title={uiT("Agents")}>
          {model.subagents.map((agent) => (
            <RowButton
              key={agent.blockId}
              onClick={() => onNavigate(agent.blockId)}
            >
              <TerminalSpinner />
              <span className="min-w-0 flex-1 truncate">{agent.name}</span>
              {agent.model ? (
                <span className="shrink-0 font-mono text-[10px] text-content/40">
                  {agent.model}
                </span>
              ) : null}
            </RowButton>
          ))}
        </Section>
      ) : null}
      {model.background.length ? (
        <Section icon={Terminal} title={uiT("Background")}>
          {model.background.map((description, index) => (
            <div
              key={`${index}:${description}`}
              className="flex min-w-0 items-center gap-2 px-2 py-1 text-[12px] text-content/70"
            >
              <TerminalSpinner />
              <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                {description}
              </span>
            </div>
          ))}
        </Section>
      ) : null}
    </div>
  );
}

function TaskRows({ items }: { items: SessionStatusPanelModel["tasks"] }) {
  return (
    <>
      {(items ?? []).map((item, index) => (
        <li
          key={item.id ?? `${index}:${item.text}`}
          className="flex min-w-0 items-start gap-2 px-2 py-1"
        >
          <TaskState status={item.status} />
          <span
            className={`min-w-0 flex-1 text-[12px] leading-4 ${
              item.status === "completed" || item.status === "cancelled"
                ? "text-content/40 line-through decoration-content/25"
                : item.status === "in_progress"
                  ? "text-content/85"
                  : "text-content/60"
            }`}
          >
            {item.text}
          </span>
        </li>
      ))}
    </>
  );
}

function Section({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: typeof GitCompare;
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-content/8 bg-content/[0.035] py-1">
      <div className="flex items-center gap-1.5 px-2 pt-0.5 pb-1">
        <Icon className="size-3.5 shrink-0 text-content/45" />
        <h3 className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-content/70">
          {title}
        </h3>
        {meta ? (
          <span className="shrink-0 rounded-full bg-content/7 px-2 py-0.5 font-mono text-[10px] text-content/50">
            {meta}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function RowButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] text-content/70 hover:bg-content/7 hover:text-content"
    >
      {children}
    </button>
  );
}
