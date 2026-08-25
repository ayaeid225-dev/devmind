"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./Icon";
import { EvidenceChips, type EvidenceChip } from "./EvidenceChips";
import { cx } from "./cx";

export type AskMessage =
  | { role: "user"; text: string }
  | {
      role: "ai";
      text: string;
      evidence?: readonly EvidenceChip[];
      conf?: number | null;
    };

export interface AskGreeting {
  title?: ReactNode;
  subtitle?: ReactNode;
  suggestions?: readonly string[];
}

export interface AskThreadProps {
  messages: readonly AskMessage[];
  typing?: boolean;
  greeting?: AskGreeting;
  onSuggestion?: (q: string) => void;
  onEvidenceClick?: (id: string) => void;
  autoScroll?: boolean;
  className?: string;
}

/*
 * Ported from the ask screen thread (app.js greetHtml/userMsg/aiMsg/typingMsg).
 * The prototype keeps the greeting block above the conversation, so it is
 * rendered whenever `greeting` is provided. Auto-scroll mirrors
 * thread.scrollTop = scrollHeight.
 */
export function AskThread({
  messages,
  typing = false,
  greeting,
  onSuggestion,
  onEvidenceClick,
  autoScroll = true,
  className,
}: AskThreadProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing, autoScroll]);

  return (
    <div ref={ref} className={cx("ask-thread", className)}>
      {greeting ? (
        <div className="ask-greet">
          <span className="cpu-lg">
            <Icon name="brain" />
          </span>
          <h1>{greeting.title ?? "Ask DevMind"}</h1>
          {greeting.subtitle ? <p>{greeting.subtitle}</p> : null}
          {greeting.suggestions && greeting.suggestions.length > 0 ? (
            <div className="ask-sugg">
              {greeting.suggestions.map((q) => (
                <button key={q} type="button" className="chip" onClick={() => onSuggestion?.(q)}>
                  {q}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="msg msg-user">
            <span className="msg-av">
              <Icon name="user" size="sm" />
            </span>
            <div className="bubble">{m.text}</div>
          </div>
        ) : (
          <div key={i} className="msg msg-ai">
            <span className="msg-av">
              <Icon name="logo" size="sm" />
            </span>
            <div className="bubble">
              {m.text.split("\n\n").map((p, k) => (
                <p key={k}>{p}</p>
              ))}
              <EvidenceChips
                chips={m.evidence ?? []}
                conf={m.conf}
                onSelect={onEvidenceClick}
              />
            </div>
          </div>
        )
      )}

      {typing ? (
        <div className="msg msg-ai">
          <span className="msg-av">
            <Icon name="logo" size="sm" />
          </span>
          <div className="bubble">
            <span style={{ display: "inline-flex", gap: 4, padding: "4px 2px" }}>
              <i
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--text-3)",
                  animation: "breath 1s infinite",
                }}
              />
              <i
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--text-3)",
                  animation: "breath 1s infinite .2s",
                }}
              />
              <i
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--text-3)",
                  animation: "breath 1s infinite .4s",
                }}
              />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
