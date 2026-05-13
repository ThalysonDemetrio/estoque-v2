"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { ColaboradorDetailSidebar } from "@/components/colaboradores/ColaboradorDetailSidebar";
import { useToast } from "@/contexts/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { Colaborador } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";

export default function ColaboradoresPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted font-black uppercase tracking-widest animate-pulse">Carregando modulo...</div>}>
      <ColaboradoresContent />
    </Suspense>
  );
}

function ColaboradoresContent() {
  const searchParams = useSearchParams();
  const openID = searchParams.get("open");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateSidebarMode, setIsCreateSidebarMode] = useState(false);
  
  // Selection & Sidebar
  const [selectedColab, setSelectedColab] = useState<Colaborador | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [startSidebarInEditMode, setStartSidebarInEditMode] = useState(false);
  const { hasPermission } = useAuth();
  const { refreshTrigger } = useChat();
  const [filterDep, setFilterDep] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [search, setSearch] = useState("");
  const toast = useToast();
  const canEdit = useMemo(() => hasPermission("colaboradores", "edit"), [hasPermission]);

  const fetchColaboradores = async () => {
    try {
      setLoading(true);
      const data = await ColaboradoresService.getColaboradores();
      setColaboradores(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar colaboradores:", err);
      setColaboradores([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchColaboradores();
  }, [refreshTrigger]);

    useEffect(() => {
      const handleAction = (e: any) => {
        if (e.detail?.path === "/colaboradores") {
          setSelectedColab(null);
          setIsCreateSidebarMode(true);
          setStartSidebarInEditMode(true);
          setIsSidebarOpen(true);
        }
      };
      window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
      return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
    }, [canEdit]);
    
    useEffect(() => {
    if (!openID || colaboradores.length === 0) return;

    const found = colaboradores.find((c) => String(c.colaboradorID) === String(openID));
    if (found) {
      setIsCreateSidebarMode(false);
      setStartSidebarInEditMode(false);
      setSelectedColab(found);
      setIsSidebarOpen(true);
    }
  }, [colaboradores, openID]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setSelectedColab(null);
      setIsCreateSidebarMode(true);
      setStartSidebarInEditMode(true);
      setIsSidebarOpen(true);
    }
  }, [searchParams]);

  const departamentos = useMemo(() => {
    const deps = new Set<string>();
    colaboradores.forEach((c) => c.departamento && deps.add(c.departamento));
    return Array.from(deps).sort();
  }, [colaboradores]);

  const filtered = useMemo(() => {
    return colaboradores.filter((c) => {
      const matchDep = !filterDep || c.departamento === filterDep;
      const matchStatus = !filterStatus || (filterStatus === "ativo" ? c.ativo !== false : c.ativo === false);
      const matchSearch = !search || [c.nome, c.email, c.cargo, c.departamento].join(" ").toLowerCase().includes(search.toLowerCase());
      return matchDep && matchStatus && matchSearch;
    });
  }, [colaboradores, filterDep, filterStatus, search]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Tem certeza que deseja excluir este colaborador?")) {
      try {
        await ColaboradoresService.deleteColaborador(id);
        toast.success("Colaborador excluído", "Registro removido com sucesso.");
        fetchColaboradores();
      } catch {
        toast.error("Erro ao excluir", "Não foi possível remover o colaborador.");
      }
    }
  };

  const handleEdit = (colab: Colaborador, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCreateSidebarMode(false);
    setSelectedColab(colab);
    setStartSidebarInEditMode(true);
    setIsSidebarOpen(true);
  };

  const handleOpenDetail = (colab: Colaborador) => {
    setIsCreateSidebarMode(false);
    setSelectedColab(colab);
    setStartSidebarInEditMode(false);
    setIsSidebarOpen(true);
  };

  const initials = (name: string) =>
    name?.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  const statusAtivo = (c: Colaborador) => c.ativo !== false;

  const kpis = [
    { label: "Capital Humano", value: colaboradores.length, color: "text-strong", icon: "fa-users", bg: "bg-surface-soft border-border-subtle" },
    { label: "Operacionais", value: colaboradores.filter((c) => statusAtivo(c)).length, color: "text-emerald-600", icon: "fa-circle-check", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Departamentos", value: departamentos.length, color: "text-blue-600", icon: "fa-building", bg: "bg-blue-500/10 border-blue-500/20" },
    { label: "Em Posse", value: "85%", color: "text-brand", icon: "fa-hand-holding-heart", bg: "bg-brand/10 border-brand/20" },
  ];

  return (
    <div className="space-y-10">

      {/* Cinematic Toolbar */}
      <div className="bg-surface p-4 md:p-5 rounded-[2.5rem] flex flex-col md:flex-row gap-4 items-center shadow-nm-flat">
          <div className="relative w-full md:flex-1">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
            <input 
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, cargo ou setor..."
              className="w-full bg-surface-soft border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold placeholder-subtle text-strong focus:ring-4 focus:ring-brand/10 transition-all shadow-nm-inset" 
            />
          </div>

         <div className="flex w-full md:w-auto gap-4">
            <select value={filterDep} onChange={(e) => setFilterDep(e.target.value)}
              title="Filtrar por departamento"
              aria-label="Filtrar por departamento"
              className="flex-1 md:flex-none bg-surface-soft border-none text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-6 shadow-nm-inset focus:ring-4 focus:ring-brand/10 dark:[color-scheme:dark] text-main">
              <option value="">Departamentos</option>
              {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button 
              onClick={() => setViewMode(viewMode === "cards" ? "table" : "cards")}
              title={viewMode === "cards" ? "Alternar para tabela" : "Alternar para cards"}
              className="w-12 h-12 flex items-center justify-center bg-surface rounded-xl shadow-nm-flat border border-border-subtle text-muted hover:text-brand transition-all active:scale-95"
            >
               <i className={`fa-solid ${viewMode === 'cards' ? 'fa-table' : 'fa-grip'}`}></i>
            </button>
         </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((k, idx) => (
          <motion.div 
            key={k.label}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }}
            className={`rounded-3xl md:rounded-[2.5rem] p-4 md:p-6 flex items-center gap-4 md:gap-5 shadow-nm-flat transition-all bg-surface border border-border-subtle hover-nm-elevated`}
          >
            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl ${k.bg} ${k.color} flex items-center justify-center text-lg md:text-xl shadow-nm-inset border border-white/10`}>
               <i className={`fa-solid ${k.icon}`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-0.5">{k.label}</p>
              <p className={`text-2xl font-black tracking-tighter ${k.color}`}>{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
           <motion.div 
             key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="bg-surface border border-border-subtle rounded-[3rem] p-32 flex flex-col items-center gap-6 shadow-nm-flat"
           >
              <div className="w-16 h-16 rounded-full border-4 border-surface-soft border-t-brand animate-spin"></div>
              <p className="text-xs font-black uppercase tracking-[0.4em] text-muted">Analizando Ecossistema...</p>
           </motion.div>
        ) : viewMode === "cards" ? (
          <motion.div 
            key="cards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1"
          >
            {filtered.length > 0 ? filtered.map((c: any, idx) => (
              <motion.div 
                key={c.colaboradorID}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -8 }}
                onClick={() => handleOpenDetail(c)}
                className="group relative bg-surface shadow-nm-flat rounded-3xl md:rounded-[2.5rem] p-5 md:p-6 hover:shadow-nm-elevated hover:border-brand/20 active:scale-[0.98] transition-all cursor-pointer overflow-hidden border border-border-subtle"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand blur-3xl -mr-16 -mt-16 opacity-0 group-hover:opacity-20 transition-opacity"></div>
                
                <div className="flex items-center gap-5 mb-6 relative z-10">
                  <div className="p-1 rounded-2xl bg-surface shadow-nm-flat">
                    <SmartAvatar 
                      src={c.fotoColaborador} 
                      name={c.nome} 
                      size="lg" 
                      type="person"
                      status={c.ativo !== false ? 'online' : 'offline'}
                      className="ring-0"
                    />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-strong truncate leading-tight text-base">{c.nome}</h4>
                    <p className="text-[10px] font-black text-brand uppercase tracking-[0.15em] truncate mt-1">{c.cargo}</p>
                  </div>
                </div>

                <div className="space-y-3 pt-6 border-t border-border-subtle relative z-10">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-muted shadow-nm-inset">
                         <i className="fa-solid fa-building text-[10px]"></i>
                      </div>
                      <span className="text-xs font-bold text-main">{c.departamento}</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-muted shadow-nm-inset">
                         <i className="fa-solid fa-envelope text-[10px]"></i>
                      </div>
                      <span className="text-xs font-bold text-muted truncate tabular-nums">{c.email}</span>
                   </div>
                </div>

                <div className="flex items-center justify-between mt-8 pt-5 border-t border-border-subtle relative z-10">
                  <span className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase tracking-widest shadow-sm ${statusAtivo(c) ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20" : "bg-rose-500/10 text-rose-700 border border-rose-500/20"}`}>
                    {statusAtivo(c) ? "Ativo" : "Inativo"}
                  </span>
                  <div className="flex gap-2">
                    {canEdit && (
                      <>
                        <button onClick={(e) => handleEdit(c, e)} title="Editar" aria-label="Editar" className="w-10 h-10 flex items-center justify-center bg-surface text-muted hover:text-brand rounded-xl transition-all shadow-nm-flat border border-border-subtle">
                          <i className="fa-solid fa-pen-to-square text-[10px]"></i>
                        </button>
                        <button onClick={(e) => handleDelete(c.colaboradorID, e)} title="Excluir" aria-label="Excluir" className="w-10 h-10 flex items-center justify-center bg-surface text-muted hover:text-red-600 rounded-xl transition-all shadow-nm-flat border border-border-subtle">
                          <i className="fa-solid fa-trash text-[10px]"></i>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="col-span-full bg-surface border-2 border-dashed border-border-subtle rounded-[3rem] p-20 text-center text-muted shadow-nm-inset">
                <i className="fa-solid fa-user-astronaut text-6xl mb-6 block text-subtle"></i>
                <p className="text-xl font-black uppercase tracking-widest text-muted">Nenhum talento em órbita</p>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] overflow-hidden hidden md:block"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-soft border-b border-border-subtle text-muted text-[10px] font-black uppercase tracking-[0.2em]">
                    <th className="py-6 px-8">Talento</th>
                    <th className="py-6 px-8">Status</th>
                    <th className="py-6 px-8">Departamento</th>
                    <th className="py-6 px-8">Cargo</th>
                    <th className="py-6 px-8 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filtered.map((c: any) => {
                    const ativo = c.ativo !== false;
                    return (
                      <tr key={c.colaboradorID} onClick={() => handleOpenDetail(c)} className="group hover:bg-surface-soft transition-colors cursor-pointer text-main">
                        <td className="py-5 px-8">
                          <div className="flex items-center gap-4">
                            <SmartAvatar 
                              src={c.fotoColaborador} 
                              name={c.nome} 
                              size="md" 
                              type="person"
                              status={ativo ? 'online' : 'offline'}
                            />
                            <div className="min-w-0">
                               <p className="font-black text-strong text-sm leading-tight truncate">{c.nome}</p>
                               <p className="text-[10px] text-muted font-bold truncate mt-0.5 uppercase tracking-widest">{c.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-5 px-8">
                           <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl uppercase tracking-widest border transition-all shadow-sm ${ativo ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800"}`}>
                              {ativo ? "Ativo" : "Inativo"}
                           </span>
                        </td>
                        <td className="py-5 px-8">
                          <span className="bg-surface-soft text-muted font-black text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-xl border border-border-subtle whitespace-nowrap">
                             {c.departamento}
                          </span>
                        </td>
                        <td className="py-5 px-8 text-[10px] font-black text-brand uppercase tracking-widest whitespace-nowrap">
                           {c.cargo}
                        </td>
                        <td className="py-5 px-8 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <>
                                <button onClick={(e) => handleEdit(c, e)} title="Editar colaborador" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-brand hover:bg-white dark:hover:bg-white/5 transition-all"><i className="fa-solid fa-pen-to-square text-xs"></i></button>
                                <button onClick={(e) => handleDelete(c.colaboradorID, e)} title="Excluir colaborador" className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-red-600 hover:bg-white dark:hover:bg-white/5 transition-all"><i className="fa-solid fa-trash text-xs"></i></button>
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

        {/* Mobile View for Table Mode */}
        {!loading && viewMode === "table" && (
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filtered.map((c: any) => (
              <motion.div 
                key={c.colaboradorID} 
                onClick={() => handleOpenDetail(c)}
                className="bg-surface p-5 rounded-3xl border border-border-subtle flex items-center gap-4 active:scale-95 transition-all shadow-nm-flat"
              >
                <div className="w-14 h-14 rounded-2xl bg-brand overflow-hidden shrink-0 flex items-center justify-center text-white font-black">
                   {c.fotoColaborador ? (
                     <Image 
                       src={c.fotoColaborador} 
                       alt={c.nome} 
                       width={56} 
                       height={56} 
                       className="w-full h-full object-cover" 
                     />
                   ) : initials(c.nome)}
                </div>
                    <div className="flex-1 min-w-0">
                       <p className="text-sm font-black text-strong truncate">{c.nome}</p>
                       <p className="text-[10px] font-black text-brand uppercase tracking-widest mt-1">{c.cargo}</p>
                       <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5">{c.departamento}</p>
                    </div>
                <i className="fa-solid fa-chevron-right text-subtle text-xs"></i>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Slide-over Sidebars & Modals */}
      <ColaboradorDetailSidebar 
        colaborador={selectedColab}
        isOpen={isSidebarOpen}
        onClose={() => { setIsSidebarOpen(false); setIsCreateSidebarMode(false); }}
        initialEditMode={startSidebarInEditMode}
        createMode={isCreateSidebarMode}
        onColaboradorUpdated={(updated) => {
          setSelectedColab(updated);
          fetchColaboradores();
        }}
      />
    </div>
  );
}
