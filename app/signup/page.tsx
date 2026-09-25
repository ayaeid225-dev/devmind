"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Logo, useToast } from "@/components/ui";
import { GitHubAccountSwitchHelp } from "@/components/auth/GitHubAccountSwitchHelp";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const urlError = searchParams.get("error") || searchParams.get("reason");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(urlError || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      toast("Passwords do not match", "error");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword, teamName }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Registration failed");
      }

      toast("Account & Workspace created!", "success");
      router.push("/connect");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account";
      setError(msg);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="ac-title">Create your workspace</h1>
      <p className="ac-sub">Start understanding your codebases in minutes.</p>

      <div className="mt24 col gap8">
        <a href="/api/github/connect?intent=signin&redirect=true" className="btn btn-github btn-lg btn-block">
          <Icon name="github" /> Continue with GitHub
        </a>
        <GitHubAccountSwitchHelp githubAuthHref="/api/github/connect?intent=signin&redirect=true" />
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
              <label className="label">Full name</label>
              <div className="input-wrap">
                <Icon name="users" />
                <input
                  className="input"
                  type="text"
                  placeholder="Sofia Mendes"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>

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
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Confirm password</label>
              <div className="input-wrap">
                <Icon name="lock" />
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Team name</label>
              <div className="input-wrap">
                <Icon name="users" />
                <input
                  className="input"
                  placeholder="Medialab"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                />
              </div>
            </div>

            <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <div className="auth-alt">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        </div>
  );
}

export default function SignupPage() {
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
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
