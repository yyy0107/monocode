import { AttachmentList } from "./AttachmentList";
import "./AgentTranscript.css";
import { useTranslation } from "../../../shared/i18n/useTranslation";
import { getUiLanguage, translate } from "../../../shared/i18n/language";
import { localizeChildExitError } from "../../../integrations/harness/core/childErrors";
import { providerSessionAccessIssue } from "../../../integrations/harness/providers/sessionAccessErrors";
import { SessionAccessNotice } from "./SessionAccessNotice";
import { QuestionHistoryCard } from "./QuestionHistoryCard";
import type { QuestionAnswer } from "../model/userQuestion";
import {
  AiIdea,
  ArrowUp,
  Check,
  ChevronRight,
  CircleDashed,
  CircleAlert,
  FilePlusCorner,
  MessageSquare,
  Pencil,
  PenLine,
  Bot,
  ChartBreakoutSquare,
  Search,
  Terminal,
  Trash2,
  Wrench,
} from "../../../shared/ui/icons";
import { reducedMotionQuery } from "../../../shared/lib/reducedMotion";
import {
  memo,
  createElement,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
import { AttachmentChip } from "./AttachmentChip";
import { GeneratedImage } from "./GeneratedImage";
import { MonocodeSparkles } from "./MonocodeSparkles";
import { OrchestratorConstellation } from "./OrchestratorConstellation";
import { PlanStepsBurst } from "./PlanStepsBurst";
import { FilePreview } from "../../files/ui/FilePreview";
import { PlanPreview } from "./PlanPreview";
import { OrchestrationPreview } from "../../orchestration/ui/OrchestrationPreview";
import { WorkflowRunCard, type WorkflowRunParent } from "../../workflows/ui/WorkflowRunCard";
import { localizeOrchestrationMessage } from "../../orchestration/ui/orchestrationMessages";
import { TaskListPreview } from "./TaskListPreview";
import { HandoffButton, SecondOpinionButton } from "./SecondOpinionButton";
import { SecondOpinionCard } from "./SecondOpinionCard";
import { NoteMiniCard } from "../../notes/ui/NoteMiniCard";

import { TerminalSpinner } from "./TerminalSpinner";
import { AnimatedCollapse } from "../../../shared/ui/AnimatedCollapse";
import { Popover } from "../../../shared/ui/Popover";
import { ProjectMascot } from "../../projects/ui/ProjectMascot";
import { useProjectMascotAppearance } from "../../projects/ui/useProjectMascotAppearance";
import type { ApprovalDecision } from "../../../integrations/harness";
import {
  isHarnessAuthError,
  supportsHarnessLogin,
} from "../../../integrations/harness/core/authSupport";
import {
  isEditTool,
  stubFilePreview,
} from "../../../integrations/harness/core/preview";
import { TranscriptPlatformContext } from "./TranscriptPlatform";
import { ToolRow } from "./transcript/tools/ToolRow";
import {
  ApprovalControls,
  ToolCallStatusIcon,
} from "./transcript/tools/ToolCallParts";
import {
  followsAfterScroll,
  useLivePhaseScroll,
} from "./transcript/useLivePhaseScroll";
import {
  AfterTextReveal,
  useTranscriptRenderingPlatform,
} from "./useTranscriptRenderingPlatform";
import { visibleUserPrompt } from "../../orchestration/model/orchestration";
import { playCue } from "../../settings/model/sounds";
import { legacyTaskListFromText } from "../model/taskList";
import { resolveModel } from "../model/models";
import { harnessForTurn } from "../model/secondOpinion";
import { TranscriptTurnCache } from "../model/transcriptTurnCache";
import { userTurnStartTimes } from "../model/turnTiming";
import { liveStatus } from "../model/liveStatus";
import { Shimmer } from "../../../shared/ui/Shimmer";
import { RollingClock, rollingClockMotion } from "../../../shared/ui/RollingClock";
import {
  hasPendingApproval,
  HARNESS_TITLE,
  type AgentStep,
  type Block,
  type HarnessId,
  type InterjectionMeta,
  type ModelTarget,
  type PlanBuildTarget,
  type TurnMetrics,
} from "../model/session";
import { HarnessIcon } from "./HarnessIcon";
import {
  innerScrollerTakes,
  useLockOverscroll,
} from "../../../shared/hooks/useLockOverscroll";
import { useTranscriptLayout } from "../hooks/useTranscriptLayout";
import { useTranscriptAnchor } from "../hooks/useTranscriptAnchor";
import { useTranscriptSelection } from "../hooks/useTranscriptSelection";
import type { TranscriptLayout } from "../../settings/model/appearance";
import { AgentMarkdown } from "./AgentMarkdown";
import { CopyTurnButton } from "./CopyTurnButton";
import { TranscriptSelectionMenu } from "./TranscriptSelectionMenu";
import { parseUserMessageLink } from "../model/linkPreview";
import { isAttachmentFolder } from "../model/attachments";
import { UserLinkPreview } from "./UserLinkPreview";
import {
  activityPhaseTitle,
  activityStillRunning,
  buildActivityPhases,
  firstFoldableIndex,
  foldableWork,
  foldedBlocks,
  initialThinkingIndex,
  isFailedStatus,
  isIncompleteTool,
  isSubagentBlock,
  isThinkingBlock,
  lastActivityIndex,
  isProseBlock,
  needsApproval,
  proseSummary,
  subagentBrief,
  subagentModelName,
  subagentName,
  subagentReport,
  toolCallLabel,
  toolCallState,
  turnCopyText,
  workDiffStats,
  workKind,
  workSummaryLine,
  type ActivityPhase,
  type ActivityPhaseKind,
  type ToolCallState,
  type TurnItem,
} from "../model/transcriptActivity";
import { lastUserTurnBlock } from "../model/editLastTurn";
import {
  monoCodeToolCall,
  monoCodeWorkSummary,
  type MonoCodeToolCall,
} from "../model/monocodeToolCall";
import {
  isOperatorUserTurn,
  operatorUserPrompt,
} from "../model/operatorCommand";
import {
  clearTranscriptHighlights,
  paintTranscriptHighlights,
  transcriptMutationNeedsRepaint,
  transcriptWordRanges,
} from "../model/transcriptHighlights";

const NEAR_BOTTOM_PX = 16;
/*
 * Tool calls often land in a burst. Each arrival waits for the one before it
 * to finish its whole entrance — rail, branch, row — before starting its own.
 * The first few play at STEP_ENTRANCE_MS; a queue running past
 * STEP_QUEUE_CALM_MS plays the rest faster, down to STEP_ENTRANCE_MIN_MS by
 * STEP_QUEUE_MS, so a long burst still catches up.
 */
const STEP_ENTRANCE_MS = 480;
const STEP_ENTRANCE_MIN_MS = 160;
const STEP_QUEUE_CALM_MS = 960;
const STEP_QUEUE_MS = 2000;
const INITIAL_TURNS = 20;
/**
 * Turns built before a transcript first paints. Every turn in the initial
 * window costs markdown work on open, so paint the latest few (more if they
 * leave the viewport short) and build the rest of the window after.
 */
const FIRST_PAINT_TURNS = 3;
const TURN_PAGE_SIZE = 20;

type Props = {
  blocks: Block[];
  busy?: boolean;
  cwd?: string;
  harness?: HarnessId;
  model?: string;
  modelSettings?: Record<string, string>;
  pendingQuestion?: boolean;
  pendingQuestionHistoryId?: string;
  onQuestionFollowUp?: (answer: QuestionAnswer) => boolean | void | Promise<boolean | void>;
  /** Work the agent left running when it yielded; the turn waits on it. */
  backgroundTasks?: string[];
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onAddToChat?: (text: string) => void;
  onSaveNote?: (text: string) => void | Promise<void>;
  onSendDraft?: (block: Block) => boolean | void;
  onRemoveDraft?: (block: Block) => boolean | void;
  onSaveSelectionNote?: (text: string) => void | Promise<void>;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
  onOpenPlan?: (blockId: string) => void;
  onBuildPlan?: (blockId: string, target?: PlanBuildTarget) => void;
  /** The plan whose decision panel is open; its card omits Build. */
  decidingPlanId?: string;
  planBuildTargets?: boolean;
  onSecondOpinion?: (target: ModelTarget, turn: Block[]) => void;
  onHandoff?: (target: ModelTarget, turn: Block[]) => void;
  onEditLastTurn?: () => void;
  editingLastTurn?: boolean;
  onJumpToBottomChange?: (show: boolean) => void;

  onJumpToBottomReady?: (jump: () => void) => void;
  /** Passes a function that renders the turn that holds a block. The render completes before the function returns. */
  onRevealReady?: (reveal: (blockId: string) => boolean) => void;
  onNavigateReady?: (
    navigate: (blockId: string | null, query?: string) => boolean,
  ) => void;
  /** Session-level output shown after the latest reply and before its action row. */
  latestTurnAccessory?: ReactNode;
  /** False while another tab is in front; local transcript state is retained. */
  visible?: boolean;
  /** Kept mounted after its pane closed. Showing it again counts as a new visit. */
  parked?: boolean;
  onScrollerChange?: (el: HTMLDivElement | null) => void;
  /** A worker's transcript: show the orchestrator's turns instead of hiding them. */
  managed?: boolean;
  /** Distinguish touch/reader scrolling from streamed layout growth. */
  touchScroll?: boolean;
  /** A just-submitted turn whose first response may already have arrived. */
  animateFrom?: string;
  /** A shorter, bottom-origin prompt entrance for the phone composer. */
  promptMotion?: "mobile";
  /** The conversation this transcript belongs to, for its workflow run cards. */
  workflowParent?: WorkflowRunParent;
};

function AgentTranscriptComponent({
  blocks: sourceBlocks,
  busy,
  cwd,
  harness,
  model,
  modelSettings,
  workflowParent,
  pendingQuestion = false,
  pendingQuestionHistoryId,
  onQuestionFollowUp,
  backgroundTasks,
  onApproval,
  onAddToChat,
  onSaveNote,
  onSendDraft,
  onRemoveDraft,
  onSaveSelectionNote,
  onOpenFile,
  onOpenDiff,
  onOpenPlan,
  onBuildPlan,
  decidingPlanId,
  planBuildTargets = true,
  onSecondOpinion,
  onHandoff,
  onEditLastTurn,
  editingLastTurn = false,
  onJumpToBottomChange,
  onJumpToBottomReady,
  onRevealReady,
  onNavigateReady,
  latestTurnAccessory,

  visible = true,
  parked = false,
  onScrollerChange,
  managed = false,
  touchScroll = true,
  animateFrom,
  promptMotion,
}: Props) {
  const renderingPlatform = useTranscriptRenderingPlatform(sourceBlocks, {
    animateFrom,
  });
  const { t: uiT } = useTranslation();
  const { liveClockInFooter, openActivity } = useContext(TranscriptPlatformContext);
  const clockInFooter = !!liveClockInFooter && !!cwd;
  const blocks = useMemo(() => {
    let turnHarness = harness;
    let changed = false;
    const visibleBlocks: Block[] = [];
    for (const block of sourceBlocks) {
      if (block.role === "user")
        turnHarness = block.turnModel?.harness ?? harness;
      if (
        harness &&
        supportsHarnessLogin(harness) &&
        block.role === "system" &&
        block.notice === "error" &&
        isHarnessAuthError(block.text)
      ) {
        changed = true;
        continue;
      }
      // Older Host histories did not tag startup errors; keep ownership notices outside folded work.
      if (
        turnHarness &&
        block.role === "system" &&
        !block.interjection &&
        !block.notice &&
        providerSessionAccessIssue(turnHarness, block.text)
      ) {
        visibleBlocks.push({ ...block, notice: "error" });
        changed = true;
      } else {
        visibleBlocks.push(block);
      }
    }
    return changed ? visibleBlocks : sourceBlocks;
  }, [harness, sourceBlocks]);
  const turnStartTimes = useMemo(() => userTurnStartTimes(blocks), [blocks]);
  const editableUserBlockId = useMemo(
    () => lastUserTurnBlock(blocks)?.id,
    [blocks],
  );
  const lockOverscroll = useLockOverscroll<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const transcriptEnd = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const showJumpRef = useRef(false);
  const distanceFromBottom = useRef(0);
  const scrollGeometry = useRef({ top: 0, height: 0, viewport: 0 });
  const scrollDirection = useRef<"up" | "down" | undefined>(undefined);
  const touchReadingUp = useRef(false);
  const prependHeight = useRef<number | null>(null);
  const wasVisible = useRef(false);
  const [scrollerEl, setScrollerEl] = useState<HTMLDivElement | null>(null);
  const [visibleTurnCount, setVisibleTurnCount] = useState(FIRST_PAINT_TURNS);
  // Turns whose folded work the reader has opened, by turn id.
  const [openWork, setOpenWork] = useState<Record<string, boolean>>({});
  const [searchCurrent, setSearchCurrent] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const highlightOwner = useRef(Symbol("transcript-search"));
  const toggleWork = useCallback((turnId: string, currentlyOpen: boolean) => {
    setOpenWork((open) => ({ ...open, [turnId]: !currentlyOpen }));
  }, []);
  // Stretch the last turn after a send while this tab stays open. Closing
  // the tab is a new visit: the remount uses the true transcript height so
  // the latest reply sits near the composer instead of a hole of empty space.
  const [anchorTurn, setAnchorTurn] = useState(
    !!busy || (promptMotion === "mobile" && !!animateFrom),
  );
  // Parking detaches the scroller, which drops its scroll offset.
  const restoreScroll = useRef(false);
  const wasParked = useRef(parked);
  if (wasParked.current !== parked) {
    wasParked.current = parked;
    if (parked) {
      restoreScroll.current = true;
      setSearchCurrent(null);
      setSearchQuery("");
    } else if (anchorTurn !== !!busy) {
      setAnchorTurn(!!busy);
    }
  }
  const { selection, dismissSelection } = useTranscriptSelection(
    scrollerEl,
    onAddToChat !== undefined || onSaveSelectionNote !== undefined,
  );
  const transcriptLayout = useTranscriptLayout();
  const promptAnchor = useTranscriptAnchor();
  const lastUserId = lastUserBlockId(blocks, managed);
  const seenUserId = useRef(lastUserId);
  if (lastUserId !== seenUserId.current) {
    seenUserId.current = lastUserId;
    if (lastUserId && !anchorTurn) setAnchorTurn(true);
  }
  const currentModelName = harness
    ? resolveModel(harness, model).name
    : undefined;
  const waitingForApproval = hasPendingApproval(blocks) || pendingQuestion;
  const preparingHandoff = blocks.some(
    (block) =>
      block.role === "handoff" && block.handoff?.status === "preparing",
  );

  const setShowJump = useCallback(
    (show: boolean) => {
      if (showJumpRef.current === show) return;
      showJumpRef.current = show;
      onJumpToBottomChange?.(show);
    },
    [onJumpToBottomChange],
  );

  const syncJumpVisibility = useCallback(
    (el: HTMLElement) => {
      if (!el.isConnected) return;
      setShowJump(
        !stickToBottom.current &&
          !isTranscriptEndVisible(el, transcriptEnd.current),
      );
    },
    [setShowJump],
  );

  const rememberScroll = useCallback((el: HTMLElement) => {
    distanceFromBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    scrollGeometry.current = {
      top: el.scrollTop,
      height: el.scrollHeight,
      viewport: el.clientHeight,
    };
  }, []);

  const pinTranscript = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      pinToBottom(el);
      rememberScroll(el);
    },
    [rememberScroll],
  );

  const syncPinned = useCallback(
    (el: HTMLElement) => {
      // The jump animation owns the offset until it lands or is interrupted.
      if (jumpingScrollers.has(el)) return;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (touchScroll) {
        const previous = scrollGeometry.current;
        const layoutChanged =
          previous.height !== el.scrollHeight ||
          previous.viewport !== el.clientHeight;
        if (!layoutChanged && el.scrollTop < previous.top - 1)
          stickToBottom.current = false;
        if (
          !stickToBottom.current &&
          !touchReadingUp.current &&
          isNearBottom(el) &&
          (scrollDirection.current === "down" ||
            (!layoutChanged && el.scrollTop > previous.top + 1))
        )
          stickToBottom.current = true;
        scrollGeometry.current = {
          top: el.scrollTop,
          height: el.scrollHeight,
          viewport: el.clientHeight,
        };
        distanceFromBottom.current = distance;
        syncJumpVisibility(el);
        return;
      }
      // Content growth can precede a queued event from the previous pin.
      // Browser clamping after layout changes is not reading intent either.
      stickToBottom.current = followsAfterScroll(
        el,
        scrollGeometry.current.top,
        stickToBottom.current,
      );
      rememberScroll(el);
      syncJumpVisibility(el);
    },
    [rememberScroll, syncJumpVisibility, touchScroll],
  );

  const followTranscript = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      // The browser can apply a manual scroll before dispatching its event.
      // Reconcile that offset before a streaming commit or observer pins it.
      syncPinned(el);
      if (stickToBottom.current) pinTranscript(el);
    },
    [pinTranscript, syncPinned],
  );

  const jumpToBottom = useCallback(() => {
    stickToBottom.current = true;
    scrollDirection.current = undefined;
    distanceFromBottom.current = 0;
    setShowJump(false);
    const el = scroller.current;
    syncTranscriptViewport(el);
    animateToBottom(el, () => {
      if (!el) return;
      rememberScroll(el);
      syncPinned(el);
    });
  }, [rememberScroll, setShowJump, syncPinned]);

  const setScroller = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      setScrollerEl(el);
      lockOverscroll(el);
    },
    [lockOverscroll],
  );

  useEffect(() => {
    onJumpToBottomReady?.(jumpToBottom);
  }, [jumpToBottom, onJumpToBottomReady]);

  // A pooled transcript outlives its pane; tell each new owner where it stands.
  useEffect(() => {
    onJumpToBottomChange?.(showJumpRef.current);
  }, [onJumpToBottomChange]);

  useLayoutEffect(() => {
    onScrollerChange?.(scrollerEl);
    return () => onScrollerChange?.(null);
  }, [onScrollerChange, scrollerEl]);

  useEffect(() => {
    if (!visible || !scrollerEl) return;
    syncPinned(scrollerEl);
    const onScroll = () => {
      if (scrollerEl.isConnected && scrollerEl.clientHeight > 0)
        syncPinned(scrollerEl);
    };
    const onWheel = (e: WheelEvent) => {
      if (innerScrollerTakes(scrollerEl, e)) return;
      touchReadingUp.current = false;
      if (e.deltaY) scrollDirection.current = e.deltaY < 0 ? "up" : "down";
      if (e.deltaY < 0) {
        stickToBottom.current = false;
        syncJumpVisibility(scrollerEl);
      }
    };
    let touchY: number | undefined;
    const onTouchStart = (event: TouchEvent) => {
      touchReadingUp.current = false;
      touchY = event.touches[0]?.clientY;
    };
    const onTouchMove = (event: TouchEvent) => {
      const next = event.touches[0]?.clientY;
      if (next !== undefined && touchY !== undefined) {
        if (next > touchY + 3) {
          touchReadingUp.current = true;
          scrollDirection.current = "up";
          stickToBottom.current = false;
          syncJumpVisibility(scrollerEl);
        } else if (next < touchY - 3) {
          touchReadingUp.current = false;
          scrollDirection.current = "down";
        }
      }
      touchY = next;
    };
    const onTouchEnd = () => {
      touchY = undefined;
      touchReadingUp.current = false;
      scrollDirection.current = undefined;
    };
    const onKey = (event: KeyboardEvent) => {
      touchReadingUp.current = false;
      if (["ArrowUp", "PageUp", "Home"].includes(event.key)) {
        scrollDirection.current = "up";
        stickToBottom.current = false;
        syncJumpVisibility(scrollerEl);
      } else if (["ArrowDown", "PageDown", "End"].includes(event.key))
        scrollDirection.current = "down";
    };
    scrollerEl.addEventListener("scroll", onScroll, { passive: true });
    scrollerEl.addEventListener("wheel", onWheel, { passive: true });
    if (touchScroll) {
      scrollerEl.addEventListener("touchstart", onTouchStart, {
        passive: true,
      });
      scrollerEl.addEventListener("touchmove", onTouchMove, { passive: true });
      scrollerEl.addEventListener("touchend", onTouchEnd, { passive: true });
      scrollerEl.addEventListener("touchcancel", onTouchEnd, { passive: true });
      scrollerEl.addEventListener("keydown", onKey);
    }
    return () => {
      scrollerEl.removeEventListener("scroll", onScroll);
      scrollerEl.removeEventListener("wheel", onWheel);
      scrollerEl.removeEventListener("touchstart", onTouchStart);
      scrollerEl.removeEventListener("touchmove", onTouchMove);
      scrollerEl.removeEventListener("touchend", onTouchEnd);
      scrollerEl.removeEventListener("touchcancel", onTouchEnd);
      scrollerEl.removeEventListener("keydown", onKey);
    };
  }, [scrollerEl, syncJumpVisibility, syncPinned, visible, touchScroll]);

  useLayoutEffect(() => {
    stickToBottom.current = true;
    setShowJump(false);
    const el = scroller.current;
    syncTranscriptViewport(el);
    pinTranscript(el);
  }, [lastUserId, pinTranscript, setShowJump]);

  // In the chat layout a sent prompt rises from the upper screen into its
  // anchored spot at the top. On mount this only plays for a session's first
  // send.
  const introducePrompt = useRef({ chat: false, anchor: false, visible });
  introducePrompt.current = {
    chat: transcriptLayout === "chat",
    anchor: promptAnchor && anchorTurn,
    visible,
  };
  const introducedPromptMount = useRef(false);
  useLayoutEffect(() => {
    const mounting = !introducedPromptMount.current;
    introducedPromptMount.current = true;
    const { chat, anchor, visible } = introducePrompt.current;
    if (!lastUserId || !chat || !anchor || !visible) return;
    if (
      mounting &&
      !(promptMotion === "mobile" && animateFrom === lastUserId) &&
      !(busy && userTurnCount(blocks, managed) === 1)
    )
      return;
    return riseIntoAnchor(scroller.current, lastUserId, promptMotion);
    // Only a new prompt starts the motion; later renders must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastUserId]);

  useLayoutEffect(() => {
    const opened = visible && !wasVisible.current;
    wasVisible.current = visible;
    if (!opened) return;
    const el = scroller.current;
    if (!el) return;
    syncTranscriptViewport(el);
    const restore = restoreScroll.current;
    restoreScroll.current = false;
    // Previously opened tabs normally retain their scroll position. Only pin
    // when the scroller looks empty after being hidden with `display: none`.
    if (el.scrollHeight <= el.clientHeight + NEAR_BOTTOM_PX) {
      stickToBottom.current = true;
      setShowJump(false);
      pinTranscript(el);
    } else if (restore && !stickToBottom.current) {
      el.scrollTop = Math.max(
        0,
        el.scrollHeight - el.clientHeight - distanceFromBottom.current,
      );
      rememberScroll(el);
    }
  }, [visible, pinTranscript, rememberScroll, setShowJump]);

  useLayoutEffect(() => {
    if (!visible || !stickToBottom.current) return;
    const el = scroller.current;
    syncTranscriptViewport(el);
    followTranscript(el);
  }, [blocks, busy, followTranscript, visible]);

  useLayoutEffect(() => {
    const el = scrollerEl;
    const inner = el?.firstElementChild;
    if (!visible || !el || !inner) return;
    let endObserver: IntersectionObserver | undefined;
    let endMargin: string | undefined;
    let observedEnd: HTMLElement | null = null;
    const onResize = () => {
      // A parked transcript's scroller is detached and measures zero.
      if (!el.isConnected) return;
      syncTranscriptViewport(el);
      // The anchored turn can grow inside its minimum height without resizing
      // the scroller or its body. Watch its actual content end as well, inset
      // above floating controls; composer resizing changes these insets.
      const style = getComputedStyle(el);
      const topInset = parseFloat(style.scrollPaddingTop) || 0;
      const bottomInset = parseFloat(style.scrollPaddingBottom) || 0;
      const margin = `-${topInset}px 0px -${bottomInset}px 0px`;
      if (
        (margin !== endMargin || transcriptEnd.current !== observedEnd) &&
        transcriptEnd.current
      ) {
        endObserver?.disconnect();
        endMargin = margin;
        observedEnd = transcriptEnd.current;
        endObserver = new IntersectionObserver(
          () => syncJumpVisibility(el),
          { root: el, rootMargin: margin },
        );
        endObserver.observe(observedEnd);
      }
      followTranscript(el);
      syncJumpVisibility(el);
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(inner);
    observer.observe(el);
    onResize();
    return () => {
      observer.disconnect();
      endObserver?.disconnect();
    };
  }, [scrollerEl, followTranscript, syncJumpVisibility, visible, lastUserId]);

  useTurnScrollAnchor(scrollerEl, visible, stickToBottom, rememberScroll);

  const [turnCache] = useState(() => new TranscriptTurnCache());
  const turns = turnCache.group(blocks, managed);
  const firstVisibleTurn = Math.max(0, turns.length - visibleTurnCount);
  const visibleTurns = turns.slice(firstVisibleTurn);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const visibleTurnCountRef = useRef(visibleTurnCount);
  visibleTurnCountRef.current = visibleTurnCount;

  useLayoutEffect(() => {
    const previousHeight = prependHeight.current;
    const el = scroller.current;
    if (!el) return;
    if (previousHeight == null) {
      // The opening window grows above the screen. Settle the offset in this
      // commit: a scroll event queued by an earlier pin would otherwise read
      // the taller transcript first and unpin it partway up.
      if (stickToBottom.current) {
        syncTranscriptViewport(el);
        followTranscript(el);
      } else {
        el.scrollTop =
          el.scrollHeight - el.clientHeight - distanceFromBottom.current;
        rememberScroll(el);
      }
      return;
    }
    prependHeight.current = null;
    el.scrollTop += el.scrollHeight - previousHeight;
    rememberScroll(el);
  }, [visibleTurnCount, followTranscript, rememberScroll]);

  // Short turns can leave the first paint with empty space above them, and
  // the rest of the window arriving later would then push everything down.
  // Top up before painting until the viewport is covered.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || el.clientHeight === 0) return;
    if (visibleTurnCount >= Math.min(INITIAL_TURNS, turns.length)) return;
    if (el.scrollHeight > el.clientHeight) return;
    setVisibleTurnCount((count) =>
      Math.min(INITIAL_TURNS, count + FIRST_PAINT_TURNS),
    );
  }, [visibleTurnCount, turns.length]);

  useEffect(() => {
    // Interruptible, so switching away before it finishes costs nothing.
    startTransition(() =>
      setVisibleTurnCount((count) => Math.max(count, INITIAL_TURNS)),
    );
  }, []);

  const prepareToPrepend = useCallback(() => {
    const el = scroller.current;
    if (el) prependHeight.current = el.scrollHeight;
    stickToBottom.current = false;
  }, []);

  const loadEarlier = () => {
    prepareToPrepend();
    setVisibleTurnCount((count) =>
      Math.min(turns.length, count + TURN_PAGE_SIZE),
    );
  };

  const revealBlock = useCallback(
    (blockId: string): boolean => {
      const all = turnsRef.current;
      const index = all.findIndex((turn) =>
        turn.some((block) => block.id === blockId),
      );
      if (index < 0) return false;
      const needed = all.length - index;
      if (needed <= visibleTurnCountRef.current) return true;
      prepareToPrepend();
      // Synchronous. The caller finds the turn in the DOM after this call.
      flushSync(() => setVisibleTurnCount(needed));
      return true;
    },
    [prepareToPrepend],
  );

  useEffect(() => {
    onRevealReady?.(revealBlock);
  }, [revealBlock, onRevealReady]);

  const navigateToBlock = useCallback(
    (blockId: string | null, query = ""): boolean => {
      if (!blockId) {
        setSearchCurrent(null);
        setSearchQuery("");
        return true;
      }
      const turn = turnsRef.current.find((item) =>
        item.some((block) => block.id === blockId),
      );
      if (!turn || !revealBlock(blockId)) return false;
      const turnId = turn[0].id;
      // A result inside folded work needs its row rendered before measuring it.
      flushSync(() => {
        setOpenWork((current) =>
          current[turnId] ? current : { ...current, [turnId]: true },
        );
        setSearchCurrent(blockId);
        setSearchQuery(query);
      });
      const el = scroller.current;
      if (!el) return false;
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: -1 }));
      const align = () => {
        const target =
          el.querySelector<HTMLElement>(
            '[data-transcript-search-current="true"]',
          ) ??
          el.querySelector<HTMLElement>(
            `[data-transcript-turn="${CSS.escape(turnId)}"]`,
          );
        if (!target) return;
        const wordRect = query
          ? transcriptWordRanges(el, query).current?.getBoundingClientRect?.()
          : null;
        const targetTop =
          wordRect && wordRect.height > 0
            ? wordRect.top
            : target.getBoundingClientRect().top;
        const delta = targetTop - el.getBoundingClientRect().top - 42;
        if (Math.abs(delta) > 2) {
          el.scrollTop += delta;
          rememberScroll(el);
        }
      };
      align();
      requestAnimationFrame(align);
      return true;
    },
    [revealBlock, rememberScroll],
  );

  useEffect(() => {
    onNavigateReady?.(navigateToBlock);
  }, [navigateToBlock, onNavigateReady]);

  useEffect(() => {
    const el = scroller.current;
    const owner = highlightOwner.current;
    if (!el || !visible || !searchQuery) {
      clearTranscriptHighlights(owner);
      return;
    }
    let frame = 0;
    let pending: MutationRecord[] = [];
    const paint = () => {
      const { matches, current } = transcriptWordRanges(el, searchQuery);
      paintTranscriptHighlights(owner, matches, current);
    };
    const observer = new MutationObserver((records) => {
      for (const record of records) pending.push(record);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const changed = pending;
        pending = [];
        if (transcriptMutationNeedsRepaint(changed, searchQuery)) paint();
      });
    });
    observer.observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    paint();
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      clearTranscriptHighlights(owner);
    };
  }, [visible, searchQuery, searchCurrent, visibleTurnCount, openWork]);

  return createElement(
    TranscriptPlatformContext.Provider,
    { value: renderingPlatform },
    <div
      ref={setScroller}
      className="agent-transcript h-full overflow-y-auto overscroll-none [overflow-anchor:none] font-mono text-[13px] leading-5"
    >
      <div className="mx-auto flex w-full min-w-0 max-w-4xl @[1280px]:max-w-6xl flex-col gap-1 pb-8">
        {firstVisibleTurn > 0 ? (
          <div className="flex justify-center px-4 @md:px-6 py-3">
            <button
              type="button"
              className="rounded-md bg-content/8 px-2.5 py-1.5 font-sans text-[12px] text-content/60 hover:bg-content/12 hover:text-content"
              onClick={loadEarlier}
            >
              {uiT("Load earlier messages")}
            </button>
          </div>
        ) : null}
        {visibleTurns.map((turn, turnIndex) => {
          const isLastTurn = firstVisibleTurn + turnIndex === turns.length - 1;
          const userBlock = turnUserBlock(turn, managed);
          const durationMs = userBlock?.durationMs;
          const settled = !(busy && isLastTurn);
          const proposals = turn.filter((block) => block.orchestration);
          const workflowCards = workflowParent ? turn.filter((block) => block.workflowRun) : [];
          // Proposals are turn results, like the changes card. Keep them out
          // of the live work and append them after all of the lead's output.
          const items = turnCache.turnItems(turn, settled);
          // Earlier activity groups have already been followed by prose or
          // more work. Only the last one can still be the live group.
          const foldedAt = lastActivityIndex(items);
          const initialThinkingAt = initialThinkingIndex(items);
          const startedAt = userBlock
            ? turnStartTimes.get(userBlock.id)
            : undefined;
          // The agent starting its answer is the end of the work: fold the
          // groups then, not when the turn finally settles, so the collapse
          // never lands under the text you have already started reading.
          const answering =
            foldedAt >= 0 &&
            items
              .slice(foldedAt + 1)
              .some(
                (item) => item.type === "block" && isProseBlock(item.block),
              );
          const workStillRunning = activityStillRunning(turn);
          // New turns carry immutable model provenance. Legacy turns do not,
          // so omit their model instead of rewriting history from the picker.
          const turnModel = userBlock?.turnModel;
          const turnHarness = harness
            ? (turnModel?.harness ?? harnessForTurn(blocks, turn, harness))
            : undefined;
          // Work the turn has already answered for folds away behind one line,
          // leaving the prompt and the answer to it.
          const turnId = turn[0].id;
          const fold = foldableWork(items);
          const folded = fold ? foldedBlocks(items, fold) : [];
          const workOpen = openWork[turnId] ?? false;
          // The fold line stays at the start of the work. Clients with a
          // footer keep the clock under the reply and the work summary here.
          const live = visible && !settled && !preparingHandoff;
          const turnModelName =
            turnModel?.name ?? (live ? currentModelName : undefined);
          // The fold line speaks for the main agent only. A delegated run has
          // its own row, which says who is working and how it went, so saying
          // it again here would be two lines telling the same story.
          const foldTitle: ReactNode = live ? (
            <LiveFoldTitle
              startedAt={startedAt}
              paused={waitingForApproval}
              waitingLabel={
                managed && waitingForApproval
                  ? "Waiting for orchestrator"
                  : pendingQuestion
                    ? "Waiting for answers"
                    : undefined
              }
              background={backgroundTasks}
              modelName={turnModelName}
              clockHidden={clockInFooter}
            />
          ) : durationMs != null && !liveClockInFooter ? (
            formatWorkingDuration(durationMs, turnModelName, true)
          ) : (
            workSummaryLine(folded)
          );
          const showFoldLine =
            live || (durationMs != null && !liveClockInFooter) || !!fold;
          // It sits where the work starts, from before there is any: the row
          // is there from the first token, so nothing shoves the answer down
          // when the turn folds.
          // A card the work cannot fold across (an answered question, a plan)
          // starts the fold below it, but the line stays where the work began.
          const firstWork = firstFoldableIndex(items);
          const foldLineAt =
            firstWork >= 0
              ? Math.min(firstWork, fold?.start ?? firstWork)
              : (fold?.start ?? items.length);
          const isCurrentItem = (item: TurnItem) =>
            item.type === "block"
              ? item.block.id === searchCurrent
              : item.blocks.some((block) => block.id === searchCurrent);
          const renderItem = (item: TurnItem, itemIndex: number) =>
            item.type === "subagents" ? (
              <SubagentStack
                key={item.blocks[0].id}
                blocks={item.blocks}
                cwd={cwd}
                live={live}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
              />
            ) : item.type === "activity" ? (
              itemIndex === initialThinkingAt ? (
                <InitialThinking
                  key={item.blocks[0].id}
                  live={visible && !settled}
                />
              ) : (
                <ActivityPhases
                  key={item.blocks[0].id}
                  blocks={item.blocks}
                  cwd={cwd}
                  done={
                    !visible ||
                    settled ||
                    itemIndex < foldedAt ||
                    (answering && !workStillRunning)
                  }
                  onApproval={onApproval}
                  onOpenFile={onOpenFile}
                  onOpenDiff={onOpenDiff}
                />
              )
            ) : (
              <TranscriptBlock
                key={item.block.id}
                block={item.block}
                questionPending={item.block.id === pendingQuestionHistoryId}
                onQuestionFollowUp={onQuestionFollowUp}
                harness={turnHarness}
                layout={transcriptLayout}
                visible={item.block.role === "user" ? visible : undefined}
                stickyIndex={firstVisibleTurn + turnIndex + 1}
                // Prose reads the same wherever it lands: under the fold
                // line at the top of the turn, or under the work it follows.
                underLine={
                  isProseBlock(item.block) &&
                  itemIndex > 0 &&
                  (items[itemIndex - 1]?.type === "activity" ||
                    items[itemIndex - 1]?.type === "subagents" ||
                    (itemIndex === foldLineAt && showFoldLine))
                }
                onApproval={onApproval}
                onSaveNote={onSaveNote}
                onSendDraft={onSendDraft}
                onRemoveDraft={onRemoveDraft}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
                onOpenPlan={onOpenPlan}
                onBuildPlan={onBuildPlan}
                planDecision={item.block.id === decidingPlanId}
                planBusy={!!busy}
                planHarness={planBuildTargets ? harness : undefined}
                planModel={model}
                planModelSettings={modelSettings}
                cwd={cwd}
                onEditLastTurn={
                  onEditLastTurn &&
                  settled &&
                  item.block.role === "user" &&
                  item.block.id === editableUserBlockId &&
                  !item.block.draft
                    ? onEditLastTurn
                    : undefined
                }
                editing={
                  editingLastTurn &&
                  item.block.role === "user" &&
                  item.block.id === editableUserBlockId
                }
              />
            );
          // The fold reaches across a stack of delegated runs, but those rows
          // do not collapse with it: they are lifted out and parked under the
          // work, where they stay put however often it re-folds.
          const foldEntries = fold
            ? items.slice(fold.start, fold.end + 1).map((entry, offset) => ({
                entry,
                index: fold.start + offset,
              }))
            : [];
          const foldSubagents = foldEntries.filter(
            ({ entry }) => entry.type === "subagents",
          );
          const foldWork = foldEntries.filter(
            ({ entry }) => entry.type !== "subagents",
          );
          const lastItem = items.at(-1);
          const liveActivity =
            lastItem?.type === "activity" ? lastItem : undefined;
          // Clients with a step sheet list a settled turn's work there in one tap.
          const sheetFold = !!openActivity && !!fold && !live;
          const foldLineRow = (
            <TurnRow key="work-fold" folded={!showFoldLine}>
              <WorkFoldLine
                title={foldTitle}
                kind={workKind(folded)}
                harness={turnHarness}
                live={live}
                expandable={!!fold}
                open={workOpen && !!fold && !sheetFold}
                sheet={sheetFold ? workDiffStats(folded) : undefined}
                onToggle={() =>
                  sheetFold ? openActivity!(folded) : toggleWork(turnId, workOpen)
                }
              />
            </TurnRow>
          );
          return (
            <div
              key={turn[0].id}
              data-transcript-turn={turnId}
              className={`transcript-turn flex min-w-0 flex-col${
                isLastTurn ? " transcript-turn-live" : ""
              }${
                promptAnchor && anchorTurn && isLastTurn && userBlock
                  ? " transcript-turn-anchor"
                  : ""
              }`}
            >
              {items.flatMap((item, itemIndex) => {
                const inFold =
                  !!fold && itemIndex >= fold.start && itemIndex <= fold.end;
                if (inFold) {
                  if (itemIndex !== fold.start) return [];
                  return [
                    ...(foldLineAt === fold.start ? [foldLineRow] : []),
                    <TurnRow key="work-details" folded={!workOpen}>
                      {() =>
                        foldWork.map(({ entry, index }, offset) => (
                          <div
                            key={turnItemKey(entry)}
                            data-transcript-search-item
                            data-transcript-search-current={
                              isCurrentItem(entry) || undefined
                            }
                            className={`flow-root pb-1 last:pb-0 pl-5 zen-fold-rail ${
                              offset === foldWork.length - 1
                                ? "zen-fold-tail"
                                : ""
                            }${
                              // Prose the trail holds is the agent talking
                              // while it works; the marker lets it read as
                              // process, not result.
                              entry.type === "block" &&
                              isProseBlock(entry.block)
                                ? " zen-fold-prose"
                                : ""
                            }`}
                          >
                            {renderItem(entry, index)}
                          </div>
                        ))
                      }
                    </TurnRow>,
                    // Delegated runs sit under the agent's own work, not
                    // among it: they are a second thing the turn is doing,
                    // and reading them as the first steps of the main trail
                    // is what made them look like its work.
                    ...foldSubagents.map(({ entry, index }) => (
                      <div
                        key={turnItemKey(entry)}
                        data-transcript-search-item
                        data-transcript-search-current={
                          isCurrentItem(entry) || undefined
                        }
                        className="flow-root pb-1"
                      >
                        {renderItem(entry, index)}
                      </div>
                    )),
                  ];
                }
                const row = (
                  <div
                    key={turnItemKey(item)}
                    data-transcript-search-item
                    data-transcript-search-current={
                      isCurrentItem(item) || undefined
                    }
                    className="flow-root pb-1"
                  >
                    {renderItem(item, itemIndex)}
                  </div>
                );
                if (itemIndex !== foldLineAt) return row;
                return [foldLineRow, row];
              })}
              {foldLineAt >= items.length ? foldLineRow : null}
              {settled &&
                proposals
                  .filter((block) => block.orchestration?.status !== "planning")
                  .map((block) => (
                    <div
                      key={block.id}
                      className="px-4 @md:px-6 pt-1 pb-2"
                      data-orchestration-result
                    >
                      <OrchestrationPreview block={block} busy={!!busy} />
                    </div>
                  ))}
              {workflowCards.map((block) => (
                <div key={block.id} className="px-4 @md:px-6 pt-1 pb-2" data-workflow-run-card>
                  <WorkflowRunCard block={block} parent={workflowParent!} />
                </div>
              ))}
              {isLastTurn && clockInFooter && cwd ? (
                <AnimatedCollapse expanded={live}>
                  {() => (
                    <LiveTurnFooter
                      cwd={cwd}
                      turn={turn}
                      seed={turnId}
                      startedAt={startedAt}
                      waiting={
                        waitingForApproval
                          ? pendingQuestion
                            ? "answers"
                            : "approval"
                          : undefined
                      }
                      toolSummary={
                        liveActivity && !answering
                          ? workSummaryLine(liveActivity.blocks, true)
                          : undefined
                      }
                      background={backgroundTasks}
                    />
                  )}
                </AnimatedCollapse>
              ) : null}
              {/* The accessory keeps the pane's props, which go stale once parked. */}
              {isLastTurn && latestTurnAccessory && !parked
                ? latestTurnAccessory
                : null}
              {durationMs != null && settled ? (
                <AfterTextReveal entries={turn}>
                  <TurnDuration
                    elapsedMs={durationMs}
                    metrics={userBlock?.turnMetrics}
                    labelHidden={showFoldLine && !liveClockInFooter}
                    modelName={turnModelName}
                    completedAt={
                      startedAt != null ? startedAt + durationMs : undefined
                    }
                    copyText={turnCopyText(turn)}
                    onSaveNote={onSaveNote}
                    harness={turnHarness}
                    fromHarness={turnHarness}
                    fromModel={turnModel?.id}
                    onSecondOpinion={
                      onSecondOpinion
                        ? (target) => onSecondOpinion(target, turn)
                        : undefined
                    }
                    onHandoff={
                      onHandoff ? (target) => onHandoff(target, turn) : undefined
                    }
                  />
                </AfterTextReveal>
              ) : null}
              {isLastTurn ? (
                <div ref={transcriptEnd} data-transcript-end aria-hidden="true" />
              ) : null}
            </div>
          );
        })}
      </div>
      {onAddToChat || onSaveSelectionNote ? (
        <TranscriptSelectionMenu
          selection={selection}
          onAddToChat={onAddToChat}
          onAddToNotes={onSaveSelectionNote}
          onDismiss={dismissSelection}
        />
      ) : null}
    </div>,
  );
}

