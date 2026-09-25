"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Logo, useToast } from "@/components/ui";
import { GitHubAccountSwitchHelp } from "@/components/auth/GitHubAccountSwitchHelp";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const rawNext = searchParams.get("next") || "/app/overview";
  const nextRoute = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/app/overview";

  const urlError = searchParams.get("error") || searchParams.get("reason");
  const isLoggedOut = searchParams.get("logged_out") === "true";
  const [showLoggedOutNotice, setShowLoggedOutNotice] = useState(isLoggedOut);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed");
      }

      toast("Signed in successfully", "success");
      router.push(nextRoute);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const githubAuthHref = `/api/github/connect?intent=signin&redirect=true${
    nextRoute !== "/app/overview" ? `&returnTo=${encodeURIComponent(nextRoute)}` : ""
  }`;

  return (
    <div className="auth-card">
      <h1 className="ac-title">Welcome back</h1>
      <p className="ac-sub">Sign in to access your project intelligence.</p>

      {showLoggedOutNotice && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 14px",
            borderRadius: "6px",
            background: "rgba(139, 195, 74, 0.12)",
            border: "1px solid rgba(139, 195, 74, 0.3)",
            color: "#C8D62B",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon name="check" className="ic-sm" />
            <span>You&apos;ve been signed out of DevMind.</span>
          </div>
          <button
            type="button"
            onClick={() => setShowLoggedOutNotice(false)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: "14px",
              padding: "0 4px",
              opacity: 0.8,
            }}
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt24 col gap8">
        <a href={githubAuthHref} className="btn btn-github btn-lg btn-block">
          <Icon name="github" /> Continue with GitHub
        </a>
        <GitHubAccountSwitchHelp githubAuthHref={githubAuthHref} />
      </div>

      <div className="divider-row">
        <span>OR</span>
      </div>

      {error && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: "rgba(216, 92, 85, 0.15)",
            border: "1px solid rgba(216, 92, 85, 0.4)",
            color: "var(--error)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      <form id="auth-form" className="col gap16" onSubmit={handleSubmit}>
        <div className="field">
          <label className="label">Work email</label>
          <div className="input-wrap">
            <Icon name="mail" />
            <input
              className="input"
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="field">
          <label className="label">Password</label>
          <div className="input-wrap">
            <Icon name="lock" />
            <input
              className="input"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="row between">
          <Link href="/forgot-password" className="btn btn-link btn-sm">
            Forgot password?
          </Link>
        </div>

        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div className="auth-alt">
        New to DevMind? <Link href="/signup">Create an account</Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="row">
          <Logo />
          <span className="sb-name">DevMind</span>
        </div>
        <div className="a-quote">
          <p>
            Before DevMind, I spent my first week piecing together how our booking flow worked.{" "}
            <em>Now it takes an afternoon.</em>
          </p>
          <div className="a-who">
            <span
              className="tb-avatar"
              style={{
                background: "#62C4C7",
                display: "grid",
                placeItems: "center",
                fontSize: "11px",
                color: "#0c0e08",
                fontWeight: 600,
              }}
            >
              SM
            </span>
            <span>
              <b>Sofia Mendes</b>
              <span>Staff Engineer, Medialab</span>
            </span>
          </div>
        </div>
        <div className="a-proof">
          <Icon name="shield" className="ic-sm" /> SOC 2 · Code never leaves your workspace unencrypted · OAuth only
        </div>
      </div>

      <div className="auth-right">
        <Suspense fallback={<div className="auth-card"><p>Loading...</p></div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
