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
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "../shared/ui/icons";
import { translate } from "../shared/i18n/language";
import { useTranslation } from "../shared/i18n/useTranslation";
import { useSurfaceVisibility } from "../shared/ui/SurfaceVisibility";
import { AgentMarkdown } from "../features/sessions/ui/AgentMarkdown";
import { TranscriptPlatformContext } from "../features/sessions/ui/TranscriptPlatform";
import {
  MAX_NOTE_TAGS,
  normalizeNoteTags,
  notePreview,
  noteSourceProject,
  noteTitle,
  type Note,
  type NoteUpsert,
} from "../features/notes/notesText";
import { insertNoteImagesMarkdown } from "../features/notes/noteImagesText";
import type { HostProject } from "../features/connections/model/protocol";
import type { MobileClient } from "./client";
import { MobilePageTransition } from "./MobilePageTransition";
import { MobileSelect } from "./MobileSelect";
import { MobileSheet } from "./MobileSheet";
import { mobileTranscriptPlatform } from "./transcriptPlatform";
import { formatMobileRelativeTime } from "./relativeTime";
import { enqueueMobileNoteSave } from "./noteSaveQueue";
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
    key: `${endpoint}\0${hostKey}`,
    list: () => {
      check();
      return client.listNotes();
    },
    get: (id: string) => {
      check();
      return client.getNote(id);
    },
    upsert: (note: NoteUpsert) => {
      check();
      return client.upsertNote(note);
    },
    delete: (id: string) => {
      check();
      return client.deleteNote(id);
    },
    saveImage: (id: string, name: string, data: string) => {
      check();
      return client.saveNoteImage(id, name, data);
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
  cwd,
  onClose,
  onAddToChat,
}: {
  ref?: Ref<MobileNotesHandle>;
  client: MobileClient;
  hostKey: string;
  projects: HostProject[];
  cwd?: string;
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
  const editor = useRef<MobileNotesHandle>(null);
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
    if (selectedId) editor.current?.back();
    else onClose();
  };
  useImperativeHandle(ref, () => ({ back }));
  const saved = (note: Note) =>
    setNotes((current) =>
      [note, ...current.filter((item) => item.id !== note.id)].sort(
        (a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id),
      ),
    );
  const open = async (id?: string) => {
    if (operation.current || loading) return;
    operation.current = true;
    setWorking(true);
    try {
      const note = id
        ? await enqueueMobileNoteSave(
            `${api.key}\0${id}`,
            async () => (await api.get(id)) ?? undefined,
          )
        : await api.upsert({
            id: crypto.randomUUID(),
            title: "",
            body: "",
            tags: [],
            ...(noteSourceProject(cwd) ? { sourceCwd: cwd } : {}),
          });
      if (!note) throw new Error(t("Note was not found."));
      if (live.current) {
        saved(note);
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
          <MobileNoteEditor
            key={selected.id}
            ref={editor}
            api={api}
            note={selected}
            projects={projects}
            onSaved={saved}
            onBack={() => {
              setSelectedId(undefined);
              void refresh();
            }}
            onDeleted={(id) => {
              setNotes((current) => current.filter((note) => note.id !== id));
              setSelectedId(undefined);
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
              <button
                className="mobile-sheet-header-button"
                aria-label={t("New note")}
                disabled={working || loading || !visible}
                onClick={() => void open()}
              >
                {working ? (
                  <LoaderCircle size={22} className="mobile-spin" />
                ) : (
                  <Plus size={24} />
                )}
              </button>
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
                disabled={loading || working}
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
                      : "No notes yet. Create one here.",
                  )}
                </p>
              ) : (
                <ul className="mobile-notes-list">
                  {filtered.map((note) => (
                    <li key={note.id}>
                      <button
                        className="mobile-note-card"
                        disabled={working || loading}
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

function MobileNoteEditor({
  ref,
  api,
  note,
  projects,
  onSaved,
  onBack,
  onDeleted,
  onAddToChat,
}: {
  ref?: Ref<MobileNotesHandle>;
  api: NotesApi;
  note: Note;
  projects: HostProject[];
  onSaved: (note: Note) => void;
  onBack: () => void;
  onDeleted: (id: string) => void;
  onAddToChat: (note: Note) => Promise<void>;
}) {
  const { language, t } = useTranslation();
  const visible = useSurfaceVisibility();
  type Edits = Partial<Pick<Note, "title" | "body" | "tags">>;
  const [edits, setEdits] = useState<Edits>({});
  const [projectChange, setProjectChange] = useState<{ path: string } | null>(
    null,
  );
  const [mode, setMode] = useState<"source" | "preview">(
    !note.body.trim() && note.title === "Untitled" ? "source" : "preview",
  );
  const [tagDraft, setTagDraft] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [actionError, setActionError] = useState("");
  const noteRef = useRef(note);
  const editsRef = useRef(edits);
  const projectRef = useRef(projectChange);
  const titleField = useRef<HTMLInputElement>(null);
  const bodyField = useRef<HTMLTextAreaElement>(null);
  const fileField = useRef<HTMLInputElement>(null);
  const imageRange = useRef({ start: 0, end: 0 });
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finalize = useRef<{ title: string } | null>(null);
  const skipSave = useRef(false);
  const operation = useRef(false);
  const uploading = useRef(false);
  const mounted = useRef(true);
  const callbacks = useRef({ onSaved, onBack, onDeleted, onAddToChat });
  callbacks.current = { onSaved, onBack, onDeleted, onAddToChat };
  noteRef.current = note;
  const title = edits.title ?? note.title;
  const body = edits.body ?? note.body;
  const tags = edits.tags ?? note.tags;
  const sourceCwd = projectChange?.path ?? note.sourceCwd;
  const queueKey = `${api.key}\0${note.id}`;
  const edit = useCallback((change: Edits) => {
    editsRef.current = { ...editsRef.current, ...change };
    setEdits(editsRef.current);
  }, []);
  const persist = useCallback(
    async (latest?: Note) => {
      if (skipSave.current) return;
      const current = latest ?? noteRef.current;
      const changes = editsRef.current;
      const nextBody = changes.body ?? current.body;
      const titleFocused = document.activeElement === titleField.current;
      const nextTitle =
        (changes.title ?? current.title).trim() ||
        (titleFocused ? current.title : noteTitle(nextBody));
      const nextTags = changes.tags ?? current.tags;
      const nextProject = projectRef.current;
      const finalizeRequest = finalize.current;
      const finalizeSlug = finalizeRequest?.title === nextTitle;
      const acceptSaved = (saved: Note) => {
        noteRef.current = saved;
        const remaining = { ...editsRef.current };
        if (
          remaining.title === changes.title &&
          !titleFocused &&
          document.activeElement !== titleField.current
        )
          delete remaining.title;
        if (remaining.body === changes.body) delete remaining.body;
        if (remaining.tags === changes.tags) delete remaining.tags;
        editsRef.current = remaining;
        if (mounted.current) {
          setEdits(remaining);
          setSaveError("");
        }
        if (projectRef.current === nextProject) {
          projectRef.current = null;
          if (mounted.current) setProjectChange(null);
        }
      };
      if (
        !finalizeSlug &&
        nextTitle === current.title &&
        nextBody === current.body &&
        JSON.stringify(nextTags) === JSON.stringify(current.tags) &&
        (!nextProject || nextProject.path === current.sourceCwd)
      ) {
        acceptSaved(current);
        return current;
      }
      try {
        const saved = await api.upsert({
          id: current.id,
          title: nextTitle,
          body: nextBody,
          tags: nextTags,
          ...(finalizeSlug ? { finalizeSlug: true } : {}),
          ...(nextProject ? { sourceCwd: nextProject.path } : {}),
        });
        if (finalizeSlug && finalize.current === finalizeRequest)
          finalize.current = null;
        acceptSaved(saved);
        callbacks.current.onSaved(saved);
        return saved;
      } catch (problem) {
        if (mounted.current) setSaveError(errorMessage(problem));
        throw problem;
      }
    },
    [api],
  );
  const saveNow = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    return enqueueMobileNoteSave(queueKey, persist);
  }, [queueKey, persist]);
  const scheduleSave = () => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveNow().catch(() => {});
    }, 400);
  };
  const finalizeTitle = useCallback(() => {
    const next =
      (editsRef.current.title ?? noteRef.current.title).trim() ||
      noteTitle(editsRef.current.body ?? noteRef.current.body);
    if (noteRef.current.slugPending) finalize.current = { title: next };
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      finalizeTitle();
      void saveNow().catch(() => {});
    };
  }, [saveNow, finalizeTitle]);
  useEffect(() => {
    if (!visible) {
      finalizeTitle();
      void saveNow().catch(() => {});
    }
  }, [visible, saveNow, finalizeTitle]);
  useEffect(() => {
    const saveHidden = () => {
      if (document.visibilityState === "hidden") {
        finalizeTitle();
        void saveNow().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", saveHidden);
    return () => document.removeEventListener("visibilitychange", saveHidden);
  }, [saveNow, finalizeTitle]);
  const commitTags = () => {
    if (!tagDraft.trim()) return;
    edit({
      tags: normalizeNoteTags([
        ...(editsRef.current.tags ?? noteRef.current.tags),
        ...tagDraft.split(/[,\n]/),
      ]),
    });
    setTagDraft("");
    scheduleSave();
  };
  const leave = async (add = false) => {
    if (operation.current || uploading.current) return;
    operation.current = true;
    setWorking(true);
    setActionError("");
    commitTags();
    titleField.current?.blur();
    finalizeTitle();
    try {
      const saved = await saveNow();
      if (!saved) return;
      if (add) await callbacks.current.onAddToChat(saved);
      else callbacks.current.onBack();
    } catch (problem) {
      setActionError(errorMessage(problem));
    } finally {
      operation.current = false;
      if (mounted.current) setWorking(false);
    }
  };
  const back = () => {
    if (operation.current || uploading.current) return;
    if (deleteOpen) setDeleteOpen(false);
    else if (projectOpen) setProjectOpen(false);
    else void leave();
  };
  useImperativeHandle(ref, () => ({ back }));
  const remove = async () => {
    if (operation.current) return;
    operation.current = true;
    skipSave.current = true;
    clearTimeout(saveTimer.current);
    setWorking(true);
    try {
      await enqueueMobileNoteSave(queueKey, async () => {
        await api.delete(note.id);
      });
      setDeleteOpen(false);
      callbacks.current.onDeleted(note.id);
    } catch (problem) {
      skipSave.current = false;
      setActionError(errorMessage(problem));
    } finally {
      operation.current = false;
      if (mounted.current) setWorking(false);
    }
  };
  const addImages = async (files: File[]) => {
    if (!files.length || uploading.current) return;
    uploading.current = true;
    setImageBusy(true);
    setActionError("");
    try {
      // Insert each completed upload so a later failure does not discard it.
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(t("Image is too large (maximum 20 MB)."));
        if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name))
          throw new Error(
            t("Image must be a PNG, JPG, GIF, WebP, or SVG file."),
          );
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = reader.onabort = () =>
            reject(new Error(t("Unable to read the selected file.")));
          reader.readAsDataURL(file);
        });
        const image = await api.saveImage(note.id, file.name, data);
        const range = imageRange.current;
        const inserted = insertNoteImagesMarkdown(
          editsRef.current.body ?? noteRef.current.body,
          range.start,
          range.end,
          [image],
        );
        imageRange.current = { start: inserted.cursor, end: inserted.cursor };
        edit({ body: inserted.value });
        scheduleSave();
      }
      setMode("source");
      requestAnimationFrame(() => {
        bodyField.current?.focus();
        bodyField.current?.setSelectionRange(
          imageRange.current.start,
          imageRange.current.end,
        );
      });
    } catch (problem) {
      if (mounted.current) setActionError(errorMessage(problem));
    } finally {
      uploading.current = false;
      if (mounted.current) setImageBusy(false);
    }
  };
  const platform = useMemo(
    () => ({ ...mobileTranscriptPlatform, resolveNoteImage: api.resolveImage }),
    [api],
  );
  const projectOptions = [
    { value: "~", label: t("No project") },
    ...(sourceCwd &&
    sourceCwd !== "~" &&
    !projects.some((project) => project.cwd === sourceCwd)
      ? [{ value: sourceCwd, label: noteSourceProject(sourceCwd) ?? sourceCwd }]
      : []),
    ...projects.map((project) => ({ value: project.cwd, label: project.name })),
  ];
  const blocked = working || imageBusy || !visible;
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
        className="mobile-notes-scroll mobile-note-editor"
        data-mobile-page-scroll
      >
        <fieldset disabled={blocked}>
          <div className="mobile-note-meta">
            <span>{note.slug}</span>
            <MobileSelect
              id={`note-project-${note.id}`}
              label={t("Project")}
              value={sourceCwd ?? "~"}
              options={projectOptions}
              open={projectOpen && visible}
              onOpenChange={setProjectOpen}
              disabled={blocked}
              onChange={(path) => {
                const change = { path };
                projectRef.current = change;
                setProjectChange(change);
                void saveNow().catch(() => {});
              }}
            />
          </div>
          <input
            ref={titleField}
            className="mobile-note-title"
            aria-label={t("Note title")}
            placeholder={t("Untitled")}
            value={title}
            onChange={(event) => {
              finalize.current = null;
              edit({ title: event.target.value });
              scheduleSave();
            }}
            onBlur={() => {
              finalizeTitle();
              void saveNow().catch(() => {});
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          <p className="mobile-muted">
            {t("Updated ")}
            {formatMobileRelativeTime(note.updatedAt, Date.now(), language)}
          </p>
          <div className="mobile-note-tags">
            {tags.map((tag) => (
              <span key={tag}>
                #{tag}
                <button
                  aria-label={t("Remove tag {tag}", { tag })}
                  onClick={() => {
                    edit({ tags: tags.filter((value) => value !== tag) });
                    scheduleSave();
                  }}
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
          <input
            className="mobile-note-tag-input"
            aria-label={t("Add tags")}
            placeholder={t("Add tags (comma separated)")}
            value={tagDraft}
            disabled={blocked || tags.length >= MAX_NOTE_TAGS}
            onChange={(event) => setTagDraft(event.target.value)}
            onBlur={commitTags}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === ",") {
                event.preventDefault();
                commitTags();
              }
            }}
          />
          <div className="mobile-note-actions">
            <button
              className="mobile-button mobile-primary"
              disabled={blocked || !body.trim()}
              onClick={() => void leave(true)}
            >
              {t("Add to chat")}
            </button>
            <button
              className="mobile-button"
              aria-label={t("Insert images")}
              onClick={() => {
                imageRange.current = bodyField.current
                  ? {
                      start: bodyField.current.selectionStart,
                      end: bodyField.current.selectionEnd,
                    }
                  : { start: body.length, end: body.length };
                fileField.current?.click();
              }}
            >
              {imageBusy ? (
                <LoaderCircle size={20} className="mobile-spin" />
              ) : (
                <ImagePlus size={20} />
              )}
              {t("Insert images")}
            </button>
            <button
              className="mobile-button mobile-menu-danger"
              aria-label={t("Delete note")}
              onClick={() => {
                setActionError("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={20} />
            </button>
            <input
              ref={fileField}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,.png,.jpg,.jpeg,.gif,.webp,.svg"
              hidden
              onChange={(event) => {
                const files = [...(event.target.files ?? [])];
                event.target.value = "";
                void addImages(files);
              }}
            />
          </div>
          {!!saveError && (
            <p role="alert" className="mobile-notes-error">
              {t("Could not save note: ")}
              {saveError}{" "}
              <button
                onClick={() => {
                  setActionError("");
                  finalizeTitle();
                  void saveNow().catch(() => {});
                }}
              >
                {t("Retry")}
              </button>
            </p>
          )}
          {!!actionError && !deleteOpen && (
            <p role="alert" className="mobile-notes-error">
              {actionError}
            </p>
          )}
          <div
            role="tablist"
            aria-label={t("Note sections")}
            className="mobile-note-tabs"
          >
            {(["preview", "source"] as const).map((tab) => (
              <button
                role="tab"
                key={tab}
                aria-selected={mode === tab}
                onClick={() => setMode(tab)}
              >
                {t(tab === "preview" ? "Preview" : "Source")}
              </button>
            ))}
          </div>
          {mode === "source" ? (
            <textarea
              ref={bodyField}
              className="mobile-note-source"
              aria-label={t("Note source")}
              placeholder={t("Write your note in Markdown…")}
              value={body}
              readOnly={imageBusy}
              onChange={(event) => {
                edit({ body: event.target.value });
                scheduleSave();
              }}
            />
          ) : (
            <TranscriptPlatformContext.Provider value={platform}>
              <div className="mobile-note-markdown">
                {body.trim() ? (
                  <AgentMarkdown text={body} cwd={sourceCwd} hardBreaks />
                ) : (
                  <p className="mobile-muted">{t("No description")}</p>
                )}
              </div>
            </TranscriptPlatformContext.Provider>
          )}
        </fieldset>
      </div>
      <MobileSheet
        open={deleteOpen && visible}
        title={t("Delete note")}
        header={{ title: t("Delete note") }}
        placement="dialog"
        onClose={() => {
          if (!operation.current) setDeleteOpen(false);
        }}
      >
        <p className="mobile-muted">
          {t("Delete this note and its images? This can’t be undone.")}
        </p>
        {!!actionError && (
          <p role="alert" className="mobile-notes-error">
            {actionError}
          </p>
        )}
        <div className="mobile-menu-form-buttons">
          <button
            className="mobile-button"
            disabled={working}
            onClick={() => setDeleteOpen(false)}
          >
            {t("Cancel")}
          </button>
          <button
            className="mobile-button mobile-menu-danger"
            disabled={working}
            onClick={() => void remove()}
          >
            {t("Delete")}
          </button>
        </div>
      </MobileSheet>
    </>
  );
}
