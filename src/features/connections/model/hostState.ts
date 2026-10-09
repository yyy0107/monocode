/** JSON-only state shared by clients connected to a verified Host identity. */
export type HostStateValue = null | boolean | number | string | HostStateValue[] | { [key: string]: HostStateValue };

export const HOST_CLIENT_STATE_CAPABILITY = "clientState.v1";

export type HostPreferences = {
  revision: number;
  values: Record<string, HostStateValue>;
  imported: boolean;
};

export type HostPreferencesPatch = {
  operationId: string;
  /** null removes an override. Each key is an independently merged field. */
  changes: Record<string, HostStateValue>;
  /** One-time import from the release desktop. Subsequent imports are ignored. */
  importRelease?: boolean;
};

export type HostWorkspaceKind = "desktop" | "mobile";
export type HostWorkspace = {
  revision: number;
  windowId: string;
  kind: HostWorkspaceKind;
  snapshot: HostStateValue;
  updatedAt: number;
};
export type HostWorkspaceSave = {
  operationId: string;
  windowId: string;
  kind: HostWorkspaceKind;
  snapshot: HostStateValue;
  activate?: boolean;
  importRelease?: boolean;
};

/** A discoverable connection definition. Device credentials and endpoints stay local. */
export type HostConnectionDefinition = {
  id: string;
  name: string;
  kind: "http" | "ssh";
  environmentId?: string;
  hostname?: string;
  port?: number;
};
export type HostConnections = { revision: number; connections: HostConnectionDefinition[] };
export type HostConnectionsPatch = {
  operationId: string;
  changes: Record<string, HostConnectionDefinition | null>;
  importRelease?: boolean;
};

export type HostPreferenceAssetUpload = {
  id: string;
  offset: number;
  size: number;
  mimeType: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
};
export type HostPreferenceAssetChunk = { data: string; offset: number; size: number; mimeType: string };

export interface HostStateMethods {
  "preferences.read": { params: { revision?: number }; result: HostPreferences | null };
  "preferences.patch": { params: HostPreferencesPatch; result: HostPreferences };
  "preferences.assets.upload": { params: HostPreferenceAssetUpload; result: { offset: number } };
  "preferences.assets.read": { params: { id: string; offset: number }; result: HostPreferenceAssetChunk };
  "workspaces.read": { params: { kind: HostWorkspaceKind; windowId?: string }; result: HostWorkspace | null };
  "workspaces.save": { params: HostWorkspaceSave; result: HostWorkspace };
  "connections.list": { params: { revision?: number }; result: HostConnections | null };
  "connections.patch": { params: HostConnectionsPatch; result: HostConnections };
}
