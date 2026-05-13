"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EquipamentosService, EquipamentoFilter } from "@/services/equipamentos.service";
import { EquipamentoModal } from "@/components/equipamentos/EquipamentoModal";
import { EquipamentoDetailSidebar } from "@/components/equipamentos/EquipamentoDetailSidebar";
import { useToast } from "@/contexts/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Equipamento } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { calculateAssetHealth } from "@/lib/health";
import { useChat } from "@/contexts/ChatContext";

export default function EquipamentosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400 font-black uppercase tracking-widest animate-pulse">Sincronizando inventario...</div>}>
      <EquipamentosContent />
    </Suspense>
  );
}

function EquipamentosContent() {
  const searchParams = useSearchParams();
  const openEtiqueta = searchParams.get("open");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [allEquipamentos, setAllEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<EquipamentoFilter>({});
  
  // Selection State
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);
  const { hasPermission } = useAuth();
  const toast = useToast();
  const { refreshTrigger } = useChat();

  const canEdit = useMemo(() => hasPermission("equipamentos", "edit"), [hasPermission]);

  const fetchEquipamentos = async () => {
    try {
      setLoading(true);
      const data = await EquipamentosService.getEquipamentos(filters);
      setEquipamentos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch equipamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullInventory = async () => {
    try {
      const data = await EquipamentosService.getEquipamentos({});
      setAllEquipamentos(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch full inventory:", error);
    }
  };

  useEffect(() => {
    fetchFullInventory();
  }, []);

  useEffect(() => {
    fetchEquipamentos();
  }, [filters, refreshTrigger]);

  useEffect(() => {
    if (!openEtiqueta || equipamentos.length === 0) return;
    const found = equipamentos.find((eq: any) => String(eq.etiquetaID) === String(openEtiqueta));
    if (found) {
      setSelectedEq(found);
      setIsSidebarOpen(true);
    }
  }, [equipamentos, openEtiqueta]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      handleOpenNewModal();
    }
  }, [searchParams]);

  // Health Calculation for the list
  const getHealth = (eq: Equipamento) => {
    const { healthScore } = calculateAssetHealth(eq);
    return healthScore;
  };

  const handleOpenNewModal = () => {
    setEditingEquipamento(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (eq: Equipamento) => {
    setEditingEquipamento(eq);
    setIsModalOpen(true);
  };

  const handleOpenDetail = (eq: Equipamento) => {
    setSelectedEq(eq);
    setIsSidebarOpen(true);
  };

  const handleDelete = async (etiquetaID: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o equipamento ${etiquetaID}?`)) {
      try {
        await EquipamentosService.deleteEquipamento(etiquetaID);
        toast.success("Equipamento excluído", `${etiquetaID} foi removido do sistema.`);
        fetchEquipamentos();
      } catch (err) {
        toast.error("Erro ao excluir", "Não foi possível remover o equipamento.");
      }
    }
  };

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail?.path === "/equipamentos") {
        handleOpenNewModal();
      }
    };
    window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
    return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
  }, [canEdit]);

  const handleFilterChange = (key: keyof EquipamentoFilter, value: string) => {
    setFilters(prev => {
      if (prev[key] === value) {
        const newFilters = { ...prev };
        delete newFilters[key];
        return newFilters;
      }
      return { ...prev, [key]: value };
    });
  };

  const typeSummary = useMemo(() => {
    const summary: Record<string, number> = {};
    const source = allEquipamentos.length > 0 ? allEquipamentos : equipamentos;
    source.forEach(eq => {
      const type = eq.tipoEquipamento || "Outros";
      summary[type] = (summary[type] || 0) + 1;
    });
    return Object.entries(summary).sort((a, b) => b[1] - a[1]);
  }, [allEquipamentos, equipamentos]);

  const getTypeIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('notebook') || t.includes('laptop')) return 'fa-laptop';
    if (t.includes('monitor') || t.includes('tela')) return 'fa-desktop';
    if (t.includes('teclado')) return 'fa-keyboard';
    if (t.includes('mouse')) return 'fa-mouse';
    if (t.includes('headset') || t.includes('fone')) return 'fa-headset';
    if (t.includes('impressora')) return 'fa-print';
    if (t.includes('switch') || t.includes('roteador')) return 'fa-network-wired';
    return 'fa-box-open';
  };

  return (
    <div className="space-y-6">
      {/* Type Summary Header */}
      {!loading && typeSummary.length > 0 && (
        <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-4 px-4 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-6 md:mb-8 md:mx-0 md:px-0">
          {typeSummary.map(([type, count], idx) => {
            const isActive = filters.tipoEquipamento === type;
            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                key={type}
                onClick={() => handleFilterChange("tipoEquipamento", type)}
                className={`p-4 md:p-6 border rounded-2xl md:rounded-[2.5rem] flex items-center gap-4 md:gap-5 group transition-all cursor-pointer active:scale-95 shrink-0 min-w-[160px] md:min-w-0 ${
                  isActive 
                    ? "bg-surface-soft border-brand/30 shadow-nm-inset" 
                    : "bg-surface border-border-subtle shadow-nm-flat hover-nm-elevated"
                }`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${
                  isActive ? "bg-surface shadow-nm-flat text-brand" : "bg-surface-soft text-muted shadow-nm-inset group-hover:text-brand"
                }`}>
                  <i className={`fa-solid ${getTypeIcon(type)} text-xs md:text-sm`} />
                </div>
                <div>
                  <p className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest mb-0.5 leading-none transition-colors ${
                    isActive ? "text-brand" : "text-muted"
                  }`}>{type}</p>
                  <p className={`text-lg md:text-xl font-black transition-colors ${
                    isActive ? "text-strong" : "text-strong"
                  }`}>{count}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      {/* Toolbar */}
      <div className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-4 md:p-5 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex gap-4 w-full lg:w-auto flex-1">
          <div className="relative flex-1 lg:max-w-[240px]">
            <select 
              title="Filtrar por propriedade"
              aria-label="Filtrar por propriedade"
              className="w-full bg-surface-soft border-none text-main text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-4 shadow-nm-inset focus:ring-2 focus:ring-brand/10 outline-none transition-all dark:[color-scheme:dark]"
              onChange={(e) => handleFilterChange("propriedade", e.target.value)}
              value={filters.propriedade || ""}
            >
              <option value="">Propriedade</option>
              <option value="empresa">🏢 Empresa</option>
              <option value="usuario">👤 Usuário</option>
            </select>
          </div>

          <div className="relative flex-1 lg:max-w-[240px]">
            <select 
              title="Filtrar por status"
              aria-label="Filtrar por status"
              className="w-full bg-surface-soft border-none text-main text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-4 shadow-nm-inset focus:ring-2 focus:ring-brand/10 outline-none transition-all dark:[color-scheme:dark]"
              onChange={(e) => handleFilterChange("status", e.target.value)}
              value={filters.status || ""}
            >
              <option value="">Status</option>
              <option value="Disponível">✅ Disponível</option>
              <option value="Em Uso">⚡ Em Uso</option>
              <option value="Manutenção">🔧 Manutenção</option>
            </select>
          </div>

          <div className="flex bg-surface-soft p-1.5 rounded-2xl shadow-nm-inset shrink-0 ml-auto gap-1">
             <button onClick={() => setViewMode("cards")} title="Cards" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'cards' ? 'bg-surface shadow-nm-flat text-brand' : 'text-muted'}`}>
                <i className="fa-solid fa-grip-vertical"></i>
             </button>
             <button onClick={() => setViewMode("table")} title="Tabela" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${viewMode === 'table' ? 'bg-surface shadow-nm-flat text-brand' : 'text-muted'}`}>
                <i className="fa-solid fa-table-list"></i>
             </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading-view" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center justify-center py-24 gap-4 grayscale opacity-50">
            <div className="w-12 h-12 border-4 border-surface-tertiary border-t-brand rounded-full animate-spin"></div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted">Escaneando...</p>
          </motion.div>
        ) : viewMode === "cards" ? (
          <motion.div 
            key="cards-view"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
          >
            {equipamentos.map((eq: any, index: number) => {
              const healthScore = getHealth(eq);
              const statusLower = eq.status?.toLowerCase() || '';
              let statusBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
              if (statusLower.includes('dispon')) statusBg = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
              else if (statusLower.includes('uso')) statusBg = 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800';
              else if (statusLower.includes('manuten')) statusBg = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800';

              return (
                <motion.div 
                  key={`card-${eq.etiquetaID}-${index}`}
                  whileHover={{ y: -8 }}
                  onClick={() => handleOpenDetail(eq)}
                  className="bg-surface border border-border-subtle rounded-3xl md:rounded-[2.5rem] p-5 md:p-6 shadow-nm-flat hover:shadow-nm-elevated hover:border-brand/20 transition-all cursor-pointer group active:scale-95"
                >
                  <div className="relative mb-6">
                    <div className="w-full aspect-square flex items-center justify-center rounded-[2.5rem] bg-surface-soft shadow-nm-inset overflow-hidden border border-border-subtle/30">
                      <SmartAvatar 
                        src={eq.fotoEquipamento} 
                        name={`${eq.marca || "Equipamento"} ${eq.modelo || ""}`} 
                        size="full" 
                        type="item"
                        status={statusLower.includes('manuten') ? 'maintenance' : statusLower.includes('uso') ? 'in_use' : 'available'}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    </div>
                    {/* Health Badge */}
                    <div className={`absolute -top-3 -right-3 w-14 h-14 rounded-2xl flex flex-col items-center justify-center shadow-nm-flat border-4 border-surface ${
                      healthScore > 70 ? 'bg-emerald-500' : healthScore > 40 ? 'bg-amber-500' : 'bg-red-500'
                    } text-white z-10`}>
                      <span className="text-[10px] font-black uppercase tracking-tighter leading-none mb-0.5">Saúde</span>
                      <span className="text-sm font-black tracking-tighter">{healthScore}%</span>
                    </div>
                  </div>

                  <div className="space-y-1 mb-6">
                    <div className="flex justify-between items-start">
                       <h3 className="font-black text-strong group-hover:text-brand transition-colors truncate pr-2 text-base">{eq.marca} {eq.modelo}</h3>
                       <span className="text-[9px] font-black text-muted tracking-widest">#{eq.etiquetaID}</span>
                    </div>
                    <p className="text-[10px] font-black text-brand uppercase tracking-[0.2em]">{eq.tipoEquipamento}</p>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-border-subtle">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border shadow-nm-flat group-hover:shadow-nm-inset transition-all ${statusBg}`}>
                       {eq.status}
                    </span>
                    <div className="flex gap-2">
                        {canEdit && (
                          <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(eq); }} title="Editar" className="w-9 h-9 rounded-xl bg-surface border border-border-subtle text-muted hover:text-brand transition-all shadow-nm-flat active:shadow-nm-inset flex items-center justify-center">
                            <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                          </button>
                        )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div 
            key="table-view"
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] overflow-hidden hidden md:block"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-soft border-b border-border-subtle text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="py-6 px-8">Equipamento</th>
                    <th className="py-6 px-8">Status</th>
                    <th className="py-6 px-8">Saúde</th>
                    <th className="py-6 px-8">Local/Responsável</th>
                    <th className="py-6 px-8">Propriedade</th>
                    <th className="py-6 px-8 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {equipamentos.map((eq: any, index: number) => {
                    const healthScore = getHealth(eq);
                    const statusLower = eq.status?.toLowerCase() || '';
                    let statusBg = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400';
                    if (statusLower.includes('dispon')) statusBg = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
                    else if (statusLower.includes('uso')) statusBg = 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-100 dark:border-blue-800';
                    else if (statusLower.includes('manuten')) statusBg = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800';

                    return (
                      <tr key={`row-${eq.etiquetaID}-${index}`} onClick={() => handleOpenDetail(eq)} className="hover:bg-surface-soft transition-all cursor-pointer group">
                        <td className="py-4 px-8">
                           <div className="flex items-center gap-4">
                              <SmartAvatar 
                                src={eq.fotoEquipamento} 
                                name={`${eq.marca} ${eq.modelo}`} 
                                size="md" 
                                type="item"
                                status={eq.status?.toLowerCase().includes('manuten') ? 'maintenance' : eq.status?.toLowerCase().includes('uso') ? 'in_use' : 'available'}
                              />
                              <div>
                                 <p className="text-sm font-black text-strong leading-none mb-1">{eq.marca} {eq.modelo}</p>
                                 <p className="text-[10px] font-black text-muted uppercase tracking-widest">{eq.tipoEquipamento} • #{eq.etiquetaID}</p>
                              </div>
                           </div>
                        </td>
                        <td className="py-4 px-8">
                           <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${statusBg}`}>
                              {eq.status}
                           </span>
                        </td>
                        <td className="py-4 px-8">
                           <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-[60px] max-w-[80px] h-1.5 bg-surface-tertiary rounded-full overflow-hidden shrink-0">
                                 <motion.div initial={{width:0}} animate={{width:`${healthScore}%`}} className={`h-full ${healthScore > 70 ? 'bg-emerald-500' : healthScore > 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-widest ${healthScore > 70 ? 'text-emerald-500' : healthScore > 40 ? 'text-amber-500' : 'text-red-500'}`}>{healthScore}%</span>
                           </div>
                        </td>
                        <td className="py-4 px-8 text-[10px] font-black uppercase tracking-widest text-muted">{eq.colaboradorAtualID || eq.localizacao || "Estoque"}</td>
                        <td className="py-4 px-8">
                           <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${eq.propriedade === 'empresa' ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400' : 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400'}`}>
                              {eq.propriedade}
                           </span>
                        </td>
                        <td className="py-4 px-8 text-right shrink-0">
                           <div className="flex justify-end gap-1">
                              {canEdit && (
                                <>
                                  <button onClick={(e) => { e.stopPropagation(); handleOpenEditModal(eq); }} title="Editar equipamento" aria-label="Editar equipamento" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-brand hover:bg-white dark:hover:bg-white/5 transition-all outline-none"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                                  <button onClick={(e) => { e.stopPropagation(); handleDelete(eq.etiquetaID); }} title="Excluir equipamento" aria-label="Excluir equipamento" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-red-600 hover:bg-white dark:hover:bg-white/5 transition-all outline-none"><i className="fa-solid fa-trash text-xs"></i></button>
                                </>
                              )}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
        
        {/* Mobile Automatic Card List (Only when in table mode on mobile) */}
        {!loading && viewMode === "table" && (
          <div className="grid grid-cols-1 gap-6 md:hidden">
             {equipamentos.map((eq: any, index: number) => {
               const healthScore = getHealth(eq);
               return (
                 <motion.div 
                   key={`mobile-${eq.etiquetaID}-${index}`} 
                   whileHover={{ y: -4 }}
                   onClick={() => handleOpenDetail(eq)}
                   className="bg-surface p-5 rounded-[2.5rem] border border-border-subtle shadow-nm-flat flex items-center gap-5 active:scale-95 transition-all"
                 >
                      <div className="w-16 h-16 shrink-0 relative p-1 rounded-2xl bg-surface shadow-nm-inset border border-border-subtle/30">
                         <SmartAvatar 
                           src={eq.fotoEquipamento} 
                           name={`${eq.marca} ${eq.modelo}`} 
                           size="lg" 
                           type="item"
                           status={eq.status?.toLowerCase().includes('manuten') ? 'maintenance' : 'available'}
                         />
                      </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-strong truncate">{eq.marca} {eq.modelo}</p>
                       <p className="text-[10px] font-black text-brand uppercase tracking-widest mt-1">#{eq.etiquetaID} • {eq.status}</p>
                       <div className="flex items-center gap-2 mt-2">
                          <div className="flex-1 h-1.5 bg-surface-soft rounded-full overflow-hidden shadow-inner border border-border-subtle/50">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${healthScore}%` }} className={`h-full ${healthScore > 70 ? 'bg-emerald-500' : healthScore > 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                          </div>
                          <span className={`text-[9px] font-black ${healthScore > 70 ? 'text-emerald-500' : healthScore > 40 ? 'text-amber-500' : 'text-red-500'}`}>{healthScore}%</span>
                       </div>
                    </div>
                    <i className="fa-solid fa-chevron-right text-slate-300 text-xs"></i>
                 </motion.div>
               );
             })}
          </div>
        )}
      </AnimatePresence>

      <EquipamentoDetailSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        equipamento={selectedEq}
        onEdit={canEdit ? (eq) => { setIsSidebarOpen(false); handleOpenEditModal(eq); } : undefined}
        onRefresh={fetchEquipamentos}
      />

      <EquipamentoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        switches={allEquipamentos.filter((eq) => eq.tipoEquipamento?.toLowerCase().includes("switch"))}
        inventory={allEquipamentos}
        onSuccess={() => {
          setIsModalOpen(false);
          fetchEquipamentos();
          fetchFullInventory();
        }}
        equipamentoData={editingEquipamento || undefined}
      />
    </div>
  );
}
