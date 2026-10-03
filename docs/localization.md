# Interface localization

MonoCode supports English (`en`) and Simplified Chinese (`zh-CN`). The setting
is in Settings → General → Language. Its first value follows the system
language; other system languages fall back to English.

`src/shared/i18n/language.ts` stores `monocode.uiLanguage`, sets the document
language, and notifies live subscribers. `useTranslation()` subscribes each
localized React component without remounting the workspace. Entry points call
`initUiLanguage()` to synchronize workspace windows and the Quick Composer.
On macOS, the same dictionary updates the native menu while preserving custom
shortcuts and autosave state.

Use the English UI text as the translation key. Add its Chinese equivalent to
`src/shared/i18n/zh-CN.json`, then call `t("English UI text")` from a component
using `useTranslation()`. Unknown keys retain the English text. Application
metadata that is displayed outside React can use `translate()` at display time;
do not translate module-level constants once at import time.

For dynamic text, use placeholders instead of translating interpolated content:

```tsx
const { t } = useTranslation();
t("What should we work on in {project}?", { project: projectName });
```

Translate only application-owned labels. Keep commands, stable settings IDs,
provider identifiers, file paths, user-defined names, prompts, agent messages,
source code, terminal output, and external service error messages intact.
Settings and keybinding searches match both English and Chinese labels without
altering the internal IDs used to navigate or save preferences.

Run `npm run check:web` and `npm run check:rust` before pushing. Localization
tests cover persistence, storage failure, synchronization, fallback and
interpolation, Chinese search, the real settings control, and live switching
without losing editor state or changing project names.
