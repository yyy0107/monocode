import type { RefObject } from "react";
import type { HostProject } from "../features/connections/model/protocol";
import { Folder } from "../shared/ui/icons";
import { useTranslation } from "../shared/i18n/useTranslation";
import { MobileSheet, SHEET_WIDTH } from "./MobileSheet";

export function MobileHomeMenu({
  open,
  anchor,
  projects,
  projectsPending,
  projectsUnavailable,
  onClose,
  onProject,
}: {
  open: boolean;
  anchor: RefObject<HTMLButtonElement | null>;
  projects: HostProject[];
  projectsPending: boolean;
  projectsUnavailable: boolean;
  onClose: () => void;
  onProject: (project: HostProject) => void;
}) {
  const { t } = useTranslation();
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
        {projects.map((project) => (
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
