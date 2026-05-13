"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { MovimentacaoModal } from "@/components/movimentacoes/MovimentacaoModal";
import { MovimentacaoDetailSidebar } from "@/components/movimentacoes/MovimentacaoDetailSidebar";
import { useToast } from "@/contexts/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Movimentacao as BaseMovimentacao } from "@/types";

interface MovimentacaoDetailed extends BaseMovimentacao {
  marca?: string;
  modelo?: string;
  tipoEquipamento?: string;
  donoAnteriorFoto?: string | null;
  novoDonoFoto?: string | null;
  tecnicoResponsavelFoto?: string | null;
  fotoEquipamento?: string | null;
  protocoloSolicitacao?: string;
  setorDestino?: string;
}

const TIPO_META: Record<string, { label: string; icon: string; color: string; bg: string; dot: string; shadow: string }> = {
  alocacao:    { label: "Alocação",      icon: "fa-user-plus",    color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50/50 dark:bg-blue-900/20",   dot: "bg-blue-500",   shadow: "shadow-blue-500/10" },
  transferencia:{ label: "Transferência", icon: "fa-right-left",   color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/50 dark:bg-indigo-900/20", dot: "bg-indigo-500", shadow: "shadow-indigo-500/10" },
  devolucao:   { label: "Devolução",      icon: "fa-rotate-left",  color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50/50 dark:bg-emerald-900/20",dot: "bg-emerald-500",shadow: "shadow-emerald-500/10" },
  manutencao:  { label: "Manutenção",     icon: "fa-wrench",       color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50/50 dark:bg-amber-900/20",  dot: "bg-amber-500",  shadow: "shadow-amber-500/10" },
  substituicao:{ label: "Substituição",   icon: "fa-shuffle",      color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50/50 dark:bg-purple-900/20", dot: "bg-purple-500", shadow: "shadow-purple-500/10" },
};

function getTipo(tipo: string) {
  return TIPO_META[tipo?.toLowerCase()] ?? { label: tipo, icon: "fa-arrows-rotate", color: "text-slate-600", bg: "bg-slate-50", dot: "bg-slate-400", shadow: "shadow-slate-500/5" };
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function MovimentacoesContent() {
  const searchParams = useSearchParams();
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Selection & Sidebar
    const [selectedMov, setSelectedMov] = useState<MovimentacaoDetailed | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [filterTipo, setFilterTipo] = useState("");
  const [filterProtocolo, setFilterProtocolo] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [search, setSearch] = useState("");
  const toast = useToast();

  const fetchMovimentacoes = async () => {
    try {
      setLoading(true);
      const data = await MovimentacoesService.getMovimentacoes({
        ...(filterTipo && { tipoMovimentacao: filterTipo }),
        ...(filterDataInicio && { dataInicio: filterDataInicio }),
        ...(filterDataFim && { dataFim: filterDataFim }),
      });
      setMovimentacoes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar movimentações:", err);
      setMovimentacoes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMovimentacoes(); }, [filterTipo, filterDataInicio, filterDataFim]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail?.path === "/movimentacoes") {
        setIsModalOpen(true);
      }
    };
    window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
    return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
  }, []);

  useEffect(() => {
    const openParam = searchParams.get("open");
    if (!openParam || loading || movimentacoes.length === 0) return;

    const target = movimentacoes.find((m) => String(m.movimentacaoID) === openParam);
    if (target) {
      setSelectedMov(target);
      setIsSidebarOpen(true);
    }
  }, [searchParams, loading, movimentacoes]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setIsModalOpen(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return movimentacoes.filter((m) => {
      const matchTipo = !filterTipo || m.tipoMovimentacao === filterTipo;
      const matchProto = !filterProtocolo || (m.protocoloSolicitacao || "").toLowerCase().includes(filterProtocolo.toLowerCase());
      const matchSearch = !search || [
        m.equipamentoID, m.tipoEquipamento, m.marca, m.modelo,
        m.novoDonoNome, m.donoAnteriorNome, m.motivo,
      ].join(" ").toLowerCase().includes(search.toLowerCase());
      return matchTipo && matchProto && matchSearch;
    });
  }, [movimentacoes, filterTipo, filterProtocolo, search]);

  const kpis = [
    { label: "Histórico Total", value: movimentacoes.length, icon: "fa-timeline", color: "text-slate-900 dark:text-slate-100", bg: "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800" },
    { label: "Movimentações Mês", value: filtered.length, icon: "fa-arrows-rotate", color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/40 border-indigo-100 dark:border-indigo-900/40" },
    { label: "Alocações", value: movimentacoes.filter(m => m.tipoMovimentacao === "alocacao").length, icon: "fa-user-plus", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/40 border-blue-100 dark:border-blue-900/40" },
    { label: "Manutenções", value: movimentacoes.filter(m => m.tipoMovimentacao === "manutencao").length, icon: "fa-wrench", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/40 border-amber-100 dark:border-amber-900/40" },
  ];

  const handleOpenDetail = (mov: any) => {
    setSelectedMov(mov);
    setIsSidebarOpen(true);
  };

  const [viewMode, setViewMode] = useState<"timeline" | "kanban">("timeline");

  const KanbanColumn = ({ tipo, title, items, meta }: { tipo: string; title: string; items: any[]; meta: any }) => (
    <div className="flex flex-col h-full min-h-[600px] bg-surface-soft border border-border-subtle rounded-[2.5rem] p-4 group/col shadow-nm-inset">
      <div className="flex items-center justify-between mb-4 px-4 pt-2">
        <div className={`flex items-center gap-2 ${meta.color}`}>
          <i className={`fa-solid ${meta.icon} text-xs`}></i>
          <h3 className="text-[10px] font-black uppercase tracking-widest">{title}</h3>
        </div>
        <span className="bg-surface text-[10px] font-black uppercase tracking-widest text-muted px-3 py-1 rounded-full shadow-nm-flat">{items.length}</span>
      </div>
      
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1 pb-4 px-1">
        {items.map((m) => (
          <motion.div
            layout
            key={m.movimentacaoID}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => handleOpenDetail(m)}
            className="bg-surface border border-border-subtle rounded-3xl p-5 shadow-nm-flat hover:shadow-nm-elevated cursor-pointer transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand blur-3xl -mr-12 -mt-12 opacity-0 group-hover:opacity-10 transition-opacity"></div>
            
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-black text-muted font-mono tracking-tighter bg-surface-soft px-3 py-1 rounded-full border border-border-subtle shadow-nm-inset">
                 {formatDate(m.dataHora || "").split(',')[0]}
              </span>
            </div>
            
            <h4 className="text-xs font-black text-strong leading-tight mb-3 group-hover:text-brand transition-colors">
              {m.marca} {m.modelo}
            </h4>
            
            <div className="flex items-center gap-2 py-3 border-t border-border-subtle">
                <div className="flex -space-x-3">
                   <SmartAvatar src={m.donoAnteriorFoto} name={m.donoAnteriorNome || "Anterior"} size="xs" type="person" className="border-2 border-white dark:border-slate-900" />
                   <div className="w-5 h-5 rounded-full bg-indigo-600 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center text-[6px] z-10 relative shadow-lg">
                      <i className="fa-solid fa-arrow-right"></i>
                   </div>
                   <SmartAvatar src={m.novoDonoFoto} name={m.novoDonoNome || "Novo"} size="xs" type="person" className="border-2 border-white dark:border-slate-900" />
                </div>
               <div className="min-w-0">
                  <p className="text-[9px] font-black text-main truncate leading-tight">{m.novoDonoNome || "Sem Destino"}</p>
                  <p className="text-[8px] font-black text-muted uppercase tracking-widest truncate">{m.setorDestino || "Alocação"}</p>
               </div>
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="h-32 border-2 border-dashed border-border-subtle rounded-3xl flex flex-col items-center justify-center opacity-40">
            <i className={`fa-solid ${meta.icon} text-lg mb-2 text-muted`}></i>
            <p className="text-[8px] font-black text-muted uppercase tracking-widest text-center px-4">Sem {title}</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-10">

      {/* Toolbar & Cinematic Filters */}
      <div className="bg-surface border border-border-subtle p-4 md:p-5 rounded-[2.5rem] flex flex-wrap gap-4 items-center shadow-nm-flat">
          <div className="relative flex-1 min-w-[300px]">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
            <input 
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rastrear por equipamento, dono, motivo ou modelo..."
              className="w-full bg-surface-soft border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold placeholder-subtle text-strong focus:ring-4 focus:ring-brand/10 transition-all shadow-nm-inset" 
            />
          </div>

          <div className="flex gap-2 items-center">
            {/* View Mode Toggle */}
            <div className="bg-surface-soft p-1.5 rounded-2xl shadow-nm-inset flex gap-1 mr-2 border border-border-subtle">
              <button 
                onClick={() => setViewMode("timeline")}
                className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${viewMode === 'timeline' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-muted hover:text-brand'}`}
                title="Linha do Tempo"
              >
                <i className="fa-solid fa-timeline"></i>
              </button>
              <button 
                onClick={() => setViewMode("kanban")}
                className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${viewMode === 'kanban' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-muted hover:text-brand'}`}
                title="Quadro Kanban"
              >
                <i className="fa-solid fa-table-columns"></i>
              </button>
            </div>

            <div className="hidden lg:flex bg-surface-soft p-1.5 rounded-xl shadow-nm-inset border border-border-subtle items-center gap-2">
              <i className="fa-solid fa-calendar-days text-[10px] text-muted ml-2"></i>
              <input 
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-main dark:[color-scheme:dark]"
                title="Data inicial"
              />
              <span className="text-[10px] text-muted font-black opacity-30">→</span>
              <input 
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-main dark:[color-scheme:dark]"
                title="Data final"
              />
            </div>

            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              title="Filtrar por tipo"
              aria-label="Filtrar por tipo"
              className="bg-surface-soft border-none text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-6 shadow-nm-inset focus:ring-4 focus:ring-brand/10 dark:[color-scheme:dark] text-main">
              <option value="">Todos Tipos</option>
              <option value="alocacao">Alocação</option>
              <option value="transferencia">Transferência</option>
              <option value="devolucao">Devolução</option>
              <option value="manutencao">Manutenção</option>
              <option value="substituicao">Substituição</option>
            </select>
          </div>
      </div>

      {/* KPIs Cinematic Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k, idx) => (
          <motion.div 
            key={k.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`rounded-[2.5rem] p-6 flex flex-col justify-between shadow-nm-flat group hover:-translate-y-1 transition-all bg-surface border border-border-subtle ${k.color}`}
          >
            <div className={`w-12 h-12 rounded-2xl bg-surface-soft ${k.color} flex items-center justify-center mb-4 transition-colors shadow-nm-inset border border-white/10 group-hover:bg-surface`}>
               <i className={`fa-solid ${k.icon} text-lg`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-1">{k.label}</p>
              <p className={`text-4xl font-black tracking-tighter ${k.color}`}>{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
           <motion.div 
             key="loading" 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="flex flex-col items-center py-32 animate-pulse"
           >
              <div className="w-16 h-16 rounded-full border-4 border-surface-soft border-t-brand animate-spin mb-4 shadow-nm-flat"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">Sincronizando Fluxo...</p>
           </motion.div>
        ) : viewMode === "kanban" ? (
          <motion.div
            key="kanban"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-5 gap-6 overflow-x-auto pb-8 custom-scrollbar min-h-screen"
          >
            <KanbanColumn tipo="alocacao" title="Alocações" meta={TIPO_META.alocacao} items={filtered.filter(m => m.tipoMovimentacao === 'alocacao')} />
            <KanbanColumn tipo="transferencia" title="Transferências" meta={TIPO_META.transferencia} items={filtered.filter(m => m.tipoMovimentacao === 'transferencia')} />
            <KanbanColumn tipo="devolucao" title="Devoluções" meta={TIPO_META.devolucao} items={filtered.filter(m => m.tipoMovimentacao === 'devolucao')} />
            <KanbanColumn tipo="manutencao" title="Manutenções" meta={TIPO_META.manutencao} items={filtered.filter(m => m.tipoMovimentacao === 'manutencao')} />
            <KanbanColumn tipo="substituicao" title="Substituições" meta={TIPO_META.substituicao} items={filtered.filter(m => m.tipoMovimentacao === 'substituicao')} />
          </motion.div>
        ) : filtered.length === 0 ? (
           <motion.div 
             key="empty" 
             initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="text-center py-32 bg-surface border-2 border-dashed border-border-subtle rounded-[3rem] shadow-nm-inset"
           >
              <i className="fa-solid fa-arrows-rotate text-6xl text-surface-soft mb-6 block"></i>
              <p className="text-xl font-black text-muted uppercase tracking-widest">Silêncio no Estoque</p>
           </motion.div>
        ) : (
          <motion.div 
            key="timeline"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
             <div className="flex items-center justify-between px-4">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-[0.4em] text-xs">Fluxo Granular de Ativos</h3>
                <div className="h-[2px] flex-1 mx-8 bg-gradient-to-r from-slate-100 via-slate-100 to-transparent dark:from-slate-800 dark:via-slate-800"></div>
             </div>
    
             <div className="relative">
                {/* Main Center Axis */}
                <div className="absolute left-[30px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[4px] bg-slate-200 dark:bg-white/10 rounded-full shadow-nm-inset"></div>
    
                <div className="space-y-8">
                    {filtered.map((m, idx) => {
                      const meta = getTipo(m.tipoMovimentacao);
                      const isEven = idx % 2 === 0;
    
                      return (
                        <motion.div 
                          key={m.movimentacaoID || idx}
                          initial={{ opacity: 0, x: isEven ? -50 : 50 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05, type: "spring", damping: 20 }}
                          className={`relative flex items-center w-full justify-start`}
                        >
                          {/* Timeline Node */}
                          <div className={`absolute left-[30px] md:left-1/2 md:-translate-x-1/2 w-6 h-6 rounded-full border-4 border-white dark:border-slate-900 ${meta.dot} shadow-lg z-20`}></div>
    
                          {/* Horizontal Connector Line (Visual Bridge) */}
                          <div className={`absolute top-1/2 -translate-y-1/2 h-[2px] z-10 
                            bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-700/50 dark:to-slate-800/20
                            /* Mobile Positioning */
                            left-[42px] w-[22px]
                            /* Desktop Positioning */
                            ${isEven ? 'md:left-auto md:right-1/2 md:w-12 md:bg-gradient-to-l md:from-slate-300 md:to-transparent' : 'md:left-1/2 md:w-12 md:bg-gradient-to-r md:from-slate-300 md:to-transparent'}`} 
                          />
    
                          {/* Content Card Container */}
                          <div 
                            className={`w-full md:w-1/2 pl-16 md:pl-0 flex ${isEven ? 'md:ml-0 md:justify-end md:pr-12' : 'md:ml-auto md:justify-start md:pl-12'}`}
                            onClick={() => handleOpenDetail(m)}
                          >
                             <div className={`w-full max-w-[450px] bg-surface border border-border-subtle rounded-[2.5rem] p-6 shadow-nm-flat hover:shadow-nm-elevated transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden`}>
                                <div className="absolute top-0 right-0 w-32 h-32 bg-brand blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                                
                                <div className="flex items-center justify-between mb-4">
                                   <div className={`flex items-center gap-2 ${meta.color}`}>
                                      <i className={`fa-solid ${meta.icon} text-[10px]`}></i>
                                      <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-surface-soft rounded-full border border-border-subtle shadow-nm-inset">{meta.label}</span>
                                   </div>
                                    <span className="text-[10px] font-black text-muted font-mono tracking-tighter bg-surface-soft px-3 py-1 rounded-full border border-border-subtle shadow-nm-inset">
                                       {formatDate(m.dataHora || "").split(',')[0]}
                                    </span>
                                </div>
    
                                <p className="text-lg font-black text-slate-900 dark:text-white mb-2 leading-tight group-hover:text-indigo-600 transition-colors">
                                  {m.marca} {m.modelo} — <span className="text-slate-400 font-bold">{m.tipoEquipamento}</span>
                                </p>
    
                                <div className="flex items-center gap-4 py-4 border-t border-slate-50 dark:border-slate-800">
                                    <div className="flex -space-x-4">
                                       <SmartAvatar 
                                          src={m.donoAnteriorFoto}
                                          name={m.donoAnteriorNome || "Anterior"} 
                                          size="sm" 
                                          type="person" 
                                          className="border-2 border-white dark:border-slate-900" 
                                       />
                                       <div className="w-8 h-8 rounded-full bg-indigo-600 text-white border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] z-10 relative shadow-lg">
                                          <i className="fa-solid fa-arrow-right"></i>
                                       </div>
                                       <SmartAvatar 
                                          src={m.novoDonoFoto}
                                          name={m.novoDonoNome || "Novo"} 
                                          size="sm" 
                                          type="person" 
                                          className="border-2 border-white dark:border-slate-900" 
                                       />
                                    </div>
                                   <div className="min-w-0">
                                      <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 truncate leading-none mb-1">{m.novoDonoNome || "Sem Destino"}</p>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{m.setorDestino || "Alocação Direta"}</p>
                                   </div>
                                </div>
    
                                {m.motivo && (
                                   <p className="mt-2 text-[10px] font-medium text-slate-500 italic line-clamp-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                      &quot;{m.motivo}&quot;
                                    </p>
                                )}
                             </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar & Modal Components */}
      <MovimentacaoDetailSidebar 
        movimentacao={selectedMov as any}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <MovimentacaoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); fetchMovimentacoes(); }}
      />
    </div>
  );
}

export default function MovimentacoesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center py-32 animate-pulse">
        <div className="w-16 h-16 rounded-full border-4 border-surface-soft border-t-brand animate-spin mb-4 shadow-nm-flat"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">Carregando Fluxo...</p>
      </div>
    }>
      <MovimentacoesContent />
    </Suspense>
  );
}
