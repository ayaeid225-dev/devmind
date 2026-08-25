import type { CSSProperties } from "react";
import { cx } from "./cx";

export interface ProgressBarProps {
  value: number;
  height?: number;
  className?: string;
}

/* Ported from .progress > span: fill via scaleX transform, transition .4s. */
export function ProgressBar({ value, height, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const style: CSSProperties | undefined = height != null ? { height } : undefined;
  return (
    <div className={cx("progress", className)} style={style}>
      <span style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}
