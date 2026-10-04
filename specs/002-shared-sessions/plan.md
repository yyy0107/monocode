# Implementation plan

1. Add an idempotent desktop bootstrap to the existing Host CLI. Reuse the
   persistent Host directory, issue a separate native desktop credential, and
   import legacy SQLite rows and attachment files before loading the workspace.
2. Bundle the existing pinned Node Host runtime with desktop releases; native
   startup locates the bundle (or development build) and registers its connection.
3. Bind local project paths to that Host without changing filesystem addressing.
   Reuse existing transcript synchronization, commands and sidebar metadata.
   Route history reads and metadata writes to the canonical Host.
4. Retain the original SQLite database for native workspace state and historical
   migration recovery. Imported/Host-owned conversations are never written back
   as independent local conversations or bound to local provider processes.
5. Add migration, bootstrap, cross-client and UI regression tests; run web,
   Host, build and Rust checks. Record actual results in quickstart.md.
