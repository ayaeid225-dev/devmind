import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export interface MetricCardProps {
  icon: IconName;
  value: ReactNode;
  label: ReactNode;
  delta?: ReactNode;
  deltaTone?: "up" | "down" | "flat";
  className?: string;
}

/* Ported from app.js metric(): .metric.card.card-pad with value/label/delta. */
export function MetricCard({
  icon,
  value,
  label,
  delta,
  deltaTone,
  className,
}: MetricCardProps) {
  return (
    <div className={cx("metric card card-pad", className)}>
      <div className="row between">
        <div className="metric-value">{value}</div>
        <span className="metric-icon">
          <Icon name={icon} />
        </span>
      </div>
      <div className="metric-label">{label}</div>
      {delta != null && (
        <span className={cx("metric-delta", deltaTone)}>{delta}</span>
      )}
    </div>
  );
}
