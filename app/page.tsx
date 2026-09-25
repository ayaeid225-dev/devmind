"use client";

import React from "react";
import Link from "next/link";
import { Button, Logo, Icon, type IconName } from "@/components/ui";
import { HeroBackgroundGrid } from "@/components/landing/HeroBackgroundGrid";
import { HeroArchitectureCanvas } from "@/components/landing/HeroArchitectureCanvas";
import { ProductShowcaseMockup } from "@/components/landing/ProductShowcaseMockup";

const SCATTERED_ITEMS: { name: string; icon: IconName; tag: string }[] = [
  { name: "Codebase", icon: "code", tag: "Repos" },
  { name: "GitHub", icon: "github", tag: "PRs & Issues" },
  { name: "Documentation", icon: "fileText", tag: "Notion & Docs" },
  { name: "Architecture", icon: "modules", tag: "Diagrams" },
  { name: "Team Knowledge", icon: "users", tag: "Developer Minds" },
  { name: "Technical Decisions", icon: "log", tag: "ADRs & Discussions" },
];

export default function LandingPage() {
  return (
    <div className="lp" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text-1)", position: "relative", overflowX: "hidden" }}>
      {/* Background Technical Grid Transformation Overlay */}
      <HeroBackgroundGrid />
      <div className="lp-bg" />

      {/* 1. HEADER */}
      <nav className="lp-nav">
        <Link href="/" className="row gap10 align-center" style={{ textDecoration: "none" }}>
          <Logo height={32} alt="DevMind AI" />
        </Link>

        <div className="lp-links">
          <a href="#product">Product</a>
          <a href="#how-it-works">How it works</a>
          <a href="#value">For Teams</a>
        </div>

        <div className="spacer" />

        <div className="row gap16 align-center">
          <Link href="/login" style={{ fontSize: 13.5, color: "var(--text-2)", textDecoration: "none", fontWeight: 500 }}>
            Sign In
          </Link>
          <Link href="/signup">
            <Button variant="primary" size="md">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* 2. HERO SECTION */}
      <header className="lp-hero" style={{ position: "relative", zIndex: 2 }}>
        <div className="col gap16">
          <div>
            <div className="lp-eyebrow" style={{ color: "var(--brand)", borderColor: "var(--border)" }}>
              ENGINEERING INTELLIGENCE PLATFORM
            </div>
          </div>

          <h1 className="lp-h1">
            Your Engineering<br />
            <span className="hl">Team&apos;s Memory.</span>
          </h1>

          <p className="lp-sub">
            Understand your codebase, architecture, decisions, and engineering knowledge in one intelligent workspace.
          </p>

          <div className="lp-cta-row">
            <Link href="/signup">
              <Button variant="primary" size="xl">
                Get Started <Icon name="arrowRight" className="ic-sm" />
              </Button>
            </Link>
            <Link href="/app/overview">
              <Button variant="secondary" size="xl">
                Explore the Product
              </Button>
            </Link>
          </div>

          <div className="row gap20 align-center mt16" style={{ fontSize: 12.5, color: "var(--text-3)" }}>
            <div className="row align-center gap6">
              <Icon name="check" style={{ color: "var(--brand)" }} className="ic-sm" />
              <span>Multi-file evidence RAG</span>
            </div>
            <div className="row align-center gap6">
              <Icon name="check" style={{ color: "var(--brand)" }} className="ic-sm" />
              <span>Zero fake data</span>
            </div>
          </div>
        </div>

        {/* HERO RIGHT: Organic Architecture Network Visualization */}
        <HeroArchitectureCanvas />
      </header>

      {/* 3. PROBLEM -> SOLUTION SECTION (SCATTERED VS UNIFIED) */}
      <section id="product" className="lp-section">
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 44px" }}>
          <div className="lp-kicker">SCATTERED VS UNIFIED</div>
          <h2 className="lp-h2">
            Your engineering knowledge<br />
            is <span style={{ color: "var(--brand)" }}>scattered.</span>
          </h2>
          <p className="lp-lead" style={{ margin: "12px auto 0" }}>
            Code lives in repositories, specs in documentation, architecture in developer minds, and decisions in chat logs. DevMind connects them into one workspace.
          </p>
        </div>

        {/* Horizontal Scattered Items -> Connects -> DevMind Workspace */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 24, alignItems: "center" }}>
          {/* 6 Scattered Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {SCATTERED_ITEMS.map((item) => (
              <div key={item.name} className="card" style={{ padding: 12, background: "var(--surface)", borderColor: "var(--border)", borderRadius: 8 }}>
                <div className="row align-center gap8 mb4">
                  <Icon name={item.icon} className="ic-sm" style={{ color: "var(--brand)" }} />
                  <b style={{ fontSize: 12.5, color: "var(--text-1)" }}>{item.name}</b>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-3)", fontFamily: "var(--mono)" }}>{item.tag}</div>
              </div>
            ))}
          </div>

          {/* Connects Pill */}
          <div className="row center align-center gap8" style={{ padding: "6px 14px", borderRadius: 999, background: "var(--elevated)", border: "1px solid var(--brand-line)" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", fontFamily: "var(--mono)" }}>Connects</span>
            <Icon name="arrowRight" className="ic-sm" style={{ color: "var(--brand)" }} />
          </div>

          {/* Unified DevMind Outcome Node */}
          <div
            className="card"
            style={{
              padding: 24,
              background: "#090b0a",
              borderColor: "var(--brand)",
              borderWidth: 1.5,
              borderRadius: 12,
              boxShadow: "0 0 30px rgba(200, 214, 43, 0.2)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--brand)", display: "grid", placeItems: "center", color: "#090b0a" }}>
              <Icon name="logo" size="lg" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-1)" }}>
              DevMind
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
              One Intelligent Workspace
            </p>
          </div>
        </div>
      </section>

      {/* 4. HOW DEV MIND WORKS (3 Automated Steps) */}
      <section id="how-it-works" className="lp-section" style={{ background: "var(--sidebar)", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
          <div className="lp-kicker">HOW DEV MIND WORKS</div>
          <h2 className="lp-h2">How DevMind Works</h2>
          <p className="lp-lead" style={{ margin: "12px auto 0" }}>
            From repository connection to multi-file intelligence in three automated steps.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: 16, alignItems: "center" }}>
          {/* Step 1 */}
          <div className="card" style={{ padding: 24, background: "var(--surface)", borderColor: "var(--border)", borderRadius: 12 }}>
            <div className="row align-center gap12 mb14">
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(200, 214, 43, 0.12)", border: "1px solid var(--brand-line)", color: "var(--brand)", display: "grid", placeItems: "center" }}>
                <Icon name="link" />
              </span>
              <div>
                <div style={{ fontSize: 11, color: "var(--brand)", fontFamily: "var(--mono)" }}>01 / CONNECT</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>Connect Workspace</h3>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              Connect your GitHub repositories and team projects in seconds with secure authorization.
            </p>
          </div>

          <Icon name="arrowRight" style={{ color: "var(--brand)" }} />

          {/* Step 2 */}
          <div className="card" style={{ padding: 24, background: "var(--surface)", borderColor: "var(--border)", borderRadius: 12 }}>
            <div className="row align-center gap12 mb14">
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(200, 214, 43, 0.12)", border: "1px solid var(--brand-line)", color: "var(--brand)", display: "grid", placeItems: "center" }}>
                <Icon name="modules" />
              </span>
              <div>
                <div style={{ fontSize: 11, color: "var(--brand)", fontFamily: "var(--mono)" }}>02 / UNDERSTAND</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>Build Architecture Context</h3>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              DevMind automatically parses AST structures, module boundaries, dependencies, and vector RAG embeddings.
            </p>
          </div>

          <Icon name="arrowRight" style={{ color: "var(--brand)" }} />

          {/* Step 3 */}
          <div className="card" style={{ padding: 24, background: "var(--surface)", borderColor: "var(--border)", borderRadius: 12 }}>
            <div className="row align-center gap12 mb14">
              <span style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(200, 214, 43, 0.12)", border: "1px solid var(--brand-line)", color: "var(--brand)", display: "grid", placeItems: "center" }}>
                <Icon name="brain" />
              </span>
              <div>
                <div style={{ fontSize: 11, color: "var(--brand)", fontFamily: "var(--mono)" }}>03 / DECIDE</div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>Query &amp; Validate</h3>
              </div>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
              Get precise architectural answers, impact analysis, and verifiable multi-file code evidence.
            </p>
          </div>
        </div>
      </section>

      {/* 5. PRODUCT SHOWCASE */}
      <section className="lp-section">
        <div className="row between align-end mb32 wrap gap16">
          <div style={{ maxWidth: 600 }}>
            <div className="lp-kicker">PRODUCT SHOWCASE</div>
            <h2 className="lp-h2" style={{ marginTop: 8 }}>
              Ask your codebase.<br />
              Understand the context.
            </h2>
            <p className="lp-lead" style={{ marginTop: 10 }}>
              DevMind connects engineering context so your team can understand systems faster and make better technical decisions.
            </p>
          </div>

          <Link href="/app/overview">
            <Button variant="primary" size="lg">
              Explore the Product <Icon name="arrowRight" className="ic-sm" />
            </Button>
          </Link>
        </div>

        {/* IDE Product Mockup Matching Reference Image */}
        <ProductShowcaseMockup />
      </section>

      {/* 6. FULL SYSTEM COVERAGE (6 Connected Feature Columns) */}
      <section id="value" className="lp-section">
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
          <div className="lp-kicker">FULL SYSTEM COVERAGE</div>
          <h2 className="lp-h2">One connected engineering system</h2>
          <p className="lp-lead" style={{ margin: "12px auto 0" }}>
            DevMind synthesizes all dimensions of software development into a coherent workspace.
          </p>
        </div>

        {/* Horizontal Connecting Line with 6 Feature Nodes */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 1, background: "var(--border)", zIndex: 1 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, position: "relative", zIndex: 2 }}>
            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="code" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Codebase</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Indexes files, AST nodes, and function symbols.</p>
            </div>

            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="modules" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Architecture</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Maps module boundaries and component tiers.</p>
            </div>

            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="deps" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Dependencies</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Tracks internal imports and external packages.</p>
            </div>

            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="fileText" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Documentation</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Keeps docs in sync with actual code implementation.</p>
            </div>

            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="brain" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Engineering Knowledge</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Retains context and historical rationale behind decisions.</p>
            </div>

            <div className="col gap10 align-center" style={{ textAlign: "center" }}>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: "var(--surface)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color: "var(--brand)" }}>
                <Icon name="users" />
              </span>
              <b style={{ fontSize: 13, color: "var(--text-1)" }}>Team Context</b>
              <p style={{ fontSize: 11.5, color: "var(--text-3)", lineHeight: 1.5 }}>Shares understanding across team members.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FINAL CTA & FOOTER */}
      <section className="lp-section" style={{ paddingBottom: 60, position: "relative" }}>
        {/* Organic Wave Mesh Background at Bottom */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 300,
            background: "radial-gradient(ellipse at 50% 100%, rgba(200,214,43,0.08) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            position: "relative",
            zIndex: 2,
          }}
        >
          <h2 style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-1)", marginBottom: 12 }}>
            Give your engineering team a <span style={{ color: "var(--brand)" }}>memory.</span>
          </h2>
          <p style={{ fontSize: 14.5, color: "var(--text-2)", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.6 }}>
            Turn scattered codebase knowledge into actionable engineering intelligence.
          </p>

          <Link href="/signup">
            <Button variant="primary" size="xl">
              Get Started <Icon name="arrowRight" className="ic-sm" />
            </Button>
          </Link>
        </div>

        {/* Footer Bar matching Reference Image */}
        <footer
          style={{
            marginTop: 60,
            paddingTop: 24,
            borderTop: "1px solid var(--border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12.5,
            color: "var(--text-3)",
            position: "relative",
            zIndex: 2,
          }}
        >
          <div className="row align-center gap12">
            <Logo height={24} />
            <span style={{ fontSize: 12, color: "var(--text-3)", fontFamily: "var(--mono)" }}>
              Engineering Intelligence Platform
            </span>
          </div>

          <div className="row align-center gap20">
            <a href="#product" style={{ color: "var(--text-3)", textDecoration: "none" }}>Product</a>
            <a href="#how-it-works" style={{ color: "var(--text-3)", textDecoration: "none" }}>How it works</a>
            <a href="#value" style={{ color: "var(--text-3)", textDecoration: "none" }}>For Teams</a>
            <Link href="/signup">
              <Button variant="secondary" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}


