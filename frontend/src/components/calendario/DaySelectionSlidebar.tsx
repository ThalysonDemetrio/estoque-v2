"use client";

import { motion } from "framer-motion";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";

interface KanbanColumn {
  key: string;
  label: string;
}

interface DaySelectionSlidebarProps {
  isOpen: boolean;
  dayKey: string;
  events: any[];
  kanbanCols: KanbanColumn[];
  updatingSolicitacaoId: string | null;
  onClose: () => void;
  onGoCalendar: () => void;
  onSetStatus: (id: string, status: string) => void;
  onOpenDetail: (event: any) => void;
  onOpenChat: (event: any) => void;
}

export function DaySelectionSlidebar({
  isOpen,
  dayKey,
  events,
  kanbanCols,
  updatingSolicitacaoId,
  onClose,
  onGoCalendar,
  onSetStatus,
  onOpenDetail,
  onOpenChat,
}: DaySelectionSlidebarProps) {
  return (
    <SlidebarPanel
      isOpen={isOpen}
      onClose={onClose}
      size="narrow"
      panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
    >
      <SlidebarHeader
        title="Dia Selecionado"
        subtitle={dayKey}
        iconClassName="fa-calendar-check"
        onClose={onClose}
        className="p-8 border-b border-slate-100 dark:border-white/5 relative overflow-hidden shrink-0 bg-white dark:bg-slate-900 flex items-center justify-between"
        titleClassName="text-xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-1"
        subtitleClassName="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1"
      />

      <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
        {events.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <i className="fa-solid fa-calendar-xmark text-2xl mb-2 opacity-30"></i>
            <p className="text-[10px] font-black uppercase tracking-widest">Sem eventos neste dia</p>
          </div>
        ) : (
          events.map((ev, idx) => (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              key={`${ev._kind || "mov"}-${ev.solicitacaoID || ev.movimentacaoID || ev.equipamentoID}-${idx}`}
              className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 group hover:border-indigo-500/30 transition-all"
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                  {ev._kind === "sol" ? "Solicitacao" : ev.tipoMovimentacao}
                </span>
                {ev._kind === "sol" ? (
                  <select
                    value={ev.status}
                    onChange={(e) => onSetStatus(ev.solicitacaoID, e.target.value)}
                    disabled={updatingSolicitacaoId === ev.solicitacaoID}
                    title="Editar status da solicitacao"
                    aria-label="Editar status da solicitacao"
                    className="text-[9px] font-black bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1"
                  >
                    {kanbanCols.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <p className="text-xs font-black text-slate-800 dark:text-slate-200 mb-1 leading-tight">
                {ev._kind === "sol"
                  ? (ev.solicitanteNome || ev.solicitante || "Solicitante")
                  : ([ev.marca, ev.modelo].filter(Boolean).join(" ") || ev.equipamentoID || "Movimentacao")}
              </p>
              <p className="text-[9px] font-medium text-slate-500 dark:text-slate-400">
                {ev._kind === "sol"
                  ? `#${ev.protocolo || ev.solicitacaoID || "S/P"}`
                  : `${ev.tipoEquipamento || "Movimentacao"}${ev.equipamentoID ? ` - ${ev.equipamentoID}` : ""}`}
              </p>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChat(ev)}
                  title="Abrir chat"
                  aria-label="Abrir chat"
                  className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-indigo-500 transition-colors"
                >
                  <i className="fa-solid fa-comment-dots text-xs"></i>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenDetail(ev)}
                  title="Abrir detalhes"
                  aria-label="Abrir detalhes"
                  className="px-3 h-8 rounded-lg bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors"
                >
                  Abrir
                </button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      <SlidebarFooter className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 space-y-2">
        <button
          onClick={onGoCalendar}
          className="w-full py-2 bg-indigo-600 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg"
        >
          Voltar ao Calendario
        </button>
        <p className="text-[9px] text-slate-500 font-bold text-center">Dica: arraste cards no Kanban para atualizar status.</p>
      </SlidebarFooter>
    </SlidebarPanel>
  );
}
