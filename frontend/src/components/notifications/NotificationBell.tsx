"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNotifications } from "@/contexts/NotificationContext";
import { useRouter } from "next/navigation";

function formatTimestamp(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function NotificationBell() {
  const { alerts, unread, critical, loading, markAllRead, dismissAlert, dismissAll, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler, { capture: true });
    return () => document.removeEventListener("mousedown", handler, { capture: true });
  }, [open]);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) {
      refresh();
      setTimeout(markAllRead, 1500);
    }
  };

  const handleNavigate = (alert: any) => {
    setOpen(false);
    if (alert.path) {
      router.push(alert.path);
    } else if (alert.equipmentId) {
      router.push(`/equipamentos?search=${encodeURIComponent(alert.equipmentId)}`);
    }
  };

  const typeStyle: Record<string, string> = {
    critical: "border-l-red-500",
    warning:  "border-l-amber-500",
    info:     "border-l-blue-500",
  };

  const typeIconStyle: Record<string, string> = {
    critical: "text-red-400",
    warning:  "text-amber-400",
    info:     "text-blue-400",
  };

  const typeTitle: Record<string, string> = {
    critical: "Crítico",
    warning: "Atenção",
    info: "Informação",
  };

  return (
    <div className="relative" style={{ zIndex: open ? 99999 : 50 }} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 group ${
          open ? "shadow-nm-inset bg-surface-soft" : "shadow-nm-flat bg-surface hover:shadow-nm-flat-hover"
        }`}
        title="Notificações"
      >
        <i className={`fa-solid fa-bell text-sm transition-colors ${open ? "text-brand" : "text-text-muted group-hover:text-brand"}`} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white shadow-lg z-10"
              style={{ background: critical > 0 ? "#ef4444" : "#f59e0b" }}
            >
              {unread > 99 ? "99+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="fixed md:absolute left-4 right-4 md:left-auto md:right-0 top-20 md:top-full mt-3 md:w-[400px] max-h-[70vh] md:max-h-[600px] flex flex-col rounded-[2rem] md:rounded-3xl overflow-hidden shadow-2xl md:shadow-nm-flat-lg bg-surface border border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-subtle bg-surface-soft/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
                   <i className="fa-solid fa-bell text-brand text-sm" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-main tracking-tight">Notificações</h3>
                  <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{alerts.length} alerta{alerts.length !== 1 ? 's' : ''} ativo{alerts.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => refresh()}
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-high transition-colors text-text-muted group"
                title="Atualizar"
              >
                <i className={`fa-solid fa-arrows-rotate text-xs group-hover:text-brand ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 bg-surface">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <i className="fa-solid fa-check-circle text-2xl text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Tudo em dia!</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="group relative">
                    <button
                      onClick={() => handleNavigate(alert)}
                      className={`w-full text-left p-4 rounded-2xl transition-all duration-200 shadow-nm-flat bg-surface hover:shadow-nm-flat-hover border-l-4 ${typeStyle[alert.type]}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeIconStyle[alert.type]} bg-current/10 shadow-inner`}>
                          <i className={`fa-solid ${alert.icon || 'fa-circle-info'} text-base`} />
                        </div>
                        <div className="flex-1 min-w-0 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${typeIconStyle[alert.type]}`}>
                              {typeTitle[alert.type]}
                            </span>
                            <span className="text-[10px] text-text-muted font-bold">{formatTimestamp(alert.timestamp)}</span>
                          </div>
                          <h4 className="text-xs font-black text-text-main leading-snug mb-1">{alert.title}</h4>
                          <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">{alert.description}</p>
                        </div>
                      </div>
                    </button>
                    
                    {/* Botão Excluir */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismissAlert(alert.id);
                      }}
                      className="absolute top-3 right-3 w-7 h-7 rounded-lg flex items-center justify-center bg-surface-soft/50 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 hover:text-red-500 text-text-muted z-10"
                      title="Remover"
                    >
                      <i className="fa-solid fa-xmark text-xs" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="px-6 py-4 border-t border-border-subtle bg-surface-soft/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={markAllRead}
                    className="text-[9px] font-black uppercase tracking-widest text-brand hover:text-brand-high transition-colors"
                  >
                    <i className="fa-solid fa-eye mr-2"></i> Marcar Lidos
                  </button>
                  <button
                    onClick={dismissAll}
                    className="text-[9px] font-black uppercase tracking-widest text-error hover:text-error/80 transition-colors"
                  >
                    <i className="fa-solid fa-trash-can mr-2"></i> Limpar Tudo
                  </button>
                </div>
                <i className="fa-solid fa-bell-concierge text-text-muted/20 text-sm" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
