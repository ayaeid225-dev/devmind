"use client";

import React from "react";
import Link from "next/link";
import { Icon, Button, useToast } from "@/components/ui";

const SHORTCUTS = [
  { key: "⌘ K", desc: "Open command palette" },
  { key: "/ ", desc: "Focus search" },
  { key: "Enter", desc: "Send question / select" },
  { key: "ESC", desc: "Close panel or palette" },
  { key: "⌘ Z", desc: "Reset map view" },
];

export default function HelpPage() {
  const toast = useToast();

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Help</h1>
        <p className="page-sub">Documentation, shortcuts, and support.</p>
      </div>

      <div
        className="row gap16"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
      >
        {/* Left Column: Keyboard Shortcuts */}
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Keyboard shortcuts</div>
          </div>
          <div className="card-body col">
            {SHORTCUTS.map((s, idx) => (
              <div
                key={idx}
                className="row between align-center"
                style={{
                  padding: "9px 0",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <span className="t2">{s.desc}</span>
                <span className="kbd">{s.key}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Resources & Support */}
        <div className="col gap16">
          {/* Resources Card */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Resources</div>
            </div>
            <div className="card-body col gap8">
              <div className="row gap8 align-center">
                <span style={{ color: "var(--text-3)" }}>
                  <Icon name="book" className="ic-sm" />
                </span>
                <Link
                  href="/app/docs"
                  className="t2"
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Read the docs
                </Link>
              </div>

              <div className="row gap8 align-center">
                <span style={{ color: "var(--text-3)" }}>
                  <Icon name="play" className="ic-sm" />
                </span>
                <Link
                  href="/app/docs"
                  className="t2"
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Watch: project map in 3 minutes
                </Link>
              </div>

              <div className="row gap8 align-center">
                <span style={{ color: "var(--text-3)" }}>
                  <Icon name="ask" className="ic-sm" />
                </span>
                <Link
                  href={`/app/ask?q=${encodeURIComponent(
                    "How does the project map work?"
                  )}`}
                  className="t2"
                  style={{
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Ask DevMind: how the map works
                </Link>
              </div>
            </div>
          </div>

          {/* Support Card */}
          <div className="card">
            <div className="card-header">
              <div className="sec-title">Support</div>
            </div>
            <div className="card-body">
              <p className="t2 small">
                Questions? Email <b className="t1">support@devmind.dev</b> or chat
                with us in the docs.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt16"
                onClick={() => toast("Support ticket request received", "info")}
              >
                Open support ticket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
