# Shared Host contract

- Native `shared_host_prepare` returns only public machine metadata, projects
  and session IDs/project paths. The paired token stays in native storage.
- Desktop bootstrap uses the same per-user Host directory and persistent
  environment ID as mobile. Separate client tokens retain independent revocation.
- Private lifecycle status advertises `sharedDesktop: 2`. A legacy executable
  is replaced only while idle and under a SQLite write lease; active turns are
  left running and bootstrap reports a retryable error.
- Legacy session import and its per-source/per-ID marker commit together.
  The source is never written, existing Host snapshots are not overwritten,
  and failed attachment imports remove newly copied files. Import markers
  outlive deletion so restart cannot resurrect old desktop rows.
- Desktop local project aliases retain native filesystem paths while session
  IDs, revisions and commands belong to Host. History reads/metadata/deletion
  and search use the same canonical snapshots as mobile.
- Shared snapshots are neither persisted as second local conversations nor
  bound to Tauri provider children. A Host failure never selects local execution.
- Native CLI imports retain their protected desktop execution path. After a
  native-source write, `sessions.refreshDesktopNative` reads the configured
  desktop database into canonical Host history, preserving source identity and
  reusing copied images. Host rejects native-source execution; mobile displays
  these histories read-only. Desktop restores them with the existing native
  lease/probe behavior. Deleted bindings are cleared before workspace restore.
- Supported transcript actions use the existing authenticated Host RPC contract,
  including its command receipts, stale-run checks and attachment authorization.
