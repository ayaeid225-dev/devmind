"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, Switch, Modal, useToast } from "@/components/ui";

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();

  const [pushNotifs, setPushNotifs] = useState(true);
  const [autoReindex, setAutoReindex] = useState(true);
  const [showEvidence, setShowEvidence] = useState(false);
  const [isRepoConnected, setIsRepoConnected] = useState(true);
  const [isRevokeModalOpen, setIsRevokeModalOpen] = useState(false);

  const handleRemoveRepo = () => {
    setIsRepoConnected(false);
    toast("Removed clinic-management from this workspace", "info");
  };

  const handleRevokeAccess = () => {
    setIsRevokeModalOpen(false);
    toast("GitHub access revoked", "info");
    setTimeout(() => {
      router.push("/connect");
    }, 700);
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
            <div className="set-t">Anjali Rao</div>
            <div className="set-s">anjali@medialab.dev</div>
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast("Profile edit saved", "info")}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Connected Repositories Card */}
      <div className="card mb16">
        <div className="card-header">
          <div className="sec-title">Connected repositories</div>
          <div className="sec-sub">medialab</div>
        </div>
        {isRepoConnected ? (
          <div className="set-row">
            <span className="set-ic" style={{ color: "var(--brand)" }}>
              <Icon name="git" />
            </span>
            <span className="grow">
              <div className="set-t mono">clinic-management</div>
              <div className="set-s">Analyzed • re-indexes on every push</div>
            </span>
            <Badge variant="success" small dot>
              Connected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              id="set-remove"
              onClick={handleRemoveRepo}
            >
              Remove
            </Button>
          </div>
        ) : (
          <div className="set-row">
            <span className="set-ic" style={{ color: "var(--text-3)" }}>
              <Icon name="git" />
            </span>
            <span className="grow">
              <div className="set-t mono">No repositories connected</div>
              <div className="set-s">Connect a GitHub repository to begin indexing</div>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push("/connect")}
            >
              Connect Repository
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
            <div className="set-t">Revoke GitHub access</div>
            <div className="set-s">
              DevMind will stop receiving repository data.
            </div>
          </span>
          <Button
            variant="danger"
            size="sm"
            id="set-revoke"
            onClick={() => setIsRevokeModalOpen(true)}
          >
            Revoke access
          </Button>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={isRevokeModalOpen}
        onClose={() => setIsRevokeModalOpen(false)}
        title="Revoke GitHub access?"
      >
        <p style={{ color: "var(--text-2)", fontSize: 13, lineHeight: 1.6 }}>
          DevMind will lose the ability to read repositories for <b>medialab</b>.
          Your intelligence map and history remain, but re-indexing stops until you
          reconnect.
        </p>
        <div className="modal-foot mt16" style={{ justifyContent: "flex-end" }}>
          <Button
            variant="secondary"
            onClick={() => setIsRevokeModalOpen(false)}
          >
            Keep access
          </Button>
          <Button
            variant="danger"
            id="revoke-yes"
            onClick={handleRevokeAccess}
          >
            Yes, revoke
          </Button>
        </div>
      </Modal>
    </div>
  );
}
