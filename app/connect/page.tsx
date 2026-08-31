"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, Logo, useToast, Button } from "@/components/ui";

export default function ConnectPage() {
  const toast = useToast();

  const [connected, setConnected] = useState(false);
  const [githubLogin, setGithubLogin] = useState<string | null>(null);
  const [githubName, setGithubName] = useState<string | null>(null);
  const [githubAvatar, setGithubAvatar] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/github/status");
        const data = await res.json();
        if (data.success && data.connected) {
          setConnected(true);
          setGithubLogin(data.login);
          setGithubName(data.name);
          setGithubAvatar(data.avatarUrl);
        } else {
          setConnected(false);
          setGithubLogin(null);
        }
      } catch {
        setConnected(false);
      } finally {
        setLoadingStatus(false);
      }
    }
    checkStatus();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/github/connect");
      const data = await res.json();

      if (res.ok && data.success && data.url) {
        window.location.href = data.url;
      } else {
        setConnecting(false);
        const errStr = data.error || "Failed to initiate GitHub OAuth connection.";
        setErrorMessage(errStr);
        toast(errStr, "error");
      }
    } catch {
      setConnecting(false);
      const errStr = "Error reaching server. Please check your network connection.";
      setErrorMessage(errStr);
      toast(errStr, "error");
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/github/disconnect", { method: "POST" });
      const data = await res.json();
      setDisconnecting(false);

      if (data.success) {
        setConnected(false);
        setGithubLogin(null);
        setGithubName(null);
        setGithubAvatar(null);
        toast("GitHub account disconnected", "info");
      } else {
        toast(data.error || "Failed to disconnect GitHub account", "error");
      }
    } catch {
      setDisconnecting(false);
      toast("Error disconnecting GitHub account", "error");
    }
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
          <Icon name="lock" className="ic-sm" /> Read-only access. Disconnect anytime.
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">
          <h1 className="ac-title">Connect your GitHub</h1>
          <p className="ac-sub">
            Give DevMind access to your repositories so it can understand your project’s structure, dependencies, and relationships.
          </p>

          {errorMessage && (
            <div
              className="mt16"
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                background: "rgba(216, 92, 85, 0.15)",
                border: "1px solid rgba(216, 92, 85, 0.4)",
                color: "var(--error)",
                fontSize: "13px",
              }}
            >
              {errorMessage}
            </div>
          )}

          <div className="mt24">
            {loadingStatus ? (
              <div className="card card-pad">
                <p className="t3">Checking GitHub connection status...</p>
              </div>
            ) : connected ? (
              <div className="card card-pad col gap12">
                <div className="row gap12 align-center">
                  {githubAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={githubAvatar}
                      alt={githubLogin || "Avatar"}
                      style={{ width: 36, height: 36, borderRadius: "50%" }}
                    />
                  ) : (
                    <span style={{ color: "var(--success)" }}>
                      <Icon name="checkCircle" />
                    </span>
                  )}
                  <span className="grow">
                    <b style={{ fontSize: 13 }}>
                      Connected as @{githubLogin} {githubName ? `(${githubName})` : ""}
                    </b>
                    <div className="t3 small">Verified GitHub OAuth Connection</div>
                  </span>
                </div>
                <div className="row gap8 mt8">
                  <Link href="/repos" className="btn btn-secondary btn-sm grow">
                    Continue to Repositories
                  </Link>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect GitHub"}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                className={`btn btn-github btn-lg btn-block ${connecting ? "btn-ghost" : ""}`}
                id="btn-connect"
                disabled={connecting}
                onClick={handleConnect}
              >
                <Icon name="github" />
                <span id="connect-label">{connecting ? "Connecting to GitHub…" : "Connect GitHub"}</span>
              </button>
            )}
          </div>

          {!connected && (
            <div className="mt16">
              <div className="divider-row">
                <span>OR</span>
              </div>
              <Link href="/repos" className="btn btn-secondary btn-lg btn-block">
                Continue to Repositories
              </Link>
            </div>
          )}

          <div className="row gap8 mt24" style={{ justifyContent: "center" }}>
            <span className="t3 tiny">
              <Icon name="shield" className="ic-sm" /> Your repository access is protected. Official OAuth 2.0 protocol.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
