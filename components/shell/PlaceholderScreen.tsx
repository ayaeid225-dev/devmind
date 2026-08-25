"use client";

import React from "react";
import { Card, CardBody, Badge, EmptyState } from "@/components/ui";

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
  badge?: string;
}

export function PlaceholderScreen({
  title,
  subtitle,
  badge = "Step 3 Placeholder",
}: PlaceholderScreenProps) {
  return (
    <div className="fade-up">
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div className="row gap8 align-center" style={{ marginBottom: 8 }}>
          <Badge variant="lime">{badge}</Badge>
        </div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-sub mono">{subtitle}</p>}
      </div>

      <Card>
        <CardBody style={{ padding: "40px 24px" }}>
          <EmptyState
            title={`${title} Screen`}
            sub="App shell and routing structure active. Screen implementation will follow in Step 4."
          />
        </CardBody>
      </Card>
    </div>
  );
}
