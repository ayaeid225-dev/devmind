"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Badge, Button, Input, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface GitHubRepoItem {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string; avatar_url: string };
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  updated_at: string;
  size: number;
}

interface GitHubAccountStatus {
  connected: boolean;
  login?: string;
  name?: string;
  avatarUrl?: string;
}

export default function ReposPage() {
  const router = useRouter();
  const toast = useToast();
  const { setActiveRepoId, refreshRepositories } = useShell();

  const [status, setStatus] = useState<GitHubAccountStatus>({ connected: false });
  const [repos, setRepos] = useState<GitHubRepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [ingestingRepoId, setIngestingRepoId] = useState<number | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const statusRes = await fetch("/api/github/status");
        const statusData = await statusRes.json();

        if (!ignore) {
          if (statusData.success && statusData.connected) {
            setStatus(statusData);

            const reposRes = await fetch("/api/github/repositories");
            const reposData = await reposRes.json();
            if (!ignore && reposData.success && Array.isArray(reposData.data)) {
              setRepos(reposData.data);
            }
          } else {
            setStatus({ connected: false });
          }
          setLoading(false);
        }
      } catch {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/github/disconnect", { method: "POST" });
      const data = await res.json();
      setDisconnecting(false);

      if (data.success) {
        setStatus({ connected: false });
        setRepos([]);
        toast("GitHub account logged out successfully", "info");
        router.push("/connect");
      } else {
        toast(data.error || "Failed to disconnect GitHub account", "error");
      }
    } catch {
      setDisconnecting(false);
      toast("Error disconnecting GitHub account", "error");
    }
  };

  const handleSelectRepo = async (repo: GitHubRepoItem) => {
    setIngestingRepoId(repo.id);
    try {
      const res = await fetch("/api/repositories/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repo.owner.login,
          repo: repo.name,
          branch: repo.default_branch || "main",
        }),
      });

      const data = await res.json();
      setIngestingRepoId(null);

      if (data.success) {
        // Set activeRepoId in Context & localStorage
        setActiveRepoId(repo.name);
        await refreshRepositories();
        toast(`Repository "${repo.name}" analyzed & selected successfully!`, "success");
        router.push(`/app/overview?repoId=${encodeURIComponent(repo.name)}`);
      } else {
        toast(data.error || "Failed to ingest repository", "error");
      }
    } catch {
      setIngestingRepoId(null);
      toast("Error ingesting repository", "error");
    }
  };

  const filteredRepos = repos.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.language && r.language.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 24px" }} className="fade-up">
      {/* Top Navigation & Status Bar */}
      <div className="card card-pad row between align-center mb24">
        <div className="row gap12 align-center">
          {status.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={status.avatarUrl}
              alt={status.login || "GitHub Avatar"}
              style={{ width: 40, height: 40, borderRadius: "50%" }}
            />
          ) : (
            <span className="repo-ic" style={{ width: 40, height: 40 }}>
              <Icon name="github" />
            </span>
          )}
          <div>
            <div className="row gap8 align-center">
              <b style={{ fontSize: 14 }}>
                {status.connected ? `@${status.login}` : "GitHub Disconnected"}
              </b>
              {status.connected && (
                <Badge variant="success" small dot>
                  Connected
                </Badge>
              )}
            </div>
            <div className="t3 small">
              {status.connected
                ? `${repos.length} authenticated GitHub repositories available`
                : "Connect your GitHub account to access your repositories"}
            </div>
          </div>
        </div>

        <div className="row gap8">
          {status.connected ? (
            <Button
              variant="danger"
              size="sm"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <Icon name="close" className="ic-sm" />
              {disconnecting ? "Logging out..." : "Log Out GitHub Account"}
            </Button>
          ) : (
            <Link href="/connect">
              <Button variant="primary" size="sm">
                <Icon name="github" className="ic-sm" /> Connect GitHub
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Header Title */}
      <div className="page-head">
        <h1 className="page-title">Choose a Repository</h1>
        <p className="page-sub">
          Select which project repository you want DevMind to analyze and explore.
        </p>
      </div>

      {/* Search Input */}
      {status.connected && repos.length > 0 && (
        <div className="input-wrap mb24" style={{ maxWidth: 460 }}>
          <Input
            icon="search"
            placeholder="Search your GitHub repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {/* Repositories List */}
      {loading ? (
        <div className="state" style={{ minHeight: 240 }}>
          <div className="st-sub">Fetching your GitHub repositories...</div>
        </div>
      ) : !status.connected ? (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="github" className="ic-lg" />
          </span>
          <div className="st-title">No GitHub account connected</div>
          <div className="st-sub">
            Please connect your GitHub account via official OAuth 2.0 to choose and analyze your repositories.
          </div>
          <div className="mt16">
            <Link href="/connect">
              <Button variant="primary">
                <Icon name="github" className="ic-sm" /> Connect GitHub
              </Button>
            </Link>
          </div>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="state" style={{ minHeight: 320 }}>
          <span className="st-ic">
            <Icon name="file" className="ic-lg" />
          </span>
          <div className="st-title">
            {searchQuery ? "No matching repositories found" : "No repositories found"}
          </div>
          <div className="st-sub">
            {searchQuery
              ? `No repositories matched your search query "${searchQuery}".`
              : "No repositories were returned for your GitHub account."}
          </div>
        </div>
      ) : (
        <div className="col gap12">
          {filteredRepos.map((repo) => {
            const isIngesting = ingestingRepoId === repo.id;
            return (
              <div
                key={repo.id}
                className="card card-pad row between align-center card-hover"
                style={{ gap: 16 }}
              >
                <span className="repo-ic" style={{ width: 40, height: 40 }}>
                  <Icon name={repo.private ? "lock" : "code"} className="ic-sm" />
                </span>

                <div className="grow col gap4">
                  <div className="row gap8 align-center">
                    <b style={{ fontSize: 15 }} className="mono">
                      {repo.full_name}
                    </b>
                    <Badge variant={repo.private ? "amber" : "gray"} small>
                      {repo.private ? "Private" : "Public"}
                    </Badge>
                    {repo.language && (
                      <Badge variant="lime" small>
                        {repo.language}
                      </Badge>
                    )}
                  </div>
                  {repo.description && (
                    <div className="t3 small" style={{ color: "var(--text-2)" }}>
                      {repo.description}
                    </div>
                  )}
                  <div className="t3 tiny row gap12" style={{ color: "var(--text-3)" }}>
                    <span>Default branch: <b className="mono">{repo.default_branch || "main"}</b></span>
                    <span>•</span>
                    <span>Updated: {repo.updated_at ? new Date(repo.updated_at).toLocaleDateString() : "Recently"}</span>
                  </div>
                </div>

                <Button
                  variant="primary"
                  onClick={() => handleSelectRepo(repo)}
                  disabled={isIngesting || Boolean(ingestingRepoId)}
                >
                  {isIngesting ? (
                    "Ingesting & Analyzing..."
                  ) : (
                    <>
                      Analyze &amp; Select <Icon name="arrowRight" className="ic-sm" />
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
