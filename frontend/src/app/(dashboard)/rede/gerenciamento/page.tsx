"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { RedeService } from "@/services/rede.service";
import { useToast } from "@/contexts/ToastContext";

const VENDORS = [
  {
    id: "mikrotik",
    name: "MikroTik",
    description: "Gerenciamento RouterOS via REST API e WinBox nativo.",
    logo: "/logos/mikrotik.png",
    color: "text-blue-500",
    bg: "bg-blue-50/50 dark:bg-blue-900/20",
    status: "Pronto para Conexão",
    apiUrl: "https://router.local/rest"
  },
  {
    id: "unifi",
    name: "Ubiquiti UniFi",
    description: "Integração com Site Manager API para monitoramento de APs e Switches.",
    logo: "/logos/unifi.png",
    color: "text-indigo-500",
    bg: "bg-indigo-50/50 dark:bg-indigo-900/20",
    status: "Aguardando API Key",
    apiUrl: "https://unifi.ui.com"
  },
  {
    id: "omada",
    name: "TP-Link Omada",
    description: "Suporte a Open API para SDN Controllers (Versão Business).",
    logo: "/logos/omada.png",
    color: "text-emerald-500",
    bg: "bg-emerald-50/50 dark:bg-emerald-900/20",
    status: "Controller SDN Requerido",
    apiUrl: "https://omada.tplink.local"
  },
  {
    id: "intelbras",
    name: "Intelbras Zeus",
    description: "Gerenciamento centralizado de Access Points e Switches Intelbras.",
    logo: "/logos/intelbras.png",
    color: "text-orange-500",
    bg: "bg-orange-50/50 dark:bg-orange-900/20",
    status: "Parcialmente Aberta",
    apiUrl: "https://izeus.intelbras.com.br"
  }
];

