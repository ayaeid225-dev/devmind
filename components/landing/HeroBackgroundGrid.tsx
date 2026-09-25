"use client";

import React from "react";

export function HeroBackgroundGrid() {
  return (
    <div
      className="hero-grid-wrapper"
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* Soft Technical Ambient Lighting behind the Hero Visual (Restrained #C8D62B influence) */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "5%",
          width: "55%",
          height: "80%",
          background:
            "radial-gradient(ellipse at 65% 45%, rgba(200, 214, 43, 0.07) 0%, rgba(98, 196, 199, 0.03) 45%, transparent 70%)",
          filter: "blur(60px)",
          opacity: 0.85,
        }}
      />

      {/* SVG Canvas for Engineering Grid & Distortion Transformation */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1400 800"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, opacity: 0.7 }}
      >
        <defs>
          {/* Linear Gradients for Natural Fade toward Edges */}
          <linearGradient id="gridFadeMask" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C8D62B" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#293024" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#141813" stopOpacity="0.1" />
          </linearGradient>

          {/* Grid Pattern definition for outer un-distorted coordinate zone */}
          <pattern id="staticGrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 60 0 L 0 0 0 60"
              fill="none"
              stroke="rgba(41, 48, 36, 0.28)"
              strokeWidth="0.8"
            />
            <circle cx="0" cy="0" r="1" fill="rgba(111, 117, 106, 0.3)" />
          </pattern>
        </defs>

        {/* 1. Base Static Coordinate Grid (Far from visual) */}
        <rect width="100%" height="100%" fill="url(#staticGrid)" />

        {/* 2. Converging & Distorted Grid Lines (Transforming toward Hero Visual) */}
        <g stroke="rgba(41, 48, 36, 0.5)" strokeWidth="1" fill="none">
          {/* Curved Horizontal Grid Lines Bending Toward Intelligence Engine */}
          <path d="M 0 180 Q 700 170 1200 240" strokeDasharray="3 3" opacity="0.6" />
          <path d="M 0 300 Q 650 310 1150 360" stroke="rgba(200, 214, 43, 0.25)" strokeWidth="1.2" />
          <path d="M 0 420 Q 600 450 1100 480" opacity="0.5" />
          <path d="M 0 540 Q 650 560 1180 570" strokeDasharray="4 4" opacity="0.4" />

          {/* Converging Vertical & Diagonal Lines leading into Architecture Graph */}
          <path d="M 450 0 Q 550 400 950 800" opacity="0.35" />
          <path d="M 650 0 Q 750 350 1100 800" stroke="rgba(98, 196, 199, 0.25)" strokeWidth="1.2" />
          <path d="M 850 0 Q 920 300 1250 800" opacity="0.4" />
        </g>

        {/* 3. Grid Fragment Connections (Fragmented Cells becoming Graph Edges) */}
        <g opacity="0.7">
          <line
            x1="780"
            y1="240"
            x2="920"
            y2="280"
            stroke="var(--brand)"
            strokeWidth="1.4"
            strokeDasharray="4 3"
            className="pulse-line"
          />
          <line
            x1="840"
            y1="360"
            x2="980"
            y2="380"
            stroke="rgba(98, 196, 199, 0.7)"
            strokeWidth="1.2"
          />
          <line
            x1="720"
            y1="480"
            x2="890"
            y2="510"
            stroke="rgba(214, 167, 44, 0.6)"
            strokeWidth="1"
            strokeDasharray="2 4"
          />
        </g>

        {/* 4. Selective Intelligence Nodes (Restrained Lime Signal) */}
        <g>
          {/* Subtle Grid Intersection Nodes */}
          <circle cx="650" cy="310" r="3" fill="#293024" />
          <circle cx="750" cy="350" r="3" fill="#293024" />
          <circle cx="850" cy="300" r="3.5" fill="#39422f" />

          {/* Active DevMind Intelligence Nodes (Selective Lime #C8D62B) */}
          <g className="active-node-group">
            <circle cx="780" cy="240" r="4.5" fill="var(--brand)" />
            <circle cx="780" cy="240" r="9" fill="none" stroke="var(--brand)" strokeWidth="1" opacity="0.4" className="node-pulse" />
          </g>

          <g className="active-node-group">
            <circle cx="920" cy="280" r="4" fill="var(--t-api)" />
            <circle cx="920" cy="280" r="8" fill="none" stroke="var(--t-api)" strokeWidth="1" opacity="0.35" />
          </g>

          <g className="active-node-group">
            <circle cx="840" cy="360" r="5" fill="var(--brand)" />
            <circle cx="840" cy="360" r="11" fill="none" stroke="var(--brand)" strokeWidth="1" opacity="0.3" className="node-pulse" />
          </g>
        </g>
      </svg>

      {/* Embedded CSS for Subtle Restrained Animations & Motion Safety */}
      <style jsx>{`
        @keyframes linePulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.95; }
        }
        @keyframes nodePulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.35); opacity: 0.8; }
        }
        .pulse-line {
          animation: linePulse 3.5s ease-in-out infinite;
        }
        .node-pulse {
          transform-origin: center;
          animation: nodePulse 4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pulse-line,
          .node-pulse {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
