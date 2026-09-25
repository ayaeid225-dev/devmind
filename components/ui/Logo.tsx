import React from "react";
import { cx } from "./cx";

export interface LogoProps {
  className?: string;
  height?: number;
  alt?: string;
}

export function Logo({ className, height = 32, alt = "DevMind AI Logo" }: LogoProps) {
  return (
    <span className={cx("sb-logo-wrap", className)} style={{ display: "inline-flex", alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/devmind-logo.png"
        alt={alt}
        style={{
          height: `${height}px`,
          width: "auto",
          objectFit: "contain",
          display: "block",
        }}
      />
    </span>
  );
}

