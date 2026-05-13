"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { EquipamentosService } from "@/services/equipamentos.service";
import { api } from "@/lib/api-client";
import Link from "next/link";
import Image from "next/image";
import { Equipamento, Movimentacao } from "@/types";
import { BarcodeScannerModal } from "@/components/ui/BarcodeScannerModal";

const TIPO_META: Record<string, { color: string; dot: string; icon: string; shadow: string }> = {
  alocacao:      { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",    dot: "bg-blue-500",    icon: "fa-user-plus", shadow: "shadow-blue-500/20" },
  transferencia: { color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", dot: "bg-indigo-500",  icon: "fa-arrows-left-right", shadow: "shadow-indigo-500/20" },
  devolucao:     { color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dot: "bg-emerald-500", icon: "fa-rotate-left", shadow: "shadow-emerald-500/20" },
  manutencao:    { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  dot: "bg-amber-500",   icon: "fa-wrench", shadow: "shadow-amber-500/20" },
  substituicao:  { color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", dot: "bg-purple-500",  icon: "fa-right-left", shadow: "shadow-purple-500/20" },
};

function fmt(dt?: string) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function RastreabilidadeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const defaultId = searchParams?.get("id") || "";

  const [search, setSearch] = useState(defaultId);
  const [equipamento, setEquipamento] = useState<Equipamento | null>(null);
  const [historico, setHistorico] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isScannerActive, setIsScannerActive] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const buscar = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setNotFound(false);
    setEquipamento(null);
    setHistorico([]);
    try {
      const [eqs, movs] = await Promise.all([
        EquipamentosService.getEquipamentos(),
        api.fetchWithRetry(`${api.baseURL}/api/movimentacoes?equipamentoID=${encodeURIComponent(id.trim())}`),
      ]);

      const eq = Array.isArray(eqs) ? eqs.find((e: Equipamento) => e.etiquetaID?.toLowerCase() === id.trim().toLowerCase()) : null;
      if (!eq) { setNotFound(true); setLoading(false); return; }
      setEquipamento(eq);
      setHistorico(Array.isArray(movs?.data) ? movs.data : Array.isArray(movs) ? movs : []);
      setSearch(id);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Listener para o código de barras
  useEffect(() => {
    const handleBarcode = (e: any) => {
      const barcode = e.detail;
      if (barcode) {
        e.preventDefault(); // Impede o redirecionamento padrão do BarcodeListener
        setIsScannerActive(true);
        buscar(barcode);
        setTimeout(() => setIsScannerActive(false), 2000);
      }
    };

    window.addEventListener("barcode-scanned", handleBarcode);
    return () => window.removeEventListener("barcode-scanned", handleBarcode);
  }, [buscar]);

  useEffect(() => { if (defaultId) buscar(defaultId); }, [defaultId, buscar]);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail?.path === "/rastreabilidade") {
        setIsModalOpen(true);
      }
    };
    window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
    return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); buscar(search); };

  const statusBadge = (s?: string) => {
    const l = (s || "").toLowerCase();
    const base = "px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border transition-all shadow-sm ";
    if (l.includes("uso")) return base + "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30";
    if (l.includes("disp")) return base + "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30";
    if (l.includes("manut")) return base + "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30";
    return base + "bg-slate-50 text-slate-600 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-5xl mx-auto pb-10"
    >
        {/* Header & Panoramic Search */}
      <section className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden transition-all">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-brand/5 rounded-full blur-3xl"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center shadow-nm-inset">
                <i className="fa-solid fa-satellite-dish text-lg"></i>
              </div>
              <h1 className="text-3xl font-black text-strong tracking-tighter">Rastreabilidade</h1>
            </div>
            <p className="text-muted text-sm font-bold max-w-md leading-relaxed">
              Localize ativos instantaneamente através da Etiqueta ID ou utilizando o scanner de código de barras.
            </p>
          </div>

          <div className="w-full md:max-w-md space-y-4">
            <form onSubmit={handleSearch} className="flex gap-3 p-2 bg-surface-soft rounded-[2rem] border border-border-subtle shadow-nm-inset focus-within:ring-4 focus-within:ring-brand/10 transition-all">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-muted"></i>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="ID da Etiqueta..."
                  className="w-full bg-transparent border-none rounded-xl pl-12 pr-4 py-3 text-sm font-black outline-none text-strong placeholder:text-subtle"
                />
              </div>
              <button 
                type="submit" 
                className="bg-brand hover:bg-brand-dark text-white px-8 py-3 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-brand/20 active:scale-95 shrink-0"
              >
                Localizar
              </button>
            </form>

            <div className="flex justify-end pr-2">
              <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-500 shadow-nm-inset ${isScannerActive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-surface-soft border-border-subtle text-muted'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isScannerActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-[9px] font-black uppercase tracking-[0.15em]">{isScannerActive ? 'Scanner Ativo' : 'Scanner Pronto'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-20 flex flex-col items-center gap-6"
          >
            <div className="relative">
              <div className="w-20 h-20 border-8 border-brand/10 rounded-full shadow-nm-inset"></div>
              <div className="w-20 h-20 border-8 border-brand border-t-transparent rounded-full animate-spin absolute top-0 shadow-lg shadow-brand/20"></div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-black text-strong tracking-tight">Sincronizando infraestrutura...</p>
              <p className="text-xs font-bold text-muted uppercase tracking-widest animate-pulse">Consultando base de ativos</p>
            </div>
          </motion.div>
        )}

        {notFound && !loading && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-16 text-center"
          >
            <div className="w-24 h-24 bg-surface-soft shadow-nm-inset rounded-3xl flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <i className="fa-solid fa-triangle-exclamation text-rose-500 text-4xl"></i>
            </div>
            <h3 className="text-2xl font-black text-strong tracking-tighter">Ativo não localizado</h3>
            <p className="text-muted font-bold mt-2 max-w-sm mx-auto leading-relaxed">
              Não encontramos nenhum equipamento com a etiqueta <span className="text-rose-500 font-black">"{search}"</span> em nossa base de dados.
            </p>
          </motion.div>
        )}

        {equipamento && !loading && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Main Equipment Card */}
            <div className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-8 md:p-10 transition-all">
              <div className="flex flex-col lg:flex-row gap-10 items-start">
                {/* Visual Section */}
                <div className="relative group shrink-0 mx-auto lg:mx-0">
                  <div className="absolute -inset-2 bg-brand/10 rounded-[3rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative w-56 h-56 rounded-[2.5rem] bg-surface-soft shadow-nm-inset overflow-hidden border border-border-subtle p-3 transition-transform duration-500 hover:scale-105">
                    <div className="w-full h-full rounded-2xl overflow-hidden relative shadow-sm">
                      {equipamento.fotoEquipamento ? (
                        <Image 
                          src={equipamento.fotoEquipamento} 
                          alt={equipamento.etiquetaID} 
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-surface-soft text-muted">
                          <i className="fa-solid fa-laptop text-6xl opacity-20"></i>
                          <span className="text-[10px] uppercase font-black tracking-widest opacity-40">Sem imagem</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 space-y-6 text-center lg:text-left pt-2">
                  <div className="flex flex-col md:flex-row md:items-center gap-4 justify-center lg:justify-start">
                    <h2 className="text-5xl font-black text-strong font-mono tracking-tighter">
                      {equipamento.etiquetaID}
                    </h2>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${statusBadge(equipamento.status)}`}>
                      {equipamento.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                    {[
                      { l: "Marca", v: equipamento.marca, i: "fa-tag", color: "text-blue-500" },
                      { l: "Modelo", v: equipamento.modelo, i: "fa-hashtag", color: "text-indigo-500" },
                      { l: "Tipo", v: equipamento.tipoEquipamento, i: "fa-microchip", color: "text-purple-500" },
                      { l: "Local atual", v: equipamento.localizacao, i: "fa-location-dot", color: "text-emerald-500" }
                    ].map(item => (
                      <div key={item.l} className="bg-surface-soft shadow-nm-inset rounded-2xl p-4 border border-border-subtle group hover:bg-surface transition-colors">
                        <span className="text-[9px] uppercase font-black text-muted flex items-center gap-2 justify-center lg:justify-start mb-2">
                           <i className={`fa-solid ${item.i} ${item.color} opacity-70`}></i> {item.l}
                        </span>
                        <p className="text-sm font-black text-strong truncate">{item.v || "—"}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex flex-wrap gap-3 justify-center lg:justify-start">
                    <div className="px-6 py-3 bg-surface-soft shadow-nm-inset rounded-2xl border border-border-subtle">
                      <span className="text-[9px] uppercase font-black text-muted block mb-0.5 tracking-wider">Propriedade</span>
                      <span className="text-xs font-black text-strong">{equipamento.propriedade || "—"}</span>
                    </div>
                    {equipamento.custoAquisicao && (
                      <div className="px-6 py-3 bg-surface-soft shadow-nm-inset rounded-2xl border border-border-subtle">
                        <span className="text-[9px] uppercase font-black text-brand block mb-0.5 tracking-wider">Vlr. Aquisição</span>
                        <span className="text-xs font-black text-brand">
                          {Number(equipamento.custoAquisicao).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <Link 
                  href={`/equipamentos?open=${equipamento.etiquetaID}`} 
                  className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-2xl transition-all flex items-center gap-3 justify-center w-full lg:w-auto text-[10px] font-black uppercase tracking-[0.15em] shrink-0 active:scale-95 shadow-lg shadow-brand/20 group order-first lg:order-last"
                >
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform"></i>
                  <span>Ficha Técnica</span>
                </Link>
              </div>
            </div>

            {/* Timeline History */}
            <div className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] overflow-hidden p-8 md:p-10 transition-all">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-2xl font-black text-strong flex items-center gap-4 tracking-tighter">
                  <div className="w-12 h-12 rounded-2xl bg-brand/10 text-brand flex items-center justify-center shadow-nm-inset">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                  </div>
                  Histórico de Vida
                  <div className="px-3 py-1 rounded-lg bg-surface-soft text-brand text-[10px] font-black shadow-nm-inset border border-brand/10">
                    {historico.length} EVENTOS
                  </div>
                </h3>
              </div>

              {historico.length === 0 ? (
                <div className="py-24 text-center bg-surface-soft shadow-nm-inset rounded-[2.5rem] border border-border-subtle border-dashed">
                  <div className="w-24 h-24 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 opacity-20 shadow-nm-flat">
                    <i className="fa-solid fa-ghost text-4xl"></i>
                  </div>
                  <p className="text-muted font-black text-[10px] uppercase tracking-[0.2em]">Nenhum evento registrado</p>
                </div>
              ) : (
                <div className="relative pl-8 md:pl-16">
                  {/* Neumorphic Axis */}
                  <div className="absolute left-[15px] md:left-[31px] top-6 bottom-6 w-1.5 bg-slate-200 dark:bg-white/10 rounded-full shadow-nm-inset"></div>

                  <div className="space-y-12">
                    {historico.map((m, idx) => {
                      const tipoKey = (m.tipoMovimentacao || "").toLowerCase();
                      const meta = TIPO_META[tipoKey] || { color: "text-muted", dot: "bg-slate-400", icon: "fa-circle", shadow: "shadow-none" };
                      
                      return (
                        <motion.div 
                          key={m.movimentacaoID || idx}
                          initial={{ opacity: 0, x: -30 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative"
                        >
                          {/* Node Icon */}
                          <div className={`absolute -left-[27px] md:-left-[43px] top-4 w-9 h-9 md:w-12 md:h-12 rounded-2xl ${meta.dot} border-4 border-surface flex items-center justify-center z-10 shadow-lg shadow-brand/10 transition-transform group-hover:scale-110`}>
                            <i className={`fa-solid ${meta.icon} text-white text-xs md:text-sm`}></i>
                          </div>

                          <div 
                            onClick={() => router.push(`/movimentacoes?open=${m.movimentacaoID}`)}
                            className="bg-surface-soft shadow-nm-inset border border-border-subtle rounded-[2rem] p-6 md:p-8 hover:bg-surface transition-all group overflow-hidden relative cursor-pointer active:scale-[0.99]"
                          >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                              <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                  <h4 className={`text-[9px] font-black uppercase tracking-widest px-4 py-1.5 rounded-xl border border-white/10 shadow-nm-inset ${meta.color}`}>
                                    {m.tipoMovimentacao}
                                  </h4>
                                  <span className="text-[10px] font-black px-3 py-1.5 bg-brand text-white rounded-lg uppercase shadow-lg shadow-brand/20">
                                    <i className="fa-regular fa-calendar mr-2"></i>{fmt(m.dataHora)}
                                  </span>
                                </div>
                                <div className="flex items-baseline gap-3">
                                  <span className="text-2xl font-black text-strong tracking-tighter">
                                    {m.protocolo || `#${idx + 1}`}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-4">
                                {m.responsavel && (
                                  <div className="bg-surface px-4 py-2 rounded-xl border border-border-subtle shadow-nm-flat flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-brand text-[10px] font-black text-white flex items-center justify-center shadow-lg shadow-brand/20">
                                      {m.responsavel.charAt(0)}
                                    </div>
                                    <span className="text-xs font-black text-muted uppercase tracking-wider">{m.responsavel}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="mt-8 grid md:grid-cols-2 gap-8 relative z-10">
                              <div className="space-y-4">
                                {m.descricao && (
                                  <div className="bg-surface/50 p-4 rounded-2xl border border-border-subtle/50 italic">
                                    <p className="text-sm text-strong leading-relaxed">
                                      "{m.descricao}"
                                    </p>
                                  </div>
                                )}
                                {m.motivo && (
                                  <div className="flex items-center gap-3 px-2">
                                    <span className="text-[9px] font-black uppercase text-brand tracking-widest">Motivo:</span>
                                    <p className="text-xs font-bold text-muted">{m.motivo}</p>
                                  </div>
                                )}
                              </div>

                              <div className="flex flex-col justify-end gap-3 shrink-0">
                                <div className="flex flex-row md:flex-col lg:flex-row gap-3 md:items-end justify-end">
                                  {m.donoAnteriorNome && (
                                    <div className="px-4 py-2.5 bg-surface rounded-xl text-[9px] font-black uppercase text-muted flex items-center gap-3 border border-border-subtle shadow-nm-flat">
                                      <span className="opacity-40">De:</span>
                                      <span className="text-strong">{m.donoAnteriorNome}</span>
                                    </div>
                                  )}
                                  {m.novoDonoNome && (
                                    <div className="px-4 py-2.5 bg-brand/5 rounded-xl text-[9px] font-black uppercase text-brand flex items-center gap-3 border border-brand/20 shadow-nm-flat">
                                      <span className="opacity-40">Para:</span>
                                      <span className="text-brand-dark">{m.novoDonoNome}</span>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex gap-2 justify-end mt-2">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); router.push(`/movimentacoes?open=${m.movimentacaoID}`); }}
                                    className="px-4 py-2 bg-surface hover:bg-surface-soft border border-border-subtle rounded-xl text-[9px] font-black uppercase tracking-widest text-muted transition-all shadow-nm-flat active:scale-95 flex items-center gap-2"
                                  >
                                    <i className="fa-solid fa-arrows-rotate text-brand"></i>
                                    Movimentação
                                  </button>
                                  {(m.protocoloSolicitacao || m.protocolo?.startsWith('SOL')) && (
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); router.push(`/solicitacoes?open=${m.protocoloSolicitacao || m.protocolo}`); }}
                                      className="px-4 py-2 bg-brand/10 hover:bg-brand/20 border border-brand/20 rounded-xl text-[9px] font-black uppercase tracking-widest text-brand transition-all shadow-nm-flat active:scale-95 flex items-center gap-2"
                                    >
                                      <i className="fa-solid fa-file-pen text-brand"></i>
                                      Solicitação
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Background Protocol Decor */}
                            <span className="absolute -right-4 -bottom-6 text-8xl font-black text-strong opacity-[0.03] select-none pointer-events-none uppercase italic tracking-tighter">
                              {m.protocolo || m.tipoMovimentacao || "MOV"}
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BarcodeScannerModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onScan={(code) => {
          setIsScannerActive(true);
          buscar(code);
          setTimeout(() => setIsScannerActive(false), 2000);
        }}
      />
    </motion.div>
  );
}

export default function RastreabilidadePage() {
  return (
    <Suspense fallback={
      <div className="bg-surface border border-border-subtle shadow-nm-flat rounded-[2.5rem] p-20 flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-surface-soft border-t-brand animate-spin"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted">Carregando Histórico...</p>
      </div>
    }>
      <RastreabilidadeContent />
    </Suspense>
  );
}
