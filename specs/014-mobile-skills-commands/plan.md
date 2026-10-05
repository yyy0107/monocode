# Implementation and validation

Extract only the existing pure skill types, merge/precedence and prompt helpers
needed by both the browser and Node Host. Preserve the desktop module exports.
Implement bounded Node discovery matching src-tauri/src/skills.rs, including
symlink roots, frontmatter and Claude plugin scope/settings. Add a Host-owned
catalog with bounded caching and native command discovery delegated through
optional HostProvider.commands to the existing Pi/OMP implementations.

Add additive skills.list RPC and HostSkillCatalog. Derive its execution context
from registered projects and stored sessions. Prepare file-skill prompts inside
Host send/steer execution while retaining raw commands and original history.
Guard cancellation after asynchronous preparation. Keep native slash rewriting
in the shared nativeCommandPrompt helper, without changing Pi/OMP protocols.

Use desktop rankSkills, slashTokenAt and replaceSlashToken for mobile completion.
Add a searchable touch sheet and an inline list that preserves keyboard focus.
Load catalogs on demand, scope asynchronous results to their context, show loading
and retry states, and support pointer selection and hardware-keyboard navigation.
Consume app /plan and /compact in the mobile send flow; preserve provider-prefixed
escapes and the existing first-message journal/queue flow.

Test metadata/precedence/plugin discovery, native catalogs, prompt expansion,
history/retry/queue/steer/cancellation, context races, caret insertion, localization
and both mobile entry points. Exercise real disposable Host RPC and real fake
Pi/OMP subprocesses, plus existing desktop skills regressions. Complete check:web,
test:host, build and mobile:build; record actual versions and unrun native/provider
scenarios. No Rust changes, APK publication, personal Host restart, push or merge.