// Keep hidden panes' local state, and catch up with current props on activation.
export const AgentTranscript = memo(
  AgentTranscriptComponent,
  (previous, next) => previous.visible === false && next.visible === false,
);

/** Placeholder for private reasoning before the first assistant text arrives. */
function InitialThinking({
  live,
  embedded = false,
}: {
  live: boolean;
  embedded?: boolean;
}) {
  const { t: uiT } = useTranslation();
  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 pt-3 pb-1 font-sans text-sm text-content/50 ${embedded ? "" : "px-4 @md:px-6"}`}
    >
      <ActivityPhaseIcon kind="think" />
      {live ? (
        <Shimmer duration={1.6}>{uiT("Thinking…")}</Shimmer>
      ) : (
        uiT("Thinking…")
      )}
    </div>
  );
}

/**
 * The clock on a turn's fold line: how long the agent has been at it, or what
 * it is waiting on. The band that sweeps the text is sized off this element,
 * so it shrinks to the words — stretched across the row, the sweep spends its
 * time on empty space and the line just sits there looking dim.
 */
function LiveFoldTitle({
  startedAt,
  paused,
  waitingLabel,
  background,
  modelName,
  clockHidden = false,
}: {
  startedAt?: number;
  paused: boolean;
  waitingLabel?: string;
  background?: string[];
  modelName?: string;
  /** The client shows the clock under the live turn instead. */
  clockHidden?: boolean;
}) {
  const elapsedMs = useElapsedFrom(startedAt, paused || clockHidden);
  const working = clockHidden
    ? formatWorkingDuration(null, modelName)
    : formatWorkingDuration(elapsedMs, modelName);
  // Yielding with a command still going is not the end of the turn. The clock
  // keeps running and the line says what it is waiting on.
  const text = paused
    ? (waitingLabel ?? "Waiting for approval")
    : background?.length
      ? `${working} · ${backgroundLabel(background)}`
      : working;
  const shimmer = (
    <Shimmer className="min-w-0 truncate font-sans text-sm" duration={1}>
      {text}
    </Shimmer>
  );
  return background?.length ? (
    <span className="flex min-w-0" title={background.join("\n")}>
      {shimmer}
    </span>
  ) : (
    shimmer
  );
}

/**
 * What sits under the reply while it is being written, for clients that keep
 * the live clock in view there: the project's mascot and one status line that
 * follows the current activity, occasionally accompanied by its clock.
 */
function LiveTurnFooter({
  cwd,
  turn,
  seed,
  startedAt,
  waiting,
  toolSummary,
  background,
}: {
  cwd: string;
  turn: Block[];
  seed: string;
  startedAt?: number;
  waiting?: "approval" | "answers";
  toolSummary?: string;
  background?: string[];
}) {
  const { t: uiT } = useTranslation();
  const paused = !!waiting;
  const now = useNow();
  const mascot = useProjectMascotAppearance(cwd);
  const status = liveStatus({
    turn,
    now,
    startedAt,
    waiting,
    toolSummary,
    background: background?.length,
    seed,
  });
  const label =
    "literal" in status.label
      ? status.label.literal
      : uiT(status.label.key, status.label.params);
  const verb =
    status.phase === "working" || status.phase === "tool" ? `${label}…` : label;
  return (
    <div
      className="transcript-live-footer flex min-w-0 items-center gap-2 px-4 pt-2 pb-1 font-sans text-sm @md:px-6"
      data-live-footer
      data-live-phase={status.phase}
      data-live-clock={status.showClock ? status.clock : undefined}
    >
      <ProjectMascot
        project={mascot.project}
        name={mascot.name}
        color={mascot.color}
        active={!paused}
        className="size-4 shrink-0"
      />
      <span className="flex min-w-0 items-center gap-1">
        {status.showClock && status.elapsed ? (
          <>
            <RollingClock
              key={`${status.clock}:${status.clockStartedAt}`}
              value={status.elapsed}
              motion={rollingClockMotion(`${seed}:${status.clock}`, status.clockStartedAt ?? 0)}
            />
            <span className="shrink-0 text-content/40" aria-hidden="true">{" · "}</span>
          </>
        ) : null}
        {/* Phase copy can ease in without remounting the ticking digits. */}
        <span key={`${status.phase}:${label}`} className="transcript-live-status flex min-w-0">
          <Shimmer className="min-w-0 truncate" duration={1.6}>
            {verb}
          </Shimmer>
        </span>
      </span>
      {status.background ? (
        <span
          className="shrink-0 truncate text-accent"
          title={background?.join("\n")}
        >
          {`· ${uiT(
            status.background === 1 ? "{count} running task" : "{count} running tasks",
            { count: status.background },
          )}`}
        </span>
      ) : null}
    </div>
  );
}

/** Wall-clock time, ticking each second for the entire live turn. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function backgroundLabel(tasks: string[]): string {
  return tasks.length === 1
    ? "running in background"
    : `${tasks.length} tasks running in background`;
}

/**
 * What a finished turn leaves under the answer: what you can do with it, and
 * when it landed. Clients that use the live footer keep the completed clock here.
 */
function TurnDuration({
  elapsedMs,
  metrics,
  labelHidden = false,
  modelName,
  harness,
  completedAt,
  copyText: output,
  onSaveNote,
  fromHarness,
  fromModel,
  onSecondOpinion,
  onHandoff,
}: {
  elapsedMs: number | null;
  metrics?: TurnMetrics;
  /** True when the fold line above already keeps the time for this turn. */
  labelHidden?: boolean;
  modelName?: string;
  harness?: HarnessId;
  completedAt?: number;
  copyText?: string;
  onSaveNote?: (text: string) => void | Promise<void>;
  fromHarness?: HarnessId;
  /** The turn's own model, so a same-harness second opinion can hide it. */
  fromModel?: string;
  onSecondOpinion?: (target: ModelTarget) => void;
  onHandoff?: (target: ModelTarget) => void;
}) {
  const { language } = useTranslation();
  const label = formatWorkingDuration(elapsedMs, modelName, true);
  const dot = (
    <span
      aria-hidden
      className="size-[3px] shrink-0 rounded-full bg-content/25"
    />
  );
  return (
    <div
      aria-label={label}
      className="flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden px-4 @md:px-6 pt-1 pb-3 font-sans text-sm text-content/40"
    >
      <span className="flex shrink-0 items-center gap-1">
        {output ? (
          <>
            <CopyTurnButton text={output} />
            {onSaveNote ? (
              <SaveNoteButton text={output} onSave={onSaveNote} />
            ) : null}
          </>
        ) : (
          <Check className="size-3.5" />
        )}
        {fromHarness && onHandoff ? (
          <HandoffButton from={fromHarness} onPick={onHandoff} />
        ) : null}
        {fromHarness && onSecondOpinion ? (
          <SecondOpinionButton
            from={fromHarness}
            fromModel={fromModel}
            onPick={onSecondOpinion}
            includeCurrent
            excludeFromModel
          />
        ) : null}
        <TurnMetricsBadge metrics={metrics} elapsedMs={elapsedMs} />
      </span>
      {labelHidden ? null : (
        <span className="flex min-w-0 items-center gap-2.5">
          {dot}
          {harness || modelName?.trim() ? (
            <>
              <span className="flex min-w-0 items-center gap-1.5">
                {harness ? (
                  <HarnessIcon harness={harness} className="size-3.5 shrink-0" />
                ) : null}
                {modelName?.trim() ? (
                  <span className="min-w-0 truncate" title={modelName.trim()}>
                    {modelName.trim()}
                  </span>
                ) : null}
              </span>
              {dot}
            </>
          ) : null}
          <span className="shrink-0 tabular-nums">{formatElapsed(elapsedMs)}</span>
        </span>
      )}
      {completedAt != null ? (
        <span className="flex shrink-0 items-center gap-2.5">
          {dot}
          <time
            dateTime={new Date(completedAt).toISOString()}
            title={new Date(completedAt).toLocaleString(language)}
            className="shrink-0 text-content/35"
          >
            {formatClockTime(completedAt)}
          </time>
        </span>
      ) : null}
    </div>
  );
}

function TurnMetricsBadge({
  metrics,
  elapsedMs,
}: {
  metrics?: TurnMetrics;
  elapsedMs: number | null;
}) {
  const { t: uiT } = useTranslation();
  const root = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  if (!metrics || !hasTurnMetrics(metrics)) return null;

  const outputRate =
    metrics.outputTokens != null && elapsedMs != null && elapsedMs > 0
      ? metrics.outputTokens / (elapsedMs / 1000)
      : undefined;
  const headline =
    [
      metrics.cacheHitPercent != null
        ? `Cache hit ${Math.round(metrics.cacheHitPercent)}%`
        : null,
      outputRate != null
        ? `Output ${formatMetricCount(outputRate)} tok/s`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Turn tokens";
  const detail = [
    metrics.inputTokens != null
      ? `${formatMetricCount(metrics.inputTokens)} input`
      : null,
    metrics.outputTokens != null
      ? `${formatMetricCount(metrics.outputTokens)} output`
      : null,
    metrics.cacheReadTokens != null
      ? `${formatMetricCount(metrics.cacheReadTokens)} cached`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const label = [headline, detail].filter(Boolean).join(". ");

  return (
    <div
      ref={root}
      className="relative shrink-0 ml-[3px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <span
        role="img"
        tabIndex={0}
        aria-label={uiT("Turn metrics: {value0}", { value0: String(label) })}
        title={uiT("Turn metrics")}
        className="grid rounded-md p-1 text-content/40 outline-none hover:bg-content/8 hover:text-content/70 focus-visible:ring-1 focus-visible:ring-accent"
      >
        <ChartBreakoutSquare className="size-3.5" />
      </span>
      {hovered ? (
        <Popover
          anchor={root}
          side="top"
          align="start"
          className="pointer-events-none w-max px-2.5 py-1.5"
        >
          <div className="text-[12px] leading-4 text-content">{headline}</div>
          {detail ? (
            <div className="text-[11px] leading-4 text-content/50">
              {detail}
            </div>
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}

function hasTurnMetrics(metrics: TurnMetrics): boolean {
  return (
    metrics.cacheHitPercent != null ||
    (metrics.inputTokens ?? 0) > 0 ||
    (metrics.outputTokens ?? 0) > 0 ||
    (metrics.cacheReadTokens ?? 0) > 0 ||
    (metrics.cacheWriteTokens ?? 0) > 0
  );
}

function formatMetricCount(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(Math.max(0, Math.round(value)));
}

/** Wall-clock stamp for a finished turn, in the reader's own locale. */
function formatClockTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(getUiLanguage(), {
    hour: "numeric",
    minute: "2-digit",
  });
}


function SaveNoteButton({
  text,
  onSave,
}: {
  text: string;
  onSave: (text: string) => void | Promise<void>;
}) {
  const { t: uiT } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setSaved(false);
    setError(null);
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
    };
  }, [text]);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        title={saved ? uiT("Saved to Notes") : uiT("Save as note")}
        aria-label={saved ? uiT("Saved to Notes") : uiT("Save as note")}
        className="rounded-md p-1 text-content/40 hover:bg-content/8 hover:text-content/70"
        onClick={async () => {
          setError(null);
          setSaved(false);
          setPending(true);
          try {
            await onSave(text);
            playCue("copy");
            setSaved(true);
            if (timer.current != null) window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setSaved(false), 2000);
          } catch (error) {
            setError(error instanceof Error ? error.message : String(error));
          } finally {
            setPending(false);
          }
        }}
      >
        {saved ? (
          <Check className="size-3.5" />
        ) : (
          <FilePlusCorner className="size-3.5" />
        )}
      </button>
      {error && (
        <span role="alert" className="max-w-xs text-xs text-content/70">
          {uiT("Could not save note. ")}
          {error}
        </span>
      )}
    </>
  );
}

function EditLastTurnButton({
  onEdit,
  editing = false,
}: {
  onEdit: () => void;
  editing?: boolean;
}) {
  const label = editing ? "Cancel edit" : "Edit and resend";
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={editing}
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
      className={`rounded-md p-1 transition-[background-color,color] duration-150 focus-visible:ring-1 focus-visible:ring-accent ${
        editing
          ? "edit-last-turn-button"
          : "text-content/40 hover:bg-content/8 hover:text-content/70"
      }`}
    >
      <Pencil className="size-3.5" />
    </button>
  );
}

const TranscriptBlock = memo(function TranscriptBlock({
  block,
  questionPending = false,
  onQuestionFollowUp,
  harness,
  layout,
  visible,
  stickyIndex,
  underLine = false,
  embedded = false,
  cwd,
  onApproval,
  onSaveNote,
  onSendDraft,
  onRemoveDraft,
  onOpenFile,
  onOpenDiff,
  onOpenPlan,
  onBuildPlan,
  planDecision = false,
  planBusy,
  planHarness,
  planModel,
  planModelSettings,
  onEditLastTurn,
  editing = false,
}: {
  block: Block;
  questionPending?: boolean;
  onQuestionFollowUp?: (answer: QuestionAnswer) => boolean | void | Promise<boolean | void>;
  harness?: HarnessId;
  layout: TranscriptLayout;
  visible?: boolean;
  stickyIndex: number;
  /** True when something already sits directly above this in the turn. */
  underLine?: boolean;
  /** True when the parent surface already provides the horizontal gutter. */
  embedded?: boolean;
  cwd?: string;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onSaveNote?: (text: string) => void | Promise<void>;
  onSendDraft?: (block: Block) => boolean | void;
  onRemoveDraft?: (block: Block) => boolean | void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
  onOpenPlan?: (blockId: string) => void;
  onBuildPlan?: (blockId: string, target?: PlanBuildTarget) => void;
  planDecision?: boolean;
  planBusy?: boolean;
  planHarness?: HarnessId;
  planModel?: string;
  planModelSettings?: Record<string, string>;
  onEditLastTurn?: () => void;
  editing?: boolean;
}) {
  const { textReveal, openPlan } = useContext(TranscriptPlatformContext);
  const { t: uiT } = useTranslation();
  // Workflow run cards render after the turn's work, like orchestration results.
  if (block.workflowRun) return null;
  if (block.question) {
    return <QuestionHistoryCard blockId={block.id} question={block.question}
      pending={questionPending} onAnswer={onQuestionFollowUp} />;
  }
  if (block.role === "user") {
    return (
      <UserMessageBlock
        block={block}
        layout={layout}
        visible={visible ?? true}
        stickyIndex={stickyIndex}
        cwd={cwd}
        onEdit={onEditLastTurn}
        editing={editing}
        onSaveNote={onSaveNote}
        onSendDraft={onSendDraft}
        onRemoveDraft={onRemoveDraft}
        onOpenFile={onOpenFile}
      />
    );
  }

  if (block.role === "image") {
    return block.image ? (
      <GeneratedImage
        image={block.image}
        attachment={block.attachments?.find((file) => file.kind === "image")}
      />
    ) : null;
  }

  if (block.role === "tool") {
    return (
      <ToolCall
        block={block}
        cwd={cwd}
        embedded={embedded}
        onApproval={onApproval}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    );
  }

  if (block.role === "reasoning") {
    return null;
  }

  if (block.role === "tasks") {
    if (!block.taskList?.items.length) return null;
    return (
      <div className={embedded ? "py-1" : "px-4 @md:px-6 py-1"}>
        <TaskListPreview
          items={block.taskList.items}
          explanation={block.taskList.explanation}
        />
      </div>
    );
  }

  if (block.role === "plan") {
    if (block.orchestration) return null;
    const legacyTasks = legacyTaskListFromText(block.text);
    if (legacyTasks) {
      return (
        <div className={embedded ? "py-1" : "px-4 @md:px-6 py-1"}>
          <TaskListPreview items={legacyTasks} />
        </div>
      );
    }
    return (
      <div className={embedded ? "py-1" : "px-4 @md:px-6 py-1"}>
        <PlanPreview
          text={block.text}
          streaming={block.streaming}
          busy={planBusy}
          plan={block.plan}
          harness={planHarness}
          model={planModel}
          modelSettings={planModelSettings}
          cwd={cwd}
          deciding={planDecision}
          paneButton={!openPlan}
          onOpen={
            openPlan
              ? () => openPlan(block.id)
              : onOpenPlan
                ? () => onOpenPlan(block.id)
                : undefined
          }
          onBuild={
            onBuildPlan ? (target) => onBuildPlan(block.id, target) : undefined
          }
        />
      </div>
    );
  }

  if (block.role === "approval") {
    return (
      <ToolCall
        block={block}
        cwd={cwd}
        embedded={embedded}
        onApproval={onApproval}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    );
  }

  if (block.role === "handoff") {
    return <HandoffDivider block={block} />;
  }

  if (block.role === "system") {
    if (block.interjection) {
      return <InterjectionDivider block={block} />;
    }
    const issue =
      harness && block.notice === "error"
        ? providerSessionAccessIssue(harness, block.text)
        : undefined;
    if (harness && issue) {
      return (
        <div className={`${embedded ? "" : "px-4 @md:px-6"} py-2`}>
          <SessionAccessNotice
            harness={harness}
            issue={issue}
            message={block.text}
          />
        </div>
      );
    }
    return (
      <div className={`${embedded ? "" : "px-4 @md:px-6"} py-2 text-content/50`}>
        <pre className="min-w-0 whitespace-pre-wrap break-words">
          {localizeOrchestrationMessage(localizeChildExitError(block.text, uiT), uiT)}
        </pre>
      </div>
    );
  }

  if (!block.text && block.streaming && !textReveal) return null;

  return (
    <div
      data-selectable-agent-response={block.streaming ? undefined : block.id}
      className={`min-w-0 pb-1 text-content ${embedded ? "" : "px-4 @md:px-6"} ${underLine ? "pt-1" : "pt-3"}`}
    >
      <AgentMarkdown
        text={block.text}
        streamingKey={block.id}
        streaming={block.streaming}
        cwd={cwd}
        onOpenFile={onOpenFile}
      />
    </div>
  );
});

function UserMessageBlock({
  block,
  layout,
  visible,
  stickyIndex,
  onEdit,
  editing = false,
  cwd,
  onSaveNote,
  onSendDraft,
  onRemoveDraft,
  onOpenFile,
}: {
  block: Block;
  layout: TranscriptLayout;
  visible: boolean;
  stickyIndex: number;
  onEdit?: () => void;
  editing?: boolean;
  cwd?: string;
  onSaveNote?: (text: string) => void | Promise<void>;
  onSendDraft?: (block: Block) => boolean | void;
  onRemoveDraft?: (block: Block) => boolean | void;
  onOpenFile?: (path: string) => void;
}) {
  const { t: uiT, language } = useTranslation();
  const sentAt = block.sentAt ?? block.startedAt;
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLElement>(null);
  const card = block.secondOpinion;
  const note = block.noteCard;
  const monocode = isOperatorUserTurn(block);
  const text =
    card && card.kind !== "handoff"
      ? ""
      : visibleUserPrompt(monocode ? operatorUserPrompt(block) : block.text);
  const messageLink = text ? parseUserMessageLink(text) : null;
  const displayText = messageLink
    ? `${messageLink.beforeText}${messageLink.afterText}`
    : text;
  // Sent attachments sit above the caption as image-sized tiles, using the
  // same presentation on desktop and mobile. Drafts keep theirs inside the
  // editable card.
  const mediaAttachments = !block.draft ? (block.attachments ?? []) : [];
  const bubbleAttachments = mediaAttachments.length
    ? (block.attachments ?? []).filter(
        (file) => !mediaAttachments.includes(file),
      )
    : (block.attachments ?? []);
  const hasBubble = Boolean(
    text ||
    bubbleAttachments.length ||
    card ||
    note ||
    block.ciContext ||
    block.draft,
  );
  useLayoutEffect(() => {
    if (!visible) return;
    const el = textRef.current;
    if (!el || !text) {
      setOverflows(false);
      return;
    }

    const measure = () => {
      // Reading a descendant's size makes the browser lay out an otherwise
      // skipped historical turn. Leave it skipped until it comes into view.
      if (
        !el.isConnected ||
        (el.checkVisibility &&
          !el.checkVisibility({ contentVisibilityAuto: true }))
      )
        return;
      if (!expanded) {
        setOverflows(el.scrollHeight > el.clientHeight + 1);
      }
    };

    const turn = el.closest(".transcript-turn");
    const onVisible = (event: Event) => {
      if (!(event as ContentVisibilityAutoStateChangeEvent).skipped) measure();
    };
    turn?.addEventListener("contentvisibilityautostatechange", onVisible);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      turn?.removeEventListener("contentvisibilityautostatechange", onVisible);
    };
  }, [text, expanded, visible]);

  const toggle = () => {
    if (overflows) setExpanded((value) => !value);
  };

  return (
    <div
      data-prompt-anchor={block.id}
      data-message-layout={layout}
      data-editing-last-turn={editing ? "true" : undefined}
      className="user-message-row group/usermsg flex flex-col items-end overflow-visible pt-1 pr-4 @md:pr-6 pb-5 pl-[18%]"
    >
      <div className="user-message-hover-zone flex w-fit max-w-full min-w-0 flex-col items-end overflow-visible">
        {block.origin?.kind === "assistant" && (
          <div
            className="mb-1 inline-flex items-center gap-1.5 px-3 text-xs text-content/60"
            data-assistant-origin={block.origin.assistantId}
          >
            <Bot className="size-3.5" aria-hidden="true" />
            <span>{uiT("From {value0}", { value0: block.origin.assistantName || uiT("Assistant") })}</span>
          </div>
        )}
        {mediaAttachments.length ? (
          <AttachmentList
            attachments={mediaAttachments}
            className={`user-message-media flex max-w-[min(100%,36rem)] flex-wrap justify-end gap-1.5 ${hasBubble ? "mb-1.5" : ""}`}
            renderAttachment={(file) => (
              <AttachmentChip
                key={file.id}
                attachment={file}
                tile
                onOpen={
                  onOpenFile && file.path && !isAttachmentFolder(file)
                    ? () => onOpenFile(file.path!)
                    : undefined
                }
              />
            )}
          />
        ) : null}
        <div
          hidden={!hasBubble}
          data-draft={block.draft ? "true" : undefined}
          data-monocode={monocode ? "true" : undefined}
          className={`user-message-bubble relative w-fit min-w-0 px-3 py-2 font-sans text-content transition-[background-color] duration-200 ${
            layout === "chat" ? "max-w-[min(100%,36rem)]" : "max-w-full"
          } ${
            block.draft
              ? "border border-dashed border-content/30 bg-content/4"
              : "bg-content/10"
          } ${editing ? "edit-last-turn-bubble" : ""}`}
          style={{ zIndex: stickyIndex }}
        >
          {bubbleAttachments.length ? (
            <div
              className={`flex flex-wrap gap-1.5 ${text || card || note ? "mb-2" : ""}`}
            >
              {bubbleAttachments.map((file) => (
                <AttachmentChip key={file.id} attachment={file} />
              ))}
            </div>
          ) : null}
          {note ? (
            <div className={text || card ? "mb-2" : ""}>
              <NoteMiniCard card={note} embedded />
            </div>
          ) : null}
          {card ? (
            <div className={text ? "mb-1.5" : undefined}>
              <SecondOpinionCard card={card} />
            </div>
          ) : null}
          {messageLink ? (
            <div
              ref={(element) => {
                textRef.current = element;
              }}
              className="user-message-with-link min-w-0 whitespace-pre-wrap break-words font-sans text-sm"
              data-selectable-agent-response={block.id}
            >
              {messageLink.beforeText}
              <UserLinkPreview link={messageLink.link} cwd={cwd} compact />
              {messageLink.afterText}
            </div>
          ) : displayText ? (
            <pre
              data-selectable-agent-response={block.id}
              ref={(element) => {
                textRef.current = element;
              }}
              className={`min-w-0 whitespace-pre-wrap break-words font-sans text-sm ${expanded ? "" : "line-clamp-4"}`}
            >
              {displayText}
            </pre>
          ) : null}
          {overflows ? (
            <button
              type="button"
              aria-expanded={expanded}
              className="mt-1 rounded px-1 py-0.5 text-xs text-content/60 hover:bg-content/8 hover:text-content"
              onClick={toggle}
            >
              {expanded ? uiT("Show less") : uiT("Show more")}
            </button>
          ) : null}
          {block.ciContext ? (
            <details
              className="group/ci mt-2 min-w-0 border-t border-content/10 pt-2"
              onClick={(event) => event.stopPropagation()}
            >
              <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded text-xs text-content/50 transition-colors hover:text-content/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-content/40 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3 shrink-0 transition-transform group-open/ci:rotate-90" />
                <span>{uiT("CI context")}</span>
              </summary>
              <p className="mt-2 text-xs text-content/50">
                {uiT(
                  "CI instructions and failure details included with this request.",
                )}
              </p>
              <pre className="mt-2 max-h-72 min-w-0 overflow-auto overscroll-contain rounded-md bg-content/5 p-2.5 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-content/70">
                {block.ciContext}
              </pre>
            </details>
          ) : null}
          {block.draft ? (
            <div className="mt-2 flex items-center justify-between gap-4 border-t border-dashed border-content/20 pt-2">
              <span className="flex items-center gap-1.5 text-xs text-content/50">
                <CircleDashed className="size-3.5" />
                {uiT("Draft")}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  title={uiT("Remove draft")}
                  aria-label={uiT("Remove draft")}
                  onClick={() => onRemoveDraft?.(block)}
                  className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-content/55 hover:bg-content/10 hover:text-content"
                >
                  <Trash2 className="size-3.5" />
                  {uiT("Remove")}
                </button>
                <button
                  type="button"
                  title={uiT("Send draft")}
                  aria-label={uiT("Send draft")}
                  onClick={() => onSendDraft?.(block)}
                  className="primary-action flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-transform duration-150 active:scale-[0.97]"
                >
                  {uiT("Send")}
                  <ArrowUp className="size-3.5" strokeWidth={2.25} />
                </button>
              </span>
            </div>
          ) : null}
          {monocode ? (
            <MonocodeSparkles blockId={block.id} startedAt={block.startedAt} />
          ) : block.intent === "plan" ? (
            <PlanStepsBurst blockId={block.id} startedAt={block.startedAt} />
          ) : block.intent === "orchestrate" ? (
            <OrchestratorConstellation
              blockId={block.id}
              startedAt={block.startedAt}
            />
          ) : null}
        </div>
        {text ||
        block.attachments?.length ||
        sentAt != null ||
        onEdit ? (
          <div className="user-message-actions flex items-center gap-1 px-3 pt-1">
            {text || block.attachments?.length ? (
              <CopyTurnButton
                text={text}
                attachments={block.attachments}
                label={uiT("Copy message")}
              />
            ) : null}
            {onEdit ? (
              <EditLastTurnButton onEdit={onEdit} editing={editing} />
            ) : null}
            {text && onSaveNote ? (
              <SaveNoteButton text={text} onSave={onSaveNote} />
            ) : null}
            {sentAt != null ? (
              <time
                dateTime={new Date(sentAt).toISOString()}
                title={new Date(sentAt).toLocaleString(language)}
                className="ml-1 font-sans text-xs text-content/40"
              >
                {formatClockTime(sentAt)}
              </time>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Animate one fold, then release its contents. Closed work must not retain
 * a component and DOM tree for every tool; only expansion builds those rows.
 * Visible rows stay out of Grid so they rewrap when their pane changes width.
 */
function TurnRow({
  folded,
  children,
}: {
  folded: boolean;
  children: ReactNode | (() => ReactNode);
}) {
  return (
    <AnimatedCollapse expanded={!folded}>
      {() => (
        <div className="pb-1">
          {typeof children === "function" ? children() : children}
        </div>
      )}
    </AnimatedCollapse>
  );
}

/** A turn item's identity, stable as the group it names grows. */
function turnItemKey(item: TurnItem): string {
  return item.type === "block" ? item.block.id : item.blocks[0].id;
}

/**
 * The line a turn's work folds behind: the harness mark, and the clock —
 * ticking while the agent works, how long it took once it is done. Everything
 * the fold holds stays one click away, so the settled transcript reads as
 * prompt, answer, and a receipt for the work in between.
 */
function WorkFoldLine({
  title,
  kind,
  harness,
  live = false,
  expandable,
  open,
  sheet,
  onToggle,
}: {
  title: ReactNode;
  kind: ActivityPhaseKind;
  harness?: HarnessId;
  live?: boolean;
  expandable: boolean;
  open: boolean;
  /** Set when tapping lists the work in a sheet; carries the edit totals. */
  sheet?: { additions: number; deletions: number };
  onToggle: () => void;
}) {
  const { t: uiT } = useTranslation();
  const iconTone = expandable && !sheet
    ? `transition-opacity ${open ? "opacity-0" : "group-hover:opacity-0 group-focus-within:opacity-0"}`
    : "";
  const icon = (
    <span className="relative flex size-3.5 shrink-0 items-center justify-center">
      {harness ? (
        <HarnessIcon
          harness={harness}
          className={`size-3.5 shrink-0 ${iconTone}`}
        />
      ) : (
        <ActivityPhaseIcon kind={kind} className={iconTone} />
      )}
      {expandable && !sheet ? (
        <ChevronRight
          className={`zen-disclosure-chevron absolute size-3.5 ${open ? "rotate-90" : ""}`}
        />
      ) : null}
    </span>
  );
  // While the agent runs, its status shimmers on the fold line.
  const label = live ? (
    title
  ) : (
    <span className="min-w-0 flex-1 truncate font-sans text-sm text-foreground-subtlest transition-colors duration-200 group-hover:text-content/80">
      {title}
    </span>
  );
  const row = `flex w-full min-w-0 items-center gap-1.5 px-4 @md:px-6 py-1 text-left${
    open ? " zen-fold-drop" : ""
  }`;

  if (!expandable) {
    return (
      <div
        className={`group ${row}`}
        role={live ? "status" : undefined}
        aria-live={live ? "polite" : undefined}
      >
        {icon}
        {label}
      </div>
    );
  }
  if (sheet) {
    return (
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={uiT("Show the work")}
        onClick={onToggle}
        className={`group ${row}`}
        data-activity-sheet
      >
        {icon}
        {label}
        {sheet.additions > 0 || sheet.deletions > 0 ? (
          <span className="shrink-0 font-mono text-xs">
            <span className="text-emerald-400">+{sheet.additions}</span>
            <span className="ms-1 text-red-400">−{sheet.deletions}</span>
          </span>
        ) : null}
        <ChevronRight className="size-3.5 shrink-0 text-foreground-subtlest" />
      </button>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={open ? uiT("Hide the work") : uiT("Show the work")}
      aria-live={live ? "polite" : undefined}
      onClick={onToggle}
      className={`group ${row}`}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * The turn's work as phases. Related reasoning and calls stay together while
 * assistant prose remains outside as full-size transcript text. The phase the
 * agent is in stays open, with new steps scrolling inside a short window; the
 * moment it moves on the phase folds back to its header.
 */
type ActivityPhasesProps = {
  blocks: Block[];
  cwd?: string;
  done?: boolean;
  /** False inside a nested panel, which supplies its own gutter. */
  padded?: boolean;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
};

const ActivityPhases = memo(function ActivityPhases({
  blocks,
  cwd,
  done,
  padded = true,
  onApproval,
  onOpenFile,
  onOpenDiff,
}: ActivityPhasesProps) {
  const phases = useMemo(() => buildActivityPhases(blocks), [blocks]);

  return (
    <div
      className={`flex min-w-0 flex-col gap-1 ${padded ? "px-4 @md:px-6" : ""}`}
    >
      {phases.map((phase, index) => (
        <ActivityPhaseGroup
          key={phase.id}
          phase={phase}
          cwd={cwd}
          active={!done && index === phases.length - 1}
          onApproval={onApproval}
          onOpenFile={onOpenFile}
          onOpenDiff={onOpenDiff}
        />
      ))}
    </div>
  );
}, sameActivity);

/**
 * A settled group is the same calls it was on the last token. Comparing the
 * blocks themselves keeps every earlier turn out of the streaming re-render,
 * which is most of what makes a long transcript stutter while the agent works.
 */
function sameActivity(a: ActivityPhasesProps, b: ActivityPhasesProps): boolean {
  return (
    a.cwd === b.cwd &&
    a.done === b.done &&
    a.padded === b.padded &&
    a.onApproval === b.onApproval &&
    a.onOpenFile === b.onOpenFile &&
    a.onOpenDiff === b.onOpenDiff &&
    a.blocks.length === b.blocks.length &&
    a.blocks.every((block, index) => block === b.blocks[index])
  );
}

/**
 * Hold the reader's place while turns above the viewport change height. An
 * off-screen turn keeps its content-visibility placeholder until it is first
 * laid out, and the scroller opts out of native scroll anchoring, so scrolling
 * up through a freshly opened chat would otherwise shove the view down by
 * each turn's correction.
 */
function useTurnScrollAnchor(
  el: HTMLDivElement | null,
  enabled: boolean,
  stickToBottom: RefObject<boolean>,
  onAdjust: (el: HTMLElement) => void,
) {
  useLayoutEffect(() => {
    const inner = el?.firstElementChild;
    if (!enabled || !el || !inner) return;
    const heights = new WeakMap<Element, number>();
    const resize = new ResizeObserver((entries) => {
      // A parked transcript's scroller is detached and measures zero.
      if (!el.isConnected) return;
      const viewportTop = el.getBoundingClientRect().top;
      let shift = 0;
      let precedingDelta = 0;
      const byTurn = new Map(entries.map((entry) => [entry.target, entry]));
      // The callback's entries can arrive out of order. Later turns already
      // include earlier height corrections in their current layout position.
      for (const turn of inner.children) {
        const entry = byTurn.get(turn);
        if (!entry) continue;
        const height =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        const previous = heights.get(entry.target);
        heights.set(entry.target, height);
        if (previous === undefined || stickToBottom.current) continue;
        // Only turns that sat wholly above the view. A turn the reader is
        // looking at grows downward from where they are reading.
        const top = entry.target.getBoundingClientRect().top - precedingDelta;
        if (top + previous <= viewportTop) shift += height - previous;
        precedingDelta += height - previous;
      }
      if (shift) {
        el.scrollTop += shift;
        onAdjust(el);
      }
    });
    let observed = new WeakSet<Element>();
    const observeTurns = () => {
      for (const turn of inner.children) {
        if (observed.has(turn) || !turn.classList.contains("transcript-turn"))
          continue;
        observed.add(turn);
        resize.observe(turn);
      }
    };
    const mutations = new MutationObserver((records) => {
      // Removal is rare (a rewind or edit), so start over rather than hold
      // detached turns. Re-observed turns report the height already stored.
      if (records.some((record) => record.removedNodes.length > 0)) {
        resize.disconnect();
        observed = new WeakSet();
      }
      observeTurns();
    });
    mutations.observe(inner, { childList: true });
    observeTurns();
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, [el, enabled, stickToBottom, onAdjust]);
}

/**
 * One phase: a header the whole group hangs off, and the steps under it on a
 * rail. Folding is automatic — the group opens while it is the live one and
 * closes when the agent moves on — until you click, after which it stays where
 * you put it. A step still waiting on you keeps the group open regardless.
 * While live, the open body stays a short scrolling window pinned to the
 * newest step; after the turn settles an opened group is full height again.
 */
function ActivityPhaseGroup({
  phase,
  cwd,
  active,
  onApproval,
  onOpenFile,
  onOpenDiff,
}: {
  phase: ActivityPhase;
  cwd?: string;
  active: boolean;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const { openActivity } = useContext(TranscriptPlatformContext);
  const [override, setOverride] = useState<boolean | null>(null);
  const waiting = phase.steps.some(needsApproval);
  // Clients with a step sheet keep the live window inline but never unfold a
  // settled group; a step waiting on approval stays inline so it can be answered.
  const sheet = !!openActivity && !waiting;
  const open = waiting || (sheet ? active : (override ?? active));
  const [liveScroller, setLiveScroller] = useState<HTMLDivElement | null>(null);
  useLivePhaseScroll(liveScroller, active && open, phase.steps);
  // Steps already here when the group mounted, or that landed while it was
  // folded, are history: only a step you watch arrive gets the entrance.
  const settled = useRef<Set<Block["id"]> | null>(null);
  settled.current ??= new Set(phase.steps.map((step) => step.id));
  useEffect(() => {
    for (const step of phase.steps) settled.current?.add(step.id);
  }, [phase.steps]);
  const turnFor = useStepQueue();
  const title = activityPhaseTitle(phase, active);
  const monoCodePhase = !!monoCodeWorkSummary(phase.steps, active);
  // Opening a group on purpose is also how you read the line that titled it,
  // whole. The auto-open while it runs is a live view, not a reading one, and
  // a one-line note the header already shows in full has nothing to add.
  const headline =
    override === true && phase.headline && headlineHasMore(phase.headline)
      ? phase.headline
      : undefined;
  const inert = phase.steps.length === 0 && !headlineHasMore(phase.headline);

  // A lone call the agent never introduced is not a group: a header repeating
  // the single row under it says nothing twice.
  if (!phase.headline && phase.steps.length === 1) {
    return (
      <ActivityRow
        block={phase.steps[0]}
        cwd={cwd}
        live={active}
        onApproval={onApproval}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    );
  }

  const label = active ? (
    <Shimmer className="min-w-0 truncate font-sans text-sm" duration={1.6}>
      {title}
    </Shimmer>
  ) : (
    // Dimmed to sit with the icons: the work is chrome around the answer, and
    // only the answer reads at full strength.
    <span className="min-w-0 flex-1 truncate font-sans text-sm text-foreground-subtlest transition-colors duration-200 group-hover:text-content/80">
      {title}
    </span>
  );

  // A line the agent wrote with nothing under it is just that line.
  if (inert) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 py-1">
        <ActivityPhaseIcon kind={phase.kind} />
        {label}
      </div>
    );
  }

  const diff = sheet ? workDiffStats(phase.steps) : undefined;
  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={sheet ? undefined : open}
        aria-haspopup={sheet ? "dialog" : undefined}
        aria-label={
          sheet
            ? uiT("Show the steps for {value0}", { value0: String(title) })
            : open
              ? uiT("Hide the steps for {value0}", { value0: String(title) })
              : uiT("Show the steps for {value0}", { value0: String(title) })
        }
        onClick={() => (sheet ? openActivity!(phase.steps) : setOverride(!open))}
        className="group flex w-full min-w-0 items-center gap-1.5 py-1 text-left"
        data-activity-sheet={sheet || undefined}
      >
        {/*
         * The two icons share one 14px box, so the swap is instant: fading
         * between them leaves both half-drawn on top of each other.
         * Sheet triggers keep their icon; their chevron lives at the row's end.
         */}
        <span className="relative flex size-3.5 shrink-0 items-center justify-center">
          {monoCodePhase ? (
            <MonoCodeMark
              className={`size-3.5 ${sheet ? "" : open ? "opacity-0" : "group-hover:opacity-0 group-focus-within:opacity-0"}`}
            />
          ) : (
            <ActivityPhaseIcon
              kind={phase.kind}
              className={
                sheet
                  ? ""
                  : open
                    ? "opacity-0"
                    : "group-hover:opacity-0 group-focus-within:opacity-0"
              }
            />
          )}
          {!sheet && (
            <ChevronRight
              className={`zen-disclosure-chevron absolute size-3.5 ${
                open ? "rotate-90" : ""
              }`}
            />
          )}
        </span>
        {label}
        {diff && (diff.additions > 0 || diff.deletions > 0) && (
          <span className="activity-diff-badge shrink-0 font-mono text-xs">
            <span className="text-emerald-400">+{diff.additions}</span>
            <span className="ms-1 text-red-400">−{diff.deletions}</span>
          </span>
        )}
        {sheet && (
          <ChevronRight className="size-3.5 shrink-0 text-foreground-subtlest" />
        )}
      </button>
      <div className="zen-phase-body" data-open={open}>
        <AnimatedCollapse expanded={open}>
          {() => (
            <div
              ref={setLiveScroller}
              className={active || !open ? "zen-phase-live" : undefined}
            >
              <div className="flex min-w-0 flex-col">
                {headline ? (
                  <div className="zen-phase-step py-1">
                    <AgentMarkdown
                      className={
                        headline.role === "reasoning"
                          ? "agent-reasoning"
                          : undefined
                      }
                      text={headline.text}
                      cwd={cwd}
                      onOpenFile={onOpenFile}
                    />
                  </div>
                ) : null}
                {phase.steps.map((block) => {
                  const arriving = active && !settled.current?.has(block.id);
                  return (
                    <PhaseStep
                      key={block.id}
                      live={active}
                      turn={arriving ? turnFor(block.id) : undefined}
                    >
                      <ActivityRow
                        block={block}
                        cwd={cwd}
                        live={active}
                        onApproval={onApproval}
                        onOpenFile={onOpenFile}
                        onOpenDiff={onOpenDiff}
                      />
                    </PhaseStep>
                  );
                })}
              </div>
            </div>
          )}
        </AnimatedCollapse>
      </div>
    </div>
  );
}

type StepTurn = { wait: number; pace: number };

/**
 * A group's queue of arriving steps: how long each one waits for the step
 * before it to finish, and how long its own entrance then takes. A step keeps
 * the turn it was first given however often the group renders.
 */
function useStepQueue() {
  const queue = useRef({ next: 0, turns: new Map<Block["id"], StepTurn>() });

  return (id: Block["id"]) => {
    const { turns } = queue.current;
    let turn = turns.get(id);
    if (!turn) {
      const now = performance.now();
      const start = Math.max(now, queue.current.next);
      const wait = start - now;
      const backlog =
        (STEP_QUEUE_MS - wait) / (STEP_QUEUE_MS - STEP_QUEUE_CALM_MS);
      const pace = Math.max(
        STEP_ENTRANCE_MIN_MS,
        STEP_ENTRANCE_MS * Math.min(1, backlog),
      );
      queue.current.next = start + pace;
      turn = { wait, pace };
      turns.set(id, turn);
    }
    return turn;
  };
}

/**
 * One step on a phase's rail. A step that lands while you watch makes room
 * first — what is below glides down, the rail runs into the gap and branches
 * off — and only then does the row fade in. One that lands behind others
 * stays out of the layout until its turn. The grid and clipping that does
 * that come off once the row has settled, so nothing inside stays clipped.
 */
function PhaseStep({
  live,
  turn: arrival,
  children,
}: {
  live: boolean;
  /** Set only on the render a step arrives in; later renders drop it. */
  turn?: StepTurn;
  children: ReactNode;
}) {
  const [turn] = useState(arrival);
  const [stage, setStage] = useState<"waiting" | "entering" | "settled">(() =>
    !turn ? "settled" : turn.wait > 0 ? "waiting" : "entering",
  );

  useEffect(() => {
    if (stage !== "waiting" || !turn) return;
    const timer = window.setTimeout(() => setStage("entering"), turn.wait);
    return () => window.clearTimeout(timer);
  }, [stage, turn]);

  return (
    <div
      className="zen-phase-step"
      style={
        turn
          ? ({ "--step-ms": `${Math.round(turn.pace)}ms` } as CSSProperties)
          : undefined
      }
      data-live={live || undefined}
      data-waiting={stage === "waiting" || undefined}
      data-entering={stage === "entering" || undefined}
      onAnimationEnd={(e) => {
        // The row's own fade is the last beat; nested rails bubble theirs.
        if (
          e.animationName === "zen-step-in" &&
          (e.target as Element).parentElement === e.currentTarget
        ) {
          setStage("settled");
        }
      }}
    >
      {children}
    </div>
  );
}

/**
 * Every delegated run in the turn, one row each. The main transcript cycles —
 * work folds behind a line, prose replaces prose — and a subagent you are
 * watching must not move while that happens, so these rows are never part of a
 * fold and hold their place from the moment the agents start.
 *
 * A row is a mascot, a name, and what that agent is doing right now. Click it
 * and the agent's own trail opens underneath.
 */
function SubagentStack({
  blocks,
  cwd,
  live = false,
  embedded = false,
  onOpenFile,
  onOpenDiff,
}: {
  blocks: Block[];
  cwd?: string;
  live?: boolean;
  embedded?: boolean;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  return (
    <div className={`flex min-w-0 flex-col ${embedded ? "" : "px-4 @md:px-6"}`}>
      {blocks.map((block) => (
        <SubagentRow
          key={block.id}
          block={block}
          cwd={cwd}
          live={live}
          onOpenFile={onOpenFile}
          onOpenDiff={onOpenDiff}
        />
      ))}
    </div>
  );
}

/**
 * One delegated run's row, stateful about being opened. A run that died opens
 * itself, so the provider's reason is not buried behind a face that looks like
 * every other finished one. A click takes the row over from there and it stays
 * where the reader puts it. The same row serves inside a settled turn's trail,
 * where the run sits as one step of the work it was spawned from.
 */
function SubagentRow({
  block,
  cwd,
  live = false,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  live?: boolean;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const [override, setOverride] = useState<boolean | null>(null);
  const open = override ?? toolCallState(block) === "rejected";
  return (
    <SubagentPanel
      block={block}
      cwd={cwd}
      live={live}
      open={open}
      onToggle={() => setOverride(!open)}
      onOpenFile={onOpenFile}
      onOpenDiff={onOpenDiff}
    />
  );
}

/**
 * One delegated run: its name, what it is doing, and — once opened — the trail
 * it left, with the same tool rows, thinking and prose the main transcript
 * shows. While it runs the trail is a short window pinned to the newest step,
 * so a subagent doing hundreds of things cannot push the turn off the screen.
 */
function SubagentPanel({
  block,
  cwd,
  live = false,
  open,
  onToggle,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  live?: boolean;
  open: boolean;
  onToggle: () => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const name = subagentName(block);
  const brief = subagentBrief(block);
  const model = subagentModelName(block);
  const state = toolCallState(block);
  const active = live && state === "pending";
  const steps = block.agentRun?.steps ?? [];
  // The run's trail as transcript blocks, so the panel groups it the way the
  // main transcript groups the agent's own work: what it said, then the calls
  // that line introduced, folding behind it once it moves on.
  const stepBlocks = useMemo(() => steps.map(agentStepBlock), [steps]);
  const status = subagentStatusLine(block, steps);
  const report = subagentReport(block);
  const failed = state === "rejected";

  // The name takes the room it needs and gives the rest back: a provider that
  // names a run with its whole brief must not push the row off the pane.
  const label = (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      {active ? (
        <Shimmer
          className="min-w-0 flex-1 truncate font-sans text-sm"
          duration={1.6}
        >
          {name}
        </Shimmer>
      ) : (
        <span
          className={`min-w-0 flex-1 truncate font-sans text-sm transition-colors duration-200 ${
            state === "rejected"
              ? "text-red-400"
              : "text-content/75 group-hover:text-content"
          }`}
        >
          {name}
        </span>
      )}
      {model || status ? (
        <span className="flex min-w-0 max-w-[55%] shrink-0 items-baseline gap-2 font-sans text-ui-sm text-content/40">
          {model ? (
            <span
              className="truncate"
              title={uiT("Model: {value0}", { value0: String(model) })}
            >
              {model}
            </span>
          ) : null}
          {status ? <span className="shrink-0">{status}</span> : null}
        </span>
      ) : null}
    </span>
  );

  // A run that has not reported a step yet has nothing to open into. The row
  // still holds its place, so the chevron arriving does not move anything.
  if (steps.length === 0 && !report) {
    return (
      <div
        aria-label={uiT("Subagent: {value0}", { value0: String(name) })}
        title={brief}
        className="-mx-1.5 flex min-w-0 items-center gap-2 px-1.5 py-1"
      >
        <SubagentMascot name={name} state={state} active={active} />
        {label}
        <span className="size-3.5 shrink-0" />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? uiT("Hide {value0}'s work", { value0: String(name) })
            : uiT("Show {value0}'s work", { value0: String(name) })
        }
        title={brief}
        onClick={onToggle}
        // An open row keeps the wash it lit up under the cursor, so the panel
        // below reads as hanging off it rather than off the transcript.
        className={`group -mx-1.5 flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors duration-200 hover:bg-content/8 ${
          open ? "bg-content/8" : ""
        }`}
      >
        <SubagentMascot name={name} state={state} active={active} />
        {label}
        <ChevronRight
          className={`zen-disclosure-chevron size-3.5 shrink-0 ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      <div className="zen-phase-body" data-open={open}>
        <AnimatedCollapse expanded={open}>
          {() => (
            /*
             * No scroll window of its own. Each phase inside already keeps the
             * group the run is working in to a short pinned window; wrapping a
             * second window around them nests one 17.5rem scroller inside
             * another, and the inner one can never reach its own last row.
             */
            <div className="flex min-w-0 flex-col pb-1">
              <ActivityPhases
                blocks={stepBlocks}
                cwd={cwd}
                done={!active}
                padded={false}
                onOpenFile={onOpenFile}
                onOpenDiff={onOpenDiff}
              />
              {report ? (
                <div className="zen-phase-step py-1">
                  {failed ? (
                    <pre className="min-w-0 whitespace-pre-wrap break-words font-mono text-ui-sm leading-5 text-red-400/80">
                      {report}
                    </pre>
                  ) : (
                    <AgentMarkdown
                      text={report}
                      cwd={cwd}
                      onOpenFile={onOpenFile}
                    />
                  )}
                </div>
              ) : null}
            </div>
          )}
        </AnimatedCollapse>
      </div>
    </div>
  );
}

