"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Input } from "@/components/ui";
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
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW";
  evidenceState?: "VERIFIED" | "PARTIAL" | "NOT_FOUND";
  isNoEvidence?: boolean;
  impactAnalysis?: {
    directlyAffected: string[];
    potentiallyAffected: string[];
    affectedModules: string[];
    affectedRoutes: string[];
    affectedComponents: string[];
    reason?: string;
    validation?: string[];
  };
  gitHistory?: Array<{
    sha: string;
    shortSha: string;
    message: string;
    author: string;
    date: string;
    changeType?: string;
  }>;
}

const DEFAULT_SUGGESTIONS = [
  "Where is authentication implemented?",
  "Explain the project architecture",
  "What depends on this module?",
  "What happens if I change the database schema?",
  "Show recent commit history",
];

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

  const sendQuestion = useCallback(
    async (q: string) => {
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

          if (payload.insufficientEvidence || payload.evidenceState === "NOT_FOUND") {
            setMessages((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}`,
                role: "ai",
                text:
                  payload.answer ||
                  `I couldn't verify this from the indexed repository data for ${currentRepoId}.`,
                evidenceState: "NOT_FOUND",
                confidenceLevel: "LOW",
                conf: 0,
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
                confidenceLevel: payload.confidenceLevel || "HIGH",
                evidenceState: payload.evidenceState || "VERIFIED",
                impactAnalysis: payload.impactAnalysis,
                gitHistory: payload.gitHistory,
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
              evidenceState: "NOT_FOUND",
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
            evidenceState: "NOT_FOUND",
            isNoEvidence: true,
          },
        ]);
      }
    },
    [currentRepoId, isTyping]
  );

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
              Answers are grounded in the repository — with traceable evidence you can click.
            </p>
            <div className="ask-sugg">
              {DEFAULT_SUGGESTIONS.map((q) => (
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

            if (m.isNoEvidence || m.evidenceState === "NOT_FOUND") {
              return (
                <div key={m.id} className="msg msg-ai">
                  <span className="msg-av">
                    <Icon name="logo" className="ic-sm" />
                  </span>
                  <div className="bubble">
                    <div style={{ marginBottom: 8 }}>
                      <span
                        className="badge badge-slate"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          padding: "2px 8px",
                        }}
                      >
                        <Icon name="info" className="ic-sm" /> Not Found in Repository
                      </span>
                    </div>
                    <div style={{ whiteSpace: "pre-line" }}>{m.text}</div>
                    <div className="evidence" style={{ marginTop: 12 }}>
                      <div className="ev-label">
                        <Icon name="info" className="ic-sm" /> Try asking about indexed components
                      </div>
                      <div className="row wrap gap8">
                        <button
                          type="button"
                          className="chip"
                          onClick={() => sendQuestion("Where is authentication implemented?")}
                        >
                          Try: authentication
                        </button>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => sendQuestion("Explain the project architecture")}
                        >
                          Try: architecture
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
                  {/* Evidence State Pill */}
                  <div style={{ marginBottom: 8, display: "flex", gap: 6, alignItems: "center" }}>
                    {m.evidenceState === "VERIFIED" ? (
                      <span
                        className="badge badge-lime"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          padding: "2px 8px",
                        }}
                      >
                        <Icon name="checkCircle" className="ic-sm" /> Verified Repository Evidence
                      </span>
                    ) : m.evidenceState === "PARTIAL" ? (
                      <span
                        className="badge badge-amber"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          padding: "2px 8px",
                        }}
                      >
                        <Icon name="alert" className="ic-sm" /> Partially Verified
                      </span>
                    ) : null}
                  </div>

                  {/* Render Parsed Content */}
                  {paras.map((p, idx) => {
                    if (p.startsWith("### ")) {
                      const heading = p.replace("### ", "");
                      return (
                        <h4
                          key={idx}
                          style={{
                            margin: "12px 0 4px 0",
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-1)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {heading}
                        </h4>
                      );
                    }
                    return (
                      <p key={idx} style={{ margin: "4px 0 8px 0", lineHeight: 1.5 }}>
                        {p}
                      </p>
                    );
                  })}

                  {/* Impact Analysis Details Card */}
                  {m.impactAnalysis &&
                    (m.impactAnalysis.directlyAffected.length > 0 ||
                      m.impactAnalysis.affectedModules.length > 0) && (
                      <div
                        style={{
                          margin: "12px 0",
                          padding: 10,
                          borderRadius: 6,
                          background: "var(--surface-2)",
                          border: "1px solid var(--border-dim)",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, color: "var(--text-1)" }}>
                          <Icon name="branch" className="ic-sm" /> Blast Radius Summary
                        </div>
                        {m.impactAnalysis.directlyAffected.length > 0 && (
                          <div style={{ color: "var(--text-2)", marginBottom: 4 }}>
                            <b>Directly affected:</b> {m.impactAnalysis.directlyAffected.join(", ")}
                          </div>
                        )}
                        {m.impactAnalysis.affectedModules.length > 0 && (
                          <div style={{ color: "var(--text-2)", marginBottom: 4 }}>
                            <b>Affected modules:</b> {m.impactAnalysis.affectedModules.join(", ")}
                          </div>
                        )}
                        {m.impactAnalysis.validation && m.impactAnalysis.validation.length > 0 && (
                          <div style={{ color: "var(--text-3)", fontSize: 11 }}>
                            <b>Recommended:</b> {m.impactAnalysis.validation.join(" • ")}
                          </div>
                        )}
                      </div>
                    )}

                  {/* Git History Card */}
                  {m.gitHistory && m.gitHistory.length > 0 && (
                    <div
                      style={{
                        margin: "12px 0",
                        padding: 10,
                        borderRadius: 6,
                        background: "var(--surface-2)",
                        border: "1px solid var(--border-dim)",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 6, color: "var(--text-1)" }}>
                        <Icon name="git" className="ic-sm" /> Verified Commit History
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.gitHistory.map((c) => (
                          <div key={c.sha} style={{ color: "var(--text-2)" }}>
                            <span className="mono" style={{ color: "var(--brand)" }}>
                              [{c.shortSha}]
                            </span>{" "}
                            {c.message} — <span style={{ color: "var(--text-3)" }}>{c.author}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Clickable Citations */}
                  {m.citations && m.citations.length > 0 && (
                    <div className="evidence">
                      <div className="ev-label">
                        <Icon name="code" className="ic-sm" /> Verified Evidence • Click to inspect
                      </div>
                      <div className="ev-chips">
                        {m.citations.map((c) => {
                          const fileName = c.path.split("/").pop() || c.path;
                          const evidenceHref = c.id
                            ? `/app/evidence/${c.id}?repoId=${encodeURIComponent(currentRepoId)}&line=${c.startLine}`
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
                          <Icon name="checkCircle" className="ic-sm" />{" "}
                          {m.confidenceLevel === "HIGH"
                            ? "High confidence"
                            : m.confidenceLevel === "MEDIUM"
                            ? "Medium confidence"
                            : "Low confidence"}{" "}
                          — grounded in {m.citations.length} verified source(s)
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
