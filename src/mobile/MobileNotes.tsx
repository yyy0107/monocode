import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  ArrowLeft,
  File,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from "../shared/ui/icons";
import { translate } from "../shared/i18n/language";
import { useTranslation } from "../shared/i18n/useTranslation";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { AgentMarkdown } from "../features/sessions/ui/AgentMarkdown";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import {
  notePreview,
  noteSourceProject,
  type Note,
} from "../features/notes/notesText";
import type { HostProject } from "../features/connections/model/protocol";
import type { MobileClient } from "./client";
import { MobilePageTransition } from "./MobilePageTransition";
import { mobileTranscriptPlatform } from "./transcriptPlatform";
import { formatMobileRelativeTime } from "./relativeTime";
import "./mobileNotes.css";

export type MobileNotesHandle = { back: () => void };
type NotesApi = ReturnType<typeof scopedNotes>;
function scopedNotes(client: MobileClient, hostKey: string) {
  const endpoint = client.connection?.endpoint;
  const check = () => {
    if (
      client.connection?.environmentId !== hostKey ||
      client.connection?.endpoint !== endpoint
    )
      throw new Error(translate("Host connection changed."));
  };
  return {
    list: () => {
      check();
      return client.listNotes();
    },
    get: (id: string) => {
      check();
      return client.getNote(id);
    },
    resolveImage: async (asset: string) => {
      check();
      const image = await client.noteImage(asset);
      return `data:${image.mime};base64,${image.data}`;
    },
  };
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

export function MobileNotes({
  ref,
  client,
  hostKey,
  projects,
  onClose,
  onAddToChat,
}: {
  ref?: Ref<MobileNotesHandle>;
  client: MobileClient;
  hostKey: string;
  projects: HostProject[];
  onClose: () => void;
  onAddToChat: (note: Note) => Promise<void>;
}) {
  const { language, t } = useTranslation();
  const visible = useSurfaceVisibility();
  const api = useMemo(() => scopedNotes(client, hostKey), [client, hostKey]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const viewer = useRef<MobileNotesHandle>(null);
  const live = useRef(true);
  const operation = useRef(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.list();
      if (live.current) {
        setNotes(next);
        setError("");
      }
    } catch (problem) {
      if (live.current) setError(errorMessage(problem));
    } finally {
      if (live.current) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const back = () => {
    if (operation.current) return;
    if (selectedId) viewer.current?.back();
    else onClose();
  };
  useImperativeHandle(ref, () => ({ back }));
  const loaded = (note: Note) =>
    setNotes((current) =>
      [note, ...current.filter((item) => item.id !== note.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      ),
    );
  const open = async (id: string) => {
    if (operation.current || loading || !visible) return;
    operation.current = true;
    setWorking(true);
    try {
      const note = await api.get(id);
      if (!note) throw new Error(t("Note was not found."));
      if (live.current) {
        loaded(note);
        setSelectedId(note.id);
        setError("");
      }
    } catch (problem) {
      if (live.current) setError(errorMessage(problem));
    } finally {
      operation.current = false;
      if (live.current) setWorking(false);
    }
  };
  const needle = query.trim().toLowerCase();
  const filtered = notes.filter(
    (note) =>
      !needle ||
      note.title.toLowerCase().includes(needle) ||
      note.body.toLowerCase().includes(needle) ||
      note.slug.toLowerCase().includes(needle) ||
      note.tags.some((tag) => tag.includes(needle.replace(/^#/, ""))) ||
      (noteSourceProject(note.sourceCwd)?.toLowerCase() ?? "").includes(needle),
  );
  const selected = notes.find((note) => note.id === selectedId);
  return (
    <aside
      className="mobile-notes"
      aria-label={t("Notes")}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          back();
        }
      }}
    >
      <MobilePageTransition
        route={{
          key: selected ? `note:${selected.id}` : "notes",
          section: "home",
          depth: selected ? 1 : 0,
        }}
        slide
      >
        {selected ? (
          <MobileNoteViewer
            key={selected.id}
            ref={viewer}
            api={api}
            note={selected}
            projects={projects}
            onBack={() => {
              setSelectedId(undefined);
              void refresh();
            }}
            onAddToChat={onAddToChat}
          />
        ) : (
          <>
            <header className="mobile-notes-header">
              <button
                className="mobile-sheet-header-button"
                aria-label={t("Close")}
                onClick={back}
              >
                <X size={24} />
              </button>
              <h1>{t("Notes")}</h1>
              {working ? (
                <LoaderCircle
                  size={22}
                  className="mobile-spin"
                  role="status"
                  aria-label={t("Loading notes…")}
                />
              ) : (
                <File size={20} aria-hidden="true" />
              )}
            </header>
            <div className="mobile-notes-search">
              <Search size={20} aria-hidden="true" />
              <input
                aria-label={t("Filter notes")}
                placeholder={t("Filter notes")}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button
                className="mobile-sheet-header-button"
                aria-label={t("Refresh notes")}
                disabled={loading || working || !visible}
                onClick={() => void refresh()}
              >
                <RefreshCw size={18} />
              </button>
            </div>
            <div className="mobile-notes-scroll" data-mobile-page-scroll>
              {error && (
                <p role="alert" className="mobile-notes-error">
                  {error}{" "}
                  <button onClick={() => void refresh()}>{t("Retry")}</button>
                </p>
              )}
              {loading && !notes.length ? (
                <p className="mobile-notes-empty" role="status">
                  <LoaderCircle
                    size={24}
                    className="mobile-spin"
                    aria-label={t("Loading notes…")}
                  />
                </p>
              ) : !filtered.length ? (
                <p className="mobile-notes-empty">
                  {t(
                    needle
                      ? "No matching notes"
                      : "No notes yet. Create notes on desktop to view them here.",
                  )}
                </p>
              ) : (
                <ul className="mobile-notes-list">
                  {filtered.map((note) => (
                    <li key={note.id}>
                      <button
                        className="mobile-note-card"
                        disabled={working || loading || !visible}
                        onClick={() => void open(note.id)}
                      >
                        <span className="mobile-note-meta">
                          <span>{noteSourceProject(note.sourceCwd)}</span>
                          <time
                            dateTime={new Date(note.updatedAt).toISOString()}
                          >
                            {formatMobileRelativeTime(
                              note.updatedAt,
                              Date.now(),
                              language,
                            )}
                          </time>
                        </span>
                        <strong>{note.title}</strong>
                        <span className="mobile-note-preview">
                          {notePreview(note.body, note.title)}
                        </span>
                        {!!note.tags.length && (
                          <span className="mobile-note-tags">
                            {note.tags.map((tag) => (
                              <span key={tag}>#{tag}</span>
                            ))}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </MobilePageTransition>
    </aside>
  );
}

function MobileNoteViewer({
  ref,
  api,
  note,
  projects,
  onBack,
  onAddToChat,
}: {
  ref?: Ref<MobileNotesHandle>;
  api: NotesApi;
  note: Note;
  projects: HostProject[];
  onBack: () => void;
  onAddToChat: (note: Note) => Promise<void>;
}) {
  const { language, t } = useTranslation();
  const visible = useSurfaceVisibility();
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState("");
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const back = () => {
    if (!operation.current && visible) onBack();
  };
  useImperativeHandle(ref, () => ({ back }));
  const addToChat = async () => {
    if (operation.current || !visible) return;
    operation.current = true;
    setWorking(true);
    setActionError("");
    try {
      await onAddToChat(note);
    } catch (problem) {
      if (mounted.current) setActionError(errorMessage(problem));
    } finally {
      operation.current = false;
      if (mounted.current) setWorking(false);
    }
  };
  const platform = useMemo(
    () => ({ ...mobileTranscriptPlatform, resolveNoteImage: api.resolveImage }),
    [api],
  );
  const sourceProject = noteSourceProject(note.sourceCwd);
  const projectName = sourceProject
    ? (projects.find((project) => project.cwd === note.sourceCwd)?.name ??
      sourceProject)
    : t("No project");
  const blocked = working || !visible;
  return (
    <>
      <header className="mobile-notes-header">
        <button
          className="mobile-sheet-header-button"
          aria-label={t("Back")}
          disabled={blocked}
          onClick={back}
        >
          <ArrowLeft size={24} />
        </button>
        <h1>{t("Note")}</h1>
        <File size={20} aria-hidden="true" />
      </header>
      <div
        className="mobile-notes-scroll mobile-note-viewer"
        data-mobile-page-scroll
      >
        <div className="mobile-note-meta">
          <span>{note.slug}</span>
          <span title={note.sourceCwd}>{projectName}</span>
        </div>
        <h2 className="mobile-note-title">{note.title}</h2>
        <p className="mobile-muted">
          {t("Updated ")}
          {formatMobileRelativeTime(note.updatedAt, Date.now(), language)}
        </p>
        {!!note.tags.length && (
          <div className="mobile-note-tags">
            {note.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
        <div className="mobile-note-actions">
          <button
            className="mobile-button mobile-primary"
            disabled={blocked || !note.body.trim()}
            onClick={() => void addToChat()}
          >
            {t("Add to chat")}
          </button>
        </div>
        {!!actionError && (
          <p role="alert" className="mobile-notes-error">
            {actionError}
          </p>
        )}
        <TranscriptPlatformContext.Provider value={platform}>
          <div className="mobile-note-markdown">
            {note.body.trim() ? (
              <AgentMarkdown text={note.body} cwd={note.sourceCwd} hardBreaks />
            ) : (
              <p className="mobile-muted">{t("No description")}</p>
            )}
          </div>
        </TranscriptPlatformContext.Provider>
      </div>
    </>
  );
}
