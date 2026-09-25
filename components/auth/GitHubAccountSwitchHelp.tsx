"use client";

import React, { useState } from "react";
import { Icon, Modal, Button } from "@/components/ui";

interface GitHubAccountSwitchHelpProps {
  githubAuthHref: string;
}

export function GitHubAccountSwitchHelp({ githubAuthHref }: GitHubAccountSwitchHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-link btn-sm"
        style={{
          alignSelf: "center",
          color: "var(--muted, #8B949E)",
          fontSize: "12px",
          textDecoration: "none",
          cursor: "pointer",
          background: "none",
          border: "none",
          padding: "4px 8px",
        }}
      >
        Use a different GitHub account
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title={
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Icon name="github" />
            <span>Use a different GitHub account</span>
          </span>
        }
        footer={
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="col gap16">
          <p style={{ margin: 0, fontSize: "13px", color: "var(--fg-muted, #8B949E)", lineHeight: 1.5 }}>
            GitHub uses the account currently signed in to <strong>github.com</strong>. To use a different account, switch accounts on GitHub or use a separate browser profile/private window.
          </p>

          <div className="col gap10" style={{ marginTop: "4px" }}>
            <a
              href={githubAuthHref}
              className="btn btn-primary btn-block"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Continue with GitHub
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-block"
              style={{ textAlign: "center", textDecoration: "none" }}
            >
              Switch account on GitHub ↗
            </a>
          </div>

          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid var(--border, #293024)",
              fontSize: "12px",
              color: "var(--fg-muted, #8B949E)",
              lineHeight: 1.4,
            }}
          >
            For a completely separate GitHub session, you can use a private/incognito window.
          </div>
        </div>
      </Modal>
    </>
  );
}
