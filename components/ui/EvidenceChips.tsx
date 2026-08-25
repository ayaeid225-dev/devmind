"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export interface EvidenceChip {
  id: string;
  label: string;
  icon?: IconName;
}

export interface EvidenceChipsProps {
  chips: readonly EvidenceChip[];
  onSelect?: (id: string) => void;
  /** 0..1 confidence; renders the .ev-conf bar when truthy (as in aiMsg). */
  conf?: number | null;
  sourcesCount?: number;
  label?: ReactNode;
  labelIcon?: IconName;
  className?: string;
}

/*
 * Ported from the .evidence block in app.js aiMsg(): ev-label + ev-chips
 * (+ optional .ev-conf bar). Doc-hint rows are composed by screens with a
 * second instance using custom label/labelIcon.
 */
export function EvidenceChips({
  chips,
  onSelect,
  conf,
  sourcesCount,
  label = "Evidence · click a source to inspect",
  labelIcon = "code",
  className,
}: EvidenceChipsProps) {
  if (chips.length === 0 && !conf) return null;
  return (
    <div className={cx("evidence", className)}>
      <div className="ev-label">
        <Icon name={labelIcon} size="sm" /> {label}
      </div>
      <div className="ev-chips">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className="ev-chip"
            onClick={() => onSelect?.(c.id)}
          >
            <Icon name={c.icon ?? "file"} size="sm" /> {c.label}
          </button>
        ))}
      </div>
      {conf ? (
        <div className="ev-conf">
          <Icon name="checkCircle" size="sm" /> High confidence — grounded in{" "}
          {sourcesCount ?? chips.length} sources
          <span className="conf-bar">
            <i style={{ width: `${Math.round(conf * 100)}%` }} />
          </span>
        </div>
      ) : null}
    </div>
  );
}
