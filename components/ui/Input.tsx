"use client";

import type { InputHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  icon?: IconName;
  error?: boolean;
}

/*
 * Ported from the prototype's field markup:
 *   <div class="field"><label class="label">…</label>
 *     <div class="input-wrap"><span class="ic">…</span><input class="input"></div>
 *     <div class="hint">…</div></div>
 */
export function Input({ label, hint, icon, error, id, className, ...rest }: InputProps) {
  const input = <input id={id} className={cx("input", error && "is-error", className)} {...rest} />;

  const wrapped = icon ? (
    <div className="input-wrap">
      <Icon name={icon} />
      {input}
    </div>
  ) : (
    input
  );

  if (!label && !hint) return wrapped;

  return (
    <div className="field">
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {wrapped}
      {hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}
