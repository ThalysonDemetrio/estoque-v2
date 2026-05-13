"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SolicitacoesService } from "@/services/solicitacoes.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { EquipamentosService } from "@/services/equipamentos.service";
import { SolicitacaoDetailSidebar } from "@/components/solicitacoes/SolicitacaoDetailSidebar";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { useToast } from "@/contexts/ToastContext";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { NMCombobox } from "@/components/ui/NMCombobox";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";

type ChecklistItemDraft = {
  ordem: number;
  descricao: string;
  tipoItem: string;
};

type FormState = {
  tipoSolicitacao: string;
  urgencia: string;
  solicitanteID: string;
  solicitanteNome: string;
  departamento: string;
  justificativa: string;
  descricaoProblema: string;
  tipoEquipamentoSolicitado: string;
  checklistTemplateID: string;
  checklistResponsavelID: string;
  checklistTitulo: string;
  checklistItens: ChecklistItemDraft[];
  dataNecessidade: string;
};

const STATUS_META: Record<string, { label: string; color: string; dot: string; bg: string; border: string }> = {
  pendente: { label: "Pendente", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-500/10", border: "border-amber-100 dark:border-amber-800", dot: "bg-amber-400" },
  em_atendimento: { label: "Em Atendimento", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10", border: "border-blue-100 dark:border-blue-800", dot: "bg-blue-500" },
  concluido: { label: "Concluido", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/10", border: "border-emerald-100 dark:border-emerald-800", dot: "bg-emerald-500" },
  rejeitado: { label: "Rejeitado", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10", border: "border-red-100 dark:border-red-800", dot: "bg-red-400" },
};

const URGENCIA_META: Record<string, { label: string; color: string; border: string }> = {
  baixa: { label: "Baixa", color: "bg-surface-soft text-muted", border: "border-border-subtle" },
  media: { label: "Media", color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400", border: "border-blue-100 dark:border-blue-800" },
  alta: { label: "Alta", color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400", border: "border-amber-100 dark:border-amber-800" },
  critica: { label: "Critica", color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400", border: "border-red-100 dark:border-red-800" },
};

const TIPO_LABELS: Record<string, string> = {
  manutencao: "Manutencao",
  alocacao: "Alocacao",
  substituicao: "Substituicao",
  demanda_manual: "Checklist",
};

const INITIAL_FORM: FormState = {
  tipoSolicitacao: "manutencao",
  urgencia: "media",
  solicitanteID: "",
  solicitanteNome: "",
  departamento: "",
  justificativa: "",
  descricaoProblema: "",
  tipoEquipamentoSolicitado: "",
  checklistTemplateID: "",
  checklistResponsavelID: "",
  checklistTitulo: "",
  checklistItens: [{ ordem: 1, descricao: "", tipoItem: "geral" }],
  dataNecessidade: "",
};

function SolicitacoesContent() {
  const searchParams = useSearchParams();
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [colaboradores, setColaboradores] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterUrgencia, setFilterUrgencia] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedSol, setSelectedSol] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const { hasPermission } = useAuth();
  const canEdit = useMemo(() => hasPermission("solicitacoes", "edit"), [hasPermission]);
  const toast = useToast();
  const { refreshTrigger } = useChat();

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sols, cols, tpls, eqs] = await Promise.all([
        SolicitacoesService.getSolicitacoes(),
        ColaboradoresService.getColaboradores(),
        SolicitacoesService.getChecklistTemplates(),
        EquipamentosService.getEquipamentos(),
      ]);
      setSolicitacoes(Array.isArray(sols) ? sols : []);
      setColaboradores(Array.isArray(cols) ? cols : []);
      setTemplates(Array.isArray(tpls) ? tpls : []);
      setEquipamentos(Array.isArray(eqs) ? eqs : []);
    } catch (err) {
      console.error("Erro ao buscar solicitacoes:", err);
      setSolicitacoes([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  useEffect(() => {
    if (isSidebarOpen && selectedSol) {
      const updated = solicitacoes.find(s => String(s.solicitacaoID) === String(selectedSol.solicitacaoID));
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedSol)) {
        setSelectedSol(updated);
      }
    }
  }, [solicitacoes, isSidebarOpen, selectedSol]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail?.path === "/solicitacoes") {
        setShowForm(true);
      }
    };
    window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
    return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
  }, [canEdit]);

  useEffect(() => {
    const openParam = searchParams.get("open");
    if (!openParam || loading || solicitacoes.length === 0) return;

    const target = solicitacoes.find(
      (s) => String(s.solicitacaoID) === openParam || String(s.protocolo) === openParam
    );

    if (target) {
      setSelectedSol(target);
      setIsSidebarOpen(true);
    }
  }, [searchParams, loading, solicitacoes]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setShowForm(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return solicitacoes.filter((s) => {
      const matchStatus = !filterStatus || s.status === filterStatus;
      const matchTipo = !filterTipo || s.tipoSolicitacao === filterTipo;
      const matchUrg = !filterUrgencia || s.urgencia === filterUrgencia;
      
      let matchDate = true;
      if (dateFrom || dateTo) {
        const d = new Date(s.createdAt || s.dataHora || s.dataSolicitacao);
        if (dateFrom && d < new Date(dateFrom)) matchDate = false;
        if (dateTo) {
          const dTo = new Date(dateTo);
          dTo.setHours(23, 59, 59, 999);
          if (d > dTo) matchDate = false;
        }
      }

      const haystack = [s.protocolo, s.solicitanteNome, s.departamento, s.descricaoResumo].join(" ").toLowerCase();
      const matchSearch = !search || haystack.includes(search.toLowerCase());
      return matchStatus && matchTipo && matchUrg && matchSearch && matchDate;
    });
  }, [solicitacoes, filterStatus, filterTipo, filterUrgencia, search, dateFrom, dateTo]);

  const kpis = [
    { label: "Total", value: solicitacoes.length, color: "text-strong", bg: "bg-surface-soft border-border-subtle", icon: "fa-clipboard-list" },
    { label: "Pendentes", value: solicitacoes.filter((s) => s.status === "pendente").length, color: "text-amber-600", bg: "bg-amber-500/5 border-amber-500/20", icon: "fa-clock" },
    { label: "Checklists", value: solicitacoes.filter((s) => s.tipoSolicitacao === "demanda_manual").length, color: "text-brand", bg: "bg-brand/5 border-brand/20", icon: "fa-list-check" },
    { label: "Concluidas", value: solicitacoes.filter((s) => s.status === "concluido").length, color: "text-emerald-500", bg: "bg-emerald-500/5 border-emerald-500/20", icon: "fa-circle-check" },
  ];

  const handleOpenDetail = (sol: any) => {
    setSelectedSol(sol);
    setIsSidebarOpen(true);
  };

  const updateChecklistItem = (idx: number, patch: Partial<ChecklistItemDraft>) => {
    setForm((prev) => ({
      ...prev,
      checklistItens: prev.checklistItens.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    }));
  };

  const addChecklistItem = () => {
    setForm((prev) => ({
      ...prev,
      checklistItens: [...prev.checklistItens, { ordem: prev.checklistItens.length + 1, descricao: "", tipoItem: "geral" }],
    }));
  };

  const removeChecklistItem = (idx: number) => {
    setForm((prev) => {
      const next = prev.checklistItens.filter((_, i) => i !== idx).map((item, i) => ({ ...item, ordem: i + 1 }));
      return { ...prev, checklistItens: next.length ? next : [{ ordem: 1, descricao: "", tipoItem: "geral" }] };
    });
  };

  const applyTemplate = (templateID: string) => {
    const template = templates.find((t) => t.templateID === templateID);
    if (!template) return;

    const items = (Array.isArray(template.itens) ? template.itens : []).map((item: any, i: number) => ({
      ordem: Number(item?.ordem || i + 1),
      descricao: String(item?.descricao || ""),
      tipoItem: String(item?.tipoItem || "geral"),
    }));

    setForm((prev) => ({
      ...prev,
      checklistTemplateID: templateID,
      checklistTitulo: prev.checklistTitulo || template.nome || "",
      checklistResponsavelID: prev.checklistResponsavelID || template.responsavelID || "",
      checklistItens: items.length ? items : prev.checklistItens,
    }));
  };

  const handleSelectSolicitante = (colaboradorID: string) => {
    const colaborador = colaboradores.find((c) => c.colaboradorID === colaboradorID);
    setForm((prev) => ({
      ...prev,
      solicitanteID: colaboradorID,
      solicitanteNome: colaborador?.nome || prev.solicitanteNome,
      departamento: colaborador?.departamento || prev.departamento,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = {
        tipoSolicitacao: form.tipoSolicitacao,
        urgencia: form.urgencia,
        solicitanteID: form.solicitanteID || null,
        solicitanteNome: form.solicitanteNome,
        departamento: form.departamento,
        justificativa: form.justificativa || null,
        descricaoProblema: form.descricaoProblema || null,
        dataNecessidade: form.dataNecessidade || null,
      };

      if (form.tipoSolicitacao === "manutencao") {
        payload.equipamentoAtualID = form.tipoEquipamentoSolicitado || null;
        payload.descricaoProblema = form.descricaoProblema || form.justificativa || "Solicitação de manutenção";
      }

      if (form.tipoSolicitacao === "alocacao" || form.tipoSolicitacao === "substituicao") {
        payload.tipoEquipamentoSolicitado = form.tipoEquipamentoSolicitado;
      }

      if (form.tipoSolicitacao === "demanda_manual") {
        const itensValidos = form.checklistItens
          .map((item, i) => ({ ordem: i + 1, descricao: item.descricao.trim(), tipoItem: item.tipoItem || "geral" }))
          .filter((item) => item.descricao);

        if (!form.checklistResponsavelID) {
          throw new Error("Selecione o colaborador que vai receber os itens do checklist.");
        }
        if (!itensValidos.length) {
          throw new Error("Adicione ao menos um item no checklist.");
        }

        payload.checklistTemplateID = form.checklistTemplateID || null;
        payload.checklistResponsavelID = form.checklistResponsavelID;
        payload.checklistTitulo = form.checklistTitulo || `Checklist ${form.solicitanteNome || "Demanda"}`;
        payload.checklistItens = itensValidos;
      }

      await SolicitacoesService.createSolicitacao(payload);
      toast.success("Solicitacao criada", "Fluxo registrado com sucesso.");
      setShowForm(false);
      setForm(INITIAL_FORM);
      await fetchData();
    } catch (err: any) {
      toast.error("Erro ao criar", err?.message || "Verifique os dados informados.");
    } finally {
      setSaving(false);
    }
  };

  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await SolicitacoesService.updateStatus(id, newStatus);
      toast.success("Status atualizado", `Solicitacao movida para ${newStatus}.`);
      fetchData();
    } catch (err: any) {
      toast.error("Erro ao atualizar", err?.message || "Nao foi possivel alterar o status.");
    }
  };  const KanbanColumn = ({ status, title, items, color }: { status: string; title: string; items: any[]; color: string }) => (
    <div className="flex flex-col h-full min-h-[600px] bg-surface-soft border border-border-subtle rounded-[2.5rem] p-4 group/col shadow-nm-inset">
      <div className="flex items-center justify-between mb-4 px-4 pt-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${color} animate-pulse`}></span>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted">{title}</h3>
        </div>
        <span className="bg-surface text-[10px] font-black uppercase tracking-widest text-muted px-3 py-1 rounded-full shadow-nm-flat">{items.length}</span>
      </div>
      
      <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-1 pb-4 px-1">
        {items.map((s) => {
          const um = URGENCIA_META[s.urgencia] || { label: s.urgencia, color: "bg-surface-soft text-muted" };
          return (
            <motion.div
              layout
              key={s.solicitacaoID}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => handleOpenDetail(s)}
              className="bg-surface border border-border-subtle rounded-3xl p-5 shadow-nm-flat hover:shadow-nm-elevated cursor-pointer transition-all group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand blur-3xl -mr-12 -mt-12 opacity-0 group-hover:opacity-10 transition-opacity"></div>

              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-mono font-black text-indigo-500/60 dark:text-indigo-400/40 uppercase tracking-widest">#{s.protocolo || s.solicitacaoID}</span>
                <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl ${um.color} border ${um.border} shadow-sm`}>
                  {um.label}
                </span>
              </div>
              
              <h4 className="text-xs font-black text-strong leading-tight mb-2 line-clamp-2 group-hover:text-brand transition-colors">
                {TIPO_LABELS[s.tipoSolicitacao] || s.tipoSolicitacao}
              </h4>
              <p className="text-[10px] font-medium text-muted line-clamp-2 mb-4 leading-relaxed italic opacity-70">&quot;{s.descricaoResumo}&quot;</p>
              
              <div className="pt-3 border-t border-border-subtle flex items-center gap-3">
                <SmartAvatar src={s.solicitanteFoto} name={s.solicitanteNome} size="xs" type="person" className="shadow-sm" />
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-main truncate leading-none mb-1">{s.solicitanteNome || "-"}</p>
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest truncate">{s.departamento || "-"}</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                 {canEdit && (
                   <>
                     {status !== 'concluido' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(s.solicitacaoID, 'concluido'); }}
                          title="Marcar como concluido"
                          className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                        >
                          <i className="fa-solid fa-check text-[10px]"></i>
                        </button>
                     )}
                     {status === 'pendente' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleUpdateStatus(s.solicitacaoID, 'em_atendimento'); }}
                          title="Atender"
                          className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
                        >
                          <i className="fa-solid fa-play text-[10px]"></i>
                        </button>
                     )}
                   </>
                 )}
              </div>
            </motion.div>
          );
        })}
        {items.length === 0 && (
          <div className="h-32 border-2 border-dashed border-border-subtle rounded-3xl flex flex-col items-center justify-center opacity-40">
             <i className="fa-solid fa-clipboard-list text-lg mb-2 text-muted"></i>
             <p className="text-[8px] font-black text-muted uppercase tracking-widest text-center px-4">Coluna vazia</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">

      {/* Toolbar & Cinematic Filters */}
      <div className="bg-surface border border-border-subtle p-4 md:p-5 rounded-[2.5rem] flex flex-col md:flex-row gap-4 items-center shadow-nm-flat">
        <div className="relative w-full md:flex-1">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Protocolo, solicitante ou descrição..."
            className="w-full bg-surface-soft border-none rounded-2xl py-3.5 pl-12 pr-4 text-sm font-bold placeholder-subtle text-strong focus:ring-4 focus:ring-brand/10 transition-all shadow-nm-inset"
          />
        </div>

        <div className="flex w-full md:w-auto gap-2 items-center">
          <div className="bg-surface-soft p-1.5 rounded-2xl shadow-nm-inset flex gap-1 mr-2 border border-border-subtle">
            <button 
              onClick={() => setViewMode("list")}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${viewMode === 'list' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-muted hover:text-brand'}`}
              title="Visão em Grade"
            >
              <i className="fa-solid fa-grip"></i>
            </button>
            <button 
              onClick={() => setViewMode("kanban")}
              className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center ${viewMode === 'kanban' ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'text-muted hover:text-brand'}`}
              title="Visão Kanban"
            >
              <i className="fa-solid fa-table-columns"></i>
            </button>
          </div>
          
          <div className="hidden lg:flex bg-surface-soft p-1.5 rounded-xl shadow-nm-inset border border-border-subtle items-center gap-2">
            <i className="fa-solid fa-calendar-days text-[10px] text-muted ml-2"></i>
            <input 
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-main dark:[color-scheme:dark]"
              title="Data inicial"
            />
            <span className="text-[10px] text-muted font-black opacity-30">→</span>
            <input 
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-main dark:[color-scheme:dark]"
              title="Data final"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            title="Filtrar por status"
            aria-label="Filtrar por status"
            className="flex-1 md:flex-none bg-surface-soft border-none text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-6 shadow-nm-inset focus:ring-4 focus:ring-brand/10 dark:[color-scheme:dark] text-main"
          >
            <option value="">Status</option>
            <option value="pendente">Pendente</option>
            <option value="em_atendimento">Atendimento</option>
            <option value="concluido">Concluido</option>
            <option value="rejeitado">Rejeitado</option>
          </select>

          <select
            value={filterTipo}
            onChange={(e) => setFilterTipo(e.target.value)}
            title="Filtrar por tipo"
            aria-label="Filtrar por tipo"
            className="flex-1 md:flex-none bg-surface-soft border-none text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-6 shadow-nm-inset focus:ring-4 focus:ring-brand/10 dark:[color-scheme:dark] text-main"
          >
            <option value="">Tipo</option>
            <option value="manutencao">Manutencao</option>
            <option value="alocacao">Alocacao</option>
            <option value="substituicao">Substituicao</option>
            <option value="demanda_manual">Checklist</option>
          </select>

          <select
            value={filterUrgencia}
            onChange={(e) => setFilterUrgencia(e.target.value)}
            title="Filtrar por urgencia"
            aria-label="Filtrar por urgencia"
            className="flex-1 md:flex-none bg-surface-soft border-none text-[10px] font-black uppercase tracking-widest rounded-xl py-3.5 px-6 shadow-nm-inset focus:ring-4 focus:ring-brand/10 dark:[color-scheme:dark] text-main"
          >
            <option value="">Urgencia</option>
            <option value="critica">Critica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baixa">Baixa</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map((k, idx) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-4 md:p-6 bg-surface border border-border-subtle rounded-3xl md:rounded-[2.5rem] shadow-nm-flat hover-nm-elevated flex items-center gap-4 md:gap-5 transition-all group`}
          >
            <div className={`w-12 h-12 rounded-2xl ${k.bg} ${k.color} flex items-center justify-center text-xl shadow-nm-inset group-hover:bg-brand/10 transition-colors`}>
               <i className={`fa-solid ${k.icon} text-lg`}></i>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-0.5 leading-none">{k.label}</p>
              <p className={`text-2xl font-black tracking-tighter ${k.color}`}>{k.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-32 flex flex-col items-center gap-4 animate-pulse">
              <div className="w-16 h-16 rounded-full border-4 border-surface-soft border-t-brand animate-spin"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">Carregando...</p>
            </motion.div>
          ) : viewMode === "kanban" ? (
            <motion.div 
              key="kanban"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-4 gap-6 overflow-x-auto pb-8 custom-scrollbar"
            >
              <KanbanColumn status="pendente" title="Pendentes" color="bg-amber-400" items={filtered.filter(s => s.status === 'pendente')} />
              <KanbanColumn status="em_atendimento" title="Em Atendimento" color="bg-blue-500" items={filtered.filter(s => s.status === 'em_atendimento')} />
              <KanbanColumn status="concluido" title="Concluidas" color="bg-emerald-500" items={filtered.filter(s => s.status === 'concluido')} />
              <KanbanColumn status="rejeitado" title="Rejeitadas" color="bg-red-400" items={filtered.filter(s => s.status === 'rejeitado')} />
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-surface border-2 border-dashed border-border-subtle rounded-[3rem] p-24 text-center">
              <i className="fa-solid fa-clipboard-list text-6xl text-surface-soft mb-6"></i>
              <h3 className="text-xl font-black text-muted uppercase tracking-widest">Nenhuma solicitacao encontrada</h3>
            </motion.div>
          ) : (
            <motion.div 
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
            >
              {filtered.map((s, idx) => {
                const sm = STATUS_META[s.status] || { label: s.status, color: "text-slate-500", bg: "bg-slate-50", dot: "bg-slate-400" };
                const um = URGENCIA_META[s.urgencia] || { label: s.urgencia, color: "bg-slate-50 text-slate-500" };
                return (
                    <motion.div
                      layout
                      key={s.solicitacaoID || idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -8 }}
                      onClick={() => handleOpenDetail(s)}
                      className="bg-surface border border-border-subtle rounded-3xl md:rounded-[2.5rem] p-6 md:p-8 shadow-nm-flat hover:shadow-nm-elevated hover:border-brand/20 cursor-pointer transition-all group relative overflow-hidden"
                    >
                    <div className="flex items-center justify-between mb-8">
                      <span className="text-[10px] font-mono font-black text-brand bg-brand/10 px-3 py-1 rounded-xl uppercase tracking-widest">
                        #{s.protocolo || s.solicitacaoID}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${um.color} ${um.border} shadow-sm`}>
                        {um.label}
                      </span>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xl font-black text-strong leading-tight mb-2 group-hover:text-brand transition-colors">
                          {TIPO_LABELS[s.tipoSolicitacao] || s.tipoSolicitacao}
                        </h3>
                        <p className="text-sm font-medium text-muted line-clamp-2 italic">&quot;{s.descricaoResumo}&quot;</p>
                      </div>

                      <div className="flex items-center gap-4 pt-4 border-t border-border-subtle">
                        <SmartAvatar 
                          src={s.solicitanteFoto} 
                          name={s.solicitanteNome} 
                          size="md" 
                          type="person"
                        />
                        <div>
                          <p className="text-[10px] font-black text-main">{s.solicitanteNome || "-"}</p>
                          <p className="text-[10px] font-black text-muted uppercase tracking-widest">{s.departamento || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <div className={`mt-8 -mx-8 -mb-8 px-8 py-4 flex items-center justify-between border-t border-border-subtle transition-colors ${sm.bg}`}>
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest ${sm.color} ${sm.border} shadow-sm flex items-center gap-2`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sm.dot} animate-pulse`}></span>
                          {sm.label}
                        </span>
                      </div>
                      <button title="Abrir solicitacao" aria-label="Abrir solicitacao" className="w-8 h-8 rounded-lg bg-surface text-muted flex items-center justify-center shadow-sm">
                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SolicitacaoDetailSidebar
        solicitacao={selectedSol}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onUpdate={fetchData}
      />

      {showForm && (
        <SlidebarPanel
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          panelClassName="bg-surface h-full w-full shadow-2xl overflow-hidden flex flex-col border-l border-border-subtle"
        >
          <SlidebarHeader
            title="Nova Solicitacao"
            subtitle="Abertura de demanda"
            iconClassName="fa-clipboard-list"
            onClose={() => setShowForm(false)}
             className="p-8 border-b border-border-subtle relative overflow-hidden shrink-0 bg-surface flex items-center justify-between"
             titleClassName="text-xl font-black tracking-tight text-strong line-clamp-1"
            subtitleClassName="text-[10px] font-black text-brand uppercase tracking-[0.2em] mt-1"
          />

          <form onSubmit={handleSubmit} className="p-10 space-y-8 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Tipo</label>
                <select
                  value={form.tipoSolicitacao}
                  onChange={(e) => setForm((p) => ({ ...p, tipoSolicitacao: e.target.value }))}
                  title="Tipo de solicitacao"
                  aria-label="Tipo de solicitacao"
                  required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all dark:[color-scheme:dark] text-main shadow-nm-inset"
                >
                  <option value="manutencao">Manutencao</option>
                  <option value="alocacao">Alocacao</option>
                  <option value="substituicao">Substituicao</option>
                  <option value="demanda_manual">Checklist</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Urgencia</label>
                <select
                  value={form.urgencia}
                  onChange={(e) => setForm((p) => ({ ...p, urgencia: e.target.value }))}
                  title="Urgencia"
                  aria-label="Urgencia"
                  required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all dark:[color-scheme:dark] text-main shadow-nm-inset"
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Critica</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest text-brand">Data Limite (Execução)</label>
                <input
                  type="date"
                  value={form.dataNecessidade}
                  onChange={(e) => setForm((p) => ({ ...p, dataNecessidade: e.target.value }))}
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark] shadow-nm-inset"
                />
                <p className="text-[9px] font-bold text-muted italic ml-2">Prazo máximo para a conclusão da demanda</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Solicitante</label>
                <NMCombobox
                  placeholder="Pesquisar colaborador..."
                  options={colaboradores.map(c => ({
                    value: c.colaboradorID,
                    label: c.nome,
                    sublabel: c.departamento || "-",
                    icon: "fa-user"
                  }))}
                  value={form.solicitanteID}
                  onChange={handleSelectSolicitante}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">Departamento</label>
                <input
                  type="text"
                  value={form.departamento}
                  onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))}
                  title="Departamento"
                  aria-label="Departamento"
                  placeholder="Ex: TI"
                  required
                  className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle shadow-nm-inset"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">Nome do solicitante</label>
              <input
                type="text"
                value={form.solicitanteNome}
                onChange={(e) => setForm((p) => ({ ...p, solicitanteNome: e.target.value }))}
                title="Nome do solicitante"
                aria-label="Nome do solicitante"
                placeholder="Nome completo"
                required
                className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle shadow-nm-inset"
              />
            </div>

            {(form.tipoSolicitacao === "manutencao" || form.tipoSolicitacao === "alocacao" || form.tipoSolicitacao === "substituicao") && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest">
                  {(form.tipoSolicitacao === "manutencao" || form.tipoSolicitacao === "substituicao") ? "Equipamento (Etiqueta)" : "Tipo de Equipamento Desejado"}
                </label>
                {(form.tipoSolicitacao === "manutencao" || form.tipoSolicitacao === "substituicao") ? (
                  <NMCombobox
                    placeholder="Pesquisar etiqueta (ex: NOTE-001)..."
                    options={equipamentos.map(eq => ({
                      value: eq.etiquetaID,
                      label: eq.etiquetaID,
                      sublabel: `${eq.marca} ${eq.modelo} | ${eq.status} | ${eq.colaboradorAtualNome || 'Disponível'}`,
                      icon: "fa-laptop"
                    }))}
                    value={form.tipoEquipamentoSolicitado}
                    onChange={(val) => setForm(p => ({ ...p, tipoEquipamentoSolicitado: val }))}
                  />
                ) : (
                  <select
                    value={form.tipoEquipamentoSolicitado}
                    onChange={(e) => setForm((p) => ({ ...p, tipoEquipamentoSolicitado: e.target.value }))}
                    required
                    title="Selecione o tipo de equipamento"
                    aria-label="Selecione o tipo de equipamento"
                    className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all shadow-nm-inset text-main placeholder-subtle dark:[color-scheme:dark]"
                  >
                    <option value="">Selecione...</option>
                    <option value="Notebook">Notebook</option>
                    <option value="Monitor">Monitor</option>
                    <option value="Computador">Computador</option>
                    <option value="Switch">Switch</option>
                    <option value="Roteador">Roteador</option>
                    <option value="Fone de Ouvido">Fone de Ouvido</option>
                    <option value="Braço Articulado">Braço Articulado</option>
                    <option value="Mouse">Mouse</option>
                    <option value="Teclado">Teclado</option>
                    <option value="Cabo">Cabo</option>
                    <option value="Acessório">Acessório</option>
                    <option value="Outro">Outro</option>
                  </select>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-muted uppercase tracking-widest">Descricao / Justificativa</label>
              <textarea
                value={form.justificativa}
                onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value, descricaoProblema: e.target.value }))}
                rows={4}
                title="Descricao e justificativa"
                aria-label="Descricao e justificativa"
                placeholder="Descreva a necessidade da solicitacao"
                className="w-full px-6 py-4 bg-surface-soft border-none rounded-[1.25rem] text-sm font-bold outline-none focus:ring-4 focus:ring-brand/10 transition-all resize-none text-main placeholder-subtle shadow-nm-inset"
              />
            </div>

            {form.tipoSolicitacao === "demanda_manual" && (
              <div className="space-y-4 rounded-3xl border border-brand/20 bg-brand/5 p-6">
                <h3 className="text-sm font-black text-brand uppercase tracking-widest">Checklist da demanda</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Template</label>
                    <select
                      value={form.checklistTemplateID}
                      onChange={(e) => applyTemplate(e.target.value)}
                      title="Selecionar template"
                      aria-label="Selecionar template"
                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-xl text-sm font-bold text-main dark:[color-scheme:dark] shadow-nm-inset outline-none focus:ring-4 focus:ring-brand/10"
                    >
                      <option value="">Sem template</option>
                      {templates.map((tpl: any) => (
                        <option key={tpl.templateID} value={tpl.templateID}>
                          {tpl.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest">Colaborador que vai receber</label>
                    <NMCombobox
                      placeholder="Selecionar colaborador..."
                      options={colaboradores.map(c => ({
                        value: c.colaboradorID,
                        label: c.nome,
                        sublabel: c.colaboradorID,
                        icon: "fa-user"
                      }))}
                      value={form.checklistResponsavelID}
                      onChange={(val) => setForm(p => ({ ...p, checklistResponsavelID: val }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted uppercase tracking-widest">Titulo do checklist</label>
                  <input
                    type="text"
                    value={form.checklistTitulo}
                    onChange={(e) => setForm((p) => ({ ...p, checklistTitulo: e.target.value }))}
                    title="Titulo do checklist"
                    aria-label="Titulo do checklist"
                    placeholder="Checklist de onboarding"
                    className="w-full px-4 py-3 bg-surface-soft border-none rounded-xl text-sm font-bold text-main placeholder-subtle shadow-nm-inset outline-none focus:ring-4 focus:ring-brand/10"
                  />
                </div>

                <div className="space-y-3">
                  {form.checklistItens.map((item, idx) => (
                    <div key={`item-${idx}`} className="grid grid-cols-1 md:grid-cols-[60px_1fr_170px_80px] gap-2">
                      <input
                        type="number"
                        value={item.ordem}
                        onChange={(e) => updateChecklistItem(idx, { ordem: Number(e.target.value) || idx + 1 })}
                        className="px-3 py-2 bg-surface-soft border border-border-subtle rounded-xl text-sm font-semibold text-main"
                        title="Ordem"
                        aria-label="Ordem"
                      />
                      <input
                        type="text"
                        value={item.descricao}
                        onChange={(e) => updateChecklistItem(idx, { descricao: e.target.value })}
                        className="px-3 py-2 bg-surface-soft border border-border-subtle rounded-xl text-sm font-semibold text-main"
                        placeholder="Ex: Instalar Office"
                      />
                      <select
                        value={item.tipoItem}
                        onChange={(e) => updateChecklistItem(idx, { tipoItem: e.target.value })}
                        title="Tipo do item"
                        aria-label="Tipo do item"
                        className="px-3 py-2 bg-surface-soft border border-border-subtle rounded-xl text-sm font-semibold text-main dark:[color-scheme:dark]"
                      >
                        <option value="geral">Geral</option>
                        <option value="instalacao">Instalacao</option>
                        <option value="alocacao">Alocacao</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(idx)}
                        className="px-4 py-2 bg-red-500/10 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-500/20"
                      >
                        Remover
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addChecklistItem}
                  className="px-4 py-2 bg-surface border-2 border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-brand hover:border-brand/30 transition-all shadow-sm flex items-center gap-2"
                >
                  <i className="fa-solid fa-plus text-[8px]"></i>
                  Novo Item
                </button>
              </div>
            )}

            <SlidebarFooter className="px-0 pt-6 border-0 bg-transparent">
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-8 py-4 text-muted hover:text-strong font-black uppercase text-[10px] tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-10 py-4 bg-brand text-white rounded-[1.25rem] hover:bg-brand/90 font-black uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-brand/20 disabled:opacity-50 hover:scale-105 active:scale-95"
                >
                  {saving ? "Salvando..." : "Criar Solicitacao"}
                </button>
              </div>
            </SlidebarFooter>
          </form>
        </SlidebarPanel>
      )}
    </div>
  );
}

export default function SolicitacoesPage() {
  return (
    <Suspense fallback={
       <div className="py-32 flex flex-col items-center gap-4 animate-pulse">
         <div className="w-16 h-16 rounded-full border-4 border-surface-soft border-t-brand animate-spin"></div>
         <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">Carregando Demandas...</p>
       </div>
    }>
      <SolicitacoesContent />
    </Suspense>
  );
}