/**
 * The pixel mascot standing in for a subagent, hopping while it works. The
 * sprite is hashed off the agent's name, so the same reviewer keeps the same
 * face across a session and two agents in a row are told apart at a glance.
 */
function SubagentMascot({
  name,
  state,
  active = false,
}: {
  name: string;
  state: ToolCallState;
  active?: boolean;
}) {
  return (
    <ProjectMascot
      project={name}
      active={active}
      className={`size-3.5 shrink-0 ${
        state === "rejected"
          ? "text-red-400"
          : state === "pending"
            ? "text-content/70"
            : "text-content/45"
      }`}
    />
  );
}

/**
 * A mirrored step as the transcript block it stands for, so a subagent's trail
 * goes through the same rows — labels, file chips, diffs — as the main agent's.
 */
function agentStepBlock(step: AgentStep): Block {
  if (step.kind !== "tool") {
    return {
      id: step.id,
      role: step.kind === "reasoning" ? "reasoning" : "assistant",
      text: step.text,
    };
  }
  return {
    id: step.id,
    role: "tool",
    text: step.text,
    tool: {
      callId: step.id,
      title: step.text,
      ...(step.toolKind ? { kind: step.toolKind } : {}),
      ...(step.status ? { status: step.status } : {}),
      ...(step.detail ? { detail: step.detail } : {}),
      ...(step.preview ? { preview: step.preview } : {}),
    },
  };
}

