import { useEffect, useLayoutEffect, useMemo, useState, type RefObject } from "react";
import type { HostProject, HostSessionSummary } from "../features/connections/model/protocol";
import { Folder } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet, SHEET_WIDTH } from "./MobileSheet";
import { sortMobileProjects } from "./sessionList";

export function MobileHomeMenu({
  open,
  anchor,
  projects,
  projectsPending,
  projectsUnavailable,
  foreground,
  loadSessions,
  cachedSessions,
  onClose,
  onProject,
}: {
  open: boolean;
  anchor: RefObject<HTMLButtonElement | null>;
  projects: HostProject[];
  projectsPending: boolean;
  projectsUnavailable: boolean;
  foreground: boolean;
  loadSessions: (projectId: string) => Promise<HostSessionSummary[]>;
  cachedSessions: (projectId: string) => HostSessionSummary[] | undefined;
  onClose: () => void;
  onProject: (project: HostProject) => void;
}) {
  const { t } = useTranslation();
  const idsKey = JSON.stringify(projects.map((project) => project.id));
  const [histories, setHistories] = useState<Record<string, HostSessionSummary[]>>({});

  // Home or the drawer may have refreshed the cache since this menu last opened.
  useLayoutEffect(() => {
    if (!open) return;
    const ids: string[] = JSON.parse(idsKey);
    setHistories((current) => {
      let next = current;
      for (const id of ids) {
        const sessions = cachedSessions(id);
        if (sessions && sessions !== current[id])
          next = { ...next, [id]: sessions };
      }
      return next;
    });
  }, [open, foreground, idsKey, cachedSessions]);

  useEffect(() => {
    if (!open || !foreground) return;
    const ids: string[] = JSON.parse(idsKey);
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      const results = await Promise.allSettled(ids.map((id) => loadSessions(id)));
      if (!live) return;
      setHistories((current) => {
        let next = current;
        results.forEach((result, index) => {
          if (result.status !== "fulfilled" || result.value === current[ids[index]]) return;
          next = { ...next, [ids[index]]: result.value };
        });
        return next;
      });
      timer = setTimeout(refresh, 3_000);
    };
    void refresh();
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, foreground, idsKey, loadSessions]);

  const orderedProjects = useMemo(() => sortMobileProjects(
    projects,
    (id) => histories[id] ?? [],
  ), [projects, histories]);

  return (
    <MobileSheet
      open={open}
      title="Projects"
      placement="anchor"
      anchor={anchor}
      align="center"
      side="bottom"
      width={SHEET_WIDTH.list}
      onClose={onClose}
    >
      <div className="mobile-project-options">
        {orderedProjects.map((project) => (
          <button
            type="button"
            className="mobile-sheet-row"
            key={project.id}
            onClick={() => {
              onClose();
              onProject(project);
            }}
          >
            <Folder size={22} />
            <span className="mobile-sheet-row-text">
              <strong>{project.name}</strong>
              <small>{project.cwd}</small>
            </span>
          </button>
        ))}
        {!projects.length && (
          <p className="mobile-sheet-hint" role="status">
            {t(projectsUnavailable ? "Couldn’t load projects"
              : projectsPending ? "Loading projects…" : "No projects found")}
          </p>
        )}
      </div>
    </MobileSheet>
  );
}
