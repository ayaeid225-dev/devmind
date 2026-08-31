"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Button, useToast } from "@/components/ui";
import { useShell } from "@/lib/shell-context";

const DOC_TYPES = [
  { label: "Architecture", icon: "book" },
  { label: "API", icon: "code" },
  { label: "Module", icon: "modules" },
  { label: "README", icon: "book" },
  { label: "Development Guide", icon: "book" },
  { label: "Testing", icon: "book" },
  { label: "Deployment", icon: "book" },
] as const;

const DOC_SOURCES = [
  { label: "Entire Repository", icon: "git" },
  { label: "Selected Module", icon: "modules" },
  { label: "Selected Files", icon: "file" },
] as const;

const GENERATION_STEPS = [
  "Analyzing repository code",
  "Extracting module boundaries",
  "Retrieving RAG evidence",
  "Synthesizing with Gemini 3.6 Flash",
  "Validating code citations",
];

export default function DocGenPage() {
  const router = useRouter();
  const toast = useToast();
  const { activeRepoId, activeRepo } = useShell();
  const currentRepoId = activeRepoId || activeRepo.name;

  const [selectedType, setSelectedType] = useState<string>("Architecture");
  const [selectedSource, setSelectedSource] = useState<string>("Entire Repository");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [createdDocId, setCreatedDocId] = useState<string | null>(null);

  const startGeneration = async () => {
    setIsGenerating(true);
    setActiveStepIdx(0);
    setIsComplete(false);

    const stepInterval = setInterval(() => {
      setActiveStepIdx((prev) => (prev < GENERATION_STEPS.length - 1 ? prev + 1 : prev));
    }, 1200);

    try {
      const res = await fetch("/api/docgen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docType: selectedType,
          source: selectedSource,
          repositoryId: currentRepoId,
        }),
      });

      const data = await res.json();
      clearInterval(stepInterval);

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to generate documentation");
      }

      setCreatedDocId(data.data.id);
      setIsGenerating(false);
      setIsComplete(true);
      toast("Generated documentation with Gemini 3.6 Flash!", "success");
    } catch (err) {
      clearInterval(stepInterval);
      setIsGenerating(false);
      const msg = err instanceof Error ? err.message : "Failed to generate document";
      toast(msg, "error");
    }
  };

  const resetForm = () => {
    setIsGenerating(false);
    setIsComplete(false);
    setActiveStepIdx(0);
    setCreatedDocId(null);
  };

  if (isComplete) {
    return (
      <div className="fade-up">
        <div className="state" style={{ minHeight: 420 }}>
          <span
            className="st-ic"
            style={{
              color: "var(--success)",
              borderColor: "rgba(139,195,74,.4)",
            }}
          >
            <Icon name="checkCircle" className="ic-lg" />
          </span>
          <div className="st-title">Documentation generated with Gemini 3.6 Flash!</div>
          <div className="st-sub">
            New documentation is grounded in indexed code evidence and saved to your repository docs.
          </div>
          <div className="row gap8 mt16">
            <Button
              variant="primary"
              onClick={() => router.push(createdDocId ? `/app/docs/${createdDocId}` : "/app/docs")}
            >
              <Icon name="book" /> View Documentation
            </Button>
            <Button variant="secondary" onClick={resetForm}>
              <Icon name="refresh" /> Generate another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="fade-up">
        <div className="page-head">
          <h1 className="page-title">Generating Documentation with Gemini AI</h1>
          <p className="page-sub">
            DevMind is analyzing code evidence and synthesizing documentation via Gemini 3.6 Flash.
          </p>
        </div>
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <div className="col gap6" id="gen-steps">
            {GENERATION_STEPS.map((s, idx) => {
              const isActive = idx === activeStepIdx;
              const isPassed = idx < activeStepIdx;

              return (
                <div
                  key={s}
                  className={`gen-step ${isActive || isPassed ? "active" : ""}`}
                >
                  <span className="gs-ic">
                    <Icon name={isPassed ? "check" : "radio"} className="ic-sm" />
                  </span>
                  <span className="grow">{s}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up">
      <div className="page-head">
        <h1 className="page-title">Generate Documentation</h1>
        <p className="page-sub">
          DevMind reads repository code evidence and synthesizes technical documentation via Gemini 3.6 Flash.
        </p>
      </div>

      <div className="row gap8 mb16">
        <Link href="/app/docs">
          <Button variant="ghost" size="sm">
            <Icon name="arrowLeft" className="ic-sm" /> Back to Documentation
          </Button>
        </Link>
      </div>

      <div className="card card-pad mb24">
        <div className="sec-title mb8">Document Type</div>
        <div className="gen-options" id="gen-type">
          {DOC_TYPES.map((t) => (
            <button
              key={t.label}
              type="button"
              className={`gen-opt ${selectedType === t.label ? "sel" : ""}`}
              onClick={() => setSelectedType(t.label)}
            >
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="sec-title mb8 mt24">Select Source</div>
        <div className="gen-options" id="gen-source">
          {DOC_SOURCES.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`gen-opt ${selectedSource === s.label ? "sel" : ""}`}
              onClick={() => setSelectedSource(s.label)}
            >
              <Icon name={s.icon} />
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="mt24" style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" id="gen-run" onClick={startGeneration}>
            Generate with Gemini <Icon name="arrowRight" className="ic-sm" />
          </Button>
        </div>
      </div>
    </div>
  );
}
