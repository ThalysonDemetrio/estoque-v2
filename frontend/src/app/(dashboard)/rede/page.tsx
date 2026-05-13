"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { RedeService } from "@/services/rede.service";
import { NetworkTopology } from "@/components/network/NetworkTopology";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";

export default function RedePage() {
  const [dispositivos, setDispositivos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSwitch, setFilterSwitch] = useState("");
  const [filterVlan, setFilterVlan] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"inventory" | "map" | "discovery">("map");
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [loadingDiscovery, setLoadingDiscovery] = useState(false);
  const [scanningSubnet, setScanningSubnet] = useState(false);
  const [pingResults, setPingResults] = useState<Record<string, "pending" | "online" | "offline">>({});
  const [isPingingAll, setIsPingingAll] = useState(false);
  const { hasPermission } = useAuth();
  const { success, error: toastError } = useToast();

  const canEdit = useMemo(() => hasPermission("rede", "edit"), [hasPermission]);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await RedeService.getInventory({});
      setDispositivos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Erro ao buscar inventário de rede:", err);
      setDispositivos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInventory(); }, []);

  const filtered = useMemo(() => {
    return dispositivos.filter((d) => {
      const searchStr = [
        d.etiquetaID, 
        d.ip_address, 
        d.mac_address, 
        d.marca, 
        d.modelo, 
        d.usuarioNome, 
        d.localizacao
      ].join(" ").toLowerCase();
      
      const matchSearch = !search || searchStr.includes(search.toLowerCase());
      const matchSwitch = !filterSwitch || String(d.switch_name || "").toLowerCase().includes(filterSwitch.toLowerCase());
      const matchVlan = !filterVlan || String(d.vlan_id) === filterVlan;
      const matchStatus = !filterStatus || d.status === filterStatus;
      return matchSearch && matchSwitch && matchVlan && matchStatus;
    });
  }, [dispositivos, search, filterSwitch, filterVlan, filterStatus]);

  const uniqueSwitches = [...new Set(dispositivos.map((d) => d.switch_name).filter(Boolean))].sort();
  const uniqueVlans = [...new Set(dispositivos.map((d) => d.vlan_id).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
  const switchOptions = useMemo(() => {
    const dedup = new Map<string, string>();

    dispositivos.forEach((d) => {
      const tipo = String(d.tipoEquipamento || d.tipo_equipamento || d.tipo || "").toLowerCase();
      const etiqueta = String(d.etiquetaID || "").trim();
      if (tipo.includes("switch") && etiqueta) {
        const label = `${etiqueta} - ${d.marca || ""} ${d.modelo || ""}`.trim();
        dedup.set(etiqueta, label);
      }
    });

    // Fallback: inclui referências de switch já usadas no inventário
    uniqueSwitches.forEach((value) => {
      const normalized = String(value || "").trim();
      if (normalized && !dedup.has(normalized)) {
        dedup.set(normalized, `${normalized} (referência)`);
      }
    });

    return Array.from(dedup.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [dispositivos, uniqueSwitches]);

  const kpis = [
    { label: "Assets Conectados", value: dispositivos.length, icon: "fa-network-wired", color: "text-blue-500", bg: "bg-blue-50/50 dark:bg-blue-900/20" },
    { label: "Infra Switch", value: uniqueSwitches.length, icon: "fa-sitemap", color: "text-indigo-500", bg: "bg-indigo-50/50 dark:bg-indigo-900/20" },
    { label: "Segmentação VLAN", value: uniqueVlans.length, icon: "fa-layer-group", color: "text-purple-500", bg: "bg-purple-50/50 dark:bg-purple-900/20" },
    { label: "Status Geral", value: "Ativo", icon: "fa-shield-halved", color: "text-emerald-500", bg: "bg-emerald-50/50 dark:bg-emerald-900/20" },
  ];

  const statusBadge = (s: string) => {
    const sl = (s || "").toLowerCase();
    if (sl.includes("disp")) return "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800";
    if (sl.includes("uso")) return "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800";
    return "bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700";
  };

  const handleStartEdit = (d: any) => {
    setEditingRow(d.etiquetaID);
    setExpandedRow(d.etiquetaID);
    setEditValues({
      ip_address: d.ip_address || "",
      mac_address: d.mac_address || "",
      switch_name: d.switch_name || "",
      switch_port: d.switch_port || "",
      vlan_id: d.vlan_id || "",
      subnet_mask: d.subnet_mask || "",
    });
  };

  const handleSaveEdit = async (etiquetaID: string) => {
    try {
      setSaving(true);
      const res = await RedeService.updateNetworkDetails(etiquetaID, editValues as any);
      
      setDispositivos(prev =>
        prev.map(d => d.etiquetaID === etiquetaID ? { ...d, ...editValues } : d)
      );
      setEditingRow(null);
      
      if (res?.warning) {
        toastError("Aviso de Rede", res.warning);
      }
      
      success("Dados de rede salvos", `${etiquetaID} atualizado com sucesso.`);
    } catch (err: any) {
      const msg = err.backendMessage || "Não foi possível atualizar os dados de rede.";
      toastError("Erro ao salvar", msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePingAll = async () => {
    const ips = dispositivos.map(n => n.ip_address).filter(Boolean) as string[];
    if (ips.length === 0) {
      toastError("Nenhum IP", "Nenhum dispositivo com IP configurado para ping");
      return;
    }

    setIsPingingAll(true);
    const initialResults: Record<string, "pending" | "online" | "offline"> = {};
    ips.forEach(ip => initialResults[ip] = "pending");
    setPingResults(prev => ({ ...prev, ...initialResults }));

    try {
      const results = await RedeService.pingBatch(ips);
      const newResults: Record<string, "pending" | "online" | "offline"> = { ...initialResults };
      
      results.forEach((res: any) => {
        if (res.ip) {
          newResults[res.ip] = res.success ? "online" : "offline";
        }
      });
      
      setPingResults(prev => ({ ...prev, ...newResults }));
      success("Varredura concluída", "Conectividade de rede verificada com sucesso.");
    } catch (err) {
      toastError("Erro na varredura", "Não foi possível realizar a varredura em lote.");
    } finally {
      setIsPingingAll(false);
    }
  };

  const handlePingSingle = async (ip: string) => {
    if (!ip) return;
    setPingResults(prev => ({ ...prev, [ip]: "pending" }));
    try {
      const results = await RedeService.pingBatch([ip]);
      const res = results[0];
      setPingResults(prev => ({ 
        ...prev, 
        [ip]: res?.success ? "online" : "offline" 
      }));
      if (res?.success) {
        success("Online", `${ip} está respondendo.`);
      } else {
        toastError("Offline", `${ip} não respondeu ao ping.`);
      }
    } catch {
      setPingResults(prev => ({ ...prev, [ip]: "offline" }));
    }
  };

  const handleDiscover = async () => {
    try {
      setLoadingDiscovery(true);
      const data = await RedeService.discoverDevices();
      setDiscovered(data || []);
      success("Varredura concluída", `${data?.length || 0} dispositivos identificados na rede local.`);
    } catch (err) {
      toastError("Erro na varredura", "Não foi possível realizar a descoberta de rede.");
    } finally {
      setLoadingDiscovery(false);
    }
  };

  const handleScanSubnet = async () => {
    try {
      setScanningSubnet(true);
      const res = await RedeService.scanSubnet();
      success("Varredura de IP Concluída", `Escaneados ${res.totalScanned} IPs em ${res.network}. ${res.onlineCount} dispositivos responderam.`);
      // Após o ping de todos os IPs, a tabela ARP deve estar populada
      await handleDiscover();
    } catch (err) {
      toastError("Erro na varredura", "Falha ao escanear sub-rede local.");
    } finally {
      setScanningSubnet(false);
    }
  };

  const EditField = ({ label, field, type = "text" }: { label: string; field: string; type?: string }) => {
    if (field === "switch_name") {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</label>
          <select
            value={(editValues[field] as string) || ""}
            onChange={e => setEditValues((prev: any) => ({ ...prev, [field]: e.target.value, switch_port: "" }))}
            aria-label={label}
            title={label}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer"
            onClick={e => e.stopPropagation()}
          >
            <option value="">Direto / Nenhum</option>
            {!!editValues.switch_name && !switchOptions.some((opt) => opt.value === (editValues.switch_name as string)) && (
              <option value={editValues.switch_name as string}>{(editValues.switch_name as string)} (não listado)</option>
            )}
            {switchOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );
    }

    if (field === "switch_port") {
      return (
        <div className="flex flex-col gap-1.5">
          <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</label>
          <select
            value={(editValues[field] as string) || ""}
            onChange={e => setEditValues((prev: any) => ({ ...prev, [field]: e.target.value }))}
            disabled={!editValues.switch_name}
            aria-label={label}
            title={label}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all cursor-pointer disabled:opacity-50"
            onClick={e => e.stopPropagation()}
          >
            <option value="">Selecionar Porta</option>
            {(() => {
              const selectedSwitchId = editValues.switch_name as string;
              if (!selectedSwitchId) return null;

              const selectedSwitch = dispositivos.find(d => d.etiquetaID === selectedSwitchId) as any;
              if (!selectedSwitch) return null;

              const total = Number(selectedSwitch.total_ports || 0);
              if (total <= 0) return <option disabled>Sem portas (Total: {total})</option>;

              const usedPorts = new Set(
                dispositivos
                  .filter(d => d.switch_name === selectedSwitchId && d.etiquetaID !== editingRow)
                  .map(d => d.switch_port as string)
              );

              const options = [];
              for (let i = 1; i <= total; i++) {
                const portName = `Porta ${i}`;
                if (!usedPorts.has(portName) || editValues.switch_port === portName) {
                  options.push(<option key={i} value={portName}>{portName}</option>);
                }
              }
              return options;
            })()}
          </select>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</label>
        <input
          type={type}
          value={(editValues[field] as string) || ""}
          onChange={e => setEditValues((prev: any) => ({ ...prev, [field]: e.target.value }))}
          aria-label={label}
          title={label}
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
          onClick={e => e.stopPropagation()}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex justify-start">
        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex gap-1 shadow-sm">
          <button
            onClick={() => setView("map")}
            className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
              ${view === 'map' ? 'bg-indigo-600 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fa-solid fa-diagram-project" /> Mapa
          </button>
          <button
            onClick={() => setView("inventory")}
            className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
              ${view === 'inventory' ? 'bg-indigo-600 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fa-solid fa-id-card-clip" /> Inventário
          </button>
          <button
            onClick={() => setView("discovery")}
            className={`px-5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2
              ${view === 'discovery' ? 'bg-indigo-600 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fa-solid fa-satellite-dish" /> Descoberta
          </button>
        </div>

        <a
          href="/rede/gerenciamento"
          className="ml-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-indigo-500 hover:border-indigo-500/30 transition-all flex items-center gap-2 shadow-sm"
        >
          <i className="fa-solid fa-microchip" /> Gerenciamento Avançado
        </a>
      </div>

      <AnimatePresence mode="wait">
        {view === "map" ? (
          <motion.div key="map" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <NetworkTopology 
              inventory={dispositivos} 
              pingResults={pingResults}
              isPingingAll={isPingingAll}
              onPingAll={handlePingAll}
              onRefresh={fetchInventory}
              onPingResult={(ip, status) => setPingResults(prev => ({ ...prev, [ip]: status }))}
            />
          </motion.div>
        ) : view === "inventory" ? (
          <motion.div key="inv" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.07] p-4 rounded-2xl flex flex-wrap gap-3 items-center shadow-sm">
              <div className="relative flex-1 min-w-[220px]">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por IP, MAC, Tag, Localização..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/10 focus:border-blue-400 outline-none transition-all text-slate-800 dark:text-slate-200"
                />
              </div>
              <select
                value={filterStatus || ""} onChange={(e) => setFilterStatus(e.target.value)}
                aria-label="Filtrar por status"
                title="Filtrar por status"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-4 text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/10 outline-none text-slate-700 dark:text-slate-300"
              >
                <option value="">Todos Status</option>
                <option value="Disponível">Disponível</option>
                <option value="Em Uso">Em Uso</option>
              </select>
              
              {canEdit && (
                <button
                  onClick={handlePingAll}
                  disabled={isPingingAll}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-2.5 px-4 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {isPingingAll ? (
                    <i className="fa-solid fa-spinner fa-spin" />
                  ) : (
                    <i className="fa-solid fa-satellite-dish" />
                  )}
                  Varredura Real
                </button>
              )}

              <a
                href={RedeService.getExportUrl()} target="_blank"
                className="w-10 h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 transition-all flex items-center justify-center shadow-sm"
                title="Exportar"
              >
                <i className="fa-solid fa-download text-sm" />
              </a>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpis.map((k, idx) => (
                <motion.div
                  key={k.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
                  className="bg-white dark:bg-slate-900/80 border border-slate-100 dark:border-white/[0.06] rounded-2xl p-5 flex items-center gap-4 shadow-sm"
                >
                  <div className={`w-11 h-11 rounded-xl ${k.bg} ${k.color} flex items-center justify-center text-lg`}>
                    <i className={`fa-solid ${k.icon}`} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{k.label}</p>
                    <p className={`text-xl font-black tracking-tight ${k.color}`}>{k.value}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Inventory Table */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.07] shadow-sm rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
                      <th className="py-4 px-6">Asset / Equipamento</th>
                      <th className="py-4 px-6">IP Address</th>
                       <th className="py-4 px-6 hidden md:table-cell">MAC Address</th>
                      <th className="py-4 px-6 hidden lg:table-cell">Usuário</th>
                      <th className="py-4 px-6">Conexão</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((d) => (
                      <Fragment key={d.etiquetaID}>
                        <tr
                          onClick={() => editingRow !== d.etiquetaID && setExpandedRow(expandedRow === d.etiquetaID ? null : d.etiquetaID)}
                          className={`group transition-all cursor-pointer
                            ${expandedRow === d.etiquetaID ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}
                        >
                          <td className="py-4 px-6">
                            <span className="font-black text-slate-900 dark:text-white font-mono text-xs">{d.etiquetaID}</span>
                            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{d.marca} {d.modelo}</p>
                          </td>
                          <td className="py-4 px-6">
                            <span className="font-mono text-xs text-blue-600 dark:text-blue-400 font-bold">{d.ip_address || "—"}</span>
                          </td>
                          <td className="py-4 px-6 hidden md:table-cell">
                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{d.mac_address || "—"}</span>
                          </td>
                          <td className="py-4 px-6 hidden lg:table-cell">
                            <span className="text-xs text-slate-600 dark:text-slate-400">{d.usuarioNome || "—"}</span>
                          </td>
                          <td className="py-4 px-6">
                            {d.ip_address ? (
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                  !pingResults[d.ip_address] || pingResults[d.ip_address] === "pending"
                                    ? "bg-blue-500 animate-pulse"
                                    : pingResults[d.ip_address] === "online"
                                    ? "bg-emerald-500"
                                    : "bg-red-500"
                                }`} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${
                                  !pingResults[d.ip_address] || pingResults[d.ip_address] === "pending"
                                    ? "text-blue-500"
                                    : pingResults[d.ip_address] === "online"
                                    ? "text-emerald-500"
                                    : "text-red-500"
                                }`}>
                                  {!pingResults[d.ip_address] || pingResults[d.ip_address] === "pending" ? "Sondando" : pingResults[d.ip_address]}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight italic">Sem IP</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && d.ip_address && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePingSingle(d.ip_address); }}
                                  disabled={pingResults[d.ip_address] === "pending"}
                                  className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-all flex items-center justify-center border border-blue-100 dark:border-blue-800"
                                  title="Ping individual"
                                >
                                  <i className="fa-solid fa-bolt text-[10px]" />
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleStartEdit(d); }}
                                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all flex items-center justify-center border border-slate-200 dark:border-slate-700"
                                  title="Editar dados de rede"
                                >
                                  <i className="fa-solid fa-pen text-[10px]" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row — Read or Edit */}
                        {expandedRow === d.etiquetaID && (
                          <tr>
                            <td colSpan={6} className="px-6 py-5 bg-slate-50/60 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                              {editingRow === d.etiquetaID ? (
                                /* Edit Mode */
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    <EditField label="IP Address" field="ip_address" />
                                    <EditField label="MAC Address" field="mac_address" />
                                    <EditField label="Switch / Etiqueta" field="switch_name" />
                                    <EditField label="Porta do Switch" field="switch_port" />
                                    <EditField label="VLAN ID" field="vlan_id" type="number" />
                                    <EditField label="Subnet Mask" field="subnet_mask" />
                                  </div>
                                  <div className="flex gap-2 pt-1">
                                    <button
                                      onClick={() => handleSaveEdit(d.etiquetaID)}
                                      disabled={saving}
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-2"
                                    >
                                      {saving ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-check" />}
                                      Salvar Dados de Rede
                                    </button>
                                    <button
                                      onClick={() => { setEditingRow(null); setExpandedRow(null); }}
                                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                /* Read Mode */
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {[
                                    { label: "Switch / Etiqueta", value: d.switch_name },
                                    { label: "Porta", value: d.switch_port },
                                    { label: "Subnet Mask", value: d.subnet_mask },
                                    { label: "VLAN ID", value: d.vlan_id },
                                  ].map(item => (
                                     <div key={item.label} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{item.label}</p>
                                       <p className="text-sm font-black text-slate-800 dark:text-slate-200 font-mono">{item.value || "—"}</p>
                                     </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                    {filtered.length === 0 && !loading && (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-slate-400 text-sm">
                          Nenhum dispositivo encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : view === "discovery" ? (
          <motion.div key="discovery" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/[0.07] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Varredura de Rede (ARP)</h3>
                <p className="text-xs text-slate-500 mt-1">Identifique dispositivos (WiFi, PCs, Impressoras) conectados que não estão no inventário.</p>
              </div>
              {canEdit && (
                <div className="flex gap-3">
                  <button
                    onClick={handleScanSubnet}
                    disabled={scanningSubnet || loadingDiscovery}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg shadow-blue-500/20"
                  >
                    {scanningSubnet ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-radar" />}
                    Varredura Completa (IPs)
                  </button>
                  <button
                    onClick={handleDiscover}
                    disabled={loadingDiscovery || scanningSubnet}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20"
                  >
                    {loadingDiscovery ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-binoculars" />}
                    Atualizar Tabela ARP
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {discovered.map((d, i) => (
                <motion.div
                  key={d.mac + i}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`bg-white dark:bg-slate-900/80 border p-5 rounded-2xl flex flex-col gap-4 shadow-sm transition-all
                    ${d.isRegistered ? 'border-slate-100 dark:border-white/[0.04]' : 'border-indigo-100 dark:border-indigo-900/40 ring-1 ring-indigo-50 dark:ring-indigo-900/20 shadow-indigo-500/5'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm
                      ${d.isRegistered ? 'bg-slate-50 dark:bg-slate-800 text-slate-400' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 animate-pulse'}`}>
                      <i className={`fa-solid ${d.isRegistered ? 'fa-check' : 'fa-wifi'}`} />
                    </div>
                     {d.isRegistered ? (
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-800">Registrado</span>
                     ) : (
                       <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">Manual / Externo</span>
                     )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço IP</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono tracking-tight">{d.ip}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Fabricante / Vendor</p>
                      <p className="text-xs font-bold text-indigo-500 truncate" title={d.vendor || 'Não identificado'}>
                        {d.vendor || <span className="opacity-30">Desconhecido</span>}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Endereço MAC</p>
                      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 font-mono italic">{d.mac}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hostname / Nome</p>
                      <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate" title={d.hostname || 'N/A'}>
                        {d.hostname || <span className="opacity-30">—</span>}
                      </p>
                    </div>
                  </div>

                  {!d.isRegistered && (
                    <div className="pt-2">
                       <p className="text-[9px] text-slate-400 mb-2 italic">* Este dispositivo não possui etiqueta vinculada.</p>
                       <button
                         onClick={() => {
                            // Copiar MAC e talvez IP para facilitar registro futuro
                            navigator.clipboard.writeText(d.mac);
                            success("MAC Copiado", "Endereço MAC copiado para área de transferência.");
                         }}
                         className="w-full py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2"
                       >
                         <i className="fa-solid fa-copy" /> Copiar MAC para Registro
                       </button>
                    </div>
                  )}
                </motion.div>
              ))}
              
              {discovered.length === 0 && !loadingDiscovery && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <i className="fa-solid fa-radar text-2xl" />
                  </div>
                  <p className="text-slate-400 text-sm font-medium">Nenhum dado de varredura disponível.</p>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest mt-1">Clique em "Iniciar Varredura" para buscar dispositivos WiFi e Ethernet locais.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
