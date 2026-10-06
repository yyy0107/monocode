# Contract: Session surfaces

## State

```ts
type WorkspaceTab = {
  // Existing identity, layout, panes, focus and group fields remain unchanged.
  surfaceMode?: "split" | "unified";
};

function openSessionAppView(
  tab: WorkspaceTab,
  kind: AppViewKind,
): WorkspaceTab;
```

Mode absence means split. Sanitization accepts only the two string values; unknown values are omitted. Resetting a workspace to a new conversation removes mode and old surface panes. `focusedId` and each editor pane's `activeFileId` remain the persisted selection contract.

## Ownership

The normal owner is a `WorkspaceTab` containing one chat. A file, plan, review or app page opened by that chat belongs to that workspace. Deduplication and preview replacement search only that workspace. The same file key or app kind may exist in another chat workspace.

An explicitly composed multi-chat split continues to use one `WorkspaceTab` and shared workspace surfaces. This is deliberate grouped layout behavior. It does not supply a per-session-leaf surface map or promise automatic surface migration when a chat leaf is moved away.

Legacy standalone app-view workspaces remain readable. Snapshot collection and parsing may remove duplicate standalone kinds while preserving copies owned by separate chat workspaces.

## Routing

File/review requests capture source session, project, checkout and owning workspace before asynchronous resolution. Completion applies only to a still-valid captured owner. A user selecting another chat during resolution keeps that foreground chat and focus. Closing or replacing the captured source invalidates the request instead of delivering it to the replacement.

Session-specific plans and reviews locate their owner by session ID. Generic project file/diff entry points use the current content workspace at invocation time. Ordinary chat selection restores the target workspace's current document; explicit focus actions and deliberate multi-chat selection can select a requested chat leaf.

Referenced-line navigation is stored per owning workspace and guarded by its captured session ID. Opening the same path at different lines in two chats does not overwrite the other chat's navigation target. A replacement chat does not inherit the removed owner's target.

## UI

Split mode shows chat beside tools. Unified mode exposes one local tab strip for selecting chat or tool content. Mode change does not create another global workspace tab or transfer any document to another conversation.

Transitions use `useCollapseMotion` and `animated-collapse-size`. Closing content stays mounted through completion, grid tracks stay stable at zero when hidden, direct resize disables transitions, and reduced motion completes immediately. Hidden/closing content and portals are not interactive. Running PTYs remain mounted while hidden.

Application labels use English translation keys with `zh-CN` entries. File paths, user names, chat titles and provider data are preserved.
