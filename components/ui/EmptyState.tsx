import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/* Ported from .state markup: st-ic + st-title + st-sub. */
export function EmptyState({ icon, title, sub, children, className }: EmptyStateProps) {
  return (
    <div className={cx("state", className)}>
      {icon ? (
        <span className="st-ic">
          <Icon name={icon} />
        </span>
      ) : null}
      <div className="st-title">{title}</div>
      {sub ? <div className="st-sub">{sub}</div> : null}
      {children}
    </div>
  );
}
