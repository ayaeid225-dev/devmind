import { Fragment } from "react";
import { Badge } from "./Badge";
import { cx } from "./cx";

/*
 * Keyword list ported verbatim from app.js KW regex (quirks included).
 * Token classes: cv-tok-k keywords, cv-tok-s strings, cv-tok-n numbers,
 * cv-tok-c comments (cv-tok-f / cv-tok-b exist in CSS but the prototype
 * tokenizer never emits them).
 */
const KW =
  /^(import|class|final|const|var|Future|void|String|int|double|bool|DateTime|return|if|else|for|while|throw|required|this|super|new|try|catch|static|enum|Map|List|Set|await|async|extends|implements|typedef|package|final|abstract|sync|async*)$/;

interface Token {
  text: string;
  cls?: string;
}

/* Line-by-line port of app.js tokenize() producing token segments. */
function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const s = line;
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      out.push({ text: " " });
      i++;
      continue;
    }
    if (ch === "/" && s[i + 1] === "/") {
      out.push({ text: s.slice(i), cls: "cv-tok-c" });
      break;
    }
    if (ch === "'" || ch === '"') {
      const q = ch;
      let j = i + 1;
      let str = "";
      while (j < s.length) {
        if (s[j] === "\\") {
          str += s.slice(j, j + 2);
          j += 2;
          continue;
        }
        if (s[j] === q) {
          j++;
          break;
        }
        str += s[j];
        j++;
      }
      out.push({ text: q + str + (s[j - 1] === q ? q : ""), cls: "cv-tok-s" });
      i = j;
      continue;
    }
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9_.]/.test(s[j])) j++;
      out.push({ text: s.slice(i, j), cls: "cv-tok-n" });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      const w = s.slice(i, j);
      out.push(KW.test(w) ? { text: w, cls: "cv-tok-k" } : { text: w });
      i = j;
      continue;
    }
    out.push({ text: ch });
    i++;
  }
  return out;
}

export interface CodeViewerProps {
  path: string;
  lines: readonly string[];
  /** 1-based line numbers to highlight (.cv-line.hl). */
  highlight?: readonly number[];
  className?: string;
}

export function CodeViewer({ path, lines, highlight, className }: CodeViewerProps) {
  const hlSet = new Set(highlight ?? []);
  return (
    <div className={cx("code-view", className)}>
      <div className="cv-head">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="cv-file">{path}</span>
        {highlight && highlight.length > 0 && (
          <Badge variant="lime" small className="cv-badge">
            {`${Math.min(...highlight)}–${Math.max(...highlight)} highlighted`}
          </Badge>
        )}
      </div>
      <div className="cv-lines">
        {lines.map((ln, i) => (
          <div key={i} className={cx("cv-line", hlSet.has(i + 1) && "hl")}>
            <span className="ln">{i + 1}</span>
            <span className="lc">
              {tokenize(ln).map((tok, k) =>
                tok.cls ? (
                  <span key={k} className={tok.cls}>
                    {tok.text}
                  </span>
                ) : (
                  <Fragment key={k}>{tok.text}</Fragment>
                )
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
