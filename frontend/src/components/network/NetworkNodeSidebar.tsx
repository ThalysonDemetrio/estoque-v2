"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NetworkNode, RedeService } from "@/services/rede.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { EquipamentosService } from "@/services/equipamentos.service";
import { useToast } from "@/contexts/ToastContext";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";

interface NetworkNodeSidebarProps {
  node: NetworkNode | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updatedNode: NetworkNode) => void;
  switches?: NetworkNode[];
  allNodes?: NetworkNode[];
  onRefresh?: () => Promise<void>;
  onPingResult?: (ip: string, status: "online" | "offline") => void;
}

export function NetworkNodeSidebar({ 
  node, 
  isOpen, 
  onClose, 
  onUpdate, 
  switches = [], 
  allNodes = [],
  onRefresh,
  onPingResult
}: NetworkNodeSidebarProps) {
  const [activeTab, setActiveTab] = useState<"diagnostics" | "console" | "config">("diagnostics");
  const [terminalOutput, setTerminalOutput] = useState<string[]>(["Rede Insight v2.0 READY", "Aguardando comando..."]);
  const [isPinging, setIsPinging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
   const [colaboradores, setColaboradores] = useState<any[]>([]);
   const [selectedColaboradorID, setSelectedColaboradorID] = useState<string>("");
   const [isAssigningUser, setIsAssigningUser] = useState(false);
   const [equipamentoDetails, setEquipamentoDetails] = useState<any>(null);
  
  const [formData, setFormData] = useState<Partial<NetworkNode>>({});
  const { success, error } = useToast();

  useEffect(() => {
    if (node) {
      setFormData(node);
         setSelectedColaboradorID("");
    }
  }, [node]);

   useEffect(() => {
      if (!isOpen) return;

      const loadColaboradores = async () => {
         try {
            const data = await ColaboradoresService.getColaboradores({});
            const list = Array.isArray(data) ? data : [];
            setColaboradores(list.filter((c) => c?.ativo !== false));
         } catch {
            setColaboradores([]);
         }
      };

      loadColaboradores();
   }, [isOpen]);

   useEffect(() => {
      if (!isOpen || !node?.equipment_id) {
         setEquipamentoDetails(null);
         return;
      }

      const loadEquipmentDetails = async () => {
         try {
            const details = await EquipamentosService.getEquipamento(node.equipment_id);
            setEquipamentoDetails(details || null);
         } catch {
            setEquipamentoDetails(null);
         }
      };

      loadEquipmentDetails();
   }, [isOpen, node?.equipment_id]);

  const handleSave = async () => {
    if (!node) return;
    try {
      setIsSaving(true);
      // Wait for both updates to complete
      const [posRes, netRes] = await Promise.all([
            RedeService.updateTopologyNodePosition(node.id, {
               pos_x: Number(node.pos_x),
               pos_y: Number(node.pos_y),
            }),
            RedeService.updateNetworkDetails(node.equipment_id, formData)
      ]);
      
      const updatedNode = { ...node, ...formData };
      if (onUpdate) onUpdate(updatedNode);

      if (netRes?.warning) {
        error("Aviso de Rede", netRes.warning);
      }

      if (onRefresh) await onRefresh();
      success("Configurações atualizadas com sucesso");
    } catch (err: any) {
      const msg = err.backendMessage || "Erro ao salvar configurações";
      error("Erro ao salvar", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePing = async () => {
    const ip = formData.ip_address || node?.ip_address;
    if (!ip) {
      error("IP não configurado para este dispositivo");
      return;
    }

    setIsPinging(true);
    setTerminalOutput(prev => [...prev, `> ping ${ip}...`]);
    
    try {
      const result = await RedeService.ping(ip);
      if (result && result.output) {
        const lines = result.output.split('\n').filter((l: string) => l.trim() !== "");
        setTerminalOutput(prev => [...prev, ...lines]);
        
        if (result.success) {
          setTerminalOutput(prev => [...prev, `Conexão: ESTÁVEL`, `Nó OPERACIONAL.`]);
          if (onPingResult) onPingResult(ip, "online");
        } else {
          setTerminalOutput(prev => [...prev, `ALERTA: O dispositivo não respondeu corretamente.`]);
          if (onPingResult) onPingResult(ip, "offline");
        }
      } else {
        setTerminalOutput(prev => [...prev, "Sem resposta do sistema operacional."]);
      }
    } catch (err) {
      setTerminalOutput(prev => [...prev, "ERRO: Falha na comunicação com o serviço de diagnóstico."]);
    } finally {
      setIsPinging(false);
    }
  };

  const getIcon = (tipo: string) => {
    const t = (tipo || "").toLowerCase();
    
    // Infraestrutura e Rede
    if (t.includes("switch")) return "fa-network-wired";
    if (t.includes("router") || t.includes("roteador")) return "fa-route";
    if (t.includes("firewall") || t.includes("fortigate") || t.includes("mikrotik")) return "fa-shield-halved";
    if (t.includes("wifi") || t.includes("wlan") || t.includes("access point") || t.includes("ubiquiti") || t.includes("unifi")) return "fa-wifi";
    if (t.includes("modem")) return "fa-bridge";
    if (t.includes("antena") || t.includes("radio")) return "fa-tower-broadcast";
    
    // Servidores e Armazenamento
    if (t.includes("server") || t.includes("servidor")) return "fa-server";
    if (t.includes("nas") || t.includes("storage")) return "fa-database";
    if (t.includes("ups") || t.includes("nobreak") || t.includes("bateria")) return "fa-battery-three-quarters";
    
    // End-points e Periféricos
    if (t.includes("computador") || t.includes("desktop") || t.includes("pc") || t.includes("monitor") || t.includes("tela")) return "fa-desktop";
    if (t.includes("notebook") || t.includes("laptop") || t.includes("macbook")) return "fa-laptop";
    if (t.includes("printer") || t.includes("impressora") || t.includes("plotter")) return "fa-print";
    if (t.includes("phone") || t.includes("celular") || t.includes("smartphone")) return "fa-mobile-screen";
    if (t.includes("tablet") || t.includes("ipad")) return "fa-tablet-screen-button";
    
    // Segurança e IoT
    if (t.includes("video") || t.includes("camera") || t.includes("dvr") || t.includes("nvr")) return "fa-video";
    if (t.includes("tv") || t.includes("smart tv")) return "fa-tv";
    if (t.includes("biometria") || t.includes("facial") || t.includes("controle de acesso")) return "fa-fingerprint";
    
    return "fa-box-open";
  };

   const getDeviceDescription = () => {
      const specs = equipamentoDetails?.especificacoes || {};
      const specsDescricao = typeof specs?.descricao === "string" ? specs.descricao.trim() : "";
      const explicitDescricao = typeof equipamentoDetails?.descricao === "string" ? equipamentoDetails.descricao.trim() : "";
      const networkNotes = typeof formData.network_notes === "string" ? formData.network_notes.trim() : "";

      if (explicitDescricao) return explicitDescricao;
      if (specsDescricao) return specsDescricao;
      if (networkNotes) return networkNotes;

      const base = `${node?.tipo_equipamento || "Dispositivo"} ${node?.marca || ""} ${node?.modelo || ""}`.trim();
      const local = node?.localizacao ? ` em ${node.localizacao}` : "";
      const rede = formData.ip_address ? ` com IP ${formData.ip_address}` : "";
      return `${base}${local}${rede}.`;
   };

   const handleAssignUser = async () => {
      if (!node || !selectedColaboradorID) {
         error("Selecione um colaborador para atribuir");
         return;
      }

      const selectedColaborador = colaboradores.find((c) => c.colaboradorID === selectedColaboradorID);
      if (!selectedColaborador) {
         error("Colaborador selecionado nao encontrado");
         return;
      }

      try {
         setIsAssigningUser(true);

         await MovimentacoesService.createMovimentacao({
            equipamentoID: node.equipment_id,
            tipoMovimentacao: node.usuarioNome ? "transferencia" : "alocacao",
            colaboradorID: selectedColaboradorID,
            novoDonoID: selectedColaboradorID,
            motivo: `Atribuição realizada via Painel de Rede para ${selectedColaborador.nome}`,
            responsavel: "Usuário (via Painel)",
            dataHora: new Date().toISOString(),
         });

         const updatedNode = {
            ...node,
            usuarioNome: selectedColaborador.nome,
            status: "Em Uso",
         };

         setFormData((prev) => ({
            ...prev,
            usuarioNome: selectedColaborador.nome,
            status: "Em Uso",
         }));
         setSelectedColaboradorID("");
         onUpdate?.(updatedNode);
         success("Atribuicao concluida", `${node.equipment_id} agora esta com ${selectedColaborador.nome}.`);
      } catch {
         error("Erro ao atribuir dispositivo", "Nao foi possivel atualizar o usuario atual.");
      } finally {
         setIsAssigningUser(false);
      }
   };

   if (!isOpen || !node) return null;

  return (
      <SlidebarPanel
         isOpen={isOpen}
         onClose={onClose}
         panelClassName="network-node-surface bg-white dark:bg-slate-900 text-slate-900 dark:text-white h-full w-full border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col"
         contentClassName="flex-1 overflow-y-auto pb-0"
      >
      <SlidebarHeader
        title={`${node.marca} ${node.modelo}`}
        subtitle={node.equipment_id}
        iconClassName={getIcon(node.tipo_equipamento || "")}
        onClose={onClose}
        className="p-8 border-b border-slate-100 dark:border-white/5 relative overflow-hidden shrink-0 bg-white dark:bg-slate-900 flex items-center justify-between"
        titleClassName="text-xl font-black tracking-tight text-slate-900 dark:text-white"
        subtitleClassName="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-widest mt-1 font-mono"
        actions={
          <div className="flex items-center gap-3">
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-500/20 uppercase tracking-widest">
              Link Ativo
            </span>
          </div>
        }
      />

      {/* Device Info Summary instead of original header MT-8 section */}
      <div className="px-8 py-4 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/10 dark:bg-blue-600/20 border border-blue-200 dark:border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-500 text-3xl shadow-lg shadow-blue-500/10 overflow-hidden shrink-0">
            {node.fotoEquipamento ? (
              <img 
                src={node.fotoEquipamento} 
                alt={node.equipment_id} 
                draggable="false"
                className="w-full h-full object-cover border-2 border-white/10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = ""; // Fallback will show icon
                }}
              />
            ) : (
              <i className={`fa-solid ${getIcon(node.tipo_equipamento || "")}`}></i>
            )}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded uppercase tracking-tighter">
                Colaborador: {node.usuarioNome || "Não Atribuído"}
              </span>
            </div>
          </div>
        </div>
      </div>

            {/* Quick Diagnostic Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 p-4 gap-4 bg-white/5 shrink-0">
               <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Status de Rede</p>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                     <span className="text-sm font-bold text-emerald-400">Excelente</span>
                  </div>
               </div>
               <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Setor / Local</p>
                  <span className="text-sm font-bold text-blue-400 truncate">{node.localizacao || "N/A"}</span>
               </div>
               <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Responsavel Atual</p>
                  <span className="text-sm font-bold text-emerald-300 truncate">{node.usuarioNome || "Nao atribuido"}</span>
               </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex px-8 border-b border-white/5 shrink-0">
               {["diagnostics", "console", "config"].map((tab) => (
                  <button 
                     key={tab}
                     onClick={() => setActiveTab(tab as any)}
                     className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                  >
                     {tab}
                  </button>
               ))}
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
               {activeTab === 'diagnostics' && (
                  <div className="space-y-6">
                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                           <i className="fa-solid fa-layer-group text-blue-500"></i>
                           Endereçamento & Link
                        </h4>
                        <div className="space-y-4">
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Endereço IPv4</p>
                              <input 
                                 type="text" value={formData.ip_address || ""} 
                                 onChange={(e) => setFormData({...formData, ip_address: e.target.value})}
                                 className="w-full bg-transparent border-none p-0 text-sm font-mono text-emerald-400 focus:ring-0"
                                 placeholder="0.0.0.0"
                              />
                           </div>
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Máscara de Sub-rede</p>
                              <input 
                                 type="text" value={formData.subnet_mask || ""} 
                                 onChange={(e) => setFormData({...formData, subnet_mask: e.target.value})}
                                 className="w-full bg-transparent border-none p-0 text-sm font-mono text-cyan-300 focus:ring-0"
                                 placeholder="255.255.255.0"
                              />
                           </div>
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Gateway Padrão</p>
                              <input 
                                 type="text" value={formData.default_gateway || ""} 
                                 onChange={(e) => setFormData({...formData, default_gateway: e.target.value})}
                                 className="w-full bg-transparent border-none p-0 text-sm font-mono text-amber-300 focus:ring-0"
                                 placeholder="192.168.1.1"
                              />
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">DNS Primário</p>
                                 <input 
                                    type="text" value={formData.dns_primary || ""} 
                                    onChange={(e) => setFormData({...formData, dns_primary: e.target.value})}
                                    className="w-full bg-transparent border-none p-0 text-sm font-mono text-fuchsia-300 focus:ring-0"
                                    placeholder="8.8.8.8"
                                 />
                              </div>
                              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">DNS Secundário</p>
                                 <input 
                                    type="text" value={formData.dns_secondary || ""} 
                                    onChange={(e) => setFormData({...formData, dns_secondary: e.target.value})}
                                    className="w-full bg-transparent border-none p-0 text-sm font-mono text-fuchsia-300 focus:ring-0"
                                    placeholder="1.1.1.1"
                                 />
                              </div>
                           </div>
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Link Uplink (Switch)</p>
                              <select 
                                 value={formData.switch_name || ""} 
                                 onChange={(e) => setFormData({...formData, switch_name: e.target.value})}
                                 title="Link Uplink (Switch)"
                                 aria-label="Link Uplink (Switch)"
                                 className="w-full bg-transparent border-none p-0 text-sm font-mono text-blue-400 dark:text-blue-300 focus:ring-0 outline-none cursor-pointer appearance-none dark:[color-scheme:dark]"
                              >
                                 <option value="" className="bg-slate-900">DIRETO / NENHUM</option>
                                 {formData.switch_name && !switches.some(s => s.equipment_id === formData.switch_name) && (
                                    <option value={formData.switch_name} className="bg-slate-900">{formData.switch_name} (Não listado/Antigo)</option>
                                 )}
                                 {switches.map(s => (
                                     <option key={s.id} value={s.equipment_id} className="bg-slate-900">
                                        {s.marca} {s.modelo} ({s.equipment_id})
                                     </option>
                                 ))}
                              </select>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Porta</p>
                                 <select 
                                    value={formData.switch_port || ""} 
                                    onChange={(e) => setFormData({...formData, switch_port: e.target.value})}
                                    disabled={!formData.switch_name}
                                    title="Porta"
                                    aria-label="Porta"
                                    className="w-full bg-transparent border-none p-0 text-sm font-mono text-white focus:ring-0 outline-none cursor-pointer appearance-none disabled:opacity-50"
                                 >
                                    <option value="" className="bg-slate-900">SELECIONAR PORTA</option>
                                    {(() => {
                                       const selectedSwitchId = formData.switch_name;
                                       if (!selectedSwitchId) return null;

                                       const selectedSwitch = allNodes?.find(d => d.equipment_id === selectedSwitchId) as any;
                                       if (!selectedSwitch) return null;

                                       const total = selectedSwitch.total_ports || 0;
                                       if (total <= 0) return <option disabled className="bg-slate-900">Sem portas (Total: {total})</option>;

                                       const usedPorts = new Set(
                                          allNodes
                                             .filter(d => d.switch_name === selectedSwitchId && d.equipment_id !== node.equipment_id)
                                             .map(d => d.switch_port as string)
                                       );

                                       const options = [];
                                       for (let i = 1; i <= total; i++) {
                                          const portName = `Porta ${i}`;
                                          if (!usedPorts.has(portName) || formData.switch_port === portName) {
                                             options.push(<option key={i} value={portName} className="bg-slate-900">{portName}</option>);
                                          }
                                       }
                                       return options;
                                    })()}
                                 </select>
                              </div>
                              <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                 <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">VLAN ID</p>
                                 <input 
                                    type="number" value={formData.vlan_id || ""} 
                                    onChange={(e) => setFormData({...formData, vlan_id: parseInt(e.target.value) || 0})}
                                    className="w-full bg-transparent border-none p-0 text-sm font-mono text-purple-400 focus:ring-0"
                                    placeholder="1"
                                 />
                              </div>
                           </div>
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Observações de Rede</p>
                              <textarea
                                 value={formData.network_notes || ""}
                                 onChange={(e) => setFormData({ ...formData, network_notes: e.target.value })}
                                 className="w-full min-h-20 resize-y bg-transparent border-none p-0 text-sm font-mono text-slate-300 focus:ring-0"
                                 placeholder="Detalhes de patch panel, tomada, rack, observacoes tecnicas..."
                              />
                           </div>
                        </div>
                     </div>

                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest mb-4">Assinatura MAC</h4>
                        <input 
                           type="text" value={formData.mac_address || ""} 
                           onChange={(e) => setFormData({...formData, mac_address: e.target.value})}
                           className="w-full bg-black/60 p-4 rounded-xl text-xs font-mono text-slate-400 border border-white/5 focus:ring-1 focus:ring-blue-500/50 outline-none"
                           placeholder="00:00:00:00:00:00"
                        />
                     </div>
                  </div>
               )}

               {activeTab === 'console' && (
                  <div className="h-full flex flex-col gap-4">
                     <div className="flex-1 bg-black rounded-2xl p-4 font-mono text-xs text-emerald-500 overflow-y-auto border border-white/10 relative">
                        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500/50 animate-pulse"></div>
                        {terminalOutput.map((line, i) => (
                           <div key={i} className="mb-1 leading-relaxed">{line}</div>
                        ))}
                        {isPinging && <div className="animate-pulse underline">Executando processo...</div>}
                     </div>
                     <button 
                        onClick={handlePing}
                        disabled={isPinging}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-600/20 transition-all"
                     >
                        {isPinging ? 'Pinging...' : 'Testar Conectividade (Ping)'}
                     </button>
                  </div>
               )}

               {activeTab === 'config' && (
                  <div className="space-y-6">
                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest mb-4">Propriedades do Ativo</h4>
                        <div className="space-y-4 text-xs">
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Status</span>
                              <span className="font-bold uppercase">{node.status || "N/A"}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Fabricante</span>
                              <span className="font-bold">{node.marca}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Modelo</span>
                              <span className="font-bold">{node.modelo}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Tipo</span>
                              <span className="font-bold uppercase">{node.tipo_equipamento}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Com Colaborador</span>
                              <span className="font-bold">{node.usuarioNome || "Nao atribuido"}</span>
                           </div>
                           <div className="flex justify-between border-b border-white/5 py-2">
                              <span className="text-slate-500">Localizacao</span>
                              <span className="font-bold">{node.localizacao || "N/A"}</span>
                           </div>
                        </div>
                     </div>

                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest mb-4">Descricao do Dispositivo</h4>
                        <p className="text-xs leading-relaxed text-slate-300">
                           {getDeviceDescription()}
                        </p>
                     </div>

                     <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
                        <h4 className="text-xs font-black uppercase tracking-widest mb-4">Usuario Atual e Atribuicao</h4>
                        <div className="space-y-4">
                           <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                              <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2">Usuario Atual</p>
                              <p className="text-sm font-bold text-emerald-300">{formData.usuarioNome || node.usuarioNome || "Nao atribuido"}</p>
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Novo usuario</label>
                              <select
                                 value={selectedColaboradorID}
                                 onChange={(e) => setSelectedColaboradorID(e.target.value)}
                                 title="Selecionar novo usuario"
                                 aria-label="Selecionar novo usuario"
                                 className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500/60 dark:[color-scheme:dark]"
                              >
                                 <option value="">Selecione um colaborador</option>
                                 {colaboradores.map((c) => (
                                    <option key={c.colaboradorID} value={c.colaboradorID}>
                                       {c.nome} ({c.colaboradorID})
                                    </option>
                                 ))}
                              </select>
                           </div>
                           <button
                              type="button"
                              onClick={handleAssignUser}
                              disabled={isAssigningUser || !selectedColaboradorID}
                              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest transition-all"
                              title="Atribuir dispositivo para novo usuario"
                              aria-label="Atribuir dispositivo para novo usuario"
                           >
                              {isAssigningUser ? "Atribuindo..." : "Atribuir para novo usuario"}
                           </button>
                        </div>
                     </div>

                     <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                           <i className="fa-solid fa-triangle-exclamation"></i> Aviso de Segurança
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                           As alterações de rede são aplicadas imediatamente ao inventário lógico. Certifique-se de que os dados de IP e VLAN condizem com a infraestrutura física.
                        </p>
                     </div>
                  </div>
               )}
            </div>

      <SlidebarFooter className="p-8 border-t border-white/5 bg-black/40">
            <div className="flex gap-4">
               <button onClick={onClose} className="flex-1 py-4 bg-white/5 text-slate-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all">
                  Cancelar
               </button>
               <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex-1 py-4 bg-emerald-600 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
               >
                  {isSaving ? (
                     <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                     <i className="fa-solid fa-floppy-disk"></i>
                  )}
                  Salvar
               </button>
            </div>
      </SlidebarFooter>
      </SlidebarPanel>
  );
}
