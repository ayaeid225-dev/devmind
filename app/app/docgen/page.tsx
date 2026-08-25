"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon, Button } from "@/components/ui";

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
  "Analyzing repository",
  "Understanding structure",
  "Collecting evidence",
  "Generating documentation",
  "Validating references",
];

const STEP_DELAYS = [900, 1200, 1500, 1800, 900];

export default function DocGenPage() {
  const router = useRouter();

  const [selectedType, setSelectedType] = useState<string>("Architecture");
  const [selectedSource, setSelectedSource] = useState<string>("Entire Repository");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState(-1);
  const [isComplete, setIsComplete] = useState(false);

  const startGeneration = () => {
    setIsGenerating(true);
    setActiveStepIdx(0);
    setIsComplete(false);
  };

  useEffect(() => {
    if (!isGenerating || isComplete) return;

    if (activeStepIdx < GENERATION_STEPS.length) {
      const delay = STEP_DELAYS[activeStepIdx] || 1000;
      const timer = setTimeout(() => {
        if (activeStepIdx + 1 < GENERATION_STEPS.length) {
          setActiveStepIdx((prev) => prev + 1);
        } else {
          setIsGenerating(false);
          setIsComplete(true);
        }
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [isGenerating, activeStepIdx, isComplete]);

  const resetForm = () => {
    setIsGenerating(false);
    setIsComplete(false);
    setActiveStepIdx(-1);
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
          <div className="st-title">Documentation generated successfully.</div>
          <div className="st-sub">
            New documentation is evidence-backed and connected to repository sources.
          </div>
          <div className="row gap8 mt16">
            <Button variant="primary" onClick={() => router.push("/app/docs")}>
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
          <h1 className="page-title">Generating Documentation</h1>
          <p className="page-sub">
            DevMind is reading the repository and connecting documentation to source.
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
                    <Icon name={isPassed || isActive ? "check" : "radio"} className="ic-sm" />
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
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Generate Documentation</h1>
        <p className="page-sub">
          DevMind reads the repository and writes evidence-backed documentation
          connected to source.
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
        {/* Document Type Section */}
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

        {/* Source Selection Section */}
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

        {/* Run CTA */}
        <div className="mt24" style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="primary" id="gen-run" onClick={startGeneration}>
            Generate with DevMind <Icon name="arrowRight" className="ic-sm" />
          </Button>
        </div>
      </div>
    </div>
  );
}
