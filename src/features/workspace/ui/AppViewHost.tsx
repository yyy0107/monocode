import {
  createContext,
  memo,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import type { AppViewKind } from "../model/layout";
import { SurfaceVisibilityContext } from "../../../shared/ui/SurfaceVisibility";

/** App owns the view dependencies; workspace panes only know its kind. */
export type AppViewRenderer = (kind: AppViewKind, active: boolean) => ReactNode;

export const AppViewRendererContext = createContext<AppViewRenderer | null>(null);

type Props = {
  kind: AppViewKind;
  visible: boolean;
  focused: boolean;
};

/** A restored hidden view stays lazy; a visited view retains its local state. */
export function AppViewHost({ kind, visible, focused }: Props) {
  const render = useContext(AppViewRendererContext);
  const mounted = useRef(false);
  if (visible) mounted.current = true;
  if (!mounted.current || !render) return null;
  return (
    <FrozenAppView
      kind={kind}
      visible={visible}
      focused={focused}
      render={render}
    />
  );
}

const FrozenAppView = memo(
  function FrozenAppView({
    kind,
    visible,
    focused,
    render,
  }: Props & { render: AppViewRenderer }) {
    return (
      <SurfaceVisibilityContext.Provider value={visible}>
        {render(kind, visible && focused)}
      </SurfaceVisibilityContext.Provider>
    );
  },
  (previous, next) =>
    previous.kind === next.kind && !previous.visible && !next.visible,
);
