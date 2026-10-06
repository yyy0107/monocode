import type {
  HostProject,
  HostSessionSummary,
} from "../features/connections/model/protocol";

export function sortMobileProjects(
  projects: readonly HostProject[],
  sessionsForProject: (projectId: string) => readonly HostSessionSummary[],
): HostProject[] {
  return projects
    .map((project) => ({
      project,
      updatedAt: sessionsForProject(project.id).reduce(
        (latest, session) =>
          session.archived ? latest : Math.max(latest, session.updatedAt),
        0,
      ),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((item) => item.project);
}

export function sortMobileSessions(
  sessions: readonly HostSessionSummary[],
): HostSessionSummary[] {
  const ordered = sessions
    .filter((session) => !session.archived)
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        b.updatedAt - a.updatedAt ||
        a.id.localeCompare(b.id),
    );

  // Reorder running rows within each pin group while keeping other rows in
  // their activity positions. A pairwise status check would create sort cycles
  // when an idle row falls between two running conversations.
  for (const pinned of [true, false]) {
    const running = ordered
      .filter(
        (session) =>
          !!session.pinned === pinned && session.status === "running",
      )
      .sort(
        (a, b) =>
          (b.lastUserMessageAt ?? b.updatedAt) -
            (a.lastUserMessageAt ?? a.updatedAt) || a.id.localeCompare(b.id),
      );
    let index = 0;
    ordered.forEach((session, position) => {
      if (!!session.pinned === pinned && session.status === "running")
        ordered[position] = running[index++];
    });
  }
  return ordered;
}

/** Archived conversations, most recently touched first. */
export function archivedMobileSessions(
  sessions: readonly HostSessionSummary[],
): HostSessionSummary[] {
  return sessions
    .filter((session) => session.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
}
