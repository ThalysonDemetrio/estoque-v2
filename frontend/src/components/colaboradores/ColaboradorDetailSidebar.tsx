"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import { useChat } from "@/contexts/ChatContext";
import { EquipamentosService } from "@/services/equipamentos.service";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { useToast } from "@/contexts/ToastContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { useRef } from "react";

import { Colaborador, Equipamento } from "@/types";

interface ColaboradorDetailSidebarProps {
  colaborador: Colaborador | null;
  isOpen: boolean;
  onClose: () => void;
   onColaboradorUpdated?: (updated: Colaborador) => void;
   initialEditMode?: boolean;
   createMode?: boolean;
}

export function ColaboradorDetailSidebar({ colaborador, isOpen, onClose, onColaboradorUpdated, initialEditMode = false, createMode = false }: ColaboradorDetailSidebarProps) {
   const router = useRouter();
  const { openChat, refreshTrigger, triggerRefresh } = useChat();
   const toast = useToast();
  const [assets, setAssets] = useState<Equipamento[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"assets" | "history">("assets");
   const [editMode, setEditMode] = useState(false);
   const [savingProfile, setSavingProfile] = useState(false);
   const [savingAssetId, setSavingAssetId] = useState<string | null>(null);
   const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
    const [assetActionLoadingId, setAssetActionLoadingId] = useState<string | null>(null);
   const [reassigningAssetId, setReassigningAssetId] = useState<string | null>(null);
   const [availableColaboradores, setAvailableColaboradores] = useState<any[]>([]);
   const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
   const [profileForm, setProfileForm] = useState({ 
      colaboradorID: "",
      nome: "", email: "", cargo: "", departamento: "", 
      fotoColaborador: "", ativo: true 
   });
   const [assetForm, setAssetForm] = useState({ status: "", localizacao: "", observacoes: "" });
   const fileInputRef = useRef<HTMLInputElement>(null);

    const loadColaboradorData = async (targetColaborador: Colaborador) => {
         setLoading(true);
         try {
            const [assetsData, historyData] = await Promise.all([
               EquipamentosService.getEquipamentos({ colaboradorAtualID: targetColaborador.colaboradorID }),
               MovimentacoesService.getMovimentacoes()
            ]);
            setAssets(Array.isArray(assetsData) ? assetsData : []);
            setHistory((Array.isArray(historyData) ? historyData : []).filter((m: any) =>
               m.novoDonoNome === targetColaborador.nome || m.donoAnteriorNome === targetColaborador.nome
            ).slice(0, 20));
         } catch (err) {
            console.error("Erro ao carregar dossiê do colaborador:", err);
         } finally {
            setLoading(false);
         }
    };

  useEffect(() => {
      if (isOpen) {
         setProfileForm({
            colaboradorID: colaborador?.colaboradorID || "",
            nome: colaborador?.nome || "",
            email: colaborador?.email || "",
            cargo: colaborador?.cargo || "",
            departamento: colaborador?.departamento || "",
            fotoColaborador: colaborador?.fotoColaborador || "",
            ativo: colaborador?.ativo !== false,
         });
         setEditMode(Boolean(initialEditMode || createMode));
         setEditingAssetId(null);

         if (createMode || !colaborador) {
            setAssets([]);
            setHistory([]);
            setLoading(false);
            return;
         }

         loadColaboradorData(colaborador);
    }
   }, [isOpen, colaborador, initialEditMode, createMode, refreshTrigger]);

   useEffect(() => {
      if (!isOpen || createMode) return;

      const loadColaboradores = async () => {
         try {
            const data = await ColaboradoresService.getColaboradores({});
            const list = Array.isArray(data) ? data : [];
            setAvailableColaboradores(list.filter((c) => c?.ativo !== false));
         } catch {
            setAvailableColaboradores([]);
         }
      };

      loadColaboradores();
   }, [isOpen, createMode]);

   const handleAssetLifecycleAction = async (asset: any, action: "alocar" | "devolver") => {
      if (!colaborador) return;
      try {
         setAssetActionLoadingId(asset.etiquetaID + action);
         if (action === "alocar") {
            await MovimentacoesService.createMovimentacao({
               equipamentoID: asset.etiquetaID,
               tipoMovimentacao: "alocacao",
               colaboradorID: colaborador.colaboradorID,
               novoDonoID: colaborador.colaboradorID,
               motivo: `Alocação direta via Painel para ${colaborador.nome}`,
               responsavel: "Usuário (via Painel)",
               dataHora: new Date().toISOString(),
            });
            toast.success("Dispositivo alocado", `${asset.etiquetaID} alocado para ${colaborador.nome}.`);
         } else {
            await MovimentacoesService.createMovimentacao({
               equipamentoID: asset.etiquetaID,
               tipoMovimentacao: "devolucao",
               colaboradorID: colaborador.colaboradorID,
               donoAnteriorID: colaborador.colaboradorID,
               motivo: `Devolução direta via Painel por ${colaborador.nome}`,
               responsavel: "Usuário (via Painel)",
               dataHora: new Date().toISOString(),
            });
            toast.success("Dispositivo devolvido", `${asset.etiquetaID} devolvido ao estoque.`);
         }
         await loadColaboradorData(colaborador);
         triggerRefresh(); // SpaceStock Sync
      } catch (error: any) {
         toast.error("Erro na acao do dispositivo", error?.message || "Nao foi possivel concluir a acao.");
      } finally {
         setAssetActionLoadingId(null);
      }
   };

   const handleAccessAsset = (asset: any) => {
      onClose();
      router.push(`/equipamentos?open=${encodeURIComponent(asset.etiquetaID)}`);
   };

   const handleReassignAsset = async (asset: any) => {
      if (!colaborador) return;
      const targetColaboradorID = reassignTargets[asset.etiquetaID];
      if (!targetColaboradorID) {
         toast.error("Selecione um colaborador", "Escolha quem recebera o dispositivo.");
         return;
      }

      const target = availableColaboradores.find((c) => c.colaboradorID === targetColaboradorID);
      if (!target) {
         toast.error("Colaborador invalido", "Nao foi possivel localizar o colaborador selecionado.");
         return;
      }

      try {
         setReassigningAssetId(asset.etiquetaID);
         await MovimentacoesService.createMovimentacao({
            equipamentoID: asset.etiquetaID,
            tipoMovimentacao: "transferencia",
            colaboradorID: targetColaboradorID,
            donoAnteriorID: colaborador.colaboradorID,
            novoDonoID: targetColaboradorID,
            motivo: `Transferência direta via Painel de colaborador para ${target.nome}`,
            responsavel: "Usuário (via Painel)",
            dataHora: new Date().toISOString(),
         });

         toast.success("Dispositivo reatribuido", `${asset.etiquetaID} agora esta com ${target.nome}.`);
         setReassignTargets((prev) => ({ ...prev, [asset.etiquetaID]: "" }));
         await loadColaboradorData(colaborador);
         triggerRefresh(); // SpaceStock Sync
      } catch (error: any) {
         toast.error("Erro ao reatribuir", error?.message || "Nao foi possivel reatribuir o dispositivo.");
      } finally {
         setReassigningAssetId(null);
      }
   };

   const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
         toast.error("Arquivo muito grande", "A foto deve ter no máximo 2MB.");
         return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
         setProfileForm((prev: any) => ({ ...prev, fotoColaborador: ev.target?.result as string }));
      };
      reader.readAsDataURL(file);
   };

   const handleSaveProfile = async () => {
      try {
         setSavingProfile(true);
         if (createMode) {
            const created = await ColaboradoresService.createColaborador(profileForm);
            const createdColaborador = {
               ...profileForm,
               colaboradorID: created?.colaboradorID || profileForm.colaboradorID || "",
            } as Colaborador;
            toast.success("Colaborador criado", `${profileForm.nome} foi cadastrado com sucesso.`);
            onColaboradorUpdated?.(createdColaborador);
         } else {
            if (!colaborador) return;
            await ColaboradoresService.updateColaborador(colaborador.colaboradorID, profileForm);
            const updated = { ...colaborador, ...profileForm };
            toast.success("Perfil atualizado", `${profileForm.nome} foi atualizado com sucesso.`);
            onColaboradorUpdated?.(updated);
         }
         triggerRefresh(); // SpaceStock Sync
         setEditMode(false);
      } catch (error: any) {
         toast.error("Erro ao salvar", error?.message || "Nao foi possivel atualizar o colaborador.");
      } finally {
         setSavingProfile(false);
      }
   };

   const startAssetEdit = (asset: any) => {
      setEditingAssetId(asset.etiquetaID);
      setAssetForm({
         status: asset.status || "",
         localizacao: asset.localizacao || "",
         observacoes: asset.observacoes || "",
      });
   };

   const handleSaveAsset = async (asset: any) => {
      try {
         setSavingAssetId(asset.etiquetaID);
         await EquipamentosService.updateEquipamento(asset.etiquetaID, {
            status: assetForm.status,
            localizacao: assetForm.localizacao,
            observacoes: assetForm.observacoes,
         });
         setAssets((prev) => prev.map((item) => (
            item.etiquetaID === asset.etiquetaID
               ? { ...item, status: assetForm.status, localizacao: assetForm.localizacao, observacoes: assetForm.observacoes }
               : item
         )));
         toast.success("Dispositivo atualizado", `${asset.etiquetaID} salvo no slidebar.`);
         setEditingAssetId(null);
      } catch (error: any) {
         toast.error("Erro ao salvar dispositivo", error?.message || "Nao foi possivel atualizar o equipamento.");
      } finally {
         setSavingAssetId(null);
      }
   };

  const initials = (name: string) =>
    name?.split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

  // Calculate Responsibility Score based on asset health/status
  const responsibilityScore = useMemo(() => {
    if (assets.length === 0) return 100;
    
    // Weight status for the score
    const statusWeights: Record<string, number> = {
      'operacional': 100,
      'em uso': 100,
      'novo': 100,
      'em manutenção': 50,
      'manutenção': 50,
      'danificado': 0,
      'extraviado': 0
    };

    const totalWeight = assets.reduce((acc, asset) => {
      const status = (asset.status || '').toLowerCase();
      // Match partial status or default to 70 for unknown/neutral states
      const weight = statusWeights[status] ?? 70;
      return acc + weight;
    }, 0);

    return Math.round(totalWeight / assets.length);
  }, [assets]);

   if (!isOpen) return null;

   const displayName = createMode ? (profileForm.nome || "Novo Colaborador") : (colaborador?.nome || "Colaborador");
   const displayRole = createMode ? (profileForm.cargo || "Cadastro") : (colaborador?.cargo || "Sem cargo");

   return (
      <SlidebarPanel
         isOpen={isOpen}
         onClose={onClose}
         panelClassName="bg-surface h-full w-full border-l border-border-subtle shadow-2xl flex flex-col"
      >
                  <SlidebarHeader
                    title={displayName}
                    subtitle={displayRole}
                    onClose={onClose}
                    actions={
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditMode((prev) => !prev)}
                          className="w-10 h-10 rounded-xl bg-surface border border-border-subtle text-muted hover:text-brand flex items-center justify-center transition-colors shadow-nm-flat"
                          title={editMode ? "Cancelar edicao" : "Editar colaborador"}
                          aria-label={editMode ? "Cancelar edicao" : "Editar colaborador"}
                        >
                          <i className={`fa-solid ${editMode ? "fa-ban" : "fa-pen-to-square"} text-xs`}></i>
                        </button>
                      </div>
                    }
                     className="p-6 border-b border-border-subtle relative overflow-hidden shrink-0 bg-surface flex items-center justify-between"
                  />

                  <div className="p-6 border-b border-border-subtle relative overflow-hidden shrink-0 bg-surface-soft">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-brand blur-[100px] -mr-32 -mt-32 opacity-10"></div>
                     <div className="relative z-10">

                       {editMode ? (
                          <div className="mt-8 flex flex-col items-center justify-center relative z-10">
                             <div 
                               className="relative group cursor-pointer" 
                               onClick={() => fileInputRef.current?.click()}
                             >
                                <SmartAvatar 
                                   src={profileForm.fotoColaborador} 
                                   name={profileForm.nome || "Novo Colaborador"} 
                                   size="xl"
                                   className="ring-4 ring-white dark:ring-slate-900 shadow-2xl"
                                />
                                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                                   <i className="fa-solid fa-camera text-white text-xl"></i>
                                </div>
                             </div>
                             <input 
                                ref={fileInputRef} 
                                type="file" 
                                accept="image/*" 
                                onChange={handlePhotoUpload} 
                                className="hidden" 
                             />
                             <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="mt-4 px-4 py-2 bg-surface border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-brand hover:bg-surface-soft transition-all shadow-nm-flat"
                             >
                                <i className="fa-solid fa-upload mr-2"></i> Selecionar Foto
                             </button>
 
                             <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Matrícula / ID *</label>
                                   <input
                                      value={profileForm.colaboradorID}
                                      onChange={(e) => setProfileForm((prev) => ({ ...prev, colaboradorID: e.target.value }))}
                                      disabled={!createMode}
                                      placeholder="Ex: COLAB001"
                                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-2xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all disabled:opacity-50 text-main"
                                   />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Nome Completo</label>
                                   <input
                                      value={profileForm.nome}
                                      onChange={(e) => setProfileForm((prev) => ({ ...prev, nome: e.target.value }))}
                                      placeholder="Ex: João Silva"
                                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-2xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                   />
                                </div>
                                <div className="md:col-span-2">
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">E-mail Corporativo</label>
                                   <input
                                      value={profileForm.email}
                                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                                      placeholder="joao@empresa.com"
                                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-2xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                   />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Cargo</label>
                                   <input
                                      value={profileForm.cargo}
                                      onChange={(e) => setProfileForm((prev) => ({ ...prev, cargo: e.target.value }))}
                                      placeholder="Ex: Analista de TI"
                                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-2xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                   />
                                </div>
                                <div>
                                   <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Departamento</label>
                                   <input
                                      value={profileForm.departamento}
                                      onChange={(e) => setProfileForm((prev) => ({ ...prev, departamento: e.target.value }))}
                                      placeholder="Ex: Infraestrutura"
                                      className="w-full px-4 py-3 bg-surface-soft border-none rounded-2xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                   />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl cursor-pointer group">
                                    <div className="relative">
                                      <input 
                                        type="checkbox" 
                                        checked={profileForm.ativo} 
                                        onChange={(e) => setProfileForm(p => ({ ...p, ativo: e.target.checked }))} 
                                        className="sr-only peer" 
                                      />
                                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-checked:bg-indigo-50 rounded-full transition-all"></div>
                                      <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-5"></div>
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-main">Colaborador Ativo</span>
                                  </label>
                                </div>
                             </div>
                          </div>
                       ) : (
                       <div className="mt-8 flex items-center gap-6">
                             {colaborador?.fotoColaborador ? (
                                <Image 
                                   src={colaborador.fotoColaborador} 
                                   alt={displayName} 
                                   width={96} 
                                   height={96} 
                                   className="w-24 h-24 rounded-[2rem] object-cover ring-4 ring-slate-50 dark:ring-slate-800 shadow-xl" 
                                />
                    ) : (
                      <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-3xl shadow-xl">
                                   {initials(displayName)}
                      </div>
                    )}
                    <div>
                               <h3 className="text-2xl font-black text-strong tracking-tight">{displayName}</h3>
                               <p className="text-sm font-bold text-indigo-500 uppercase tracking-[0.2em] mb-3">{displayRole}</p>
                      <div className="flex items-center gap-3">
                         <span className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black px-3 py-1 rounded-lg text-muted uppercase tracking-widest border border-slate-200 dark:border-white/5">
                                         {createMode ? (profileForm.departamento || "Sem departamento") : colaborador?.departamento}
                         </span>
                                    <span className={`w-2 h-2 rounded-full ${profileForm.ativo !== false ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`}></span>
                      </div>
                    </div>
                     </div>
                  )}
               </div>
            </div>

              {/* Quick Stats Grid */}
              {!createMode ? (
              <div className="p-8 grid grid-cols-2 gap-4 border-b border-border-subtle bg-surface-soft shrink-0">
                 <div className="bg-surface p-5 rounded-3xl border border-border-subtle shadow-nm-flat">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Ativos em Posse</p>
                    <p className="text-3xl font-black text-strong">{assets.length}</p>
                 </div>
                 <div className="bg-surface p-5 rounded-3xl border border-border-subtle shadow-nm-flat">
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Responsabilidade</p>
                    <div className="flex items-center gap-2">
                       <p className="text-3xl font-black text-brand">{responsibilityScore}%</p>
                       <i className="fa-solid fa-shield-check text-brand/40"></i>
                    </div>
                 </div>
              </div>
              ) : null}

              {/* Tabs Content */}
              {!createMode ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                 <div className="flex gap-8 border-b border-border-subtle mb-8 shrink-0">
                    <button 
                       onClick={() => setActiveTab("assets")}
                       className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'assets' ? 'text-brand' : 'text-muted hover:text-main'}`}
                    >
                       Painel de Ativos
                       {activeTab === 'assets' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand rounded-full" />}
                    </button>
                    <button 
                       onClick={() => setActiveTab("history")}
                       className={`pb-4 text-[10px] font-black uppercase tracking-[0.3em] transition-all relative ${activeTab === 'history' ? 'text-brand' : 'text-muted hover:text-main'}`}
                    >
                       Histórico de Movimentações
                       {activeTab === 'history' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-[3px] bg-brand rounded-full" />}
                    </button>
                 </div>

                 {loading ? (
                    <div className="flex flex-col items-center py-20 animate-pulse text-muted">
                       <i className="fa-solid fa-dna text-3xl mb-4 animate-spin-slow"></i>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted">Geração de Dossiê...</p>
                    </div>
                 ) : (
                    <div className="space-y-6">
                       {activeTab === 'assets' && (
                          <div className="space-y-4">
                             {assets.length === 0 ? (
                                <div className="text-center py-10 bg-surface-soft dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                                   <p className="text-xs font-bold text-muted uppercase tracking-widest">Nenhum ativo alocado</p>
                                </div>
                             ) : assets.map((asset) => (
                                <div key={asset.etiquetaID} className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-border-subtle dark:border-slate-700 shadow-sm group hover:border-indigo-200 transition-all">
                                   <button
                                     type="button"
                                     onClick={() => startAssetEdit(asset)}
                                     className="w-full text-left flex items-center justify-between"
                                     title="Editar dispositivo no slidebar"
                                     aria-label="Editar dispositivo no slidebar"
                                   >
                                   <div className="flex items-center gap-4">
                                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-brand group-hover:scale-110 transition-transform">
                                         <i className="fa-solid fa-laptop text-lg"></i>
                                      </div>
                                      <div>
                                         <p className="text-sm font-black text-strong">{asset.marca} {asset.modelo}</p>
                                         <p className="text-[10px] font-bold text-muted uppercase tracking-widest">{asset.tipoEquipamento} • <span className="text-indigo-500 font-mono">{asset.etiquetaID}</span></p>
                                      </div>
                                   </div>
                                   <div className="text-right">
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${asset.status === 'operacional' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                         {asset.status}
                                      </span>
                                   </div>
                                                   </button>

                                                   {editingAssetId === asset.etiquetaID ? (
                                                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border-subtle dark:border-slate-700 pt-4">
                                                         <div>
                                                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Status</label>
                                                            <input
                                                               value={assetForm.status}
                                                               onChange={(e) => setAssetForm((prev) => ({ ...prev, status: e.target.value }))}
                                                               title="Status do dispositivo"
                                                               aria-label="Status do dispositivo"
                                                               className="w-full px-4 py-2 bg-surface-soft border-none rounded-xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                                            />
                                                         </div>
                                                         <div>
                                                            <label className="block text-[10px] font-black uppercase tracking-widest text-muted mb-1.5 ml-1">Localizacao</label>
                                                            <input
                                                               value={assetForm.localizacao}
                                                               onChange={(e) => setAssetForm((prev) => ({ ...prev, localizacao: e.target.value }))}
                                                               title="Localizacao do dispositivo"
                                                               aria-label="Localizacao do dispositivo"
                                                               className="w-full px-4 py-2 bg-surface-soft border-none rounded-xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main"
                                                            />
                                                         </div>
                                                         <div className="flex items-end gap-2">
                                                            <button
                                                               type="button"
                                                               onClick={() => handleSaveAsset(asset)}
                                                               disabled={savingAssetId === asset.etiquetaID}
                                                               className="flex-1 py-1.5 px-3 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                            >
                                                               {savingAssetId === asset.etiquetaID ? "Salvando" : "Salvar"}
                                                            </button>
                                                            <button
                                                               type="button"
                                                               onClick={() => setEditingAssetId(null)}
                                                               className="py-1.5 px-3 bg-surface-soft border border-border-subtle text-main rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                            >
                                                               Cancelar
                                                            </button>
                                                         </div>
                                                      </div>
                                                   ) : null}

                                                   <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border-subtle dark:border-slate-700 pt-4">
                                                      <div className="bg-surface-soft rounded-2xl border border-border-subtle p-3 shadow-nm-inset">
                                                         <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1">Usuario Atual</p>
                                                         <p className="text-xs font-black text-strong">{colaborador?.nome || "Nao atribuido"}</p>
                                                      </div>
                                                      <div className="bg-surface-soft rounded-2xl border border-border-subtle p-3 shadow-nm-inset">
                                                         <p className="text-[9px] font-black uppercase tracking-widest text-muted mb-1">Descricao</p>
                                                         <p className="text-xs font-bold text-main line-clamp-2">
                                                            {asset.observacoes || `${asset.tipoEquipamento || "Dispositivo"} ${asset.marca || ""} ${asset.modelo || ""}`.trim()}
                                                         </p>
                                                      </div>
                                                   </div>

                                                   <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                                      <select
                                                         value={reassignTargets[asset.etiquetaID] || ""}
                                                         onChange={(e) => setReassignTargets((prev) => ({ ...prev, [asset.etiquetaID]: e.target.value }))}
                                                         title="Selecionar novo usuario para o dispositivo"
                                                         aria-label="Selecionar novo usuario para o dispositivo"
                                                         className="w-full px-4 py-2 bg-surface-soft border-none rounded-xl text-sm font-bold shadow-nm-inset focus:outline-none focus:ring-4 focus:ring-brand/10 transition-all text-main dark:[color-scheme:dark]"
                                                      >
                                                         <option value="">Selecionar novo usuario</option>
                                                         {availableColaboradores
                                                            .filter((c) => c.colaboradorID !== colaborador?.colaboradorID)
                                                            .map((c) => (
                                                              <option key={`${asset.etiquetaID}-${c.colaboradorID}`} value={c.colaboradorID}>
                                                                 {c.nome} ({c.colaboradorID})
                                                              </option>
                                                            ))}
                                                      </select>
                                                      <button
                                                         type="button"
                                                         onClick={() => handleReassignAsset(asset)}
                                                         disabled={reassigningAssetId === asset.etiquetaID || !(reassignTargets[asset.etiquetaID] || "")}
                                                         title="Atribuir dispositivo para novo usuario"
                                                         aria-label="Atribuir dispositivo para novo usuario"
                                                         className="py-2 px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                                      >
                                                         {reassigningAssetId === asset.etiquetaID ? "Atribuindo" : "Atribuir"}
                                                      </button>
                                                   </div>

                                                   <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle dark:border-slate-700 pt-4">
                                                        <button
                                                           type="button"
                                                           onClick={() => handleAssetLifecycleAction(asset, "alocar")}
                                                           disabled={assetActionLoadingId === asset.etiquetaID + "alocar"}
                                                           title="Alocar para Usuário"
                                                           aria-label="Alocar para Usuário"
                                                           className="py-2 px-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                        >
                                                           {assetActionLoadingId === asset.etiquetaID + "alocar" ? "..." : "Alocar"}
                                                        </button>
                                                        <button
                                                           type="button"
                                                           onClick={() => handleAccessAsset(asset)}
                                                           title="Acessar edicao do dispositivo"
                                                           aria-label="Acessar edicao do dispositivo"
                                                           className="py-2 px-2 bg-surface-soft border border-border-subtle text-main rounded-xl text-[10px] font-black uppercase tracking-widest shadow-nm-flat"
                                                        >
                                                           Acessar
                                                        </button>
                                                        <button
                                                           type="button"
                                                           onClick={() => handleAssetLifecycleAction(asset, "devolver")}
                                                           disabled={assetActionLoadingId === asset.etiquetaID + "devolver"}
                                                           title="Devolver para Estoque"
                                                           aria-label="Devolver para Estoque"
                                                           className="py-2 px-2 bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                                        >
                                                           {assetActionLoadingId === asset.etiquetaID + "devolver" ? "..." : "Devolver"}
                                                        </button>
                                                   </div>
                                </div>
                             ))}
                          </div>
                       )}

                       {activeTab === 'history' && (
                          <div className="relative border-l-2 border-border-subtle ml-3 space-y-6 py-4">
                             {history.length === 0 ? (
                                <p className="text-xs font-bold text-muted uppercase tracking-widest text-center py-10">Sem histórico recente</p>
                             ) : history.map((m, idx) => (
                                <div key={idx} className="relative pl-8">
                                   <div className="absolute -left-[9px] top-0 w-4 h-4 bg-surface-soft border-2 border-border-subtle rounded-full shadow-nm-flat" />
                                   <div className="bg-white dark:bg-slate-800 border border-border-subtle rounded-2xl p-4 shadow-sm group">
                                      <div className="flex items-center justify-between gap-2 mb-2">
                                         <p className="text-[10px] font-black text-muted uppercase tracking-widest">
                                            {new Date(m.dataHora).toLocaleDateString()} {new Date(m.dataHora).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                         </p>
                                         <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-brand uppercase tracking-widest">
                                            {m.tipoMovimentacao || "movimentacao"}
                                         </span>
                                      </div>
                                      <p className="text-sm font-black text-strong tracking-tight">
                                         {m.tipoEquipamento || "Dispositivo"} <span className="text-brand">{m.equipamentoID || ""}</span>
                                      </p>
                                      <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] font-bold text-muted">
                                         <p>Origem: {m.donoAnteriorNome || m.setorOrigem || "N/A"}</p>
                                         <p>Destino: {m.novoDonoNome || m.setorDestino || "N/A"}</p>
                                         <p>Responsável: {m.tecnicoResponsavelNome || m.responsavel || "Sistema"}</p>
                                         {m.protocoloSolicitacao ? <p className="text-indigo-500">Protocolo: #{m.protocoloSolicitacao}</p> : null}
                                      </div>
                                      <p className="text-xs text-muted mt-2 italic line-clamp-2">
                                         "&quot;{m.motivo || m.descricaoDetalhada || 'Transação operacional'}&quot;"
                                      </p>
                                       {(() => {
                                          const prot = (m as any).protocoloSolicitacao || (m as any).protocolo;
                                          const movId = (m as any).movimentacao_id || (m as any).movimentacaoID || (m as any).id;
                                          
                                          return (
                                             <div className="mt-4 pt-3 border-t border-border-subtle flex flex-wrap gap-2">
                                                {prot && (
                                                   <button 
                                                      onClick={() => {
                                                         onClose();
                                                         router.push(`/solicitacoes?open=${prot}`);
                                                      }}
                                                      className="flex-1 min-w-[80px] py-1.5 bg-surface-soft border border-border-subtle text-main rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-nm-flat"
                                                   >
                                                      <i className="fa-solid fa-eye text-[10px]"></i>
                                                      Acessar
                                                   </button>
                                                )}

                                                <button 
                                                   onClick={() => openChat("movimentacao", movId || String(m.dataHora), `Chat da Movimentação`)}
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
                             ))}
                          </div>
                       )}
                    </div>
                 )}
                    </div>
                    ) : (
                       <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                          <div className="text-center py-10 bg-surface-soft rounded-3xl border border-border-subtle">
                             <i className="fa-solid fa-user-plus text-indigo-500 text-2xl mb-3"></i>
                             <p className="text-xs font-black uppercase tracking-widest text-muted">Preencha os dados e clique em salvar para criar o colaborador</p>
                          </div>
                       </div>
                    )}

      <SlidebarFooter className="p-6 border-t border-border-subtle bg-surface-soft">
            <div className="grid grid-cols-2 gap-4">
               <button onClick={onClose} className="py-3 px-4 bg-surface border border-border-subtle rounded-2xl text-[10px] font-black uppercase tracking-widest text-main hover:bg-surface-soft transition-all shadow-nm-flat">
                  Fechar Perfil
               </button>
               {editMode && (
                 <button
                   onClick={handleSaveProfile}
                   disabled={savingProfile}
                   className="py-3 px-4 bg-brand text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                 >
                   {savingProfile ? (createMode ? "Criando..." : "Salvando") : (createMode ? "Concluir Cadastro" : "Salvar Alteracoes")}
                 </button>
               )}
            </div>
      </SlidebarFooter>
      </SlidebarPanel>
   );
}
