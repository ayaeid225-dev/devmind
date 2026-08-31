"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, Switch, Modal, useToast } from "@/components/ui";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

interface GitHubAccountStatus {
  connected: boolean;
  login?: string;
  name?: string;
  avatarUrl?: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [githubStatus, setGithubStatus] = useState<GitHubAccountStatus>({ connected: false });
  const [loading, setLoading] = useState(true);

  const [pushNotifs, setPushNotifs] = useState(true);
  const [autoReindex, setAutoReindex] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);

  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [meRes, ghRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/github/status"),
        ]);
        const meData = await meRes.json();
        const ghData = await ghRes.json();

        if (meData.success && meData.user) {
          setUser(meData.user);
        }
        if (ghData.success && ghData.connected) {
          setGithubStatus(ghData);
        } else {
          setGithubStatus({ connected: false });
        }
      } catch {
        toast("Failed to load settings", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);

  const handleRevokeAccess = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/github/disconnect", { method: "POST" });
      const data = await res.json();
      setDisconnecting(false);
      setIsRevokeModalOpen(false);

      if (data.success) {
        setGithubStatus({ connected: false });
        toast("GitHub account disconnected successfully", "info");
        setTimeout(() => {
          router.push("/connect");
        }, 700);
      } else {
        toast(data.error || "Failed to disconnect GitHub account", "error");
      }
    } catch {
      setDisconnecting(false);
      setIsRevokeModalOpen(false);
      toast("Error disconnecting GitHub account", "error");
    }
  };

  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">Workspace, connections, and preferences.</p>
      </div>

      {/* Profile Card */}
      <div className="card mb16">
        <div className="card-header">
          <div className="sec-title">Profile</div>
        </div>
        <div className="set-row">
          <span className="set-ic">
            <Icon name="user" />
          </span>
          <span className="grow">
            <div className="set-t">{user?.name || "Authenticated User"}</div>
            <div className="set-s">{user?.email || "user@domain.com"}</div>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast("Profile settings updated", "info")}
          >
            Saved
          </Button>
        </div>
      </div>

      {/* Connected Repositories Card */}
      <div className="card mb16">
        <div className="card-header">
          <div className="sec-title">Connected GitHub Account</div>
          <div className="sec-sub">Official OAuth Integration</div>
        </div>
        {loading ? (
          <div className="set-row">
            <span className="t3 small">Checking connection status...</span>
          </div>
        ) : githubStatus.connected ? (
          <div className="set-row">
            <span className="set-ic" style={{ color: "var(--brand)" }}>
              <Icon name="git" />
            </span>
            <span className="grow">
              <div className="set-t mono">@{githubStatus.login}</div>
              <div className="set-s">Verified OAuth Connection • Repositories Access Granted</div>
            </span>
            <Badge variant="success" small dot>
              Connected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              id="set-remove"
              onClick={() => setIsRevokeModalOpen(true)}
              style={{ color: "var(--error)" }}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="set-row">
            <span className="set-ic" style={{ color: "var(--text-3)" }}>
              <Icon name="git" />
            </span>
            <span className="grow">
              <div className="set-t mono">No GitHub account connected</div>
              <div className="set-s">Connect your GitHub account via official OAuth 2.0 to access repositories</div>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/connect")}
            >
              Connect GitHub
            </Button>
          </div>
        )}
      </div>

      {/* Preferences Card */}
      <div className="card mb16">
        <div className="card-header">
          <div className="sec-title">Preferences</div>
        </div>
        <div className="set-row">
          <span className="set-ic">
            <Icon name="bell" />
          </span>
          <span className="grow">
            <div className="set-t">Push notifications</div>
            <div className="set-s">New analyses, weekly digest</div>
          </span>
          <Switch
            checked={pushNotifs}
            onCheckedChange={setPushNotifs}
            ariaLabel="Push notifications"
          />
        </div>
        <div className="set-row">
          <span className="set-ic">
            <Icon name="git" />
          </span>
          <span className="grow">
            <div className="set-t">Auto re-index on push</div>
            <div className="set-s">Keep the intelligence map current</div>
          </span>
          <Switch
            checked={autoReindex}
            onCheckedChange={setAutoReindex}
            ariaLabel="Auto re-index on push"
          />
        </div>
        <div className="set-row">
          <span className="set-ic">
            <Icon name="eye" />
          </span>
          <span className="grow">
            <div className="set-t">Show code evidence to teammates</div>
            <div className="set-s">
              Evidence links are visible to all workspace members
            </div>
          </span>
          <Switch
            checked={showEvidence}
            onCheckedChange={setShowEvidence}
            ariaLabel="Show code evidence to teammates"
          />
        </div>
      </div>

      {/* Danger Zone Card */}
      <div className="card" style={{ borderColor: "rgba(216,92,85,.3)" }}>
        <div className="card-header">
          <div className="sec-title" style={{ color: "var(--error)" }}>
            Danger zone
          </div>
        </div>
        <div className="set-row">
          <span className="set-ic" style={{ color: "var(--error)" }}>
            <Icon name="alert" />
          </span>
          <span className="grow">
            <div className="set-t">Disconnect GitHub account</div>
            <div className="set-s">
              Revoke GitHub OAuth token and disconnect your account from DevMind.
            </div>
          </span>
          <Button
            variant="danger"
            size="sm"
            id="set-revoke"
            onClick={() => setIsRevokeModalOpen(true)}
            disabled={!githubStatus.connected}
          >
            Disconnect GitHub
          </Button>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Disconnect GitHub account?"
      >
        <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>
          DevMind will remove your stored OAuth token and disconnect your GitHub account.
          You can reconnect anytime from the Connect page.
        </p>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            onClick={() => setIsRevokeModalOpen(false)}
            disabled={disconnecting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            id="revoke-yes"
            onClick={handleRevokeAccess}
            disabled={disconnecting}
          >
            {disconnecting ? "Disconnecting..." : "Disconnect GitHub"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
