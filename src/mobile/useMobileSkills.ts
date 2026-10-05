import { useCallback, useEffect, useRef, useState } from "react";
import type { HostSkillCatalog } from "../features/connections/model/protocol";

export type MobileSkillsLoader = (
  refresh?: boolean,
) => Promise<HostSkillCatalog>;
type State = {
  key: string;
  catalog?: HostSkillCatalog;
  loading: boolean;
  error?: string;
  failed?: boolean;
};

/** A context switch hides stale results immediately, before the next request. */
export function useMobileSkills(
  key: string,
  load: MobileSkillsLoader | undefined,
  open: boolean,
  native: boolean,
) {
  const [state, setState] = useState<State>({ key, loading: false });
  const current = useRef({ key, generation: 0 });
  if (current.current.key !== key)
    current.current = { key, generation: current.current.generation + 1 };
  const reload = useCallback(
    async (refresh = false) => {
      if (!load) return;
      const owner = current.current;
      const generation = ++owner.generation;
      setState((previous) => ({
        key,
        catalog: previous.key === key ? previous.catalog : undefined,
        loading: true,
      }));
      try {
        const catalog = await load(refresh);
        if (current.current !== owner || generation !== owner.generation)
          return;
        setState({ key, catalog, loading: false });
      } catch (reason) {
        if (current.current !== owner || generation !== owner.generation)
          return;
        setState((previous) => ({
          key,
          catalog: previous.key === key ? previous.catalog : undefined,
          loading: false,
          failed: true,
          error: reason instanceof Error ? reason.message : undefined,
        }));
      }
    },
    [key, load],
  );
  useEffect(() => {
    if (open) void reload(!native);
  }, [open, key, reload, native]);
  useEffect(
    () => () => {
      current.current.generation++;
    },
    [],
  );
  const visible = state.key === key ? state : { key, loading: open };
  return { ...visible, reload };
}