export default function RedeGerenciamentoPage() {
  const toast = useToast();
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null);
  
  const [mikrotikConfig, setMikrotikConfig] = useState({ host: "", port: "443", user: "", password: "", path: "" });
  const [unifiConfig, setUnifiConfig] = useState({ controllerUrl: "", siteId: "default", apiKey: "", path: "" });
  const [omadaConfig, setOmadaConfig] = useState({ controllerUrl: "", clientId: "", clientSecret: "", path: "" });
  const [intelbrasConfig, setIntelbrasConfig] = useState({ host: "", user: "", password: "", path: "" });

  const [saving, setSaving] = useState(false);

  const handleOpenConfig = (vendorId: string) => {
    setActiveVendorId(vendorId);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      let result;
      if (activeVendorId === 'mikrotik') result = await RedeService.syncMikrotik(mikrotikConfig);
      else if (activeVendorId === 'unifi') result = await RedeService.syncUnifi(unifiConfig);
      else if (activeVendorId === 'omada') result = await RedeService.syncOmada(omadaConfig);
      else if (activeVendorId === 'intelbras') result = await RedeService.syncIntelbras(intelbrasConfig);
      
      if (result?.success) {
        toast.success(`${activeVendorId?.toUpperCase()} Sincronizado!`, "Dados capturados com sucesso.");
      } else {
        toast.error("Erro na Sincronização", "O fabricante respondeu com erro.");
      }
    } catch (error: any) {
      toast.error("Falha de Conexão", error.message || "Não foi possível conectar ao dispositivo.");
    } finally {
      setSaving(false);
      setShowConfigModal(false);
    }
  };

  const renderModalContent = () => {
    switch(activeVendorId) {
      case 'mikrotik':
        return (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">IP / Host</label>
              <input type="text" value={mikrotikConfig.host} onChange={e => setMikrotikConfig({...mikrotikConfig, host: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="192.168.88.1" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" value={mikrotikConfig.port} onChange={e => setMikrotikConfig({...mikrotikConfig, port: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Porta (443)" />
              <input type="text" value={mikrotikConfig.user} onChange={e => setMikrotikConfig({...mikrotikConfig, user: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Usuário" required />
            </div>
            <input type="password" value={mikrotikConfig.password} onChange={e => setMikrotikConfig({...mikrotikConfig, password: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Senha" required />
            <input type="text" value={mikrotikConfig.path} onChange={e => setMikrotikConfig({...mikrotikConfig, path: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Caminho de Acesso Direto (ex: /webfig)" />
            <p className="text-[10px] text-slate-400 mt-2 px-1 italic">
              * Certifique-se de que o serviço <b>www</b> (porta 80) ou <b>www-ssl</b> (porta 443) está ativo no MikroTik em <i>IP &gt; Services</i>. O RouterOS v7.1+ é necessário para a REST API.
            </p>
          </>
        );
      case 'unifi':
        return (
          <>
            <input type="text" value={unifiConfig.controllerUrl} onChange={e => setUnifiConfig({...unifiConfig, controllerUrl: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Controller URL (ex: https://192.168.1.10:8443)" required />
            <input type="text" value={unifiConfig.siteId} onChange={e => setUnifiConfig({...unifiConfig, siteId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Site ID (padrão: default)" required />
            <input type="password" value={unifiConfig.apiKey} onChange={e => setUnifiConfig({...unifiConfig, apiKey: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="API Key / Password" required />
            <input type="text" value={unifiConfig.path} onChange={e => setUnifiConfig({...unifiConfig, path: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Caminho/Porta de Acesso (ex: :8443)" />
          </>
        );
      case 'omada':
        return (
          <>
            <input type="text" value={omadaConfig.controllerUrl} onChange={e => setOmadaConfig({...omadaConfig, controllerUrl: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Controller URL" required />
            <input type="text" value={omadaConfig.clientId} onChange={e => setOmadaConfig({...omadaConfig, clientId: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="App Client ID" required />
            <input type="password" value={omadaConfig.clientSecret} onChange={e => setOmadaConfig({...omadaConfig, clientSecret: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="App Client Secret" required />
            <input type="text" value={omadaConfig.path} onChange={e => setOmadaConfig({...omadaConfig, path: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Caminho de Acesso (ex: /login)" />
          </>
        );
      case 'intelbras':
        return (
          <>
            <input type="text" value={intelbrasConfig.host} onChange={e => setIntelbrasConfig({...intelbrasConfig, host: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Host / IP" required />
            <input type="text" value={intelbrasConfig.user} onChange={e => setIntelbrasConfig({...intelbrasConfig, user: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Usuário" required />
            <input type="password" value={intelbrasConfig.password} onChange={e => setIntelbrasConfig({...intelbrasConfig, password: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Senha" required />
            <input type="text" value={intelbrasConfig.path} onChange={e => setIntelbrasConfig({...intelbrasConfig, path: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-5 py-3.5 text-sm shadow-inner" placeholder="Caminho de Acesso (ex: /zeus)" />
          </>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      {/* Modal de Configuração */}
      {showConfigModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] p-8 shadow-2xl border border-slate-100 dark:border-white/[0.05]"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center p-2 shadow-inner
                  ${activeVendorId === 'mikrotik' ? 'bg-blue-50' : 
                    activeVendorId === 'unifi' ? 'bg-white' :
                    activeVendorId === 'omada' ? 'bg-emerald-50' : 'bg-orange-50'}`}>
                  <img src={VENDORS.find(v => v.id === activeVendorId)?.logo} alt={activeVendorId || ''} className="w-full h-full object-contain" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Configurar {activeVendorId?.toUpperCase()}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Integração via API Oficial</p>
                </div>
              </div>
              <button onClick={() => setShowConfigModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <i className="fa-solid fa-times" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-5">
              {renderModalContent()}

              <div className="pt-4 flex gap-4">
                <button 
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar e Conectar"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
      {/* Header com Voltar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link 
              href="/rede"
              className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-500/30 transition-all shadow-sm"
            >
              <i className="fa-solid fa-arrow-left text-xs" />
            </Link>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Gerenciamento Avançado
            </h1>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Integração direta com Controllers e APIs de fabricantes para gestão centralizada de ativos de infraestrutura.
          </p>
        </div>
        
        <div className="hidden md:flex bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30 px-4 py-2 rounded-xl items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Proxy de Rede Ativo
          </span>
        </div>
      </div>

      {/* Grid de Fabricantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {VENDORS.map((v, idx) => (
          <motion.div
            key={v.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelectedVendor(v.id)}
            className={`group cursor-pointer bg-white dark:bg-slate-900/80 border p-6 rounded-3xl transition-all duration-300 relative overflow-hidden
              ${selectedVendor === v.id 
                ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-xl shadow-indigo-500/5' 
                : 'border-slate-100 dark:border-white/[0.05] hover:border-indigo-500/30 hover:shadow-lg shadow-sm'}`}
          >
            {/* Background Pattern */}
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-slate-50 dark:bg-white/[0.02] rounded-full group-hover:scale-150 transition-transform duration-500" />
            
            <div className="relative z-10 flex flex-col gap-6">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 p-2.5 transition-all
                ${v.bg} shadow-inner group-hover:scale-110 duration-500`}>
                <img src={v.logo} alt={v.name} className="w-full h-full object-contain" />
              </div>

              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{v.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[40px]">
                  {v.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-50 dark:border-white/[0.05] flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status API</span>
                  <span className="text-[9px] font-bold text-slate-800 dark:text-slate-200">{v.status}</span>
                </div>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenConfig(v.id);
                  }}
                  className="w-full py-3 bg-slate-50 dark:bg-slate-800 group-hover:bg-indigo-600 group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-100 dark:border-slate-700 group-hover:border-indigo-600 flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-external-link-alt" />
                  {((v.id === 'mikrotik' && mikrotikConfig.host) || 
                    (v.id === 'unifi' && unifiConfig.controllerUrl) ||
                    (v.id === 'omada' && omadaConfig.controllerUrl)) ? "Reconectar" : "Conectar Interface"}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Seção Informativa / Próximos Passos */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-white/[0.05] p-8 rounded-3xl flex flex-col lg:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-3xl shrink-0">
          <i className="fa-solid fa-code-fork" />
        </div>
        <div className="flex-1 text-center lg:text-left">
          <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Base de Integração Unificada</h4>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
            Este terminal permite a visualização de dispositivos sem a necessidade de alternar entre múltiplas interfaces. 
            Em breve, você poderá sincronizar automaticamente o inventário de ativos diretamente destes Controllers.
          </p>
        </div>
        <button className="px-6 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-sm hover:shadow-md transition-all">
          Documentação das APIs
        </button>
      </div>
    </div>
  );
}
