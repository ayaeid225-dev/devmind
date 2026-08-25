import { Icon } from "./Icon";
import { cx } from "./cx";

export interface LogoProps {
  className?: string;
}

/* Ported from U.logo(): <span class="sb-logo"><svg class="ic ic-lg">…</svg></span> */
export function Logo({ className }: LogoProps) {
  return (
    <span className={cx("sb-logo", className)}>
      <Icon name="logo" size="lg" />
    </span>
  );
}
