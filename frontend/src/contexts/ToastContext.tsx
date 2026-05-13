"use client";

import { createContext, useContext, useState, useCallback, useRef, useMemo } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextValue {
  toast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current[id]);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-4), { id, type, title, message }]);
    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
    return id;
  }, []);

  const success = useCallback((t: string, m?: string) => toast("success", t, m), [toast]);
  const error   = useCallback((t: string, m?: string) => toast("error", t, m), [toast]);
  const warning = useCallback((t: string, m?: string) => toast("warning", t, m), [toast]);
  const info    = useCallback((t: string, m?: string) => toast("info", t, m), [toast]);

  const ICONS: Record<ToastType, string> = {
    success: "fa-circle-check",
    error:   "fa-circle-xmark",
    warning: "fa-triangle-exclamation",
    info:    "fa-circle-info",
  };

  const STYLES: Record<ToastType, string> = {
    success: "border-emerald-500/30 bg-surface text-emerald-700 dark:text-emerald-400 shadow-emerald-500/5",
    error:   "border-red-500/30    bg-surface text-red-700    dark:text-red-400    shadow-red-500/5",
    warning: "border-amber-500/30  bg-surface text-amber-700  dark:text-amber-400  shadow-amber-500/5",
    info:    "border-blue-500/30   bg-surface text-blue-700   dark:text-blue-400   shadow-blue-500/5",
  };

  const ICON_COLORS: Record<ToastType, string> = {
    success: "text-emerald-500",
    error:   "text-red-500",
    warning: "text-amber-500",
    info:    "text-blue-500",
  };

  const value = useMemo(() => ({ toast, success, error, warning, info }), [toast, success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[99999] flex flex-col gap-2 pointer-events-none w-[calc(100vw-32px)] md:w-auto items-end">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-xl w-full md:min-w-[300px] md:max-w-sm backdrop-blur-md
              animate-in slide-in-from-bottom-4 md:slide-in-from-right-4 fade-in duration-300 ${STYLES[t.type]}`}
          >
            <div className={`w-8 h-8 rounded-full ${ICON_COLORS[t.type]} bg-current/10 flex items-center justify-center shrink-0`}>
              <i className={`fa-solid ${ICONS[t.type]} text-sm`}></i>
            </div>
            
            <div className="flex-1 min-w-0 pt-1">
              <p className="font-bold text-strong text-sm leading-tight">{t.title}</p>
              {t.message && <p className="text-xs text-muted mt-1 font-medium">{t.message}</p>}
            </div>

            <button 
              onClick={() => dismiss(t.id)} 
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-strong hover:bg-surface-soft transition-all mt-0.5"
            >
              <i className="fa-solid fa-xmark text-[10px]"></i>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