/** What a delegated run is up to: its newest step, or how much it got through. */
/**
 * A run is counted, never narrated. Echoing the call in flight put a second
 * scrolling command line on every row — the shimmer on the name already says
 * the agent is working, and the count says how far it has got.
 */
function subagentStatusLine(block: Block, steps: AgentStep[]): string {
  if (toolCallState(block) === "rejected") return "failed";
  const tools = steps.filter((step) => step.kind === "tool").length;
  if (tools === 0) return "";
  const count = tools === 1 ? "1 step" : `${tools} steps`;
  // A step that failed inside a run that went on to finish still has to say so
  // here, or the row reads clean until someone opens the trail.
  const failed = steps.filter(
    (step) => step.kind === "tool" && isFailedStatus(step.status),
  ).length;
  if (!failed) return count;
  return `${count}, ${failed === 1 ? "1 failed" : `${failed} failed`}`;
}

/** Whether the line that titled a group has more in it than the header shows. */
function headlineHasMore(block?: Block): boolean {
  if (!block) return false;
  return block.role === "reasoning" || /\n\s*\n/.test(block.text.trim());
}

/** What the group was for, at a glance: look, change, run, think. */
function ActivityPhaseIcon({
  kind,
  className = "",
}: {
  kind: ActivityPhaseKind;
  className?: string;
}) {
  const props = {
    "aria-hidden": true as const,
    className: `size-3.5 shrink-0 text-content/45 ${className}`,
    strokeWidth: 1.75,
  };
  if (kind === "edit") return <PenLine {...props} />;
  if (kind === "research") return <Search {...props} />;
  if (kind === "run") return <Terminal {...props} />;
  if (kind === "agent") return <Bot {...props} />;
  if (kind === "think") return <AiIdea {...props} />;
  if (kind === "other") return <Wrench {...props} />;
  return <MessageSquare {...props} />;
}

