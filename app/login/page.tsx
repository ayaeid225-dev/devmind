"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Logo, useToast } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const rawNext = searchParams.get("next") || "/app/overview";
  const nextRoute = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\") ? rawNext : "/app/overview";

  const [email, setEmail] = useState("anjali@medialab.dev");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <div className="auth-card">
      <h1 className="ac-title">Welcome back</h1>
      <p className="ac-sub">Sign in to access your project intelligence.</p>

      <div className="mt24">
        <Link href="/connect" className="btn btn-github btn-lg btn-block">
          <Icon name="github" /> Continue with GitHub
        </Link>
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
          <button
            type="button"
            className="btn btn-link btn-sm"
            onClick={() => toast("Password reset link sent to work email", "info")}
          >
            Forgot password?
          </button>
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
