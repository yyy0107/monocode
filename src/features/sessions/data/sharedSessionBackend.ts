import type { Session, LinkedWorkItem } from "../model/session";
import type { SessionSummary, SessionSearchHit } from "./sessionStore";

export type SharedSessionBackend = {
  ownsProject(cwd: string): boolean;
  ownsSession(id: string): boolean;
  rememberSession(id: string, cwd: string): void;
  mirrorNative(session: Session): Promise<void>;
  list(cwd?: string): Promise<SessionSummary[]>;
  get(id: string): Promise<Session | null>;
  update(
    id: string,
    patch: {
      title?: string;
      archived?: boolean;
      pinned?: boolean;
      linkedWorkItem?: LinkedWorkItem | null;
    },
  ): Promise<void>;
  delete(id: string): Promise<void>;
  search(
    query: string,
    cwd?: string,
    includeArchived?: boolean,
    owner?: string,
  ): Promise<SessionSearchHit[]>;
  cancelSearch(owner: string): void;
};

let backend: SharedSessionBackend | undefined;
export const sharedSessionBackend = () => backend;
export function setSharedSessionBackend(value?: SharedSessionBackend) {
  backend = value;
}