/**
 * One step of the agent's work, whatever that step was: a tool call, a thought,
 * a paragraph. Each row keeps a type icon beside the phase rail.
 */
function ActivityRow({
  block,
  cwd,
  live = false,
  onApproval,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  live?: boolean;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  if (isThinkingBlock(block)) {
    return (
      <ActivityThinkingRow
        block={block}
        cwd={cwd}
        expandable
        onOpenFile={onOpenFile}
      />
    );
  }
  if (block.interjection) {
    return <ActivityInterjectionRow block={block} />;
  }
  if (block.role === "system") {
    return <ActivityStatusRow block={block} />;
  }
  if (isProseBlock(block)) {
    return (
      <ActivityNoteRow
        block={block}
        cwd={cwd}
        expandable
        onOpenFile={onOpenFile}
      />
    );
  }
  // Only a settled turn routes a delegated run here; live turns pin the row
  // outside the trail. Either way it is the same row, so it still opens onto
  // the agent's own work.
  if (isSubagentBlock(block)) {
    return (
      <SubagentRow
        block={block}
        cwd={cwd}
        live={live}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    );
  }
  return (
    <ActivityToolRow
      block={block}
      cwd={cwd}
      live={live}
      onApproval={onApproval}
      onOpenFile={onOpenFile}
      onOpenDiff={onOpenDiff}
    />
  );
}

/** A status row folded into the trail: one muted line, nothing to open. */
function ActivityStatusRow({ block }: { block: Block }) {
  const { t } = useTranslation();
  const text = localizeOrchestrationMessage(
    localizeChildExitError(block.text, t),
    t,
  );
  return (
    <div className="flex min-w-0 items-center gap-1.5 py-1">
      <CircleAlert
        aria-hidden="true"
        className="size-3.5 shrink-0 text-content/45"
        strokeWidth={1.75}
      />
      <span
        title={text}
        className="min-w-0 flex-1 truncate font-sans text-sm text-foreground-subtlest"
      >
        {text.trim()}
      </span>
    </div>
  );
}

/**
 * An interjection inside the work trail: one compact line naming where it came
 * from and what it said. It opens on a click, so folding the work never costs
 * you a note you wanted to read.
 */
function ActivityInterjectionRow({ block }: { block: Block }) {
  const { t: uiT } = useTranslation();
  const [open, setOpen] = useState(false);
  const meta = block.interjection;
  if (!meta) return null;
  const chrome = interjectionChrome(meta);
  const summary = proseSummary(block.text);
  const label = (
    <span className="min-w-0 flex-1 truncate font-sans text-sm">
      <span className="text-content/55">{chrome.label}</span>
      {chrome.severityText ? (
        <span className={`text-[11px] ${chrome.severityClass}`}>
          {" "}
          {chrome.severityText}
        </span>
      ) : null}
      {summary ? (
        <span className="text-foreground-subtlest transition-colors duration-200 group-hover:text-content/75">
          {" · "}
          {summary}
        </span>
      ) : null}
    </span>
  );

  if (!block.text.trim()) {
    return (
      <div
        aria-label={uiT("{value0} note", { value0: String(chrome.label) })}
        className="flex min-w-0 items-center gap-1.5 py-1"
      >
        <ActivityPhaseIcon kind="note" />
        {label}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? uiT("Hide the {value0} note", { value0: String(chrome.label) })
            : `${chrome.label}: ${summary}`
        }
        onClick={() => setOpen((value) => !value)}
        className="group flex min-w-0 items-center gap-1.5 py-1 text-left"
      >
        <ActivityPhaseIcon kind="note" />
        {label}
      </button>
      <AnimatedCollapse expanded={open}>
        <div className="min-w-0 pb-2">
          <pre className={INTERJECTION_BODY}>{block.text}</pre>
        </div>
      </AnimatedCollapse>
    </div>
  );
}

/**
 * The line that keeps a long think from reading as a stall: how long the
 * agent has been thinking, or thought, and the thought's first line. Opening
 * the fold around it does not open the thought itself — reasoning is only ever
 * read on purpose, one line until you ask for it. Opened while it streams, the
 * thought scrolls in a short window pinned to its newest line.
 */
function ActivityThinkingRow({
  block,
  cwd,
  expandable = false,
  onOpenFile,
}: {
  block: Block;
  cwd?: string;
  expandable?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const [open, setOpen] = useState(false);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const streaming = !!block.streaming;
  useLivePhaseScroll(scroller, open && streaming, block.text);
  const elapsed = useElapsedFrom(block.startedAt, !streaming);
  const summary = proseSummary(block.text);
  // Thoughts from before timing was recorded keep their one-line summary.
  const timing = streaming
    ? block.startedAt != null
      ? uiT("Thinking for {value0}", { value0: formatElapsed(elapsed) ?? "" })
      : uiT("Thinking")
    : block.durationMs != null
      ? uiT("Thought for {value0}", {
          value0: formatElapsed(block.durationMs) ?? "",
        })
      : undefined;
  const text = timing
    ? summary
      ? `${timing} · ${summary}`
      : timing
    : summary || uiT("Thinking");
  const content = timing ? (
    <>
      <span className="text-content/60">{timing}</span>
      {summary ? (
        <span>
          {" · "}
          {summary}
        </span>
      ) : null}
    </>
  ) : (
    text
  );
  const pulse = streaming ? "zen-thinking-pulse" : "";
  const icon = <ActivityPhaseIcon kind="think" className={pulse} />;
  const label = (
    <span
      className="min-w-0 flex-1 truncate font-sans text-sm text-foreground-subtlest"
    >
      {content}
    </span>
  );

  if (!expandable) {
    return (
      <div
        aria-label={uiT("Thinking: {value0}", { value0: String(text) })}
        className="flex min-w-0 items-center gap-1.5 py-1"
      >
        {icon}
        {label}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? uiT("Hide thinking")
            : uiT("Show thinking: {value0}", { value0: String(text) })
        }
        onClick={() => setOpen((value) => !value)}
        className="group flex min-w-0 items-center gap-1.5 py-1 text-left"
      >
        {icon}
        <span
          className="min-w-0 flex-1 truncate font-sans text-sm text-foreground-subtlest transition-colors duration-200 group-hover:text-content/75"
        >
          {content}
        </span>
        <ChevronRight
          className={`zen-disclosure-chevron size-3.5 shrink-0 ${open ? "rotate-90 opacity-100" : ""}`}
        />
      </button>
      <AnimatedCollapse expanded={open}>
        {() => (
          <div
            ref={setScroller}
            className={`zen-detail-panel ${
              streaming ? "max-h-60 overflow-auto" : ""
            }`}
          >
            <AgentMarkdown
              className="agent-reasoning"
              text={block.text}
              cwd={cwd}
              onOpenFile={onOpenFile}
            />
          </div>
        )}
      </AnimatedCollapse>
    </div>
  );
}

/**
 * A line the agent wrote mid-run, kept to one line. It opens on click, so
 * folding the work never costs you a paragraph you wanted to read.
 */
function ActivityNoteRow({
  block,
  cwd,
  expandable = false,
  onOpenFile,
}: {
  block: Block;
  cwd?: string;
  expandable?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const { t: uiT } = useTranslation();
  const [open, setOpen] = useState(false);
  const text = proseSummary(block.text);
  const icon = <ActivityPhaseIcon kind="note" />;

  if (!expandable) {
    return (
      <div
        aria-label={uiT("Agent said: {value0}", { value0: String(text) })}
        className="flex min-w-0 items-center gap-1.5 py-1"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate font-sans text-sm text-content/70">
          {text}
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col">
      <button
        type="button"
        aria-expanded={open}
        aria-label={
          open
            ? uiT("Hide the full note")
            : uiT("Agent said: {value0}", { value0: String(text) })
        }
        onClick={() => setOpen((value) => !value)}
        className="group flex min-w-0 items-center gap-1.5 py-1 text-left"
      >
        {icon}
        <span className="min-w-0 flex-1 truncate font-sans text-sm text-content/70 transition-colors duration-200 group-hover:text-content">
          {text}
        </span>
      </button>
      <AnimatedCollapse expanded={open}>
        {() => (
          <div className="min-w-0 pb-2">
            <AgentMarkdown text={block.text} cwd={cwd} onOpenFile={onOpenFile} />
          </div>
        )}
      </AnimatedCollapse>
    </div>
  );
}

function ActivityToolRow({
  block,
  cwd,
  live = false,
  onApproval,
  onOpenFile,
  onOpenDiff,
}: {
  block: Block;
  cwd?: string;
  live?: boolean;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
}) {
  const appCall = monoCodeToolCall(block);
  if (appCall) {
    return (
      <MonoCodeCallRow block={block} call={appCall} onApproval={onApproval} />
    );
  }
  return (
    <ToolRow
      block={block}
      cwd={cwd}
      live={live}
      variant="activity"
      compact
      onApproval={onApproval}
      onOpenFile={onOpenFile}
      onOpenDiff={onOpenDiff}
    />
  );
}

function MonoCodeMark({ className = "size-4" }: { className?: string }) {
  return <img src="/monocode.png" alt="" className={`shrink-0 ${className}`} />;
}

/** MonoCode commands read like the other activity rows; failures expose their output. */
function MonoCodeCallRow({
  block,
  call,
  onApproval,
}: {
  block: Block;
  call: MonoCodeToolCall;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
}) {
  const { t: uiT } = useTranslation();
  const state = toolCallState(block);
  const output =
    block.tool?.detail?.trim() || block.tool?.preview?.output?.trim();
  const [errorOpen, setErrorOpen] = useState(false);
  const hasError = state === "rejected" && !!output;
  const pendingApproval = needsApproval(block);
  const command = `monocode app ${call.action}`;
  const verb = pendingApproval
    ? "Run"
    : state === "pending"
      ? "Running"
      : "Ran";
  const summary = (
    <>
      <MonoCodeMark className="size-3.5" />
      <span
        className={`shrink-0 font-sans text-sm ${state === "rejected" ? "text-red-400" : "text-foreground-subtlest"}`}
      >
        {verb}
      </span>
      <span
        className={`flex min-w-0 max-w-full items-center gap-1 rounded bg-content/6 px-1 font-mono text-ui-caption ${state === "rejected" ? "text-red-400" : "text-content/70"}`}
        title={command}
      >
        <span className="min-w-0 truncate">{command}</span>
      </span>
      <ToolCallStatusIcon state={state} />
      {hasError ? (
        <ChevronRight
          className={`size-3.5 shrink-0 text-red-400/60 transition-transform ${errorOpen ? "rotate-90" : ""}`}
        />
      ) : null}
    </>
  );
  return (
    <div data-monocode-tool-call={call.action} className="min-w-0">
      {hasError ? (
        <button
          type="button"
          aria-expanded={errorOpen}
          aria-label={
            errorOpen
              ? uiT("Hide error details for MonoCode: {value0}", {
                  value0: call.label,
                })
              : uiT("Show error details for MonoCode: {value0}", {
                  value0: call.label,
                })
          }
          onClick={() => setErrorOpen((value) => !value)}
          className="flex w-full min-w-0 items-center gap-1.5 py-1 text-left"
        >
          {summary}
        </button>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5 py-1">{summary}</div>
      )}
      <AnimatedCollapse expanded={errorOpen && hasError}>
        <pre className="zen-detail-panel whitespace-pre-wrap break-words text-red-400/80">
          {output}
        </pre>
      </AnimatedCollapse>
      {pendingApproval ? (
        <pre className="max-h-32 min-w-0 overflow-auto whitespace-pre-wrap break-all py-1 pl-5 font-mono text-ui-sm leading-5 text-content/70">
          {call.command}
        </pre>
      ) : null}
      <ApprovalControls block={block} onApproval={onApproval} />
    </div>
  );
}

function useElapsedFrom(
  startedAt: number | undefined,
  paused: boolean,
): number | null {
  const fallback = useRef<number | null>(null);
  const pausedMs = useRef(0);
  const pauseStarted = useRef<number | null>(null);
  const seenStartedAt = useRef(startedAt);

  if (seenStartedAt.current !== startedAt) {
    seenStartedAt.current = startedAt;
    fallback.current = null;
    pausedMs.current = 0;
    pauseStarted.current = paused ? Date.now() : null;
  }

  const origin = startedAt ?? (fallback.current ??= Date.now());
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, Date.now() - origin),
  );

  useEffect(() => {
    const start = startedAt ?? (fallback.current ??= Date.now());
    if (paused) {
      if (pauseStarted.current == null) pauseStarted.current = Date.now();
      return;
    }
    if (pauseStarted.current != null) {
      pausedMs.current += Date.now() - pauseStarted.current;
      pauseStarted.current = null;
    }
    const tick = () =>
      setElapsedMs(Math.max(0, Date.now() - start - pausedMs.current));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, paused]);

  return elapsedMs;
}

function formatWorkingDuration(
  elapsedMs: number | null,
  modelName?: string,
  done = false,
): string {
  const who = modelName?.trim();
  const elapsed = formatElapsed(elapsedMs);
  if (elapsed == null) {
    if (done) {
      return who
        ? translate("{model} worked", { model: who })
        : translate("Worked");
    }
    return who
      ? translate("{model} working…", { model: who })
      : translate("Working…");
  }
  return who
    ? translate(
        done ? "{model} worked for {duration}" : "{model} working for {duration}",
        { model: who, duration: elapsed },
      )
    : translate(done ? "Worked for {duration}" : "Working for {duration}", {
        duration: elapsed,
      });
}

function formatElapsed(elapsedMs: number | null): string | null {
  if (elapsedMs == null) return null;
  const totalSec = Math.max(1, Math.round(elapsedMs / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function ToolCall({
  block,
  cwd,
  onApproval,
  onOpenFile,
  onOpenDiff,
  embedded,
}: {
  block: Block;
  cwd?: string;
  onApproval?: (requestId: number, decision: ApprovalDecision) => void;
  onOpenFile?: (path: string) => void;
  onOpenDiff?: (path: string) => void;
  embedded?: boolean;
}) {
  const preview = block.tool?.preview;
  const label = toolCallLabel(block, cwd);
  const state = toolCallState(block);
  const frame = embedded ? "py-0.5" : "px-4 @md:px-6 py-1";

  const appCall = monoCodeToolCall(block);
  if (appCall) {
    return (
      <div className={frame}>
        <MonoCodeCallRow block={block} call={appCall} onApproval={onApproval} />
      </div>
    );
  }

  // An edit waiting on you shows the change itself, so you approve what it does.
  if (
    needsApproval(block) &&
    isEditTool(block.tool?.kind, block.text || block.tool?.title, preview)
  ) {
    return (
      <div className={frame}>
        <FilePreview
          preview={preview ?? stubFilePreview(block.tool?.kind, label)}
          status={state}
          cwd={cwd}
          onOpenFile={onOpenDiff ?? onOpenFile}
        />
        <ApprovalControls block={block} onApproval={onApproval} />
      </div>
    );
  }

  if (isIncompleteTool(block, label, state)) return null;

  return (
    <div className={frame}>
      <ToolRow
        block={block}
        cwd={cwd}
        variant="standalone"
        onApproval={onApproval}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
      />
    </div>
  );
}

function HandoffDivider({ block }: { block: Block }) {
  const { t: uiT } = useTranslation();
  const meta = block.handoff;
  if (!meta) return null;

  const preparing = meta.status === "preparing";
  const label = preparing ? "Preparing a handoff" : HARNESS_TITLE[meta.to];

  return (
    <div className="px-4 @md:px-6 py-5">
      <div className="flex items-center gap-3">
        <div className="h-px min-w-4 flex-1 bg-content/12" />
        <div
          role="separator"
          aria-label={
            preparing
              ? uiT("Preparing a handoff to {value0}", {
                  value0: String(HARNESS_TITLE[meta.to]),
                })
              : uiT("Continued with {value0}", { value0: String(label) })
          }
          className="flex max-w-[min(100%,20rem)] items-center gap-1.5 px-1.5 font-sans text-[12px] text-content/55"
        >
          {preparing ? (
            <>
              <TerminalSpinner className="inline-block w-3.5 shrink-0 select-none text-center text-[11px] leading-none text-content/45" />
              <Shimmer duration={1.4}>{label}</Shimmer>
            </>
          ) : (
            <>
              <HarnessIcon harness={meta.to} className="size-3.5 shrink-0" />
            </>
          )}
        </div>
        <div className="h-px min-w-4 flex-1 bg-content/12" />
      </div>
    </div>
  );
}

/** The label and severity chrome an interjection wears, wherever it sits. */
function interjectionChrome(meta: InterjectionMeta): {
  label: string;
  severityText?: string;
  severityClass: string;
} {
  const label =
    meta.customType === "advisor"
      ? "Advisor"
      : meta.customType === "custom"
        ? "Notice"
        : meta.customType;
  const severityText =
    meta.severity === "blocker"
      ? "Blocker"
      : meta.severity === "concern"
        ? "Concern"
        : meta.severity === "nit"
          ? "Nit"
          : undefined;
  const severityClass =
    meta.severity === "blocker"
      ? "text-red-400"
      : meta.severity === "concern"
        ? "text-amber-400"
        : "text-content/55";
  return { label, severityText, severityClass };
}

/** The advisory body under an interjection, wherever the note is surfaced. */
const INTERJECTION_BODY =
  "min-w-0 whitespace-pre-wrap break-words font-sans text-[12.5px] leading-5 text-content/70";

/** A mid-turn interjection, e.g. OMP advisor notes: a labeled boundary with
 * a collapsible advisory body below it. */
function InterjectionDivider({ block }: { block: Block }) {
  const { t: uiT } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLPreElement>(null);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !block.text) {
      setOverflows(false);
      return;
    }
    const measure = () => {
      if (!expanded) {
        setOverflows(el.scrollHeight > el.clientHeight + 1);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [block.text, expanded]);

  const meta = block.interjection;
  if (!meta) return null;
  const { label, severityText, severityClass } = interjectionChrome(meta);
  return (
    <div className="px-4 @md:px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="h-px min-w-4 flex-1 bg-content/12" />
        <div
          role="separator"
          aria-label={uiT("Interjection: {value0}", { value0: String(label) })}
          className="flex items-center gap-2 px-1.5 font-sans text-[12px] text-content/55"
        >
          <span>{label}</span>
          {severityText ? (
            <span className={`text-[11px] ${severityClass}`}>
              {severityText}
            </span>
          ) : null}
        </div>
        <div className="h-px min-w-4 flex-1 bg-content/12" />
      </div>
      {block.text ? (
        <div className="mt-2 px-2">
          <pre
            ref={textRef}
            className={`${INTERJECTION_BODY} ${expanded ? "" : "line-clamp-2"}`}
          >
            {block.text}
          </pre>
          {overflows ? (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 py-1 font-sans text-xs text-content/55 hover:text-content"
            >
              {expanded ? uiT("Show less") : uiT("Show more")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function lastUserBlockId(blocks: Block[], managed = false): string | undefined {
  return turnUserBlock(blocks, managed)?.id;
}

function turnUserBlock(blocks: Block[], managed = false): Block | undefined {
  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i];
    if (block.role === "user" && (managed || !block.internal)) return block;
  }
  return undefined;
}

function userTurnCount(blocks: Block[], managed = false): number {
  return blocks.filter(
    (block) => block.role === "user" && (managed || !block.internal),
  ).length;
}

const PROMPT_RISE_MS = 560;
// Keep in sync with the prompt-turn-reveal animation in index.css.
const PROMPT_REVEAL_MS = 320;
const PROMPT_FADE_MS = 480;
// Where the prompt starts, as a fraction of the viewport height from the top.
const PROMPT_RISE_FROM = 0.3;

/** Fades the prompt in while sliding it from the upper viewport to its row. */
function riseIntoAnchor(
  scroller: HTMLElement | null,
  blockId: string,
  motion?: "mobile",
) {
  const row = scroller?.querySelector<HTMLElement>(
    `[data-prompt-anchor="${CSS.escape(blockId)}"]`,
  );
  if (!scroller || !row || typeof row.animate !== "function") return;
  if (reducedMotionQuery().matches) return;
  const turn = row.closest<HTMLElement>(".transcript-turn");
  const mobile = motion === "mobile";
  const revealDuration = mobile ? 200 : PROMPT_REVEAL_MS;
  let animation: Animation | undefined;
  let fade: Animation | undefined;
  let frame = 0;
  let revealTimer: ReturnType<typeof setTimeout> | undefined;
  const start = () => {
    row.style.removeProperty("visibility");
    const view = scroller.getBoundingClientRect();
    const bounds = row.getBoundingClientRect();
    const dock = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
    const origin = mobile
      ? view.bottom - dock - Math.min(bounds.height, view.height * 0.4) - 8
      : view.top + view.height * PROMPT_RISE_FROM;
    const dy = Math.max(0, origin - bounds.top);
    if (dy <= 1) {
      turn?.removeAttribute("data-prompt-rise");
      return;
    }
    animation = row.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      {
        duration: mobile ? 420 : PROMPT_RISE_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    );
    // Separate fade timing makes a phone message readable early in its rise.
    fade = row.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: mobile ? 200 : PROMPT_FADE_MS,
      easing: "ease-out",
    });
    turn?.setAttribute("data-prompt-rise", "rising");
    animation.onfinish = () => {
      turn?.setAttribute("data-prompt-rise", "revealing");
      revealTimer = setTimeout(
        () => turn?.removeAttribute("data-prompt-rise"),
        revealDuration,
      );
    };
  };
  if (mobile) {
    // Let the sibling dock publish its cleared draft height before measuring.
    row.style.visibility = "hidden";
    turn?.setAttribute("data-prompt-rise", "rising");
    frame = requestAnimationFrame(start);
  } else start();
  return () => {
    cancelAnimationFrame(frame);
    animation?.cancel();
    fade?.cancel();
    clearTimeout(revealTimer);
    row.style.removeProperty("visibility");
    turn?.removeAttribute("data-prompt-rise");
  };
}

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM_PX;
}

/** Measure content rather than the anchored turn's blank space or padding. */
function isTranscriptEndVisible(
  el: HTMLElement,
  end: HTMLElement | null,
): boolean {
  if (!end) return true;
  const style = getComputedStyle(el);
  const top = el.getBoundingClientRect().top + el.clientTop;
  const endTop = end.getBoundingClientRect().top;
  return (
    endTop >= top + (parseFloat(style.scrollPaddingTop) || 0) &&
    endTop <=
      top + el.clientHeight - (parseFloat(style.scrollPaddingBottom) || 0)
  );
}

function pinToBottom(el: HTMLElement | null) {
  // An animated jump retargets every frame; snapping would cut it short.
  if (!el || jumpingScrollers.has(el)) return;
  el.scrollTop = el.scrollHeight;
}

const jumpingScrollers = new WeakSet<HTMLElement>();
const JUMP_INTERRUPTS = ["wheel", "touchstart", "pointerdown", "keydown"];

/**
 * Glide to the bottom, following content that keeps streaming in. Any reader
 * input stops the glide where it is.
 */
function animateToBottom(el: HTMLElement | null, done: () => void) {
  if (!el || jumpingScrollers.has(el)) return;
  const bottom = () => Math.max(0, el.scrollHeight - el.clientHeight);
  const from = el.scrollTop;
  const distance = bottom() - from;
  if (
    distance <= 1 ||
    reducedMotionQuery().matches
  ) {
    el.scrollTop = el.scrollHeight;
    done();
    return;
  }
  const duration = Math.min(560, 260 + distance / 12);
  const start = performance.now();
  let frame = 0;
  const finish = (snap: boolean) => {
    cancelAnimationFrame(frame);
    jumpingScrollers.delete(el);
    for (const type of JUMP_INTERRUPTS) el.removeEventListener(type, interrupt);
    if (snap) el.scrollTop = el.scrollHeight;
    done();
  };
  const interrupt = () => finish(false);
  const step = (now: number) => {
    if (!el.isConnected) return finish(false);
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - (1 - t) ** 3;
    el.scrollTop = from + (bottom() - from) * eased;
    if (t < 1) frame = requestAnimationFrame(step);
    else finish(true);
  };
  jumpingScrollers.add(el);
  for (const type of JUMP_INTERRUPTS)
    el.addEventListener(type, interrupt, { passive: true });
  frame = requestAnimationFrame(step);
}

/** Stretch the live turn within the space below any floating controls. */
function syncTranscriptViewport(el: HTMLElement | null) {
  if (!el || el.clientHeight <= 0) return;
  const inner = el.firstElementChild as HTMLElement | null;
  const pad = inner
    ? Number.parseFloat(getComputedStyle(inner).paddingBottom) || 0
    : 0;
  // pinToBottom uses scrollTop directly, so CSS scroll-padding cannot offset
  // it. Shortening the anchored turn leaves the requested inset above it.
  // The scroller's own bottom padding (a floating composer) also sits below
  // the turn when pinned, so it comes out of the turn's height too.
  const style = getComputedStyle(el);
  const topInset = Number.parseFloat(style.scrollPaddingTop) || 0;
  const bottomInset = Number.parseFloat(style.paddingBottom) || 0;
  const next = `${Math.max(0, el.clientHeight - pad - topInset - bottomInset)}px`;
  if (el.style.getPropertyValue("--transcript-viewport") === next) return;
  el.style.setProperty("--transcript-viewport", next);
}
