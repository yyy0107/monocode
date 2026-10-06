import type { ComponentType, ReactNode } from "react";
import type { RemoteAttachment, RemoteProvider } from "../../connections/model/protocol";
import type { AssistantLifecycle } from "../model/assistant";

/** Presentation slots keep Host state and command ownership in AssistantChat. */
export type AssistantHeaderProps = {
  name: string;
  hostName: string;
  harness?: RemoteProvider;
  /** Optional Host switcher shown in place of the Host name. */
  hostPicker?: ReactNode;
  status: string;
  lifecycle?: AssistantLifecycle;
  settingsOpen: boolean;
  busy: boolean;
  onSettings?: () => void;
  onClose?: () => void;
  controls?: AssistantControlsProps;
};
export type AssistantControlsProps = {
  busy: boolean;
  enabled: boolean;
  continuable: boolean;
  onToggle: () => void;
  onDisable: () => void;
  nextRetryAt?: number;
  backlog?: boolean;
};
export type AssistantSettingsPanelProps = {
  open: boolean;
  initialSetup: boolean;
  onClose: () => void;
  children: ReactNode;
};
export type AssistantComposerProps = {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  onAttach: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  attachments: RemoteAttachment[];
  busy: boolean;
  inputDisabled: boolean;
  attachDisabled: boolean;
  sendDisabled: boolean;
  retry: boolean;
  onRetry: () => void;
};
export type AssistantChatChrome = {
  Header: ComponentType<AssistantHeaderProps>;
  Controls: ComponentType<AssistantControlsProps>;
  SettingsPanel: ComponentType<AssistantSettingsPanelProps>;
  Composer: ComponentType<AssistantComposerProps>;
  MessageMenu?: ComponentType<AssistantMessageMenuProps>;
  /** Settings picker; desktop falls back to the shared searchable select. */
  Select?: ComponentType<AssistantSelectProps>;
};
export type AssistantSelectOption = { value: string; label: string; icon?: ReactNode };
export type AssistantSelectProps = {
  label: string;
  value: string;
  options: readonly AssistantSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  hint?: string;
  /** Visually omit the label when a neighbouring control already names it. */
  hideLabel?: boolean;
  searchable?: boolean;
};
export type AssistantMessageMenuProps = {
  open: boolean;
  point?: { x: number; y: number };
  disabled: boolean;
  onReply: () => void;
  onClose: () => void;
};
