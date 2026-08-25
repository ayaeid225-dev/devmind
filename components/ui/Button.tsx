"use client";

import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "link"
  | "github";

export type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
  link: "btn-link",
  github: "btn-github",
};

const SIZE_CLASS: Record<ButtonSize, string | null> = {
  sm: "btn-sm",
  md: null,
  lg: "btn-lg",
  xl: "btn-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: boolean;
}

export function Button({
  variant = "secondary",
  size = "md",
  block = false,
  icon = false,
  type,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={cx(
        "btn",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        block && "btn-block",
        icon && "btn-icon",
        className
      )}
      {...rest}
    />
  );
}
