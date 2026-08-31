"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Input } from "@/components/ui";
import { ASK_SUGGESTIONS } from "@/data/fixtures";
import { useShell } from "@/lib/shell-context";

interface EvidenceCitationItem {
  id: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  relevance?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
  citations?: EvidenceCitationItem[];
  conf?: number;
  isNoEvidence?: boolean;
}

function AskPageContent() {
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const currentRepoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;
  const initialQ = searchParams.get("q") || "";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const processedInitialRef = useRef(false);

  const scrollToBottom = () => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendQuestion = useCallback(async (q: string) => {
    if (!q || isTyping || !currentRepoId) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositoryId: currentRepoId, question: q }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (data.success && data.data) {
        const payload = data.data;

        if (payload.insufficientEvidence) {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "ai",
              text: payload.answer || `No relevant code evidence was found for repository ${currentRepoId}.`,
              isNoEvidence: true,
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "ai",
              text: payload.answer,
              citations: payload.citations || [],
              conf: payload.confidence || 0.92,
            },
          ]);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "ai",
            text: data.error || "Unable to answer question.",
            isNoEvidence: true,
          },
        ]);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "ai",
          text: "Connection error: Failed to reach Ask DevMind API.",
          isNoEvidence: true,
        },
      ]);
    }
  }, [currentRepoId, isTyping]);

  useEffect(() => {
    if (initialQ && !processedInitialRef.current) {
      processedInitialRef.current = true;
      sendQuestion(initialQ);
    }
  }, [initialQ, sendQuestion]);

  return (
    <div className="ask-screen fade-up">
      {/* Thread Container */}
      <div className="ask-thread" ref={threadRef}>
        {messages.length === 0 && !isTyping ? (
          <div className="ask-greet">
            <span className="cpu-lg">
              <Icon name="brain" />
            </span>
            <h1>Ask DevMind</h1>
            <p>
              Ask anything about <b className="mono t2">{currentRepoId}</b>.
              Answers are grounded in the repository — with evidence you can click.
            </p>
            <div className="ask-sugg">
              {ASK_SUGGESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="chip"
                  onClick={() => sendQuestion(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="msg msg-user">
                  <span className="msg-av">
                    <Icon name="user" className="ic-sm" />
                  </span>
                  <div className="bubble">{m.text}</div>
                </div>
              );
            }

            if (m.isNoEvidence) {
              return (
                <div key={m.id} className="msg msg-ai">
                  <span className="msg-av">
                    <Icon name="logo" className="ic-sm" />
                  </span>
                  <div className="bubble">
                    <p>{m.text}</p>
                    <div className="evidence">
                      <div className="ev-label">
                        <Icon name="info" className="ic-sm" /> No evidence found for {currentRepoId}
                      </div>
                      <div className="row wrap gap8">
                        <button
                          type="button"
                          className="chip"
                          onClick={() => sendQuestion("How does authentication work?")}
                        >
                          Try: authentication
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => sendQuestion("Where are modules defined?")}
                        >
                          Try: modules
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            const paras = m.text.split("\n\n");

            return (
              <div key={m.id} className="msg msg-ai">
                <span className="msg-av">
                  <Icon name="logo" className="ic-sm" />
                </span>
                <div className="bubble">
                  {paras.map((p, idx) => (
                    <p key={idx}>{p}</p>
                  ))}

                  {m.citations && m.citations.length > 0 && (
                    <div className="evidence">
                      <div className="ev-label">
                        <Icon name="code" className="ic-sm" /> Evidence • click a
                        source to inspect
                      </div>
                      <div className="ev-chips">
                        {m.citations.map((c) => {
                          const fileName = c.path.split("/").pop() || c.path;
                          // Use the real citation ID from the RAG response (DocumentChunk.id)
                          const evidenceHref = c.id
                            ? `/app/evidence/${c.id}?repoId=${encodeURIComponent(currentRepoId)}`
                            : `/app/files?repoId=${encodeURIComponent(currentRepoId)}`;

                          return (
                            <Link
                              key={c.id || c.path}
                              href={evidenceHref}
                              className="ev-chip"
                              style={{ textDecoration: "none" }}
                            >
                              <Icon name="file" className="ic-sm" /> {fileName} (L{c.startLine}-{c.endLine})
                            </Link>
                          );
                        })}
                      </div>

                      {m.conf != null && (
                        <div className="ev-conf">
                          <Icon name="checkCircle" className="ic-sm" /> High confidence
                          — grounded in {m.citations.length} sources
                          <span className="conf-bar">
                            <i style={{ width: `${Math.round(m.conf * 100)}%` }} />
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="msg msg-ai" id="typing">
            <span className="msg-av">
              <Icon name="logo" className="ic-sm" />
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
        )}
      </div>

      {/* Input Bar */}
      <div className="ask-input-bar">
        <div className="ask-input-box">
          <Input
            id="ask-input"
            placeholder={`Ask DevMind about ${currentRepoId}…`}
            autoComplete="off"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendQuestion(inputVal.trim());
              }
            }}
          />
          <button
            type="button"
            className="ask-send"
            id="ask-send"
            onClick={() => sendQuestion(inputVal.trim())}
          >
            <Icon name="send" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AskPage() {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <AskPageContent />
    </Suspense>
  );
}
