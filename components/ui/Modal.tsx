"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "./Button";
import { Icon } from "./Icon";
import { cx } from "./cx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: "md" | "lg";
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/*
 * Ported from U.modal(): renders into #modal-root (.open shows it), with
 * .modal-backdrop + .modal(.modal-lg). Backdrop click and Escape close;
 * the head close button mirrors [data-close-modal] buttons.
 */
export function Modal({ open, onClose, size = "md", title, footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div id="modal-root" className="open">
      <div className="modal-backdrop" onClick={onClose} />
      <div className={cx("modal", size === "lg" && "modal-lg")}>
        {title != null && (
          <div className="modal-head">
            <h3>{title}</h3>
            <Button variant="ghost" icon onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </Button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer != null && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
