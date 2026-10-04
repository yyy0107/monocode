# Tasks

- [x] Connect shared modal panels and independent dialogs to popup opacity.
- [x] Use translucent MCP/worktree fields and transparent worktree selectors.
- [x] Update localized setting descriptions and search keywords.
- [x] Run existing affected tests and web checks.
- [x] Build and visually inspect both themes and live opacity changes.

## Validation evidence

- Existing affected UI, appearance, localization, and navigation tests: 149 passed
  across 14 files.
- Initial `npm run check:web`: 4,452 passed; nine FilePaneNavigation tests failed
  during the full concurrent run. All nine passed on the affected-test rerun.
- Full suite rerun with `npx vitest run --maxWorkers=4`: 4,461 passed, 13 skipped,
  428 passing files and two skipped files.
- `npm run build`: passed, including TypeScript checking and Vite production
  output. The existing large-chunk warning remains.
- Browser preview of the actual McpSettings and Modal components: background alpha
  follows 0%, 55%, and 100% in both light and dark mode without closing the dialog;
  field background alpha is 5% and content opacity is 100%. Saved light and dark
  screenshots. Native OS window compositing was not separately exercised.
