"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./Icon";

export type ToastType = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  msg: string;
  type: ToastType;
  closing: boolean;
}

const TOAST_ICON: Record<ToastType, IconName> = {
  success: "checkCircle",
  error: "alert",
  info: "info",
};

type PushToast = (msg: string, type?: ToastType) => void;

const ToastContext = createContext<PushToast>(() => {});

let nextId = 1;

/*
 * Ported from U.toast(): appends .toast.toast-{type} into #toast-root with
 * icon + message + close button; auto-closes after 3400ms, fading opacity
 * over .2s before removal.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((ts) =>
        ts.map((t) => (t.id === id ? { ...t, closing: true } : t))
      );
      window.setTimeout(() => remove(id), 200);
    },
    [remove]
  );

  const push = useCallback<PushToast>(
    (msg, type = "success") => {
      const id = nextId++;
      setToasts((ts) => [...ts, { id, msg, type, closing: false }]);
      window.setTimeout(() => dismiss(id), 3400);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div id="toast-root">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            style={t.closing ? { opacity: 0, transition: "opacity .2s" } : undefined}
          >
            <span className="t-ic">
              <Icon name={TOAST_ICON[t.type]} />
            </span>
            <span className="t-msg">{t.msg}</span>
            <button className="t-close" onClick={() => dismiss(t.id)}>
              <Icon name="close" size="sm" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  return useContext(ToastContext);
}
