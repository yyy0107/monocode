# Contract: native provider sources

`NativeSessionFile` (TS `core/nativeSessions.ts`, Rust `native_sessions.rs`):

| field | notes |
| --- | --- |
| provider | `codex` `pi` `claude` `omp` `opencode` |
| providerSessionId | `[A-Za-z0-9_-]{1,128}` |
| cwd | absolute, `/` separators |
| path | canonical JSONL file, or the opencode database |
| revision | JSONL `len:mtime_ns`; SQLite `sqlite:<updated>:<messages>:<parts>` |
| storage | optional; absent means `jsonl` (feature 002 records) |
| accountId | optional MonoCode account profile (claude, codex) |
| title | optional provider title (opencode) or first prompt (claude) |

Identity of a source is `path` for JSONL and `path#providerSessionId` for SQLite
(`nativeSourceKey`, Rust `lock_key`). `NativeSessionLink` persists the optional
`storage` and `accountId`; the sanitizer keeps both.

opencode read document: `{session:{id,directory,title,timeCreated,model},
messages:[{id,timeCreated,info,parts:[{id,...partData}]}]}` from one read
transaction. Child sessions (`parent_id`) and archived sessions are not listed.

Resume rules: an imported session binds `nativeSession`; adapters must either
continue that id or fail. Claude and OpenCode refuse a different cwd (and Claude
a different account) for an imported binding.
