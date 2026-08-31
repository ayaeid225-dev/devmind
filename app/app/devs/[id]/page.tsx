"use client";

import React, { use, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon, Button } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

interface DbDeveloper {
  id: string;
  repoId: string;
  name: string;
  role: string;
  color: string;
  coverage: number;
  blurb: string;
  recentContribution: string;
}

function DevDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeRepoId, activeRepo } = useShell();

  const repoId = searchParams.get("repoId") || activeRepoId || activeRepo.name;

  const [dev, setDev] = useState<DbDeveloper | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/devs/${id}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && data.data) {
            setDev(data.data);
          } else {
            setNotFound(true);
          }
        }
      } catch {
        if (!ignore) setNotFound(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="fade-up">
        <div className="state" style={{ minHeight: 320 }}>
          <div className="st-sub">Loading developer profile...</div>
        </div>
      </div>
    );
  }

  if (notFound || !dev) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Developer Not Found</h1>
          <p className="page-sub">No developer profile matches ID &quot;{id}&quot;.</p>
        </div>
        <div className="mt24">
          <Link href={repoId ? `/app/devs?repoId=${encodeURIComponent(repoId)}` : "/app/devs"}>
            <Button variant="primary">
              <Icon name="arrowLeft" className="ic-sm" /> Back to Developer Insights
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const initials = dev.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  const firstName = dev.name.split(" ")[0];

  return (
    <div className="fade-up">
      {/* Developer Hero Card */}
      <div className="card mod-hero">
        <span
          className="dev-av"
          style={{
            width: 52,
            height: 52,
            borderRadius: 13,
            background: dev.color,
            fontSize: 16,
          }}
        >
          {initials}
        </span>
        <div className="grow">
          <h1>{dev.name}</h1>
          <p className="desc">
            {dev.role} • {dev.blurb}
          </p>
          <div className="meta-row">
            <span className="row gap5 align-center">
              <Icon name="spark" className="ic-sm" /> Knowledge coverage {dev.coverage}%
            </span>
            <span className="row gap5 align-center">
              <Icon name="clock" className="ic-sm" /> Recent: {dev.recentContribution}
            </span>
          </div>
        </div>
        <div className="col gap8" style={{ alignItems: "flex-end" }}>
          <Button
            variant="primary"
            onClick={() =>
              router.push(
                `/app/ask?q=${encodeURIComponent(
                  `How does ${dev.name}'s work fit into the architecture?`
                )}`
              )
            }
          >
            <Icon name="ask" /> Ask about {firstName}&apos;s areas
          </Button>
        </div>
      </div>

      {/* DevMind AI Insight Note */}
      <div className="ai-note mt24">
        <span className="ai-ic">
          <Icon name="brain" />
        </span>
        <div>
          <b className="small" style={{ color: "var(--brand)" }}>
            DevMind insight
          </b>
          <p>
            Insights are derived from repository activity, module ownership, and
            documentation authorship — they reflect contribution areas, not performance.
          </p>
        </div>
      </div>

      {/* Row 1: Profile & Stats */}
      <div
        className="mt24"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
      >
        <div className="card">
          <div className="card-header">
            <div className="sec-title">Profile</div>
          </div>
          <div className="card-body col gap8">
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Name</div>
                <div className="fn-sig">{dev.name}</div>
              </span>
            </div>
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Role</div>
                <div className="fn-sig">{dev.role}</div>
              </span>
            </div>
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Repository</div>
                <div className="fn-sig mono">{dev.repoId}</div>
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="sec-title">Contribution Stats</div>
          </div>
          <div className="card-body col gap8">
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Knowledge Coverage</div>
                <div className="fn-sig">{dev.coverage}% of repository documented</div>
              </span>
              <Icon name="spark" className="ic-sm" />
            </div>
            <div className="fn-row">
              <span className="grow">
                <div className="fn-name">Recent Contribution</div>
                <div className="fn-sig">{dev.recentContribution}</div>
              </span>
              <Icon name="log" className="ic-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Ask about this developer */}
      <div className="card mt16">
        <div className="card-header">
          <div className="sec-title">Explore with AI</div>
          <div className="sec-sub">Ask DevMind about this contributor</div>
        </div>
        <div className="card-body row gap8">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/app/ask?q=${encodeURIComponent(`What modules does ${dev.name} own?`)}`)
            }
          >
            <Icon name="ask" className="ic-sm" /> Module ownership
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/app/ask?q=${encodeURIComponent(`What did ${dev.name} contribute recently?`)}`)
            }
          >
            <Icon name="log" className="ic-sm" /> Recent contributions
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              router.push(`/app/ask?q=${encodeURIComponent(`What are ${dev.name}&apos;s technical strengths?`)}`)
            }
          >
            <Icon name="spark" className="ic-sm" /> Technical strengths
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DevDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="fade-up" />}>
      <DevDetailContent params={params} />
    </Suspense>
  );
}
