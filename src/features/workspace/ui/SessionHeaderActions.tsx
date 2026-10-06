import { createContext, useContext } from "react";

/**
 * Window-level actions a chat column's header offers, Claude Desktop style:
 * the title menu and the terminal / changes toggles. App owns the handlers;
 * headers only read them, so the pane tree needs no extra props.
 */
export type SessionHeaderActions = {
  rename: (sessionId: string, title: string) => void;
  archive: (sessionId: string) => void;
  /** Start a new chat in a column to the right of this one. */
  splitRight: (sessionId: string) => void;
  terminalAvailable: boolean;
  terminalOpen: boolean;
  toggleTerminal: () => void;
  changesOpen: boolean;
  toggleChanges: () => void;
};

export const SessionHeaderActionsContext =
  createContext<SessionHeaderActions | null>(null);

export function useSessionHeaderActions(): SessionHeaderActions | null {
  return useContext(SessionHeaderActionsContext);
}
