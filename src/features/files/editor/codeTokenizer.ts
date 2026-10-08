import type { HighlightResult, ThemeInput } from "@streamdown/code";
import {
  bundledLanguages,
  createHighlighter,
  type BundledLanguage,
} from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

export type CodeTokenizer = (
  code: string,
  lang: string,
  themes: [ThemeInput, ThemeInput],
) => Promise<HighlightResult>;

export type CodeTokenizeRequest = {
  id: number;
  code: string;
  lang: string;
  themes: [ThemeInput, ThemeInput];
};

export type CodeTokenizeResponse =
  | { id: number; result: HighlightResult }
  | { id: number; error: string };

const supported = new Set(Object.keys(bundledLanguages));

export function themeName(theme: ThemeInput): string {
  return typeof theme === "string" ? theme : (theme.name ?? "custom");
}

/**
 * Loads languages into one highlighter per theme pair and tokenizes with it.
 * Shared by the highlight worker and the main-thread fallback.
 */
export function createCodeTokenizer(): CodeTokenizer {
  const engine = createJavaScriptRegexEngine({ forgiving: true });
  const highlighters = new Map<string, Promise<Highlighter>>();

  const highlighterFor = (pair: [ThemeInput, ThemeInput]) => {
    const key = `${themeName(pair[0])}\u0000${themeName(pair[1])}`;
    let highlighter = highlighters.get(key);
    if (!highlighter) {
      highlighter = createHighlighter({ themes: pair, langs: [], engine });
      highlighters.set(key, highlighter);
      highlighter.catch(() => highlighters.delete(key));
    }
    return highlighter;
  };

  return async (code, lang, pair) => {
    const highlighter = await highlighterFor(pair);
    if (supported.has(lang) && !highlighter.getLoadedLanguages().includes(lang)) {
      await highlighter.loadLanguage(lang as BundledLanguage);
    }
    const usable = highlighter.getLoadedLanguages().includes(lang)
      ? lang
      : "text";
    return highlighter.codeToTokens(code, {
      lang: usable as BundledLanguage,
      themes: { light: themeName(pair[0]), dark: themeName(pair[1]) },
    });
  };
}
