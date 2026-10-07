import { useContext, useLayoutEffect, useRef, useState } from "react";
import type { Block } from "../features/sessions/model/session";
import {
  agentTranscript,
  resolveAgentBlock,
} from "../features/sessions/model/agentTranscript";
import {
  subagentModelName,
  subagentName,
  toolCallState,
} from "../features/sessions/model/transcriptActivity";
import { SubagentTranscript } from "../features/sessions/ui/SubagentTranscript";
import { useTranslation } from "../shared/i18n/useTranslation";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { MobileSheet, MobileSheetHeader } from "./MobileSheet";
import { MobilePageTransition } from "./MobilePageTransition";
import { MobilePageStateContext } from "./mobilePageState";
import { MobileToolSheet } from "./MobileToolSheet";
import { MobileFileSheet } from "./MobileFileSheet";

type Page =
  { kind: "agent" | "tool"; path: string[] } | { kind: "file"; file: string };

function Conversation({
  block,
  cwd,
  openAgent,
  openTool,
  openFile,
}: {
  block: Block;
  cwd?: string;
  openAgent: (block: Block) => void;
  openTool: (block: Block) => void;
  openFile?: (path: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pageState = useContext(MobilePageStateContext);
  const following = useRef(pageState?.values.get("agentFollowing") !== false);
  const initialized = useRef(false);
  const [jump, setJump] = useState(false);
  const visible = useSurfaceVisibility();
  const { t } = useTranslation();
  const rows = agentTranscript(block);
  useLayoutEffect(() => {
    if (!visible || !ref.current) return;
    if (!initialized.current) {
      initialized.current = true;
      if (pageState?.scroll.has("[data-mobile-page-scroll]")) return;
    }
    if (following.current) ref.current.scrollTop = ref.current.scrollHeight;
    else setJump(true);
  }, [rows, block.tool?.detail, visible, pageState]);
  return (
    <div
      ref={ref}
      className="mobile-sheet-page-scroll"
      data-mobile-page-scroll
      onScroll={(event) => {
        const node = event.currentTarget;
        following.current =
          node.scrollHeight - node.scrollTop - node.clientHeight < 60;
        pageState?.values.set("agentFollowing", following.current);
        if (following.current) setJump(false);
      }}
    >
      <SubagentTranscript
        block={block}
        cwd={cwd}
        onOpenAgent={openAgent}
        onOpenTool={openTool}
        onOpenFile={openFile}
      />
      {jump ? (
        <button
          type="button"
          className="mobile-button sticky bottom-3 mx-auto block"
          onClick={() => {
            following.current = true;
            setJump(false);
            if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
          }}
        >
          {t("Jump to latest")}
        </button>
      ) : null}
    </div>
  );
}

export function MobileAgentSheet({
  open,
  onExited,
  blocks,
  blockId,
  cwd,
  readBinaryFile,
  onBack,
  onClose,
  embedded = false,
}: {
  open: boolean;
  onExited?: () => void;
  embedded?: boolean;
  blocks: Block[];
  blockId: string;
  cwd?: string;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
  onBack?: () => void;
  onClose: () => void;
}) {
  const [pages, setPages] = useState<Page[]>([
    { kind: "agent", path: [blockId] },
  ]);
  const { t } = useTranslation();
  const page = pages[pages.length - 1];
  const block =
    page.kind === "file" ? undefined : resolveAgentBlock(blocks, page.path);
  const back =
    pages.length > 1 ? () => setPages((value) => value.slice(0, -1)) : onBack;
  const pushFile = readBinaryFile
    ? (file: string) => setPages((value) => [...value, { kind: "file", file }])
    : undefined;
  const pushBlock = (kind: "agent" | "tool", next: Block) => {
    if (page.kind === "file") return;
    setPages((value) => [...value, { kind, path: [...page.path, next.id] }]);
  };
  const key =
    page.kind === "file"
      ? `file:${page.file}`
      : `${page.kind}:${page.path.join("/")}`;
  const content = (
    <div className="mobile-sheet-pages">
      <MobilePageTransition
        slide
        visible={open}
        route={{ key, section: "chat", depth: pages.length }}
      >
        {page.kind === "file" && readBinaryFile ? (
          <MobileFileSheet
            embedded
            path={page.file}
            cwd={cwd}
            readBinaryFile={readBinaryFile}
            onOpenFile={pushFile}
            onBack={back}
            onClose={onClose}
          />
        ) : block && page.kind === "tool" ? (
          <MobileToolSheet
            embedded
            block={block}
            cwd={cwd}
            onBack={back}
            onClose={onClose}
            onOpenFile={pushFile}
          />
        ) : block ? (
          <>
            <MobileSheetHeader
              title={subagentName(block)}
              subtitle={[
                subagentModelName(block),
                t(
                  toolCallState(block) === "pending"
                    ? "Running"
                    : toolCallState(block) === "rejected"
                      ? "Failed"
                      : "Completed",
                ),
              ]
                .filter(Boolean)
                .join(" · ")}
              onBack={back}
              onClose={onClose}
            />
            <Conversation
              block={block}
              cwd={cwd}
              openAgent={(row) => pushBlock("agent", row)}
              openTool={(row) => pushBlock("tool", row)}
              openFile={pushFile}
            />
          </>
        ) : (
          <>
            <MobileSheetHeader
              title={t("Subagent conversation")}
              onBack={back}
              onClose={onClose}
            />
            <p className="mobile-detail-note">
              {t("This subagent record is no longer available.")}
            </p>
          </>
        )}
      </MobilePageTransition>
    </div>
  );
  return embedded ? (
    content
  ) : (
    <MobileSheet
      open={open}
      onExited={onExited}
      title="Subagent conversation"
      onClose={onClose}
      onBack={back}
      detents
    >
      {content}
    </MobileSheet>
  );
}
