"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SolicitacoesService } from "@/services/solicitacoes.service";
import { EquipamentosService } from "@/services/equipamentos.service";
import { useChat } from "@/contexts/ChatContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { NMCombobox } from "@/components/ui/NMCombobox";
import { useToast } from "@/contexts/ToastContext";

import { Solicitacao } from "@/types";

interface SolicitacaoDetailSidebarProps {
  solicitacao: Solicitacao | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

const STATUS_META: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  pendente: { label: "Pendente", color: "text-amber-600", bg: "bg-amber-500/10", icon: "fa-clock" },
  em_atendimento: { label: "Em Atendimento", color: "text-blue-600", bg: "bg-blue-500/10", icon: "fa-spinner fa-spin" },
  concluido: { label: "Concluído", color: "text-emerald-600", bg: "bg-emerald-500/10", icon: "fa-check-double" },
  rejeitado: { label: "Rejeitado", color: "text-red-600", bg: "bg-red-500/10", icon: "fa-circle-xmark" },
};

const URGENCIA_META: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "text-muted bg-surface-soft border-border-subtle" },
  media: { label: "Media", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  alta: { label: "Alta", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  critica: { label: "Critica", color: "text-red-600 bg-red-500/10 border-red-500/20" },
};

export function SolicitacaoDetailSidebar({ solicitacao: solProp, isOpen, onClose, onUpdate }: SolicitacaoDetailSidebarProps) {
  const { openChat, processForm, setProcessForm, triggerRefresh } = useChat();
  const toast = useToast();
  
  // Estado Local para atualizações instantâneas (Optimistic UI)
  const [localSol, setLocalSol] = useState<Solicitacao | null>(null);
  const syncLockRef = useRef<boolean>(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [finishingChecklist, setFinishingChecklist] = useState(false);
  const [checklist, setChecklist] = useState<any | null>(null);
  const [inventarioDisponivel, setInventarioDisponivel] = useState<any[]>([]);
  const [equipamentosTroca, setEquipamentosTroca] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [finalizationForm, setFinalizationForm] = useState({
    reparado: true,
    destinoAposManutencao: "usuario" as "usuario" | "estoque",
  });

  // Sincroniza estado local com prop sempre que ela mudar externamente (respeitando a trava)
  useEffect(() => {
    if (syncLockRef.current) return;

    if (solProp) {
      setLocalSol(solProp);
    } else {
      setLocalSol(null);
    }
  }, [solProp]);

  // Função para travar atualizações externas por um breve período
  const lockSync = (duration = 2500) => {
    syncLockRef.current = true;
    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = setTimeout(() => {
      syncLockRef.current = false;
    }, duration);
  };

  const isChecklist = (localSol?.tipoSolicitacao || "") === "demanda_manual";
  const isFinished = localSol?.status === "concluido" || localSol?.status === "rejeitado";
  const isReserved = (localSol?.status === "em_atendimento" || !!localSol?.equipamentoAlocadoID) && !isFinished;
  const canProcessAllocation = !isChecklist && !isFinished && !isReserved && (localSol?.tipoSolicitacao === "alocacao" || localSol?.tipoSolicitacao === "substituicao" || (localSol?.tipoSolicitacao === "manutencao" && localSol.status === "pendente"));

  useEffect(() => {
    if (!isOpen || !localSol?.solicitacaoID || !isChecklist) {
      setChecklist(null);
      return;
    }

    const loadChecklist = async () => {
      try {
        setLoadingChecklist(true);
        const data = await SolicitacoesService.getChecklist(localSol.solicitacaoID);
        setChecklist(data || null);
      } catch (err: any) {
        setChecklist(null);
        toast.error("Erro ao carregar checklist", err?.message || "Nao foi possivel carregar os itens.");
      } finally {
        setLoadingChecklist(false);
      }
    };

    loadChecklist();
  }, [isOpen, localSol?.solicitacaoID, isChecklist, toast]);

  useEffect(() => {
    if (!isOpen || !localSol?.solicitacaoID) {
      setInventarioDisponivel([]);
      setEquipamentosTroca([]);
      return;
    }

    const loadAllocationData = async () => {
      try {
        const [disponiveis, equipamentosDoSolicitante] = await Promise.all([
          SolicitacoesService.getInventarioDisponivel(),
          localSol?.solicitanteID
            ? EquipamentosService.getEquipamentos({ colaboradorAtualID: localSol.solicitanteID })
            : Promise.resolve([]),
        ]);

        setInventarioDisponivel(Array.isArray(disponiveis) ? disponiveis : []);
        setEquipamentosTroca(Array.isArray(equipamentosDoSolicitante) ? equipamentosDoSolicitante : []);
        
        if (localSol.status === 'pendente') {
          setProcessForm(prev => ({
            ...prev,
            equipamentoID: localSol.equipamentoAlocadoID || localSol.equipamentoAtualID || prev.equipamentoID,
            equipamentoTrocadoID: localSol.equipamentoAtualID || prev.equipamentoTrocadoID,
          }));
        }
      } catch {
        setInventarioDisponivel([]);
        setEquipamentosTroca([]);
      }
    };

    loadAllocationData();
  }, [isOpen, localSol?.solicitacaoID, localSol?.status, localSol?.solicitanteID, localSol?.equipamentoAlocadoID, localSol?.equipamentoAtualID, setProcessForm]);

  if (!isOpen || !localSol) return null;

  const processarAlocacao = async () => {
    if (!localSol?.solicitacaoID) return;
    if (!processForm.equipamentoID) {
      toast.error("Selecione o dispositivo", "Escolha o dispositivo para alocar.");
      return;
    }

    try {
      setProcessing(true);
      lockSync(); // Trava sincronismo externo para evitar flicker
      
      // Feedback Instantâneo (Optimistic)
      setLocalSol(prev => prev ? { 
        ...prev, 
        equipamentoAlocadoID: processForm.equipamentoID, 
        status: 'em_atendimento' 
      } : null);

      await SolicitacoesService.processarSolicitacao(localSol.solicitacaoID, {
        acao: "aprovar",
        equipamentoID: processForm.equipamentoID,
        colaboradorDestinoID: localSol.solicitanteID || null,
        estaSubstituindo: processForm.estaSubstituindo === "sim",
        equipamentoTrocadoID: processForm.estaSubstituindo === "sim" ? processForm.equipamentoTrocadoID : null,
      });
      toast.success("Dispositivo reservado", "O item foi vinculado à solicitação.");
      triggerRefresh();
      onUpdate();
    } catch (err: any) {
      toast.error("Erro ao processar", err?.message || "Falha na reserva.");
    } finally {
      setProcessing(false);
    }
  };

  const handleNaoAlocado = async () => {
    if (!localSol?.solicitacaoID) return;
    try {
      setReverting(true);
      lockSync(); // Trava sincronismo externo para evitar flicker
      
      // Feedback Instatâneo (Optimistic)
      setLocalSol(prev => prev ? { ...prev, equipamentoAlocadoID: "", status: 'pendente' } : null);
      setProcessForm(p => ({ ...p, equipamentoID: "" })); 
      
      await SolicitacoesService.confirmarEntrega(localSol.solicitacaoID, { confirmar: false });
      toast.success("Reserva desfeita", "Selecione o novo equipamento abaixo.");
      
      triggerRefresh();
      onUpdate();
    } catch (err: any) {
      // Reverte em caso de erro
      setLocalSol(solProp); 
      toast.error("Erro ao estornar", err?.message || "Falha ao liberar item.");
    } finally {
      setReverting(false);
    }
  };

  const confirmarAlocacao = async () => {
    if (!localSol?.solicitacaoID) return;
    try {
      setConfirming(true);
      await SolicitacoesService.confirmarEntrega(localSol.solicitacaoID, { 
        confirmar: true, 
        equipamentoTestado: true,
        reparado: finalizationForm.reparado,
        destinoAposManutencao: finalizationForm.destinoAposManutencao
      });
      toast.success("Atendimento concluído", "Entrega registrada com sucesso.");
      triggerRefresh();
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error("Erro ao finalizar", err?.message || "Falha na conclusão.");
    } finally {
      setConfirming(false);
    }
  };

  const handleRejeitarSolicitacao = async () => {
     if (!localSol?.solicitacaoID) return;
     const motivo = window.prompt("Informe o motivo da rejeição:");
     if (!motivo) return;

     try {
        setProcessing(true);
        await SolicitacoesService.processarSolicitacao(localSol.solicitacaoID, { acao: "rejeitar", motivoRejeicao: motivo });
        toast.success("Solicitação rejeitada", "Status atualizado.");
        triggerRefresh();
        onUpdate();
        onClose();
     } catch (err: any) {
        toast.error("Erro", err?.message || "Falha ao rejeitar.");
     } finally {
        setProcessing(false);
     }
  };

  const concluirChecklist = async () => {
    if (!localSol?.solicitacaoID) return;
    try {
      setFinishingChecklist(true);
      await SolicitacoesService.concluirChecklist(localSol.solicitacaoID, {});
      toast.success("Checklist concluido", "Solicitacao finalizada.");
      triggerRefresh();
      onUpdate();
      onClose();
    } catch (err: any) {
      toast.error("Nao foi possivel concluir", err?.message || "Ainda existem pendencias.");
    } finally {
      setFinishingChecklist(false);
    }
  };

  return (
    <SlidebarPanel isOpen={isOpen} onClose={onClose}>
      <SlidebarHeader
        title={`Solicitação ${localSol.protocolo || localSol.solicitacaoID}`}
        subtitle={`${localSol.solicitanteNome} • ${localSol.departamento}`}
        onClose={onClose}
        actions={
          <button
            onClick={() => openChat("solicitacao", localSol.solicitacaoID, `Sol. ${localSol.solicitacaoID}`)}
            className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <i className="fa-solid fa-comments"></i>
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {/* Status Card */}
        <div className="bg-surface-soft rounded-3xl p-6 border border-border-subtle">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${STATUS_META[localSol.status || ""]?.bg} ${STATUS_META[localSol.status || ""]?.color}`}>
              <i className={`fa-solid ${STATUS_META[localSol.status || ""]?.icon} text-[10px]`}></i>
              <span className="text-[10px] font-black uppercase tracking-widest">{STATUS_META[localSol.status || ""]?.label}</span>
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${URGENCIA_META[localSol.urgencia || ""]?.color}`}>
              {URGENCIA_META[localSol.urgencia || ""]?.label}
            </span>
          </div>
          <p className="text-sm text-main leading-relaxed font-medium">{localSol.descricaoResumo}</p>
        </div>

        {/* Action Area: GERENCIAMENTO DE ATIVOS */}
        <div className="bg-surface rounded-3xl border border-border-subtle p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
             <div className="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                <i className="fa-solid fa-screwdriver-wrench text-xs"></i>
             </div>
             <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-strong">Gerenciamento de Atendimento</h4>
          </div>

          {!isFinished ? (
            <div className="space-y-8">
              {/* PASSO 1: SELEÇÃO OU ITEM RESERVADO */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[10px] font-black">1</span>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted">Vínculo de Equipamento</p>
                </div>

                <AnimatePresence mode="wait">
                  {canProcessAllocation ? (
                    <motion.div key="selection-form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4 pl-7">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">Equipamento para Alocação</label>
                        <NMCombobox
                          placeholder="Selecionar dispositivo disponível..."
                          options={inventarioDisponivel.map((eq: any) => ({
                            value: eq.etiquetaID,
                            label: eq.etiquetaID,
                            sublabel: `${eq.marca} ${eq.modelo}`,
                            icon: "fa-laptop"
                          }))}
                          value={processForm.equipamentoID}
                          onChange={(val) => setProcessForm(p => ({ ...p, equipamentoID: val }))}
                        />
                      </div>

                      {localSol.tipoSolicitacao === 'substituicao' && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                          <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest ml-1">Ativo a ser devolvido</label>
                          <NMCombobox
                            placeholder="Dispositivo que sai..."
                            options={equipamentosTroca.map((eq: any) => ({
                              value: eq.etiquetaID,
                              label: eq.etiquetaID,
                              sublabel: `${eq.marca} ${eq.modelo}`,
                              icon: "fa-laptop"
                            }))}
                            value={processForm.equipamentoTrocadoID}
                            onChange={(val) => setProcessForm(p => ({ ...p, equipamentoTrocadoID: val, estaSubstituindo: "sim" }))}
                          />
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          onClick={processarAlocacao}
                          disabled={processing || !processForm.equipamentoID}
                          className="flex-1 py-3.5 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                          {processing ? "Reservando..." : "Confirmar Reserva"}
                        </button>
                        <button
                          onClick={handleRejeitarSolicitacao}
                          className="px-4 bg-surface text-red-500 border border-red-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500/5 transition-all"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </motion.div>
                  ) : isReserved ? (
                    <motion.div key="reserved-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="pl-7">
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-5 flex items-center justify-between group shadow-sm transition-all hover:bg-emerald-500/10">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center text-xl">
                              <i className="fa-solid fa-laptop-code"></i>
                           </div>
                           <div>
                              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Item Reservado</p>
                              <p className="text-base font-black text-strong font-mono leading-none tracking-tight">{localSol.equipamentoAlocadoID}</p>
                           </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                           <span className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase animate-pulse">Aguardando Entrega</span>
                           <button 
                             onClick={handleNaoAlocado}
                             className="text-[9px] font-black text-amber-600 hover:text-amber-700 underline underline-offset-4 uppercase tracking-widest transition-all"
                           >
                              {reverting ? "Liberando..." : "Trocar Dispositivo"}
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="pl-7 py-4 text-xs font-bold text-muted italic">Inicie o atendimento para gerenciar ativos.</div>
                  )}
                </AnimatePresence>
              </div>

              {/* PASSO 2: FINALIZAÇÃO */}
              <div className={`space-y-4 px-1 transition-all ${!isReserved ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                <div className="flex items-center gap-2">
                   <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black transition-colors ${isReserved ? 'bg-emerald-500 text-white' : 'bg-surface-soft text-muted'}`}>2</span>
                   <p className="text-[10px] font-black uppercase tracking-widest text-muted">Entrega e Conclusão</p>
                </div>

                <div className="pl-7 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Reparado?</label>
                      <div className="flex bg-surface-soft rounded-xl p-1 border border-border-subtle">
                        <button 
                          onClick={() => setFinalizationForm(f => ({ ...f, reparado: true }))}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${finalizationForm.reparado ? 'bg-emerald-500 text-white shadow-md' : 'text-muted'}`}
                        >SIM</button>
                        <button 
                          onClick={() => setFinalizationForm(f => ({ ...f, reparado: false }))}
                          className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${!finalizationForm.reparado ? 'bg-red-500 text-white shadow-md' : 'text-muted'}`}
                        >NÃO</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Destino Final</label>
                      <select 
                        value={finalizationForm.destinoAposManutencao}
                        onChange={(e) => setFinalizationForm(f => ({ ...f, destinoAposManutencao: e.target.value as any }))}
                        className="w-full px-3 py-2.5 bg-surface-soft border-border-subtle rounded-xl text-[10px] font-black uppercase text-main focus:ring-2 focus:ring-brand"
                      >
                        <option value="usuario">Voltar p/ Usuário</option>
                        <option value="estoque">Enviar p/ Estoque</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={confirmarAlocacao}
                    disabled={confirming || !isReserved}
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {confirming ? "Finalizando..." : "Concluir e Confirmar Entrega"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
             <div className="py-10 text-center space-y-3">
                <i className="fa-solid fa-circle-check text-4xl text-emerald-500/20"></i>
                <p className="text-xs font-bold text-muted px-10">Este atendimento já foi encerrado e sincronizado com o estoque local.</p>
             </div>
          )}
        </div>
      </div>

      <SlidebarFooter className="p-6 bg-surface-soft border-t border-border-subtle">
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onClose} className="py-3 bg-surface border border-border-subtle rounded-2xl text-[10px] font-black uppercase text-muted hover:bg-surface-soft transition-all">Fechar</button>
          {isChecklist && !isFinished && (
            <button onClick={concluirChecklist} className="py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-700 shadow-md">Concluir Checklist</button>
          )}
        </div>
      </SlidebarFooter>
    </SlidebarPanel>
  );
}
