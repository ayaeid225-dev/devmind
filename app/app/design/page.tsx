"use client";

import React from "react";
import Link from "next/link";
import { Icon, Button } from "@/components/ui";

export default function DesignPage() {
  return (
    <div className="fade-up">
      {/* Page Header */}
      <div className="page-head">
        <h1 className="page-title">Design ↔ Code</h1>
        <p className="page-sub">
          Connecting the design system to the code that implements it — design tokens,
          screen references, and drift detection between UI and source.
        </p>
      </div>

      {/* Coming Soon Card */}
      <div
        className="card card-pad"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "72px 24px",
        }}
      >
        <span className="st-ic">
          <Icon name="puzzle" />
        </span>
        <div className="st-title">Coming soon</div>
        <div className="st-sub" style={{ maxWidth: 480, margin: "8px auto 0" }}>
          Design ↔ Code is on the way. Soon you’ll be able to trace every screen and
          design token back to the exact source file.
        </div>
        <Link href="/app/docs">
          <Button variant="secondary" className="mt16">
            <Icon name="book" className="ic-sm" /> Browse Documentation meanwhile
          </Button>
        </Link>
      </div>
    </div>
  );
}
