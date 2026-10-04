# Background connection contract

MonoCodeNotifications.start retains connection/text fields and accepts optional
enabled (defaults true), controlling conversation alerts separately from service
lifetime. Texts add remoteChannel, remote, connected and reconnecting. The connected
and reconnecting values already contain the unchanged Host name. Startup binds,
configures/promotes the receiver, requests started lifetime, and unbinds. start
resolves after promotion/configuration. Pending-binding cancellation starts no FGS.
stop clears activation, unbinds, removes
the remote card and stops the native receiver. Destroying the plugin only unbinds.

START_STICKY restores only an activated connection whose encrypted endpoint and
environmentId match its persisted non-secret pin. Tokens stay in existing secure
storage and transient service memory. Disconnection removes the encrypted
connection and deactivates the service. Failed restoration stops safely.

monocode-remote / 9042 is a silent ongoing connection card. monocode-replies,
per-session tags, observe/setVisible/state/consumeOpen, unread/open events and
conversation content intents retain their current contracts. Permission denial
retains unread reconciliation without starting an invisible service.
