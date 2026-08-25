import type { CSSProperties } from "react";
import { cx } from "./cx";

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cx("sk", className)} style={style} />;
}
