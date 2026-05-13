"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { SolicitacoesService } from "@/services/solicitacoes.service";
import { EquipamentosService } from "@/services/equipamentos.service";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { DaySelectionSlidebar } from "@/components/calendario/DaySelectionSlidebar";
import { motion, AnimatePresence } from "framer-motion";
import { Movimentacao, Solicitacao, Equipamento } from "@/types";

type CalendarEvent = 
  | (Movimentacao & { _kind?: "mov" })
  | (Solicitacao & { _kind: "sol"; tipoMovimentacao: string; equipamentoID: string; dataHora: string })
  | (Equipamento & { _kind: "pred"; tipoMovimentacao: "predicao"; dataHora: string; equipamentoID: string });

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TIPO_COLORS: Record<string, string> = {
  alocacao:    "bg-blue-500",
  transferencia:"bg-indigo-500",
  devolucao:   "bg-emerald-500",
  manutencao:  "bg-amber-500",
  substituicao:"bg-purple-500",
  predicao:    "bg-red-400 opacity-80 border-2 border-dashed border-red-200 dark:border-red-900/30",
};

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}


export default function CalendarioPage() {
  const router = useRouter();
  const { openChat } = useChat();
  const [viewMode, setViewMode] = useState<"calendar" | "kanban">("calendar");
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState(() => getDayKey(new Date()));
  const [isDaySlidebarOpen, setIsDaySlidebarOpen] = useState(false);
  const [draggingSolicitacaoId, setDraggingSolicitacaoId] = useState<string | null>(null);
  const [updatingSolicitacaoId, setUpdatingSolicitacaoId] = useState<string | null>(null);
  const { hasPermission } = useAuth();
  const toast = useToast();

  const canEdit = useMemo(() => hasPermission("solicitacoes", "edit"), [hasPermission]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [movs, sols, eqs] = await Promise.all([
          MovimentacoesService.getMovimentacoes(),
          SolicitacoesService.getSolicitacoes(),
          EquipamentosService.getEquipamentos(),
        ]);
        setMovimentacoes(Array.isArray(movs) ? movs : []);
        setSolicitacoes(Array.isArray(sols) ? sols : []);
        setEquipamentos(Array.isArray(eqs) ? eqs : []);
      } finally { setLoading(false); }
    })();
  }, []);

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = getDayKey(new Date());

  // Predictive Maintenance Logic
  const predictions = useMemo(() => {
    const list: any[] = [];
    const now = new Date();
    
    equipamentos.forEach(e => {
      if (!e.dataCompra) return;
      const compDate = new Date(e.dataCompra);
      // Prediction: Every 12 months from purchase
      const predDate = new Date(compDate);
      while (predDate < new Date(now.getFullYear(), now.getMonth() + 2, 1)) {
        predDate.setFullYear(predDate.getFullYear() + 1);
        if (predDate.getMonth() === month && predDate.getFullYear() === year) {
          list.push({
            ...e,
            _kind: "pred",
            tipoMovimentacao: "predicao",
            dataHora: predDate.toISOString(),
            equipamentoID: e.etiquetaID
          });
        }
      }
    });
    return list as CalendarEvent[];
  }, [equipamentos, month, year]);

  // Map events by day
  const eventsByDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    [...movimentacoes, ...predictions].forEach((m) => {
      if (!m.dataHora) return;
      const k = getDayKey(new Date(m.dataHora));
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    solicitacoes.forEach((s) => {
      if (!s.dataNecessidade) return;
      const k = getDayKey(new Date(s.dataNecessidade));
      if (!map[k]) map[k] = [];
      map[k].push({
        ...s,
        _kind: "sol",
        tipoMovimentacao: "solicitacao",
        equipamentoID: s.protocolo || s.solicitacaoID,
        dataHora: s.dataNecessidade || "",
      });
    });
    return map;
  }, [movimentacoes, predictions, solicitacoes]);

  const selectedDayEvents = useMemo(() => {
    return eventsByDay[selectedDayKey] || [];
  }, [eventsByDay, selectedDayKey]);

  const getEventTitle = (ev: CalendarEvent) => {
    if ("_kind" in ev && ev._kind === "sol") {
      return ev.solicitanteNome || "Solicitacao";
    }
    const e = ev as any;
    return [e.marca, e.modelo].filter(Boolean).join(" ") || e.equipamentoID || "Movimentacao";
  };

  const getEventSubtitle = (ev: CalendarEvent) => {
    if ("_kind" in ev && ev._kind === "sol") {
      return `#${ev.protocolo || ev.solicitacaoID || "S/P"}`;
    }
    const e = ev as any;
    return `${e.tipoEquipamento || "Movimentacao"}${e.equipamentoID ? ` - ${e.equipamentoID}` : ""}`;
  };

  const openEventChat = (ev: CalendarEvent) => {
    if ("_kind" in ev && ev._kind === "sol") {
      const id = String(ev.solicitacaoID || "");
      if (!id) return;
      openChat("solicitacao", id, `Sol. ${ev.protocolo || id}`);
      return;
    }

    const e = ev as any;
    const id = String(e.movimentacaoID || e.equipamentoID || "");
    if (!id) return;
    openChat("movimentacao", id, `Mov. ${id}`);
  };

  const openEventDetail = (ev: CalendarEvent) => {
    if ("_kind" in ev && ev._kind === "sol") {
      const id = String(ev.solicitacaoID || ev.protocolo || "");
      if (!id) return;
      router.push(`/solicitacoes?open=${encodeURIComponent(id)}`);
      return;
    }

    const e = ev as any;
    const id = String(e.movimentacaoID || "");
    if (!id) return;
    router.push(`/movimentacoes?open=${encodeURIComponent(id)}`);
  };

  const updateSolicitacaoStatus = async (id: string, status: string) => {
    if (!canEdit) {
      toast.error("Permissão negada", "Você não tem permissão para editar solicitações.");
      return;
    }
    const previous = solicitacoes;
    setSolicitacoes((prev) => prev.map((s) => (s.solicitacaoID === id ? { ...s, status } : s)));
    try {
      setUpdatingSolicitacaoId(id);
      await SolicitacoesService.updateStatus(id, status);
      toast.success("Status atualizado", `Solicitacao ${id} movida para ${status}.`);
    } catch (error: any) {
      setSolicitacoes(previous);
      toast.error("Erro ao atualizar", error?.message || "Nao foi possivel atualizar o status.");
    } finally {
      setUpdatingSolicitacaoId(null);
    }
  };

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));
  const openDaySlidebar = (dayKey: string) => {
    setSelectedDayKey(dayKey);
    setIsDaySlidebarOpen(true);
  };
  const goToday = () => {
    const now = new Date();
    setCurrent(now);
    setSelectedDayKey(getDayKey(now));
    setIsDaySlidebarOpen(true);
  };

  const kanbanCols = [
    { key: "pendente",       label: "Pendente",       color: "border-amber-400",   bg: "bg-amber-50" },
    { key: "em_atendimento", label: "Em Atendimento", color: "border-blue-400",    bg: "bg-blue-50" },
    { key: "concluido",      label: "Concluído",      color: "border-emerald-400", bg: "bg-emerald-50" },
    { key: "rejeitado",      label: "Rejeitado",      color: "border-red-400",     bg: "bg-red-50" },
  ];

  const calendarDays: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      {/* Main Content */}
      <div className="space-y-5">
        {/* Toolbar & Panoramic Controls */}
        <div className="bg-surface border border-border-subtle p-4 md:p-5 rounded-[2.5rem] flex flex-wrap gap-4 items-center justify-between shadow-nm-flat transition-all">
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-soft p-1.5 rounded-2xl shadow-nm-inset border border-border-subtle gap-1">
              <button 
                onClick={prevMonth} title="Mês anterior" 
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface transition-all text-muted hover:text-brand"
              >
                <i className="fa-solid fa-chevron-left text-sm"></i>
              </button>
              <button 
                onClick={nextMonth} title="Próximo mês" 
                className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface transition-all text-muted hover:text-brand"
              >
                <i className="fa-solid fa-chevron-right text-sm"></i>
              </button>
            </div>

            <h3 className="text-xl font-black text-strong min-w-[200px] text-center tracking-tighter">
              {MONTHS[month]} <span className="text-brand opacity-80">{year}</span>
            </h3>

            <div className="hidden lg:flex gap-2 ml-4">
              <button 
                onClick={goToday} 
                className="h-11 px-6 rounded-xl bg-surface-soft shadow-nm-inset border border-border-subtle text-[10px] font-black uppercase tracking-widest text-muted hover:text-brand transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-calendar-day text-brand"></i>Hoje
              </button>
              <button
                onClick={() => setIsDaySlidebarOpen(true)}
                className="h-11 px-6 rounded-xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <i className="fa-solid fa-sidebar"></i>Dia Selecionado
              </button>
            </div>
          </div>

          <div className="flex bg-surface-soft p-1.5 rounded-2xl gap-1 shadow-nm-inset border border-border-subtle">
            <button 
              onClick={() => setViewMode("calendar")}
              className={`py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === "calendar" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-muted hover:text-brand"}`}
            >
              <i className="fa-regular fa-calendar text-xs"></i>Calendário
            </button>
            <button 
              onClick={() => setViewMode("kanban")}
              className={`py-2.5 px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === "kanban" ? "bg-brand text-white shadow-lg shadow-brand/20" : "text-muted hover:text-brand"}`}
            >
              <i className="fa-solid fa-table-columns text-xs"></i>Kanban
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-20 flex flex-col items-center gap-4 text-slate-400">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="font-bold text-slate-500 tracking-tight">Sincronizando infraestrutura...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === "calendar" ? (
              <motion.div 
                key="cal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none rounded-3xl overflow-hidden transition-all"
              >
                {/* Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                  {DAYS.map((d) => (
                    <div key={d} className="text-center py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">{d}</div>
                  ))}
                </div>
                {/* Day Cells */}
                <div className="grid grid-cols-7">
                  {calendarDays.map((day, idx) => {
                    const key = day ? `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
                    const events = key ? (eventsByDay[key] || []) : [];
                    const isToday = key === today;
                    return (
                      <div key={idx} className={`min-h-[120px] border-b border-r border-slate-100 dark:border-slate-800 p-2 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group ${!day ? "bg-slate-50/40 dark:bg-slate-950/20" : "bg-white dark:bg-slate-900"}`}>
                        {day && (
                          <div className="h-full flex flex-col">
                            <button
                              type="button"
                              onClick={() => key && openDaySlidebar(key)}
                              title={`Selecionar dia ${day}`}
                              aria-label={`Selecionar dia ${day}`}
                              className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black mb-2 transition-all group-hover:scale-110 ${key === selectedDayKey ? "ring-2 ring-indigo-500" : ""} ${isToday ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-700 dark:text-slate-300 group-hover:text-indigo-500"}`}
                            >
                              {day}
                            </button>
                            <div className="space-y-1 overflow-y-auto custom-scrollbar pr-0.5">
                              {events.map((ev, i) => {
                                const color = TIPO_COLORS[ev.tipoMovimentacao] || "bg-slate-400";
                                const isPred = ev.tipoMovimentacao === "predicao";
                                const isSolicitacao = " _kind" in ev && ev._kind === "sol";
                                return (
                                  <motion.button
                                    type="button"
                                    initial={{ scale: 0.9, opacity: 0 }} 
                                    animate={{ scale: 1, opacity: 1 }}
                                    key={i}
                                    onClick={() => {
                                      if (key) openDaySlidebar(key);
                                      if (isSolicitacao) {
                                        setViewMode("kanban");
                                      }
                                    }}
                                    className={`w-full text-left ${color} text-white text-[9px] font-black rounded-lg px-2 py-1.5 truncate shadow-sm flex items-center gap-1`} 
                                    title={`${getEventTitle(ev)} — ${ev.tipoMovimentacao}`}
                                  >
                                    {isSolicitacao ? <i className="fa-solid fa-ticket text-[7px]"></i> : isPred ? <i className="fa-solid fa-clock-rotate-left"></i> : <i className="fa-solid fa-bolt-lightning text-[7px]"></i>}
                                    {getEventTitle(ev)}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Legend */}
                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/10 flex flex-wrap gap-4">
                  {Object.entries(TIPO_COLORS).map(([tipo, color]) => (
                    <span key={tipo} className="flex items-center gap-2 text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span className={`w-4 h-4 rounded-md shadow-sm ${color} inline-block`}></span>
                      {tipo}
                    </span>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="kan" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 overflow-x-auto pb-8 custom-scrollbar min-h-[600px]"
              >
                {kanbanCols.map((col) => {
                  const items = solicitacoes.filter((s) => s.status === col.key);
                  return (
                    <div
                      key={col.key}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (draggingSolicitacaoId) {
                          updateSolicitacaoStatus(draggingSolicitacaoId, col.key);
                          setDraggingSolicitacaoId(null);
                        }
                      }}
                      className="flex flex-col h-full bg-surface-soft border border-border-subtle rounded-[2.5rem] p-4 group/col shadow-nm-inset transition-all"
                    >
                      <div className="flex items-center justify-between mb-4 px-4 pt-2">
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${col.key === 'pendente' ? 'bg-amber-400' : col.key === 'em_atendimento' ? 'bg-blue-500' : col.key === 'concluido' ? 'bg-emerald-500' : 'bg-red-400'} animate-pulse`}></span>
                           <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">{col.label}</h3>
                        </div>
                        <span className="bg-surface text-[10px] font-black uppercase tracking-widest text-muted px-3 py-1 rounded-full shadow-nm-flat">{items.length}</span>
                      </div>

                      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1 pb-4 px-1">
                        {items.length === 0 ? (
                          <div className="h-32 border-2 border-dashed border-border-subtle rounded-3xl flex flex-col items-center justify-center opacity-40">
                             <i className="fa-solid fa-calendar-check text-lg mb-2 text-muted"></i>
                             <p className="text-[8px] font-black text-muted uppercase tracking-widest text-center px-4">Coluna vazia</p>
                          </div>
                        ) : items.sort((a,b) => {
                          const da = a.dataNecessidade ? new Date(a.dataNecessidade).getTime() : Infinity;
                          const db = b.dataNecessidade ? new Date(b.dataNecessidade).getTime() : Infinity;
                          return da - db;
                        }).map((s) => {
                          const isOverdue = s.dataNecessidade && new Date(s.dataNecessidade) < new Date() && s.status !== 'concluido';
                          const diffDays = s.dataNecessidade ? Math.ceil((new Date(s.dataNecessidade).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;

                          return (
                            <motion.div 
                              layoutId={s.solicitacaoID}
                              key={s.solicitacaoID} 
                              draggable
                              onDragStart={() => setDraggingSolicitacaoId(s.solicitacaoID)}
                              className={`bg-surface border-2 rounded-3xl p-5 shadow-nm-flat hover:shadow-nm-elevated transition-all cursor-grab active:cursor-grabbing group relative overflow-hidden ${isOverdue ? "border-red-500/30" : "border-border-subtle hover:border-brand/20"}`}
                            >
                               <div className="absolute top-0 right-0 w-24 h-24 bg-brand blur-3xl -mr-12 -mt-12 opacity-0 group-hover:opacity-10 transition-opacity"></div>

                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <h4 className="font-black text-strong text-xs leading-tight group-hover:text-brand transition-colors uppercase tracking-tight">
                                    {s.solicitanteNome}
                                  </h4>
                                  <p className="text-[9px] font-black text-muted mt-0.5 tracking-widest uppercase opacity-60">
                                    #{s.protocolo || "Sem Protocolo"}
                                  </p>
                                </div>
                                {diffDays !== null && (
                                  <span className={`text-[8px] font-black px-2 py-1 rounded-lg border uppercase tracking-widest shadow-nm-inset ${
                                    diffDays >= 0 
                                      ? 'bg-blue-500/5 text-blue-600 border-blue-200/30' 
                                      : 'bg-red-500/5 text-red-600 border-red-200/30'
                                  }`}>
                                    {Math.abs(diffDays)}d {diffDays >= 0 ? "prazo" : "atrasado"}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between mt-auto pt-4 border-t border-border-subtle">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openChat("solicitacao", String(s.solicitacaoID), `Sol. ${s.protocolo || s.solicitacaoID}`)}
                                    title="Abrir conversa"
                                    className="w-8 h-8 rounded-xl bg-surface-soft border border-border-subtle flex items-center justify-center text-muted hover:text-brand hover:shadow-nm-flat transition-all"
                                  >
                                    <i className="fa-solid fa-comment-dots text-[10px]"></i>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/solicitacoes?open=${encodeURIComponent(String(s.solicitacaoID))}`)}
                                    title="Abrir detalhes"
                                    className="h-8 px-4 rounded-xl bg-surface-soft border border-border-subtle text-[10px] font-black uppercase tracking-widest text-muted hover:text-brand hover:shadow-nm-flat transition-all"
                                  >
                                    Ver
                                  </button>
                                </div>
                                
                                <select
                                  value={s.status}
                                  onChange={(e) => updateSolicitacaoStatus(s.solicitacaoID, e.target.value)}
                                  disabled={updatingSolicitacaoId === s.solicitacaoID || !canEdit}
                                  title="Mover"
                                  className="h-8 rounded-xl bg-brand text-white text-[10px] font-black px-3 uppercase tracking-widest shadow-lg shadow-brand/20 outline-none border-none cursor-pointer"
                                >
                                  {kanbanCols.map((opt) => (
                                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      <DaySelectionSlidebar
        isOpen={isDaySlidebarOpen}
        dayKey={selectedDayKey}
        events={selectedDayEvents}
        kanbanCols={kanbanCols}
        updatingSolicitacaoId={updatingSolicitacaoId}
        onClose={() => setIsDaySlidebarOpen(false)}
        onGoCalendar={() => {
          setViewMode("calendar");
          setIsDaySlidebarOpen(false);
        }}
        onSetStatus={updateSolicitacaoStatus}
        onOpenDetail={openEventDetail}
        onOpenChat={openEventChat}
      />
    </div>
  );
}
