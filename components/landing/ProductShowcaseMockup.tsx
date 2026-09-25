"use client";

import React, { useState } from "react";
import { Icon, Logo, Badge, type IconName } from "@/components/ui";

const SIDEBAR_ITEMS: { id: string; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "onboarding", label: "Onboarding", icon: "compass" },
  { id: "map", label: "Interactive Map", icon: "map" },
  { id: "modules", label: "Modules", icon: "modules" },
  { id: "files", label: "Files", icon: "file" },
  { id: "deps", label: "Dependencies", icon: "deps" },
  { id: "docs", label: "Documentation", icon: "fileText" },
];

export function ProductShowcaseMockup() {
  const [activeItem, setActiveItem] = useState("onboarding");

  return (
    <div
      className="card"
      style={{
        overflow: "hidden",
        borderColor: "var(--border)",
        boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
        background: "var(--sidebar)",
        borderRadius: 14,
      }}
    >
      {/* 1. IDE Top Title Bar */}
      <div
        className="row between align-center"
        style={{
          padding: "10px 18px",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="row align-center gap12">
          <Logo height={24} />
          <div style={{ height: 14, width: 1, background: "var(--border)" }} />
          <div className="row align-center gap6" style={{ fontSize: 12.5, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
            <span>workspace</span>
            <span>/</span>
            <b style={{ color: "var(--text-1)" }}>masrofy</b>
            <span style={{ cursor: "pointer", marginLeft: 4 }}>✕</span>
          </div>
        </div>

        <div className="row align-center gap8">
          <Badge variant="lime">
            <span className="dot" /> Connected Workspace
          </Badge>
        </div>
      </div>

      {/* 2. IDE Workspace Main Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 1fr 1.1fr", minHeight: 460 }}>
        {/* IDE Left Sidebar Navigation */}
        <div
          style={{
            background: "#0c0e0c",
            borderRight: "1px solid var(--border)",
            padding: "12px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveItem(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 450,
                  color: isActive ? "var(--text-1)" : "var(--text-3)",
                  background: isActive ? "var(--surface)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .12s ease",
                }}
              >
                <Icon name={item.icon} className="ic-sm" style={{ color: isActive ? "var(--brand)" : "var(--text-3)" }} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* IDE Center Architecture & Context Pane */}
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16, borderRight: "1px solid var(--border)" }}>
          <div className="row between align-center">
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}>Developer Onboarding</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--brand)" }}>STAGE 05 / 06</span>
          </div>

          {/* Module Architecture Box */}
          <div
            className="card"
            style={{
              padding: 16,
              background: "var(--elevated)",
              borderColor: "var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div className="row align-center gap8">
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 5,
                  background: "var(--brand-soft)",
                  color: "var(--brand)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                }}
              >
                <Icon name="compass" />
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-1)", fontWeight: 500 }}>
                Core Domain &amp; Entrypoint Flow
              </span>
            </div>

            {/* File Items */}
            <div className="col gap8" style={{ paddingLeft: 8 }}>
              <div className="row align-center gap10" style={{ padding: "6px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Icon name="fileText" className="ic-sm" style={{ color: "var(--brand)" }} />
                <span className="mono" style={{ fontSize: 12, color: "var(--brand)" }}>lib/server/auth.ts</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>Core auth domain</span>
              </div>

              <div className="row align-center gap10" style={{ padding: "6px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Icon name="fileText" className="ic-sm" style={{ color: "var(--t-api)" }} />
                <span className="mono" style={{ fontSize: 12, color: "var(--text-1)" }}>app/api/auth/logout/route.ts</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>API Endpoint</span>
              </div>

              <div className="row align-center gap10" style={{ padding: "6px 10px", borderRadius: 6, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Icon name="fileText" className="ic-sm" style={{ color: "var(--t-db)" }} />
                <span className="mono" style={{ fontSize: 12, color: "var(--text-1)" }}>middleware.ts</span>
                <span style={{ fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>Route protection</span>
              </div>
            </div>

            <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5, marginTop: 4 }}>
              DevMind links verified code files to high-level architecture modules and dependency graphs.
            </p>
          </div>
        </div>

        {/* IDE Right Code Viewer Pane */}
        <div style={{ padding: 18, background: "#090b0a", display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="row between align-center" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10 }}>
            <div className="row align-center gap8">
              <Icon name="code" style={{ color: "var(--brand)" }} />
              <b className="mono" style={{ fontSize: 12.5, color: "var(--text-1)" }}>lib/server/auth.ts</b>
            </div>
            <Badge variant="lime">Verified Evidence</Badge>
          </div>

          {/* Syntax Highlighted Code Viewer */}
          <div
            className="mono"
            style={{
              fontSize: 12,
              lineHeight: 1.65,
              color: "var(--text-2)",
              whiteSpace: "pre",
              overflowX: "auto",
              fontFamily: "var(--mono)",
            }}
          >
            <div><span style={{ color: "var(--text-3)" }}>1 </span><span style={{ color: "#C8D62B" }}>export async function</span> <span style={{ color: "#62C4C7" }}>verifyToken</span>(token: string) &#123;</div>
            <div><span style={{ color: "var(--text-3)" }}>2 </span>  <span style={{ color: "#C8D62B" }}>const</span> payload = <span style={{ color: "#C8D62B" }}>await</span> jwt.verifyToken(token, process.env.JWT_SECRET);</div>
            <div><span style={{ color: "var(--text-3)" }}>3 </span>  <span style={{ color: "#C8D62B" }}>return</span> payload;</div>
            <div><span style={{ color: "var(--text-3)" }}>4 </span>&#125;</div>
            <div><span style={{ color: "var(--text-3)" }}>5 </span></div>
            <div><span style={{ color: "var(--text-3)" }}>6 </span><span style={{ color: "#C8D62B" }}>export async function</span> <span style={{ color: "#62C4C7" }}>logout</span>(userId: string) &#123;</div>
            <div><span style={{ color: "var(--text-3)" }}>7 </span>  <span style={{ color: "#C8D62B" }}>await</span> db.user.update(&#123;</div>
            <div><span style={{ color: "var(--text-3)" }}>8 </span>    where: &#123; id: userId &#125;,</div>
            <div><span style={{ color: "var(--text-3)" }}>9 </span>    data: &#123; tokenVersion: &#123; increment: 1 &#125; &#125;</div>
            <div><span style={{ color: "var(--text-3)" }}>10</span>  &#125;);</div>
            <div><span style={{ color: "var(--text-3)" }}>11</span>&#125;</div>
          </div>
        </div>
      </div>
    </div>
  );
}
