"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icon";
import { cx } from "./cx";

export type DropdownItem =
  | { kind?: "item"; pick?: string; icon?: IconName; label: ReactNode }
  | { kind: "sep" }
  | { kind: "label"; label: ReactNode }
  | { kind: "custom"; node: ReactNode };

export interface DropdownProps {
  trigger: ReactElement;
  items: readonly DropdownItem[];
  onSelect?: (pick: string) => void;
  /** Stretch the trigger wrapper full-width (sidebar repo card). */
  block?: boolean;
  className?: string;
}

/*
 * Ported from U.dropdown(): positions a .menu below the anchor at
 * top = bottom+6, left = min(anchor.left + 240, innerWidth - 8);
 * closes on outside mousedown (listener attached on next tick).
 */
export function Dropdown({
  trigger,
  items,
  onSelect,
  block,
  className,
}: DropdownProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = pos !== null;

  const close = useCallback(() => setPos(null), []);

  const show = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      top: r.bottom + 6,
      left: Math.min(r.left + 240, window.innerWidth - 8),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (ev: MouseEvent) => {
      const t = ev.target as Node;
      if (!menuRef.current?.contains(t) && !anchorRef.current?.contains(t)) {
        close();
      }
    };
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", outside);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", outside);
    };
  }, [open, close]);

  const triggerEl = trigger as ReactElement;

  return (
    <>
      <span
        ref={anchorRef}
        className={cx("dm-dropdown-anchor", className)}
        style={block ? { display: "block", width: "100%" } : { display: "inline-flex" }}
        onClick={() => (open ? close() : show())}
      >
        {triggerEl}
      </span>
      {open && (
        <div
          ref={menuRef}
          className="menu"
          style={{ position: "fixed", top: pos.top, left: pos.left }}
        >
          {items.map((it, i) => {
            if (it.kind === "sep") return <div key={i} className="menu-sep" />;
            if (it.kind === "label")
              return (
                <div key={i} className="menu-label">
                  {it.label}
                </div>
              );
            if (it.kind === "custom") return <Fragment key={i}>{it.node}</Fragment>;
            return (
              <button
                key={`${i}-${it.pick ?? "item"}`}
                type="button"
                className="menu-item"
                onClick={() => {
                  close();
                  if (it.pick !== undefined) onSelect?.(it.pick);
                }}
              >
                {it.icon ? <Icon name={it.icon} /> : null}
                {it.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
