import type { HTMLAttributes } from "react";
import { cx } from "./cx";

export type BadgeVariant =
  | "lime"
  | "cyan"
  | "blue"
  | "amber"
  | "success"
  | "error"
  | "gray"
  | "outline";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  small?: boolean;
  dot?: boolean;
}

export function Badge({ variant, small, dot, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cx("badge", variant && `badge-${variant}`, small && "badge-sm", className)}
      {...rest}
    >
      {dot ? <span className="dot" /> : null}
      {children}
    </span>
  );
}
