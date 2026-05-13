"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { ChatService } from "@/services/chat.service";
import { SolicitacoesService } from "@/services/solicitacoes.service";
import { EquipamentosService } from "@/services/equipamentos.service";
import { useToast } from "@/contexts/ToastContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { ChatConversation, ChatMessage, Solicitacao, Checklist, Equipamento, ChecklistItem } from "@/types";

export function ChatPanel() {
  const { isPanelOpen, closeChat, activeContext, openChat, showChatInbox, refreshNotifications, processForm, setProcessForm, triggerRefresh } = useChat();
  const { hasPermission, user } = useAuth();
  const [conversas, setConversas] = useState<ChatConversation[]>([]);
  const [mensagens, setMensagens] = useState<ChatMessage[]>([]);
  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [inventarioDisponivel, setInventarioDisponivel] = useState<Equipamento[]>([]);
  const [equipamentosTroca, setEquipamentosTroca] = useState<Equipamento[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [finishingChecklist, setFinishingChecklist] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [loading, setLoading] = useState(false);
  const syncLockRef = useRef<boolean>(false);
  const lockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [texto, setTexto] = useState("");
  const [anexo, setAnexo] = useState<{ nome: string; dados: string; tipo: string } | null>(null);
  const [view, setView] = useState<"conversas" | "mensagens">("conversas");
  const { error: toastError, success: toastSuccess } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversas = async () => {
    setLoading(true);
    try {
      const data = await ChatService.getConversas();
      setConversas(data);
    } catch (error) {
      console.error("Erro ao carregar conversas:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMensagens = async (tipo: string, id: string) => {
    setLoading(true);
    try {
      const msgs = await ChatService.getMensagens(tipo, id);
      setMensagens(msgs);
      setTimeout(scrollToBottom, 50);
    } catch (error) {
      console.error("Erro ao carregar mensagens:", error);
    } finally {
      setLoading(false);
    }
  };

  const isSolicitacaoContext = activeContext?.tipo === "solicitacao";
  const isChecklist = useMemo(() => (solicitacao?.tipoSolicitacao || "") === "demanda_manual", [solicitacao?.tipoSolicitacao]);
  
  const isFinalizado = useMemo(() => {
    if (!solicitacao) return false;
    const s = (solicitacao.status || "").toLowerCase();
    return s === "concluido" || s === "rejeitado";
  }, [solicitacao]);

  const isReserved = useMemo(() => {
    if (!solicitacao || isFinalizado) return false;
    return solicitacao.status === "em_atendimento" || !!solicitacao.equipamentoAlocadoID;
  }, [solicitacao, isFinalizado]);

  const canProcessAllocation = useMemo(() => {
    if (!solicitacao || isFinalizado) return false;
    return !isChecklist && !isReserved && (solicitacao.tipoSolicitacao === "alocacao" || solicitacao.tipoSolicitacao === "substituicao" || (solicitacao.tipoSolicitacao === "manutencao" && solicitacao.status === "pendente"));
  }, [solicitacao, isChecklist, isReserved, isFinalizado]);

  const normalizeSolicitacao = useCallback((raw: any): Solicitacao | null => {
    if (!raw) return null;
    return {
      solicitacaoID: String(raw.solicitacaoID),
      protocolo: raw.protocolo,
      tipoSolicitacao: raw.tipoSolicitacao || raw.tipo || "alocacao",
      solicitanteNome: raw.solicitanteNome || raw.solicitante || "",
      solicitanteID: raw.solicitanteID || raw.solicitante_id || "",
      departamento: raw.departamento || "",
      equipamentoAtualID: raw.equipamentoAtualID || raw.equipamento_atual_id || "",
      urgencia: (raw.urgencia || "media") as "baixa" | "media" | "alta",
      status: raw.status || "pendente",
      descricaoResumo: raw.descricaoProblema || raw.justificativa || raw.descricao || "Sem descrição.",
      equipamentoAlocadoID: raw.equipamentoAlocadoID || "",
    };
  }, []);

  const loadSolicitacaoActions = useCallback(async (solicitacaoID: string) => {
    if (!hasPermission("solicitacoes")) return;
    setLoadingActions(true);
    try {
      const all = await SolicitacoesService.getSolicitacoes();
      const found = (Array.isArray(all) ? all : []).find((s) => String(s.solicitacaoID) === String(solicitacaoID));
      const normalized = normalizeSolicitacao(found);

      // Se a trava estiver ativa, ignoramos atualizações que possam causar flicker (dados velhos)
      if (syncLockRef.current && normalized && normalized.status !== 'pendente') {
          return; 
      }

      setSolicitacao(normalized);

      if (!normalized) {
        setChecklist(null);
        setInventarioDisponivel([]);
        setEquipamentosTroca([]);
        return;
      }

      if (normalized.tipoSolicitacao === "demanda_manual") {
        const checklistData = await SolicitacoesService.getChecklist(normalized.solicitacaoID);
        setChecklist(checklistData || null);
        setInventarioDisponivel([]);
        setEquipamentosTroca([]);
        return;
      }

      setChecklist(null);
      const [disponiveis, equipamentosDoSolicitante] = await Promise.all([
        SolicitacoesService.getInventarioDisponivel(),
        normalized.solicitanteID
          ? EquipamentosService.getEquipamentos({ colaboradorAtualID: normalized.solicitanteID })
          : Promise.resolve([]),
      ]);

      setInventarioDisponivel(Array.isArray(disponiveis) ? disponiveis : []);
      setEquipamentosTroca(Array.isArray(equipamentosDoSolicitante) ? equipamentosDoSolicitante : []);
      
      if (normalized.status === 'pendente') {
        setProcessForm((prev) => ({
          ...prev,
          equipamentoID: normalized.equipamentoAlocadoID || normalized.equipamentoAtualID || prev.equipamentoID,
          equipamentoTrocadoID: normalized.equipamentoAtualID || prev.equipamentoTrocadoID,
        }));
      }
    } catch (error: any) {
      setChecklist(null);
      setInventarioDisponivel([]);
      setEquipamentosTroca([]);
      toastError("Erro ao carregar a solicitacao", error?.message || "Nao foi possivel carregar as acoes.");
    } finally {
      setLoadingActions(false);
    }
  }, [normalizeSolicitacao, toastError, hasPermission, setProcessForm]);

  const updateChecklistItem = (itemID: string, patch: Partial<ChecklistItem>) => {
    setChecklist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: (prev.itens || []).map((item) => (item.itemID === itemID ? { ...item, ...patch } : item)),
      };
    });
  };

  const saveChecklist = async () => {
    if (!solicitacao?.solicitacaoID || !checklist) return;

    try {
      setSavingChecklist(true);
      const itens = (checklist.itens || []).map((item: any) => ({
        itemID: item.itemID,
        status: item.status,
        observacao: item.observacao || null,
        equipamentoID: item.equipamentoID || null,
      }));
      await SolicitacoesService.updateChecklist(solicitacao.solicitacaoID, itens);
      
      if (activeContext) {
        await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
          texto: `💾 Alterações no checklist salvas via Chat.`
        });
      }

      toastSuccess("Checklist salvo", "Progresso atualizado.");
      triggerRefresh();
      await loadSolicitacaoActions(solicitacao.solicitacaoID);
    } catch (error: any) {
      toastError("Erro ao salvar", error?.message);
    } finally {
      setSavingChecklist(false);
    }
  };

  const concluirChecklist = async () => {
    if (!solicitacao?.solicitacaoID) return;

    try {
      setFinishingChecklist(true);
      await SolicitacoesService.concluirChecklist(solicitacao.solicitacaoID, {});

      if (activeContext) {
        await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
          texto: `📝 Atendimento manual finalizado via Chat.`
        });
      }

      toastSuccess("Concluido", "Fluxo finalizado.");
      triggerRefresh();
      await loadSolicitacaoActions(solicitacao.solicitacaoID);
    } catch (error: any) {
      toastError("Erro ao concluir", error?.message);
    } finally {
      setFinishingChecklist(false);
    }
  };

  const lockSync = (duration = 2500) => {
    syncLockRef.current = true;
    if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    lockTimeoutRef.current = setTimeout(() => {
      syncLockRef.current = false;
    }, duration);
  };

  const processarAlocacao = async () => {
    if (!solicitacao?.solicitacaoID) return;
    if (!processForm.equipamentoID) {
      toastError("Selecione o dispositivo", "Escolha um item disponível.");
      return;
    }

    try {
      setProcessing(true);
      lockSync(); // Trava sincronismo para evitar flicker
      
      // Feedback Instantâneo (Optimistic)
      setSolicitacao(prev => prev ? { 
        ...prev, 
        equipamentoAlocadoID: processForm.equipamentoID, 
        status: "em_atendimento" 
      } : null);

      await SolicitacoesService.processarSolicitacao(solicitacao.solicitacaoID, {
        acao: "aprovar",
        equipamentoID: processForm.equipamentoID,
        colaboradorDestinoID: solicitacao.solicitanteID || null,
        estaSubstituindo: processForm.estaSubstituindo === "sim",
        equipamentoTrocadoID: processForm.estaSubstituindo === "sim" ? processForm.equipamentoTrocadoID : null,
        observacoes: "Processamento via chat",
      });

      if (activeContext) {
        await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
          texto: `✅ Ativo [${processForm.equipamentoID}] RESERVADO via Chat. Próximo passo: Confirmar Entrega.`
        });
      }

      toastSuccess("Dispositivo reservado", "Siga para a confirmação de entrega.");
      triggerRefresh();
      await loadSolicitacaoActions(solicitacao.solicitacaoID);
    } catch (error: any) {
      toastError("Erro ao processar", error?.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleNaoAlocado = async () => {
    if (!solicitacao?.solicitacaoID) return;
    try {
      setReverting(true);
      lockSync(); // Trava sincronismo para evitar flicker
      
      // Feedback otimista: limpa a seleção e o estado da reserva IMEDIATAMENTE na UI
      setProcessForm(p => ({ ...p, equipamentoID: "" }));
      setSolicitacao(prev => prev ? { ...prev, equipamentoAlocadoID: "", status: 'pendente' } : null);

      await SolicitacoesService.confirmarEntrega(solicitacao.solicitacaoID, { confirmar: false });

      if (activeContext) {
        await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
          texto: `🔄 Reserva CANCELADA via Chat. O dispositivo voltou ao estoque.`
        });
      }

      toastSuccess("Reserva liberada", "Selecione o novo equipamento.");
      triggerRefresh();
      await loadSolicitacaoActions(solicitacao.solicitacaoID);
    } catch (error: any) {
      toastError("Erro ao liberar", error?.message);
    } finally {
      setReverting(false);
    }
  };

  const confirmarAlocacao = async () => {
    if (!solicitacao?.solicitacaoID) return;

    try {
      setConfirming(true);
      await SolicitacoesService.confirmarEntrega(solicitacao.solicitacaoID, { 
        confirmar: true, 
        equipamentoTestado: true,
        reparado: true, 
        destinoAposManutencao: "usuario"
      });

      if (activeContext) {
        await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
          texto: `📦 Atendimento CONCLUÍDO via Chat. Movimentações sincronizadas.`
        });
      }

      toastSuccess("Finalizado", "Solicitação encerrada.");
      triggerRefresh();
      await loadSolicitacaoActions(solicitacao.solicitacaoID);
    } catch (error: any) {
      toastError("Erro ao confirmar", error?.message);
    } finally {
      setConfirming(false);
    }
  };

  useEffect(() => {
    if (isPanelOpen) {
      if (activeContext) {
        loadMensagens(activeContext.tipo, activeContext.id);
        if (activeContext.tipo === "solicitacao" && hasPermission("solicitacoes")) {
          loadSolicitacaoActions(activeContext.id);
        }
      } else {
        loadConversas();
      }
    }
  }, [isPanelOpen, activeContext, loadSolicitacaoActions]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContext || (!texto.trim() && !anexo)) return;

    try {
      await ChatService.enviarMensagem(activeContext.tipo, activeContext.id, {
        texto,
        arquivoNome: anexo?.nome,
        arquivoTipo: anexo?.tipo,
        arquivoDados: anexo?.dados,
      });
      setTexto("");
      setAnexo(null);
      loadMensagens(activeContext.tipo, activeContext.id);
      refreshNotifications();
    } catch (error: any) {
      toastError("Erro ao enviar", error.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (prev) => setAnexo({ nome: file.name, tipo: file.type, dados: prev.target?.result as string });
    reader.readAsDataURL(file);
  };

  if (!isPanelOpen) return null;

  return (
    <SlidebarPanel isOpen={isPanelOpen} onClose={closeChat} size="narrow">
      <SlidebarHeader
        title={activeContext?.titulo || "Chat"}
        subtitle={activeContext ? `${activeContext.tipo} • ${activeContext.id}` : "Mensagens"}
        onClose={closeChat}
        actions={activeContext && <button type="button" onClick={() => showChatInbox()} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"><i className="fa-solid fa-arrow-left"></i></button>}
      />

      <div className="flex-1 overflow-y-auto no-scrollbar p-0">
        {!activeContext ? (
          <div className="flex flex-col p-4">
            {conversas.map(c => (
              <button key={`${c.contextoTipo}-${c.contextoId}`} onClick={() => openChat(c.contextoTipo, c.contextoId, `Sol. ${c.contextoId}`)} className="p-4 flex items-start gap-4 hover:bg-slate-50 border-b border-slate-50 text-left dark:border-slate-800 dark:hover:bg-slate-800/50">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${c.contextoTipo === 'movimentacao' ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'}`}><i className={`fa-solid ${c.contextoTipo === 'movimentacao' ? 'fa-arrows-rotate' : 'fa-clipboard-list'}`}></i></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between"><span className="font-bold text-slate-800 text-sm">{c.contextoTipo === 'movimentacao' ? 'Mov.' : 'Sol.'} {c.contextoId}</span><span className="text-[10px] text-slate-400">{new Date(c.ultimaMensagemAt).toLocaleDateString()}</span></div>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{c.ultimoTexto || "📎 Arquivo"}</p>
                </div>
                {c.naoLidos > 0 && <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">{c.naoLidos}</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col min-h-full">
            {isSolicitacaoContext && hasPermission("solicitacoes") && (
              <div className="p-5 bg-indigo-50/50 dark:bg-slate-900 border-b border-indigo-100 dark:border-white/5 space-y-5">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Ações Operacionais</p>
                   {solicitacao && <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-indigo-100">{solicitacao.status}</span>}
                </div>

                {!solicitacao || isFinalizado ? (
                  <div className="py-2 text-center"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{isFinalizado ? "Solicitação Concluída" : "Aguardando Sincronia..."}</p></div>
                ) : (
                  <div className="space-y-6">
                    {/* PASSO 1: RESERVA */}
                    <div className="space-y-3">
                       <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${isReserved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white'}`}>1</span>
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Atribuição de Ativo</p>
                       </div>
                       
                       {isReserved ? (
                         <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between group animate-in zoom-in-95">
                            <div>
                               <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">Reservado</p>
                               <p className="text-sm font-black text-slate-800 dark:text-white font-mono">{solicitacao.equipamentoAlocadoID}</p>
                            </div>
                            <button onClick={handleNaoAlocado} className="text-[9px] font-black text-amber-600 hover:scale-105 transition-transform">{reverting ? "..." : "TROCAR"}</button>
                         </div>
                       ) : (
                         <div className="space-y-3 pl-6">
                            <select
                              value={processForm.equipamentoID}
                              onChange={(e) => setProcessForm(prev => ({ ...prev, equipamentoID: e.target.value }))}
                              className="w-full px-4 py-3 text-xs font-black border border-indigo-200 dark:bg-slate-900 dark:border-white/10 rounded-2xl bg-white text-slate-700 dark:text-slate-200"
                            >
                               <option value="">Selecionar dispositivo...</option>
                               {inventarioDisponivel.map(eq => <option key={`chat-${eq.etiquetaID}`} value={eq.etiquetaID}>{eq.etiquetaID} - {eq.marca}</option>)}
                            </select>
                            <button onClick={processarAlocacao} disabled={processing || !processForm.equipamentoID} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                               {processing ? "RESERVANDO..." : "AUTORIZAR RESERVA"}
                            </button>
                         </div>
                       )}
                    </div>

                    {/* PASSO 2: ENTREGA */}
                    <div className={`space-y-3 transition-all ${!isReserved ? 'opacity-30' : ''}`}>
                       <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${isReserved ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>2</span>
                          <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Entrega Final</p>
                       </div>
                       <div className="pl-6">
                          <button onClick={confirmarAlocacao} disabled={confirming || !isReserved} className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">
                             {confirming ? "FINALIZANDO..." : "CONFIRMAR RECEBIMENTO"}
                          </button>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="p-4 space-y-3">
              {mensagens.map(m => {
                const isMe = m.userNome === (user?.nome || "Admin");
                return (
                  <div key={m.mensagemId} className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-2`}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      {!isMe && <span className="text-[9px] font-black text-slate-400 uppercase">{m.userNome}</span>}
                      <span className="text-[8px] font-black text-slate-300 uppercase">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-100 dark:border-white/5 rounded-tl-none"}`}>
                      {m.arquivoDados && <div className="mb-2 rounded-xl overflow-hidden bg-black/5"><Image src={m.arquivoDados} alt="Anexo" width={400} height={300} className="w-full h-auto" unoptimized /></div>}
                      <p className="text-[13px] font-medium leading-relaxed">{m.texto}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      <SlidebarFooter className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-white/5">
        <form onSubmit={handleSend} className="flex items-center gap-3">
          <button type="button" onClick={() => fileInputRef.current?.click()} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400"><i className="fa-solid fa-plus"></i></button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
          <textarea value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(e); } }} placeholder="Digitar..." rows={1} className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm no-scrollbar resize-none" />
          <button type="submit" disabled={!texto.trim() && !anexo} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg"><i className="fa-solid fa-paper-plane"></i></button>
        </form>
      </SlidebarFooter>
    </SlidebarPanel>
  );
}
