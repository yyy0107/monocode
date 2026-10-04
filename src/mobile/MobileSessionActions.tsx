import { useRef, useState, type RefObject } from "react";
import {
  Archive,
  Copy,
  ChevronRight,
  ExternalLink,
  Pencil,
  Pin,
  Plus,
  Trash2,
} from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import type { HostSession } from "../features/connections/model/protocol";
import { sessionDisplayTitle } from "../features/sessions/model/session";
import { parseGithubWorkItemUrl } from "../features/sessions/model/sessionWorkItem";
import { MobileSheet } from "./MobileSheet";
import { mobileTranscriptPlatform } from "./transcriptPlatform";
import type { MobileSessionPatch } from "./client";

export function MobileSessionActions({
  snapshot,
  anchor,
  disabled,
  onUpdate,
  onDelete,
  onNew,
  onClose,
}: {
  snapshot?: HostSession;
  anchor: RefObject<HTMLElement | null>;
  disabled: boolean;
  onUpdate: (patch: MobileSessionPatch) => Promise<void>;
  onDelete: () => Promise<void>;
  onNew: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState<
    "menu" | "rename" | "copy" | "link" | "delete"
  >("menu");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const blocked = disabled || working;
  const session = snapshot?.session;
  const run = async (action: () => Promise<void>) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setWorking(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : t("Unable to update this conversation."),
      );
    } finally {
      inFlight.current = false;
      setWorking(false);
    }
  };
  const close = () => {
    if (!inFlight.current) onClose();
  };
  const back = () => {
    if (!inFlight.current) {
      setError("");
      setPage("menu");
    }
  };
  const copy = (value: string) =>
    void run(() => mobileTranscriptPlatform.copyText(value));
  return (
    <MobileSheet
      key={page}
      title={
        page === "rename"
          ? "Rename"
          : page === "copy"
            ? "Copy session ID"
            : page === "link"
              ? "Link GitHub issue or PR"
              : page === "delete"
                ? "Delete session"
                : "Session actions"
      }
      placement="anchor"
      anchor={anchor}
      width={320}
      align="end"
      onClose={close}
      onBack={page === "menu" ? undefined : back}
    >
      <div className="mobile-session-actions">
        {page === "menu" ? (
          <>
            {session && (
              <>
                <button
                  className="mobile-sheet-row"
                  disabled={blocked}
                  onClick={() =>
                    void run(() => onUpdate({ pinned: !snapshot!.pinned }))
                  }
                >
                  <Pin size={20} />
                  <span>{t(snapshot!.pinned ? "Unpin" : "Pin")}</span>
                </button>
                <button
                  className="mobile-sheet-row"
                  disabled={blocked}
                  onClick={() => {
                    setTitle(
                      sessionDisplayTitle(session.title, session.harness),
                    );
                    setPage("rename");
                  }}
                >
                  <Pencil size={20} />
                  <span>{t("Rename")}</span>
                </button>
                <button
                  className="mobile-sheet-row"
                  disabled={blocked}
                  onClick={() => setPage("copy")}
                >
                  <Copy size={20} />
                  <span>{t("Copy session ID")}</span>
                  <ChevronRight size={18} />
                </button>
                <button
                  className="mobile-sheet-row"
                  disabled={blocked}
                  onClick={() => {
                    setUrl(session.linkedWorkItem?.url ?? "");
                    setPage("link");
                  }}
                >
                  <ExternalLink size={20} />
                  <span>
                    {t(
                      session.linkedWorkItem
                        ? "Edit GitHub issue or PR link…"
                        : "Link GitHub issue or PR…",
                    )}
                  </span>
                </button>
                <div className="mobile-menu-divider" role="separator" />
                <button
                  className="mobile-sheet-row"
                  disabled={blocked}
                  onClick={() =>
                    void run(() => onUpdate({ archived: !snapshot!.archived }))
                  }
                >
                  <Archive size={20} />
                  <span>{t(snapshot!.archived ? "Unarchive" : "Archive")}</span>
                </button>
                <button
                  className="mobile-sheet-row mobile-menu-danger"
                  disabled={blocked || snapshot!.status === "running"}
                  title={
                    snapshot!.status === "running"
                      ? t("Stop this session before deleting it")
                      : undefined
                  }
                  onClick={() => setPage("delete")}
                >
                  <Trash2 size={20} />
                  <span>{t("Delete")}</span>
                </button>
                <div className="mobile-menu-divider" role="separator" />
              </>
            )}
            <button
              className="mobile-sheet-row"
              disabled={blocked}
              onClick={() => {
                close();
                onNew();
              }}
            >
              <Plus size={20} />
              <span>{t("New conversation")}</span>
            </button>
          </>
        ) : page === "copy" && session ? (
          <>
            <button
              className="mobile-sheet-row"
              disabled={blocked || !session.providerSessionId}
              onClick={() =>
                session.providerSessionId && copy(session.providerSessionId)
              }
            >
              <span>{t("Harness session ID")}</span>
            </button>
            <button
              className="mobile-sheet-row"
              disabled={blocked}
              onClick={() => copy(session.id)}
            >
              <span>{t("MonoCode session ID")}</span>
            </button>
          </>
        ) : page === "rename" ? (
          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim())
                void run(() => onUpdate({ title: title.trim() }));
            }}
          >
            <label>
              {t("Session title")}
              <input
                value={title}
                maxLength={200}
                disabled={blocked}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <div className="mobile-menu-form-buttons">
              <button
                type="button"
                className="mobile-button"
                disabled={blocked}
                onClick={back}
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                className="mobile-button mobile-primary"
                disabled={blocked || !title.trim()}
              >
                {t("Save")}
              </button>
            </div>
          </form>
        ) : page === "link" ? (
          <form
            className="mobile-form"
            onSubmit={(event) => {
              event.preventDefault();
              const item = parseGithubWorkItemUrl(url.trim());
              if (!item) {
                setError(t("Enter a valid GitHub issue or pull request URL."));
                return;
              }
              void run(() => onUpdate({ linkedWorkItem: item }));
            }}
          >
            <label>
              {t("Issue or pull request URL")}
              <input
                type="url"
                value={url}
                disabled={blocked}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://github.com/owner/repo/pull/123"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError("");
                }}
              />
            </label>
            <div className="mobile-menu-form-buttons">
              {session?.linkedWorkItem && (
                <button
                  type="button"
                  className="mobile-button"
                  disabled={blocked}
                  onClick={() =>
                    void run(() => onUpdate({ linkedWorkItem: null }))
                  }
                >
                  {t("Remove link")}
                </button>
              )}
              <button
                type="button"
                className="mobile-button"
                disabled={blocked}
                onClick={back}
              >
                {t("Cancel")}
              </button>
              <button
                type="submit"
                className="mobile-button mobile-primary"
                disabled={blocked || !url.trim()}
              >
                {t("Save")}
              </button>
            </div>
          </form>
        ) : page === "delete" ? (
          <>
            <p className="mobile-muted">
              {t("Delete this conversation? This can’t be undone.")}
            </p>
            <div className="mobile-menu-form-buttons">
              <button
                type="button"
                className="mobile-button"
                disabled={blocked}
                onClick={back}
              >
                {t("Cancel")}
              </button>
              <button
                type="button"
                className="mobile-button mobile-menu-danger"
                disabled={blocked || snapshot?.status === "running"}
                onClick={() => void run(onDelete)}
              >
                {t("Delete")}
              </button>
            </div>
          </>
        ) : null}
        {error && (
          <p className="mobile-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </MobileSheet>
  );
}
