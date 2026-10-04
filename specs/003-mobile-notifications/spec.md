# Mobile unread replies and system notifications

Scope: the Android conversation list shown by the user, with shared Host activity
metadata and device-local read state. Existing list spacing and sorting stay intact.

- Show a green dot after the row's metadata for unseen incoming replies, images,
  new input requests and completed turns. Opening successfully in the foreground
  acknowledges the displayed revision. Failed loads and background views do not.
- Preserve unread state across restarts and separate Host identities. Historical
  messages on the first connection, renames, drafts, outgoing messages and tool
  progress do not create new-message notifications.
- Notify once on a completed turn or a new input request while the conversation
  is not visible. Queue dispatch must not hide the preceding completion. Clicks
  open the owning project/session; mismatched Host identities are ignored.
- Android receives activity while the WebView is backgrounded via a remote
  messaging foreground service. The user can disable it in Connections and must
  allow OS notifications. Permission denial keeps unread indicators functional.
- No third-party push service, new credential persistence or provider protocol
  changes. Browser previews support permission-granted browser notifications;
  iOS unread indicators work in the foreground, but iOS system/background push
  is outside this Android change and is shown as unavailable.

Android force-stop and OS power/network restrictions can suspend delivery; this
does not stop the Host's agents. Execution evidence is recorded separately.
