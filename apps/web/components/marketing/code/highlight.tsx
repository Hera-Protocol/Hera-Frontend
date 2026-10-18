import type { ReactNode } from "react";

/**
 * A tiny TypeScript highlighter for the marketing snippets. It knows
 * comments, strings, numbers, keywords, calls and Capitalised names, which
 * is all the samples need. Colors come from the tokens, so they follow
 * whatever theme the surrounding code window sets.
 */
const KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "new", "await", "async", "function", "return", "if", "else",
  "try", "catch", "throw", "switch", "case", "break", "instanceof", "type", "interface", "for", "of", "default",
  "true", "false", "null", "undefined", "typeof",
]);

const TOKEN = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)/g;

export function highlight(code: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of code.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) out.push(code.slice(last, index));
    const [text, comment, string, number, word] = match;
    let className: string | undefined;
    if (comment) className = "text-ink-soft/75 italic";
    else if (string) className = "text-sun";
    else if (number) className = "text-iris";
    else if (word) {
      if (KEYWORDS.has(word)) className = "text-blush";
      else if (code[index + word.length] === "(" || /^[A-Z]/.test(word)) className = "text-peacock";
    }
    out.push(className ? <span key={key++} className={className}>{text}</span> : text);
    last = index + text.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}
