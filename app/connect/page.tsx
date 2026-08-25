"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Logo, useToast } from "@/components/ui";

export default function ConnectPage() {
  const router = useRouter();
  const toast = useToast();

  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/github/status");
        const data = await res.json();
        if (data.success && data.connected) {
          setConnected(true);
          setGithubLogin(data.login || "anjali");
        }
      } catch {
        // use default state
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/github/connect");
      const data = await res.json();

      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        // Fallback demo simulation if API returns standard simulation endpoint
        setTimeout(() => {
          setConnected(true);
          setGithubLogin("anjali");
          setConnecting(false);
          toast("GitHub connected", "success");
          router.push("/repos");
        }, 1200);
      }
    } catch {
      setConnecting(false);
      router.push("/connect-failed");
    }
  };

  const handleSimulateFailure = () => {
    router.push("/connect-failed");
  };

  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="row">
          <Logo />
          <span className="sb-name">DevMind</span>
        </div>
        <div className="a-quote">
          <p>
            DevMind reads your repository the way a senior engineer does —{" "}
            <em>structure, relationships, and intent.</em>
          </p>
          <div className="a-who">
            <span
              className="tb-avatar"
              style={{
                background: "#C8D62B",
                display: "grid",
                placeItems: "center",
                fontSize: "11px",
                color: "#0c0e08",
                fontWeight: 600,
              }}
            >
              MC
            </span>
            <span>
              <b>Marcus Chen</b>
              <span>Tech Lead, Medialab</span>
            </span>
          </div>
        </div>
        <div className="a-proof">
          <Icon name="lock" className="ic-sm" /> Read-only access. Revoke anytime.
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h1 className="ac-title">Connect your GitHub</h1>
          <p className="ac-sub">
            Give DevMind access to your repositories so it can understand your project’s structure, dependencies, and relationships.
          </p>

          <div className="mt24">
            {loadingStatus ? (
              <div className="card card-pad">
                <p className="t3">Checking GitHub connection status...</p>
              </div>
            ) : connected ? (
              <div className="card card-pad row gap12 align-center">
                <span style={{ color: "var(--success)" }}>
                  <Icon name="checkCircle" />
                </span>
                <span className="grow">
                  <b style={{ fontSize: 13 }}>Connected as @{githubLogin}</b>
                  <div className="t3 small">medialab · 4 repositories available</div>
                </span>
                <Link href="/repos" className="btn btn-secondary btn-sm">
                  Continue
                </Link>
              </div>
            ) : (
              <button
                className={`btn btn-github btn-lg btn-block ${connecting ? "btn-ghost" : ""}`}
                id="btn-connect"
                disabled={connecting}
                onClick={handleConnect}
              >
                <Icon name="github" />
                <span id="connect-label">{connecting ? "Connecting…" : "Connect GitHub"}</span>
              </button>
            )}
          </div>

          {!connected && (
            <div className="mt16">
              <div className="divider-row">
                <span>OR</span>
              </div>
              <Link href="/repos" className="btn btn-secondary btn-lg btn-block">
                I’ll use the demo workspace
              </Link>
            </div>
          )}

          <div className="row gap8 mt24" style={{ justifyContent: "center" }}>
            <span className="t3 tiny">
              <Icon name="shield" className="ic-sm" /> Your repository access is protected. OAuth 2.0, encrypted at rest.
            </span>
          </div>

          {!connected && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button
                className="btn btn-link btn-sm"
                id="btn-fail"
                onClick={handleSimulateFailure}
              >
                Simulate a connection issue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
