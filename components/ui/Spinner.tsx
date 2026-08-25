import { cx } from "./cx";

export interface SpinnerProps {
  size?: number;
  className?: string;
}

/*
 * Ported verbatim from the analyze-step spinner markup:
 *   width:12px;height:12px;border:2px solid rgba(200,214,43,.3);
 *   border-top-color:var(--brand);border-radius:50%;
 *   animation:spin .8s linear infinite;display:block
 */
export function Spinner({ size = 12, className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={cx("dm-spinner", className)}
      style={{
        width: size,
        height: size,
        border: "2px solid rgba(200,214,43,.3)",
        borderTopColor: "var(--brand)",
        borderRadius: "50%",
        animation: "spin .8s linear infinite",
        display: "block",
        flex: "none",
      }}
    />
  );
}
