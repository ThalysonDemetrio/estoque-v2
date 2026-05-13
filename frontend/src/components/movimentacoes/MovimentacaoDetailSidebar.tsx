"use client";

import { motion } from "framer-motion";
import { useChat } from "@/contexts/ChatContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";

interface Movimentacao {
  movimentacaoID: string;
  tipoMovimentacao: string;
  equipamentoID: string;
  tipoEquipamento: string;
  marca: string;
  modelo: string;
  dataHora: string;
  novoDonoNome?: string;
  donoAnteriorNome?: string;
  tecnicoResponsavelNome?: string;
  responsavel?: string;
  motivo?: string;
  descricaoDetalhada?: string;
  protocoloSolicitacao?: string;
  setorOrigem?: string;
  setorDestino?: string;
}

interface MovimentacaoDetailSidebarProps {
  movimentacao: Movimentacao | null;
  isOpen: boolean;
  onClose: () => void;
}

const TIPO_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  alocacao:     { label: "Alocação",      icon: "fa-user-plus",    color: "text-blue-600 dark:text-blue-400",   bg: "bg-blue-50/50 dark:bg-blue-500/5",   border: "border-blue-100 dark:border-blue-500/20" },
  transferencia:{ label: "Transferência", icon: "fa-right-left",   color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/50 dark:bg-indigo-500/5", border: "border-indigo-100 dark:border-indigo-500/20" },
  devolucao:    { label: "Devolução",      icon: "fa-rotate-left",  color: "text-emerald-600 dark:text-emerald-400",bg: "bg-emerald-50/50 dark:bg-emerald-500/5",border: "border-emerald-100 dark:border-emerald-500/20" },
  manutencao:   { label: "Manutenção",     icon: "fa-wrench",       color: "text-amber-600 dark:text-amber-400",  bg: "bg-amber-50/50 dark:bg-amber-500/5",  border: "border-amber-100 dark:border-amber-500/20" },
  substituicao: { label: "Substituição",   icon: "fa-shuffle",      color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50/50 dark:bg-purple-500/5", border: "border-purple-100 dark:border-purple-500/20" },
};

export function MovimentacaoDetailSidebar({ movimentacao, isOpen, onClose }: MovimentacaoDetailSidebarProps) {
  const { openChat } = useChat();

  const meta = movimentacao ? (TIPO_META[movimentacao.tipoMovimentacao?.toLowerCase()] ?? { 
    label: movimentacao.tipoMovimentacao, 
    icon: "fa-arrows-rotate", 
    color: "text-slate-600", 
    bg: "bg-slate-50/50",
    border: "border-slate-100"
  }) : null;

   if (!isOpen || !movimentacao || !meta) return null;

   return (
      <SlidebarPanel
         isOpen={isOpen}
         onClose={onClose}
         panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
      >
         <SlidebarHeader
           title={`Movimentação #${movimentacao.movimentacaoID}`}
           subtitle="Registro Detalhado"
           iconClassName="fa-right-left"
           onClose={onClose}
           actions={
             <button
               onClick={() => openChat('movimentacao', movimentacao.movimentacaoID, `Mov. ${movimentacao.movimentacaoID}`)}
               title="Abrir chat da movimentação"
               aria-label="Abrir chat da movimentação"
               className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/20 hover:scale-110 transition-transform"
             >
               <i className="fa-solid fa-comments text-xs"></i>
             </button>
           }
            className="p-8 border-b border-slate-100 dark:border-white/5 relative overflow-hidden shrink-0 bg-white dark:bg-slate-900 flex items-center justify-between"
            titleClassName="text-xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-1"
           subtitleClassName="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-1"
         />

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10">
              
              {/* Digital Receipt UX */}
              <div className="relative group">
                 <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000 group-hover:duration-200"></div>
                 <div className="relative bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-[2rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <div className={`${meta.bg} ${meta.color} ${meta.border} px-4 py-2 rounded-xl border flex items-center gap-2`}>
                          <i className={`fa-solid ${meta.icon} text-sm`}></i>
                          <span className="text-xs font-black uppercase tracking-widest">{meta.label}</span>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400 font-mono">
                          {new Date(movimentacao.dataHora).toLocaleDateString('pt-BR')} às {new Date(movimentacao.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                       </span>
                    </div>

                    <div className="space-y-6">
                       <div className="flex items-center gap-6">
                          <div className="w-20 h-20 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-indigo-600">
                             <i className="fa-solid fa-laptop text-3xl"></i>
                          </div>
                          <div>
                             <h4 className="text-xl font-black text-slate-900 dark:text-white mb-1">{movimentacao.marca} {movimentacao.modelo}</h4>
                             <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{movimentacao.tipoEquipamento}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                <span className="font-mono text-[10px] font-black text-indigo-500">{movimentacao.equipamentoID}</span>
                             </div>
                          </div>
                       </div>

                       <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm text-slate-400">
                                <i className="fa-solid fa-user-tie"></i>
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsável Técnico</p>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-200">{movimentacao.tecnicoResponsavelNome || movimentacao.responsavel || "Sistema"}</p>
                             </div>
                          </div>
                          {movimentacao.protocoloSolicitacao && (
                             <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Protocolo Origem</p>
                                <p className="text-xs font-black text-indigo-600">#{movimentacao.protocoloSolicitacao}</p>
                             </div>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Traceability Flow */}
              <div className="space-y-6">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] text-center">Fluxo de Transferência</h4>
                 <div className="flex items-center justify-between gap-4 relative">
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[2px] bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800 to-transparent"></div>
                    
                    {/* Origin */}
                    <div className="z-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-5 w-40 text-center shadow-sm">
                       <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                          <i className="fa-solid fa-building"></i>
                       </div>
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Origem</p>
                       <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{movimentacao.donoAnteriorNome || "Estoque Central"}</p>
                       {movimentacao.setorOrigem && (
                          <p className="text-[9px] font-bold text-slate-500 mt-0.5">{movimentacao.setorOrigem}</p>
                       )}
                    </div>

                    <div className="z-20 w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 animate-pulse">
                       <i className="fa-solid fa-chevron-right"></i>
                    </div>

                    {/* Destination */}
                    <div className="z-10 bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-5 w-40 text-center shadow-lg shadow-indigo-500/5">
                       <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mx-auto mb-3 text-indigo-600">
                          <i className="fa-solid fa-location-dot"></i>
                       </div>
                       <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Destino</p>
                       <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{movimentacao.novoDonoNome || "Manutenção/Técnico"}</p>
                       {movimentacao.setorDestino && (
                          <p className="text-[9px] font-bold text-slate-500 mt-0.5">{movimentacao.setorDestino}</p>
                       )}
                    </div>
                 </div>
              </div>

              {/* Justification & Notes */}
              <div className="space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Justificativa e Notas</h4>
                 <div className="bg-slate-50 dark:bg-slate-800/30 rounded-3xl p-6 border-l-[6px] border-indigo-500 italic">
                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Motivo da Transação</p>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                       "{movimentacao.motivo || "Transação padrão de ciclo de vida."}"
                    </p>
                    {movimentacao.descricaoDetalhada && (
                       <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50 not-italic">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Observações Adicionais</p>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                             {movimentacao.descricaoDetalhada}
                          </p>
                       </div>
                    )}
                 </div>
              </div>

              {/* Intelligence Snapshot (Mocked for Visual) */}
              <div className="bg-indigo-100 dark:bg-indigo-600 rounded-[2rem] p-8 text-indigo-900 dark:text-white relative overflow-hidden border border-indigo-200 dark:border-indigo-500/30">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-300/20 dark:bg-white/10 blur-3xl -mr-16 -mt-16"></div>
                 <div className="relative z-10 flex items-center justify-between">
                    <div className="space-y-2">
                       <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60">Status de Integridade</p>
                       <h5 className="text-2xl font-black tracking-tighter uppercase">Nível Premium</h5>
                       <p className="text-xs font-medium opacity-80">Rastreabilidade completa verificada pelo sistema.</p>
                    </div>
                    <div className="w-16 h-16 rounded-2xl bg-white/70 dark:bg-white/20 backdrop-blur-md border border-indigo-200 dark:border-white/20 flex items-center justify-center">
                       <i className="fa-solid fa-shield-check text-2xl"></i>
                    </div>
                 </div>
              </div>

            </div>

      <SlidebarFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
            <div className="grid grid-cols-2 gap-4">
                <button 
                 onClick={onClose}
                 className="py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                >
                   Fechar Dossiê
                </button>
                <button 
                  onClick={() => openChat('movimentacao', movimentacao.movimentacaoID, `Mov. ${movimentacao.movimentacaoID}`)}
                  className="py-3 px-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all"
                >
                   Conciliação de Chat
                </button>
            </div>
      </SlidebarFooter>
      </SlidebarPanel>
  );
}
