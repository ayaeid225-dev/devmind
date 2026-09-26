"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export interface DropdownItem {
  kind?: "item" | "sep" | "label" | "custom";
  label?: React.ReactNode;
  icon?: string;
  value?: string;
  pick?: string;
  node?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect?: (pick: string) => void;
  /** Stretch the trigger wrapper full-width (sidebar repo card). */
  block?: boolean;
  /** Align menu to left or right of the anchor trigger. */
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  block,
  align,
  className,
}: DropdownProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [pos, setPos] = useState<{
    top: number;
    left?: number;
    right?: number;
  } | null>(null);

  const open = pos !== null;

  const close = useCallback(() => setPos(null), []);

  const show = useCallback(() => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;

    if (align === "right" || r.left + 260 > window.innerWidth) {
      setPos({
        top: r.bottom + 6,
        right: Math.max(8, window.innerWidth - r.right),
      });
    } else {
      setPos({
        top: r.bottom + 6,
        left: Math.max(8, r.left),
      });
    }
  }, [align]);

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        !anchorRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    const onResize = () => {
      show();
    };

    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onMouseDown);
    }, 0);

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close, show]);

  const handleTriggerClick = () => {
    if (open) {
      close();
    } else {
      show();
    }
  };

  return (
    <span
      ref={anchorRef}
      className={className}
      style={block ? { display: "block" } : undefined}
    >
      <span onClick={handleTriggerClick} style={{ cursor: "pointer" }}>
        {trigger}
      </span>

      {open && pos && (
        <div
          ref={menuRef}
          className="menu"
          style={{
            position: "fixed",
            top: pos.top,
            ...(pos.right !== undefined
              ? { right: pos.right }
              : { left: pos.left }),
          }}
        >
          {items.map((it, i) => {
            if (it.kind === "sep") {
              return <div key={i} className="menu-sep" />;
            }

            if (it.kind === "label") {
              return (
                <div key={i} className="menu-label">
                  {it.label}
                </div>
              );
            }

            if (it.kind === "custom") {
              return (
                <React.Fragment key={i}>
                  {it.node}
                </React.Fragment>
              );
            }

            const pick = it.pick ?? it.value;

            return (
              <div
                key={it.value ?? it.pick ?? i}
                className={`menu-item${it.disabled ? " disabled" : ""}`}
                onClick={() => {
                  if (it.disabled) return;

                  if (pick !== undefined) {
                    onSelect?.(pick);
                  }

                  close();
                }}
              >
                {it.icon && <span>{it.icon}</span>}
                <span>{it.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </span>
  );
}