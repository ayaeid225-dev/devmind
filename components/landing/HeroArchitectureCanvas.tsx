"use client";

import React from "react";
import { Icon } from "@/components/ui";


export function HeroArchitectureCanvas() {
  return (
    <div
      className="hero-canvas-container"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 620,
        margin: "0 auto",
        padding: "20px 10px",
      }}
    >
      {/* Background Organic Green/Lime Bezier Curve Network connecting to Central Node */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 600 440"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <g stroke="rgba(200, 214, 43, 0.45)" strokeWidth="1.5" fill="none">
          {/* Top Left Code -> Central DevMind */}
          <path d="M 140 60 C 220 80, 250 140, 300 170" strokeDasharray="3 3" />
          <path d="M 140 60 C 220 80, 250 140, 300 170" stroke="rgba(200, 214, 43, 0.7)" strokeWidth="1.8" className="glow-path" />

          {/* Top Center Architecture -> Central DevMind */}
          <path d="M 300 50 L 300 150" stroke="rgba(200, 214, 43, 0.6)" strokeWidth="1.6" />

          {/* Top Right Dependencies -> Central DevMind */}
          <path d="M 460 60 C 380 80, 350 140, 300 170" strokeDasharray="4 4" />
          <path d="M 460 60 C 380 80, 350 140, 300 170" stroke="rgba(200, 214, 43, 0.7)" strokeWidth="1.8" className="glow-path" />

          {/* Middle Left Documentation -> Central DevMind */}
          <path d="M 130 190 C 200 190, 230 195, 270 200" stroke="rgba(200, 214, 43, 0.5)" />

          {/* Middle Right Git History -> Central DevMind */}
          <path d="M 470 190 C 400 190, 370 195, 330 200" stroke="rgba(200, 214, 43, 0.5)" />

          {/* Bottom Center Engineering Memory -> Central DevMind */}
          <path d="M 300 330 L 300 250" stroke="rgba(200, 214, 43, 0.7)" strokeWidth="1.8" />
        </g>

        {/* Small Active Glowing Particles along Connection Paths */}
        <circle cx="210" cy="115" r="3" fill="#C8D62B" className="pulse-dot" />
        <circle cx="390" cy="115" r="3" fill="#C8D62B" className="pulse-dot" />
        <circle cx="300" cy="100" r="3" fill="#C8D62B" className="pulse-dot" />
        <circle cx="300" cy="290" r="3.5" fill="#C8D62B" className="pulse-dot" />
      </svg>

      {/* Grid Layout placing cards and Central DevMind node matching Reference Image */}
      <div
        style={{
          display: "grid",
          gridTemplateAreas: `
            "code arch deps"
            "docs devmind git"
            ". memory ."
          `,
          gridTemplateColumns: "1fr 1.1fr 1fr",
          gap: "18px 14px",
          alignItems: "center",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* 1. Top Left: Code */}
        <div className="card hero-node-card" style={{ gridArea: "code", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="code" /></span>
            <div>
              <div className="node-title">Code</div>
              <div className="node-sub">AST &amp; File Symbols</div>
            </div>
          </div>
        </div>

        {/* 2. Top Center: Architecture */}
        <div className="card hero-node-card" style={{ gridArea: "arch", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="modules" /></span>
            <div>
              <div className="node-title">Architecture</div>
              <div className="node-sub">Module Topology</div>
            </div>
          </div>
        </div>

        {/* 3. Top Right: Dependencies */}
        <div className="card hero-node-card" style={{ gridArea: "deps", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="deps" /></span>
            <div>
              <div className="node-title">Dependencies</div>
              <div className="node-sub">Package Imports</div>
            </div>
          </div>
        </div>

        {/* 4. Middle Left: Documentation */}
        <div className="card hero-node-card" style={{ gridArea: "docs", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="fileText" /></span>
            <div>
              <div className="node-title">Documentation</div>
              <div className="node-sub">Specs &amp; Knowledge</div>
            </div>
          </div>
        </div>

        {/* 5. CENTER: Main DevMind Core Node (Elevated Card matching Reference) */}
        <div
          className="card devmind-central-node"
          style={{
            gridArea: "devmind",
            padding: "16px 14px",
            background: "#090b0a",
            borderColor: "var(--brand)",
            borderWidth: 1.5,
            borderRadius: 12,
            textAlign: "center",
            boxShadow: "0 0 35px rgba(200, 214, 43, 0.25), 0 12px 30px rgba(0,0,0,0.8)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
          }}
        >
          {/* Logo Icon with glowing lime outline */}
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--brand)", display: "grid", placeItems: "center", color: "#090b0a" }}>
            <Icon name="logo" size="lg" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
            DevMind
          </div>
          <div style={{ fontSize: 10, color: "var(--brand)", fontFamily: "var(--mono)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            Unified Engineering Context Engine
          </div>
        </div>

        {/* 6. Middle Right: Git History */}
        <div className="card hero-node-card" style={{ gridArea: "git", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="git" /></span>
            <div>
              <div className="node-title">Git History</div>
              <div className="node-sub">Commits &amp; Changes</div>
            </div>
          </div>
        </div>

        {/* 7. Bottom Center: Engineering Memory */}
        <div className="card hero-node-card" style={{ gridArea: "memory", padding: "10px 12px", background: "var(--surface)", borderColor: "var(--border)" }}>
          <div className="row align-center gap8">
            <span className="node-icon"><Icon name="brain" /></span>
            <div>
              <div className="node-title">Engineering Memory</div>
              <div className="node-sub">Unified Context</div>
            </div>
          </div>
        </div>
      </div>

      {/* 8. Bottom Status Pill Bar matching Reference Image */}
      <div
        className="card"
        style={{
          marginTop: 24,
          padding: "10px 18px",
          background: "rgba(14, 17, 15, 0.9)",
          borderColor: "var(--border)",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          position: "relative",
          zIndex: 5,
        }}
      >
        <div className="row align-center gap6">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--brand)" }} />
          <b style={{ color: "var(--brand)", fontWeight: 600 }}>Active Context</b>
        </div>
        <div style={{ width: 1, height: 12, background: "var(--border)" }} />
        <div>
          <span style={{ color: "var(--text-3)" }}>Indexed Repos: </span>
          <b style={{ color: "var(--brand)", fontFamily: "var(--mono)" }}>Active</b>
        </div>
        <div style={{ width: 1, height: 12, background: "var(--border)" }} />
        <div>
          <span style={{ color: "var(--text-3)" }}>RAG Operational: </span>
          <b style={{ color: "var(--brand)", fontFamily: "var(--mono)" }}>Context Verified</b>
        </div>
      </div>

      {/* Styles for node cards & smooth pulses */}
      <style jsx>{`
        .hero-node-card {
          border-radius: 8px;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .hero-node-card:hover {
          border-color: var(--brand-line);
          background: var(--elevated);
        }
        .node-icon {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: var(--elevated-2);
          color: var(--brand);
          display: grid;
          place-items: center;
          font-size: 12px;
          flex-shrink: 0;
        }
        .node-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-1);
          line-height: 1.2;
        }
        .node-sub {
          font-size: 10px;
          color: var(--text-3);
          font-family: var(--mono);
          margin-top: 1px;
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
        .pulse-dot {
          animation: pulseDot 3s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

