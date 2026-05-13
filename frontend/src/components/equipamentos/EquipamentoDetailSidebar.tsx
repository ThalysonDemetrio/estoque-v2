"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useChat } from "@/contexts/ChatContext";
import { useToast } from "@/contexts/ToastContext";
import { useTheme } from "@/contexts/ThemeContext";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { api } from "@/lib/api-client";
import { calculateAssetHealth } from "@/lib/health";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { NMCombobox } from "@/components/ui/NMCombobox";
import { EquipmentLabelGenerator } from "./EquipmentLabelGenerator";

import { Equipamento, Colaborador, Movimentacao } from "@/types";

interface Props {
  equipamento: Equipamento | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (eq: Equipamento) => void;
  onRefresh?: () => void;
}

type Tab = "info" | "actions" | "history";

const QUICK_ACTIONS = [
  { id: "editar",      icon: "fa-pen",              label: "Editar Equipamento",   color: "bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border-indigo-500/10", desc: "Alterar dados e especificações" },
  { id: "retornar",    icon: "fa-house-medical-circle-check", label: "Retornar de Manutenção", color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/10", desc: "Finalizar reparo e voltar ao estoque", statusFilter: "manutenção" },
  { id: "movimentar",  icon: "fa-arrows-rotate",    label: "Movimentar Ativo",    color: "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/10",    desc: "Alocar, devolver ou registrar manutenção" },
  { id: "devolucao",    icon: "fa-arrow-rotate-left", label: "Devolver para Estoque",  color: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/10",     desc: "Registrar retorno do ativo" },
  { id: "solicitacao", icon: "fa-file-pen",         label: "Solicitar Reparo",    color: "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/10",  desc: "Criar protocolo de solicitação" },
  { id: "checklist",   icon: "fa-list-check",       label: "Realizar Vistoria", color: "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/10", desc: "Registrar inspeção do equipamento" },
  { id: "etiqueta",    icon: "fa-barcode",          label: "Gerar Etiqueta",       color: "bg-brand/10 text-brand hover:bg-brand/20 border-brand/10",         desc: "Baixar código de barras e QR" },
  { id: "rastrear",    icon: "fa-route",            label: "Rastrear Histórico",      color: "bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border-purple-500/10",    desc: "Ver histórico completo" },
  { id: "excluir",     icon: "fa-trash",            label: "Baixar / Excluir",     color: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/10",       desc: "Remover do inventário ativo" },
];

export function EquipamentoDetailSidebar({ equipamento, isOpen, onClose, onEdit, onRefresh }: Props) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [tab, setTab] = useState<Tab>("info");
  const [history, setHistory] = useState<Movimentacao[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [movForm, setMovForm] = useState({ tipo: "alocacao", descricao: "" });
  const [showMov, setShowMov] = useState(false);
  const [showLabel, setShowLabel] = useState(false);
  const [submittingMov, setSubmittingMov] = useState(false);
  const [checklistItems, setChecklistItems] = useState<{ label: string; done: boolean }[]>([
    { label: "Verificar estado físico (tela, teclado, carcaça)", done: false },
    { label: "Testar funcionamento do equipamento", done: false },
    { label: "Checar carga/alimentação elétrica", done: false },
    { label: "Validar etiqueta patrimonial", done: false },
    { label: "Conferir acessórios inclusos", done: false },
  ]);
  const [equipamentoDetalhado, setEquipamentoDetalhado] = useState<Equipamento | null>(null);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [selectedColaboradorID, setSelectedColaboradorID] = useState("");
  const [assigningUser, setAssigningUser] = useState(false);
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { openChat, refreshTrigger, triggerRefresh } = useChat();
  const [isImproviso, setIsImproviso] = useState(false);
  const [selectedImprovisoID, setSelectedImprovisoID] = useState("");
  const [repairDetails, setRepairDetails] = useState("");
  const [availableImprovisoEquips, setAvailableImprovisoEquips] = useState<Equipamento[]>([]);
  const [loadingImproviso, setLoadingImproviso] = useState(false);
  const movFormRef = useRef<HTMLDivElement>(null);

  const fetchHistory = useCallback(async () => {
    if (!equipamento) return;
    setLoadingHistory(true);
    try {
      const res = await api.fetchWithRetry(`${api.baseURL}/api/movimentacoes/relatorios/rastreabilidade/${equipamento.etiquetaID}`);
      setHistory(Array.isArray(res?.data) ? res.data.reverse() : []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [equipamento]);

  useEffect(() => {
    if (isOpen && equipamento) {
      setTab("info");
      setShowMov(false);
      setSelectedColaboradorID("");
      
      // Delay fetching heavy data to allow the animation to complete smoothly
      const timer = setTimeout(() => {
        fetchHistory();
      }, 400); 
      return () => clearTimeout(timer);
    }
  }, [isOpen, equipamento, fetchHistory, refreshTrigger]);
    
  useEffect(() => {
    if (!isOpen || !equipamento) return;

    const timer = setTimeout(() => {
      const loadExtraData = async () => {
        try {
          const [detalhes, listaColaboradores] = await Promise.all([
            EquipamentosService.getEquipamento(equipamento.etiquetaID),
            ColaboradoresService.getColaboradores({}),
          ]);
          setEquipamentoDetalhado(detalhes || null);
          setColaboradores(Array.isArray(listaColaboradores) ? listaColaboradores.filter((c: any) => c?.ativo !== false) : []);
        } catch {
          setEquipamentoDetalhado(null);
          setColaboradores([]);
        }
      };
      loadExtraData();
    }, 500);

    return () => clearTimeout(timer);
  }, [isOpen, equipamento, refreshTrigger]);

  const { healthScore: score, reasons } = useMemo(() => {
    if (!equipamento) return { healthScore: 100, reasons: [] };
    return calculateAssetHealth(equipamentoDetalhado || equipamento);
  }, [equipamento, equipamentoDetalhado]);

  const healthColor = score > 70 ? "text-emerald-400" : score > 40 ? "text-amber-400" : "text-red-400";
  const healthBg = score > 70 ? "bg-emerald-500" : score > 40 ? "bg-amber-500" : "bg-red-500";

  const handleAction = (id: string) => {
    switch (id) {
      case "editar":
        if (equipamento) onEdit?.(equipamento);
        break;
      case "movimentar":
      case "retornar":
      case "devolucao":
        if (equipamento?.propriedade === "usuario") {
          toastError("Operação não permitida", "Equipamento pessoal não pode ser realocado.");
          return;
        }
        if (id === "movimentar") {
          setShowMov(true);
          setTab("actions");
        } else if (id === "retornar") {
          setMovForm({ tipo: "alocacao", descricao: "Retorno de manutenção concluído. Equipamento disponível para uso." });
          setIsImproviso(false);
          setRepairDetails("");
          setShowMov(true);
          setTab("actions");
          const lastAloc = history.find(h => h.tipoMovimentacao === "alocacao");
          if (lastAloc?.colaboradorID) setSelectedColaboradorID(lastAloc.colaboradorID);
        } else {
          setMovForm({ tipo: "devolucao", descricao: "Devolução automática via ação rápida" });
          setIsImproviso(false);
          setRepairDetails("");
          setShowMov(true);
          setTab("actions");
        }
        break;
      case "solicitacao":
        onClose();
        router.push(`/solicitacoes?equipamento=${equipamento?.etiquetaID}`);
        break;
      case "rastrear":
        onClose();
        router.push(`/rastreabilidade?id=${equipamento?.etiquetaID}`);
        break;
      case "etiqueta":
        setShowLabel(true);
        break;
      case "checklist":
        onClose();
        router.push(`/diagnosticos?open=${equipamento?.etiquetaID}`);
        break;
      case "excluir":
        if (window.confirm(`Tem certeza que deseja baixar ${equipamento?.etiquetaID}?`)) {
          EquipamentosService.deleteEquipamento(equipamento!.etiquetaID).then(() => {
            success("Equipamento baixado", `${equipamento?.etiquetaID} removido do inventário.`);
            triggerRefresh(); // Sincroniza ecossistema
            onRefresh?.();
            onClose();
          }).catch(() => toastError("Erro", "Não foi possível excluir o equipamento."));
        }
        break;
    }
  };

  useEffect(() => {
    if (showMov && movForm.tipo === "manutencao" && isImproviso) {
      const loadAvailable = async () => {
        setLoadingImproviso(true);
        try {
          const res = await EquipamentosService.getEquipamentos({ status: "Disponível", tipoEquipamento: equipamento?.tipoEquipamento });
          setAvailableImprovisoEquips(res.filter(e => e.etiquetaID !== equipamento?.etiquetaID));
        } catch {
          setAvailableImprovisoEquips([]);
        } finally {
          setLoadingImproviso(false);
        }
      };
      loadAvailable();
    }
    
    if (showMov && movForm.tipo === "alocacao" && (equipamento?.status === "Manutenção" || movForm.tipo === "alocacao") && isImproviso && selectedColaboradorID) {
       const loadUserItems = async () => {
         setLoadingImproviso(true);
         try {
           const res = await EquipamentosService.getEquipamentos({ colaboradorAtualID: selectedColaboradorID });
           // Se estivermos devolvendo o principal, o improviso é qualquer outro item do usuário do mesmo tipo
           setAvailableImprovisoEquips(res.filter(e => e.etiquetaID !== equipamento?.etiquetaID));
         } catch {
           setAvailableImprovisoEquips([]);
         } finally {
           setLoadingImproviso(false);
         }
       };
       loadUserItems();
    }
  }, [showMov, movForm.tipo, isImproviso, equipamento, selectedColaboradorID]);
  
  // Auto-scroll to form when action is clicked
  useEffect(() => {
    if (showMov) {
      setTimeout(() => {
        movFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300); // Wait for AnimatePresence transition
    }
  }, [showMov]);

  const handleMovimentar = async () => {
    if (!equipamento) return;
    
    const motivoFinal = movForm.descricao.trim() || `Movimentação de ${movForm.tipo} realizada via Painel`;
    
    try {
      setSubmittingMov(true);
      const isDonoRequired = movForm.tipo === "alocacao" || movForm.tipo === "transferencia";
      
      if (isDonoRequired && !selectedColaboradorID) {
        toastError("Atenção", "Selecione um colaborador para esta movimentação.");
        setSubmittingMov(false);
        return;
      }

      // 1. Registrar a movimentação principal
      const motivoComReparo = repairDetails ? `${motivoFinal}\nREPARO REALIZADO: ${repairDetails}` : motivoFinal;
      
      await MovimentacoesService.createMovimentacao({
        equipamentoID: equipamento.etiquetaID,
        tipoMovimentacao: movForm.tipo as any,
        colaboradorID: isDonoRequired ? selectedColaboradorID : undefined,
        novoDonoID: isDonoRequired ? selectedColaboradorID : undefined,
        motivo: motivoComReparo,
        dataHora: new Date().toISOString(),
        responsavel: "Usuário (via Painel)",
      });

      // 2. Lógica Extra: Alocação de Improviso (Entrada em Manutenção)
      if (movForm.tipo === "manutencao" && isImproviso && selectedImprovisoID) {
        await MovimentacoesService.createMovimentacao({
          equipamentoID: selectedImprovisoID,
          tipoMovimentacao: "alocacao",
          colaboradorID: equipamento.colaboradorAtualID || undefined,
          novoDonoID: equipamento.colaboradorAtualID || undefined,
          motivo: `Reserva/Improviso alocado devido à manutenção do item ${equipamento.etiquetaID}`,
          responsavel: "Sistema (Ação de Usuário)",
          dataHora: new Date().toISOString(),
        });
        success("Improviso alocado", `Reserva #${selectedImprovisoID} entregue ao usuário.`);
      }

      // 3. Lógica Extra: Recolhimento de Improviso (Qualquer Alocação/Troca)
      if (movForm.tipo === "alocacao" && isImproviso && selectedImprovisoID) {
        await MovimentacoesService.createMovimentacao({
          equipamentoID: selectedImprovisoID,
          tipoMovimentacao: "devolucao",
          motivo: `Recolhimento de item reserva/temporário devido à alocação do item #${equipamento.etiquetaID}`,
          responsavel: "Sistema (Ação de Usuário)",
          dataHora: new Date().toISOString(),
        });
        success("Item recolhido", `Temporário #${selectedImprovisoID} retornou ao estoque.`);
      }
      
      success("Concluído", `Movimentação de ${movForm.tipo} realizada com sucesso.`);
      setShowMov(false);
      setIsImproviso(false);
      setSelectedImprovisoID("");
      setRepairDetails("");
      setMovForm({ tipo: "alocacao", descricao: "" });
      setSelectedColaboradorID("");
      fetchHistory();
      triggerRefresh(); // Sincroniza ecossistema
      onRefresh?.();
    } catch (err: any) {
      console.error("Erro na movimentacao:", err);
      const msg = err.response?.data?.error || err.message || "Não foi possível registrar a movimentação.";
      toastError("Erro na Movimentação", msg);
    } finally {
      setSubmittingMov(false);
    }
  };

  const getColaboradorNome = (colaboradorID?: string | null) => {
    if (!colaboradorID) return "Nao atribuido";
    const found = colaboradores.find((c) => c.colaboradorID === colaboradorID);
    return found?.nome || colaboradorID;
  };

  const getEquipamentoDescricao = () => {
    const descricaoDireta = String(equipamentoDetalhado?.descricao || "").trim();
    const observacoes = String(equipamentoDetalhado?.observacoes || equipamento?.observacoes || "").trim();
    const specsDescricao = String(equipamentoDetalhado?.especificacoes?.descricao || "").trim();

    if (descricaoDireta) return descricaoDireta;
    if (observacoes) return observacoes;
    if (specsDescricao) return specsDescricao;

    const local = equipamento?.localizacao ? ` em ${equipamento.localizacao}` : "";
    return `${equipamento?.tipoEquipamento} ${equipamento?.marca} ${equipamento?.modelo}${local}.`;
  };

  const handleAssignNewUser = async () => {
    if (!equipamento || !selectedColaboradorID) {
      toastError("Selecione um colaborador", "Escolha quem recebera o equipamento.");
      return;
    }

    const eqId = equipamento.etiquetaID;
    const isTransfer = !!equipamento.colaboradorAtualID;

    const selected = colaboradores.find((c: any) => c.colaboradorID === selectedColaboradorID);
    if (!selected) {
      toastError("Colaborador invalido", "Nao foi possivel localizar o colaborador selecionado.");
      return;
    }

    try {
      setAssigningUser(true);
      await MovimentacoesService.createMovimentacao({
        equipamentoID: eqId,
        tipoMovimentacao: isTransfer ? "transferencia" : "alocacao",
        colaboradorID: selectedColaboradorID,
        novoDonoID: selectedColaboradorID,
        motivo: `Atribuição via Painel de equipamentos para ${selected.nome}`,
        responsavel: "Usuário (via Painel)",
        dataHora: new Date().toISOString(),
      });

      success("Atribuicao concluida", `${equipamento.etiquetaID} agora esta com ${selected.nome}.`);
      setSelectedColaboradorID("");
      fetchHistory();
      triggerRefresh(); // Sincroniza ecossistema
      onRefresh?.();
    } catch {
      toastError("Erro", "Nao foi possivel atribuir o equipamento para o novo usuario.");
    } finally {
      setAssigningUser(false);
    }
  };

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "info",    label: "Detalhes",  icon: "fa-circle-info" },
    { id: "actions", label: "Ações",     icon: "fa-bolt" },
    { id: "history", label: "Timeline",  icon: "fa-clock-rotate-left" },
  ];

  if (!isOpen || !equipamento) return null;

  return (
    <SlidebarPanel
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="bg-white dark:bg-slate-900 h-full w-full md:border-l border-border-subtle shadow-none md:shadow-2xl flex flex-col"
      contentClassName="flex-1 overflow-y-auto pb-0"
    >
      <div
        className="h-full w-full flex flex-col equip-sidebar-surface relative overflow-hidden bg-surface"
      >
      <SlidebarHeader
        title={`${equipamento.marca} ${equipamento.modelo}`}
        subtitle={`#${equipamento.etiquetaID} · ${equipamento.tipoEquipamento}`}
        onClose={onClose}
        actions={
          <button
            onClick={() => handleAction("editar")}
            className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 text-brand hover:bg-brand/20 flex items-center justify-center transition-all"
            title="Editar"
            aria-label="Editar"
          >
            <i className="fa-solid fa-pen text-xs" />
          </button>
        }
         className="p-5 md:p-8 border-b border-border-subtle bg-surface relative overflow-hidden shrink-0 flex items-center justify-between"
        titleClassName="text-sm md:text-base font-black truncate text-strong"
        subtitleClassName="text-[9px] md:text-[10px] font-black text-brand uppercase tracking-[0.15em] truncate mt-1"
      />

        {/* Health Bar */}
        <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] font-black text-muted uppercase tracking-widest">Saúde do Ativo</span>
              <span className={`text-xs font-black ${healthColor}`}>{score}%</span>
            </div>
            <div className="h-1.5 bg-surface-tertiary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${score}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full rounded-full ${healthBg}`}
              />
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border
            ${(equipamento.status || "").toLowerCase().includes("uso")
              ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
              : (equipamento.status || "").toLowerCase().includes("dispon")
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
            {equipamento.status || "—"}
          </div>
        </div>
        {reasons.length > 0 && (
          <div className="px-5 py-3 bg-surface-soft/30 space-y-1.5 border-b border-border-subtle">
             <p className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1">Diagnóstico do Score</p>
             <div className="flex flex-wrap gap-2">
                {reasons.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-surface-tertiary/50 border border-border-subtle rounded-lg">
                    <div className="w-1 h-1 rounded-full bg-brand/40" />
                    <span className="text-[9px] font-bold text-muted">{r}</span>
                  </div>
                ))}
             </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs md:text-[10px] font-black uppercase tracking-widest transition-all
                ${tab === t.id
                  ? "bg-brand text-white shadow-lg"
                  : "text-muted hover:bg-surface-soft"
                }`}
            >
              <i className={`fa-solid ${t.icon} text-xs md:text-[10px]`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <AnimatePresence mode="wait">

            {/* ━━ INFO TAB ━━ */}
            {tab === "info" && (
              <motion.div key="info" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {/* Info Tab Rows */}
                {[
                  { icon: "fa-qrcode",         label: "Número de Série",    value: equipamento.numeroSerie },
                  { icon: "fa-location-dot",   label: "Localização",        value: equipamento.localizacao },
                  { icon: "fa-user",           label: "Usuário Atual",      value: getColaboradorNome(equipamento.colaboradorAtualID) },
                  { icon: "fa-calendar-days",  label: "Data de Compra",     value: equipamento.dataCompra ? new Date(equipamento.dataCompra).toLocaleDateString("pt-BR") : null },
                  { icon: "fa-coins",          label: "Custo de Aquisição", value: equipamento.custoAquisicao ? `R$ ${Number(equipamento.custoAquisicao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : null },
                  { icon: "fa-building",       label: "Propriedade",        value: equipamento.propriedade === "empresa" ? "Empresa" : equipamento.propriedade === "usuario" ? "Pessoal / Usuário" : equipamento.propriedade },
                  { icon: "fa-sitemap",        label: "Setor",              value: equipamento.setor },
                ].map(row => (
                  <div key={row.label} className="flex items-center gap-3 p-3 rounded-xl border bg-surface-soft border-border-subtle">
                    <i className={`fa-solid ${row.icon} text-subtle w-4 text-center text-xs`} />
                    <span className="text-[10px] md:text-[10px] font-bold text-muted w-24 md:w-28 shrink-0">{row.label}</span>
                    <span className="text-xs font-black truncate text-strong">{row.value || "—"}</span>
                  </div>
                ))}

                <div className="p-4 rounded-xl border bg-surface-soft border-border-subtle">
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Descrição do Ativo</p>
                  <p className="text-sm md:text-xs font-bold leading-relaxed text-main">{getEquipamentoDescricao()}</p>
                </div>

                {equipamento.propriedade !== "usuario" && (
                  <div className="p-5 rounded-[2rem] border space-y-4 bg-surface-soft border-border-subtle shadow-nm-inset">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Atribuir Novo Usuário</p>
                    <NMCombobox
                      label="Selecionar Novo Usuário"
                      placeholder="Pesquisar colaborador..."
                      options={colaboradores.map(c => ({
                        value: c.colaboradorID,
                        label: c.nome,
                        sublabel: c.colaboradorID,
                        icon: "fa-user"
                      }))}
                      value={selectedColaboradorID}
                      onChange={setSelectedColaboradorID}
                    />
                    <button
                      type="button"
                      onClick={handleAssignNewUser}
                      disabled={assigningUser || !selectedColaboradorID}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:scale-[1.02]"
                      title="Atribuir para novo usuario"
                      aria-label="Atribuir para novo usuario"
                    >
                      {assigningUser ? "Atribuindo..." : "Atribuir para novo usuário"}
                    </button>
                  </div>
                )}

                {/* Quick actions grid in info tab */}
                <div className="pt-2">
                  <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-3">Ações Rápidas</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(equipamento.status?.toLowerCase().includes("manuten") 
                      ? [QUICK_ACTIONS[1], QUICK_ACTIONS[0], QUICK_ACTIONS[2], QUICK_ACTIONS[3]] 
                      : QUICK_ACTIONS.slice(0, 4)
                    ).filter(a => {
                      const isFilterMatch = !a.statusFilter || equipamento.status?.toLowerCase().includes(a.statusFilter);
                      const isPersonalForbidden = equipamento.propriedade === "usuario" && ["movimentar", "retornar", "devolucao", "checkout"].includes(a.id);
                      return isFilterMatch && !isPersonalForbidden;
                    }).map(a => (
                      <button
                        key={a.id}
                        onClick={() => handleAction(a.id)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border border-border-subtle text-left transition-all ${a.color}`}
                      >
                        <i className={`fa-solid ${a.icon} text-xs md:text-sm`} />
                        <span className="text-[11px] md:text-[10px] font-black leading-tight">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ━━ ACTIONS TAB ━━ */}
            {tab === "actions" && (
              <motion.div key="actions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">

                {/* All actions */}
                {QUICK_ACTIONS.filter(a => {
                  const isFilterMatch = !a.statusFilter || equipamento.status?.toLowerCase().includes(a.statusFilter);
                  const isPersonalForbidden = equipamento.propriedade === "usuario" && ["movimentar", "retornar", "devolucao", "checkout"].includes(a.id);
                  return isFilterMatch && !isPersonalForbidden;
                }).map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleAction(a.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border border-border-subtle text-left transition-all group ${a.color}`}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-surface-soft">
                      <i className={`fa-solid ${a.icon} text-base`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black">{a.label}</p>
                      <p className="text-[10px] transition-colors text-muted group-hover:text-main">{a.desc}</p>
                    </div>
                    <i className="fa-solid fa-chevron-right text-[10px] text-subtle group-hover:text-main transition-colors" />
                  </button>
                ))}

                {/* Movimentação inline form */}
                <AnimatePresence>
                  {showMov && (
                    <motion.div
                      ref={movFormRef}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className="border rounded-2xl p-4 space-y-3 bg-surface-soft border-border-subtle"
                    >
                      <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 ml-1">Registrar Movimentação</p>
                      <select
                        value={movForm.tipo}
                        onChange={e => setMovForm(p => ({ ...p, tipo: e.target.value }))}
                        title="Tipo de movimentação"
                        aria-label="Tipo de movimentação"
                        className="w-full bg-surface-soft border-none rounded-xl px-4 py-3 text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                      >
                        <option value="alocacao">Alocação / Entrega ao Usuário</option>
                        <option value="devolucao">Devolução ao Estoque</option>
                        <option value="manutencao">Manutenção / Reparo</option>
                        <option value="transferencia">Transferência de Setor</option>
                      </select>

                      {/* --- MANUTENCÃO: IMPROVISO --- */}
                      {movForm.tipo === "manutencao" && equipamento?.colaboradorAtualID && (
                        <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-3">
                           <label className="flex items-center gap-3 cursor-pointer group">
                             <div 
                               onClick={() => setIsImproviso(!isImproviso)}
                               className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isImproviso ? "bg-blue-500 border-blue-500" : "border-white/20 hover:border-blue-500/50"}`}
                             >
                               {isImproviso && <i className="fa-solid fa-check text-white text-[8px]" />}
                             </div>
                             <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Emprestar dispositivo de improviso?</span>
                           </label>
                           
                           {isImproviso && (
                             <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                               <p className="text-[9px] font-bold text-slate-500 uppercase">Selecione o Item Reserva:</p>
                               {loadingImproviso ? (
                                 <div className="text-[10px] text-slate-500 italic"><i className="fa-solid fa-spinner fa-spin mr-2" />Buscando disponíveis...</div>
                               ) : availableImprovisoEquips.length > 0 ? (
                                 <NMCombobox
                                   placeholder="Selecione o Item Reserva..."
                                   options={availableImprovisoEquips.map(e => ({
                                     value: e.etiquetaID,
                                     label: `${e.marca} ${e.modelo}`,
                                     sublabel: `#${e.etiquetaID}`,
                                     icon: "fa-laptop"
                                   }))}
                                   value={selectedImprovisoID}
                                   onChange={setSelectedImprovisoID}
                                 />
                               ) : (
                                 <p className="text-[9px] text-red-400 font-bold">Nenhum {equipamento.tipoEquipamento} disponível no estoque no momento.</p>
                               )}
                             </div>
                           )}
                        </div>
                      )}

                      {/* --- RETORNO DE MANUTENÇÃO: REPARO E RECOLHIMENTO --- */}
                      {(equipamento?.status === "Manutenção" || movForm.tipo === "devolucao") && (
                        <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 ml-1">Descrição do Reparo / Motivo</p>
                            <textarea
                              placeholder="Quais peças foram trocadas ou qual limpeza foi feita?"
                              value={repairDetails}
                              onChange={e => setRepairDetails(e.target.value)}
                              rows={2}
                              className="w-full bg-surface border-none rounded-xl px-4 py-3 text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none"
                            />
                          </div>

                          {/* Inteligência de Destino */}
                          {equipamento?.status === "Manutenção" && (
                            <div className="grid grid-cols-2 gap-2 pt-1">
                               <button 
                                 type="button"
                                 onClick={() => {
                                   setMovForm(p => ({ ...p, tipo: "alocacao" }));
                                   // Tentar localizar último dono no histórico
                                   const lastAloc = history.find(h => h.tipoMovimentacao === "alocacao");
                                   if (lastAloc?.colaboradorID) setSelectedColaboradorID(lastAloc.colaboradorID);
                                 }}
                                 className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${movForm.tipo === 'alocacao' ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-surface-soft border-border-subtle text-muted'}`}
                               >
                                 Voltar p/ Usuário
                               </button>
                               <button 
                                 type="button"
                                 onClick={() => {
                                   setMovForm(p => ({ ...p, tipo: "devolucao" }));
                                   setSelectedColaboradorID("");
                                 }}
                                 className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${movForm.tipo === 'devolucao' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-surface-soft border-border-subtle text-muted'}`}
                               >
                                 Voltar p/ Estoque
                               </button>
                            </div>
                          )}

                          {(movForm.tipo === "alocacao") && (
                            <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                               <label className="flex items-center gap-3 cursor-pointer group mb-3">
                                 <div 
                                   onClick={() => setIsImproviso(!isImproviso)}
                                   className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isImproviso ? "bg-emerald-500 border-emerald-500" : "border-white/20 hover:border-emerald-500/50"}`}
                                 >
                                   {isImproviso && <i className="fa-solid fa-check text-white text-[8px]" />}
                                 </div>
                                 <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Recolher dispositivo de improviso?</span>
                               </label>

                               {isImproviso && (
                                <div className="space-y-2">
                                  <p className="text-[9px] font-bold text-emerald-600 uppercase">Selecione item a recolher:</p>
                                  {loadingImproviso ? (
                                    <div className="text-[10px] text-muted italic"><i className="fa-solid fa-spinner fa-spin mr-2" />Buscando itens...</div>
                                  ) : availableImprovisoEquips.length > 0 ? (
                                    <NMCombobox
                                       placeholder="Selecione o improviso..."
                                       options={availableImprovisoEquips.map(e => ({
                                         value: e.etiquetaID,
                                         label: `${e.marca} ${e.modelo}`,
                                         sublabel: `#${e.etiquetaID}`,
                                         icon: "fa-laptop"
                                       }))}
                                       value={selectedImprovisoID}
                                       onChange={setSelectedImprovisoID}
                                     />
                                  ) : (
                                    <p className="text-[9px] text-muted italic">Nenhum outro item com este usuário.</p>
                                  )}
                                </div>
                               )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dynamic Colaborador Selector for Allocation/Transfer */}
                      {(movForm.tipo === "alocacao" || movForm.tipo === "transferencia") && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 ml-1">Selecionar Beneficiário</p>
                           <NMCombobox
                             placeholder="Selecione o colaborador..."
                             options={colaboradores.map(c => ({
                               value: c.colaboradorID,
                               label: c.nome,
                               sublabel: c.departamento,
                               icon: "fa-user"
                             }))}
                             value={selectedColaboradorID}
                             onChange={setSelectedColaboradorID}
                           />
                        </div>
                      )}

                      <textarea
                        placeholder="Descreva a movimentação..."
                        value={movForm.descricao}
                        onChange={e => setMovForm(p => ({ ...p, descricao: e.target.value }))}
                        rows={2}
                        className="w-full bg-surface-soft border-none rounded-xl px-4 py-3 text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main placeholder-subtle/50 resize-none"
                      />
                      <div className="flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={handleMovimentar}
                          disabled={submittingMov}
                          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-[11px] md:text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                        >
                          {submittingMov ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
                          CONFIRMAR MOVIMENTAÇÃO
                        </button>
                        <button
                          onClick={() => setShowMov(false)}
                          className="px-4 py-3 text-[11px] md:text-xs font-bold rounded-xl transition-all bg-surface-soft text-muted hover:text-main"
                        >
                          Cancelar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Checklist Section */}
                <div className="border rounded-2xl p-4 space-y-3 bg-surface-soft border-border-subtle">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Vistoria Rápida</p>
                    <span className="text-[9px] font-black text-emerald-400">
                      {checklistItems.filter(i => i.done).length}/{checklistItems.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {checklistItems.map((item, idx) => (
                      <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                        <div
                          onClick={() => setChecklistItems(prev => prev.map((it, i) => i === idx ? { ...it, done: !it.done } : it))}
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all
                            ${item.done ? "bg-emerald-500 border-emerald-500" : "border-white/20 bg-white/5 group-hover:border-emerald-500/50"}`}
                        >
                          {item.done && <i className="fa-solid fa-check text-white text-[8px]" />}
                        </div>
                        <span className={`text-xs transition-colors leading-tight ${item.done ? "text-subtle line-through" : "text-main"}`}>
                          {item.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ━━ HISTORY TAB ━━ */}
            {tab === "history" && (
              <motion.div key="history" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                {loadingHistory && (
                  <div className="flex items-center gap-2 text-muted text-xs py-4">
                    <i className="fa-solid fa-spinner fa-spin" />
                    Carregando histórico...
                  </div>
                )}
                {!loadingHistory && history.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted">
                    <i className="fa-solid fa-clock text-3xl opacity-30" />
                    <p className="text-xs font-bold">Nenhuma movimentação registrada.</p>
                  </div>
                )}
                <div className="relative pl-5 space-y-5 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-border-subtle">
                  {history.map((h, i) => {
                    const dotColor = h.tipoMovimentacao === "manutencao" ? "bg-amber-500" : h.tipoMovimentacao === "alocacao" ? "bg-emerald-500" : h.tipoMovimentacao === "devolucao" ? "bg-red-500" : "bg-indigo-500";
                    return (
                      <div key={i} className="relative">
                        <div className={`absolute -left-[19px] top-1.5 w-3 h-3 rounded-full ${dotColor} border-2 border-surface`} />
                        <div className="border rounded-xl p-4 bg-surface-soft border-border-subtle">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black text-brand uppercase tracking-wider">{h.tipoMovimentacao}</span>
                            <span className="text-[10px] text-subtle">{h.dataHora ? new Date(h.dataHora).toLocaleDateString("pt-BR") : "—"}</span>
                          </div>
                          <p className="text-xs leading-relaxed text-main">{h.descricaoDetalhada || h.descricao || "—"}</p>
                          {h.responsavel && (
                            <div className="mt-2 pt-2 border-t border-border-subtle flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <i className="fa-solid fa-user text-[9px] text-muted" />
                                <span className="text-[9px] font-black text-muted uppercase">{(h as any).responsavelNome || h.responsavel?.split("@")[0]}</span>
                              </div>
                              {h.protocolo && <span className="text-[9px] font-black text-brand">#{h.protocolo}</span>}
                            </div>
                          )}

                          {(() => {
                            const prot = (h as any).protocoloSolicitacao || (h as any).protocolo;
                            const movId = (h as any).movimentacao_id || (h as any).movimentacaoID || (h as any).id;
                            
                            return (
                              <div className="mt-4 pt-3 border-t border-border-subtle dark:border-slate-800 flex flex-wrap gap-2">
                                {prot && (
                                  <button 
                                    onClick={() => {
                                      onClose();
                                      router.push(`/solicitacoes?open=${prot}`);
                                    }}
                                    className="flex-1 min-w-[80px] py-1.5 bg-surface-soft dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-border-subtle dark:border-slate-700 text-main rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                  >
                                    <i className="fa-solid fa-eye text-[10px]"></i>
                                    Acessar
                                  </button>
                                )}

                                <button 
                                   onClick={() => openChat("movimentacao", movId || String(h.dataHora), `Chat da Movimentação`)}
                                   className="flex-1 min-w-[80px] py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-500 border border-indigo-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                   <i className="fa-solid fa-comments text-[10px]"></i>
                                   Chat Mov.
                                </button>

                                {prot && (
                                  <button 
                                    onClick={() => openChat("solicitacao", prot, `Chat Solic. #${prot}`)}
                                    className="flex-1 min-w-[80px] py-1.5 bg-brand hover:bg-brand/90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center gap-2"
                                  >
                                    <i className="fa-solid fa-comment-dots text-[10px]"></i>
                                    Chat Solic.
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        <SlidebarFooter className="p-4 border-t border-border-subtle bg-transparent">
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("movimentar")}
              className="flex-1 py-3 border border-border-subtle text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 bg-surface hover:bg-surface-soft text-main"
            >
              <i className="fa-solid fa-arrows-rotate text-brand shadow-sm" />
              Movimentar
            </button>
            <button
              onClick={() => handleAction("solicitacao")}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <i className="fa-solid fa-file-pen" />
              Solicitação
            </button>
          </div>
        </SlidebarFooter>
      </div>
      <EquipmentLabelGenerator
        equipamento={equipamentoDetalhado || equipamento}
        isOpen={showLabel}
        onClose={() => setShowLabel(false)}
      />
    </SlidebarPanel>
  );
}
