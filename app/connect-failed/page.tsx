"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Icon, Logo } from "@/components/ui";

function ConnectFailedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const getReasonText = () => {
    if (reason === "access_denied") {
      return "GitHub authorization was denied. DevMind was not granted access to your account.";
    }
    if (reason === "invalid_csrf_state") {
      return "OAuth state verification failed. The connection request expired or was interrupted.";
    }
    return "We couldn’t complete the OAuth handshake with GitHub. Your access was not granted and no data was read.";
  };

  return (
    <div className="auth-card">
      <div className="card" style={{ borderColor: "rgba(216, 92, 85, 0.4)" }}>
        <div className="state">
          <span className="st-ic" style={{ color: "var(--error)", borderColor: "rgba(216, 92, 85, 0.4)" }}>
            <Icon name="alert" />
          </span>
          <div className="st-title">GitHub connection failed</div>
          <div className="st-sub">{getReasonText()}</div>
          <div className="row gap8 mt16">
            <Link href="/connect" className="btn btn-primary" id="btn-retry">
              Try again
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectFailedPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-left">
        <div className="row">
          <Logo />
          <span className="sb-name">DevMind</span>
        </div>
        <div className="a-quote">
          <p>
            Connecting should take seconds.{" "}
            <em>When it fails, we show you exactly what went wrong.</em>
          </p>
        </div>
      </div>

      <div className="auth-right">
        <Suspense fallback={<div className="auth-card"><p>Loading...</p></div>}>
          <ConnectFailedContent />
        </Suspense>
      </div>
    </div>
  );
}
