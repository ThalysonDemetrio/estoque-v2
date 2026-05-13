"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { EquipamentosService, Vistoria, VistoriaItem } from "@/services/equipamentos.service";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { SlidebarPanel, SlidebarHeader } from "@/components/layout/SlidebarPanel";

import { Equipamento } from "@/types";
import { calculateAssetHealth, calculateGlobalHealthScore } from "@/lib/health";

interface AnalyzedEquipamento extends Equipamento {
  healthScore: number;
  riskScore: number;
  reasons: string[];
  impacts: Array<{ label: string; value: number; type: 'positive' | 'negative' | 'neutral' }>;
  remainingLifeMonths: number;
  statusLevel: 'stable' | 'warning' | 'critical';
  lastVistoria?: Vistoria;
}

export default function DiagnosticosPage() {
  return (
    <Suspense fallback={<div className="p-8">Carregando diagnósticos...</div>}>
      <DiagnosticosContent />
    </Suspense>
  );
}

function DiagnosticosContent() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEq, setSelectedEq] = useState<AnalyzedEquipamento | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [healthFilter, setHealthFilter] = useState<"all" | "critical" | "warning" | "stable">("all");
  const [vistoriasMap, setVistoriasMap] = useState<Record<string, Vistoria[]>>({});
  const [isVistoriaModalOpen, setIsVistoriaModalOpen] = useState(false);
  const [eqToInspect, setEqToInspect] = useState<AnalyzedEquipamento | null>(null);
  const searchParams = useSearchParams();

  const fetchVistorias = async (etiquetaID: string) => {
    try {
      const vs = await EquipamentosService.getVistorias(etiquetaID);
      setVistoriasMap((prev: Record<string, Vistoria[]>) => ({ ...prev, [etiquetaID]: vs }));
    } catch (error) {
      console.error("Erro ao buscar vistorias:", error);
    }
  };

  useEffect(() => {
    if (selectedEq) {
      fetchVistorias(selectedEq.etiquetaID);
    }
  }, [selectedEq]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const eqs = await EquipamentosService.getEquipamentos();
        setEquipamentos(Array.isArray(eqs) ? eqs : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const diagnostics = useMemo(() => {
    const now = new Date();
    let totalScore = 0;
    const criticalItems: any[] = [];
    const ageCategories = { nova: 0, media: 0, antiga: 0, critica: 0 };
    
    const analyzed = equipamentos.map((e: Equipamento) => {
      const vistorias = vistoriasMap[e.etiquetaID] || [];
      const latestVistoria = vistorias[0];
      
      const { healthScore, riskScore, reasons, impacts } = calculateAssetHealth(e, latestVistoria);
      
      totalScore += healthScore;

      // Lifecycle Metrics for Categories
      if (e.dataCompra) {
        const ageInMonths = (now.getTime() - new Date(e.dataCompra).getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (ageInMonths > 48) ageCategories.critica++;
        else if (ageInMonths > 36) ageCategories.antiga++;
        else if (ageInMonths > 18) ageCategories.media++;
        else ageCategories.nova++;
      } else {
        // Sem histórico não entra na contagem de idade por faixa, ou podemos pôr na média
      }

      // Remaining Life Estimation
      let remainingLifeMonths = 48;
      if (e.dataCompra) {
        const ageInMonths = (now.getTime() - new Date(e.dataCompra).getTime()) / (1000 * 60 * 60 * 24 * 30);
        remainingLifeMonths = Math.max(0, 48 - ageInMonths);
      }

      const statusLevel: 'stable' | 'warning' | 'critical' = 
        healthScore >= 75 ? 'stable' : 
        healthScore >= 40 ? 'warning' : 'critical';

      const result: AnalyzedEquipamento = { 
        ...e, 
        healthScore, 
        riskScore, 
        reasons, 
        impacts,
        remainingLifeMonths: Math.round(remainingLifeMonths || 0),
        statusLevel,
        lastVistoria: latestVistoria
      };
      
      if (riskScore >= 45) criticalItems.push(result);
      return result;
    });

    const globalHealth = calculateGlobalHealthScore(equipamentos, vistoriasMap);

    const filtered = analyzed.filter((item: AnalyzedEquipamento) => {
      // Health filter
      if (healthFilter === "critical" && item.healthScore > 40) return false;
      if (healthFilter === "warning" && (item.healthScore <= 40 || item.healthScore >= 75)) return false;
      if (healthFilter === "stable" && item.healthScore < 75) return false;

      if (!searchTerm) return true;
      return (
        item.etiquetaID.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.modelo?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }).sort((a: AnalyzedEquipamento, b: AnalyzedEquipamento) => a.healthScore - b.healthScore);

    return {
      globalHealth,
      items: filtered,
      ageCategories,
      totalCount: equipamentos.length
    };
  }, [equipamentos, searchTerm, healthFilter, vistoriasMap]);

  // Auto-open equipment from URL
  useEffect(() => {
    if (!loading && searchParams?.get("open") && diagnostics.items.length > 0) {
      const id = searchParams.get("open");
      // Prevenir loop infinito: só abrir se o ID mudou ou modal está fechado
      if (selectedEq?.etiquetaID !== id || !isModalOpen) {
        const found = diagnostics.items.find(e => e.etiquetaID === id);
        if (found) {
          setSelectedEq(found);
          setIsModalOpen(true);
        }
      }
    }
  }, [loading, searchParams, diagnostics.items]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Escaneando Saúde do Inventário...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96 group">
          <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"></i>
          <input 
            type="text" 
            placeholder="Buscar por Etiqueta, Marca ou Modelo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-400 text-sm font-semibold"
          />
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-1 shadow-sm shrink-0">
           <button 
             onClick={() => setHealthFilter("all")}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${healthFilter === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
           >Todos</button>
           <button 
             onClick={() => setHealthFilter("critical")}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${healthFilter === 'critical' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500'}`}
           >Críticos</button>
           <button 
             onClick={() => setHealthFilter("warning")}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${healthFilter === 'warning' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'}`}
           >Alerta</button>
           <button 
             onClick={() => setHealthFilter("stable")}
             className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${healthFilter === 'stable' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500'}`}
           >Estáveis</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        
        {/* Global Health Gauge (4 cols) */}
        <div className="col-span-12 lg:col-span-4 bg-surface dark:bg-slate-900 rounded-[2.5rem] border border-border-subtle p-8 shadow-nm-flat flex flex-col items-center justify-center text-center">
          <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-10">Score de Integridade Global</h3>
          
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
              <circle cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="20" fill="transparent" className="text-slate-100 dark:text-slate-800" />
              <motion.circle
                cx="128" cy="128" r="110" stroke="currentColor" strokeWidth="20" fill="transparent"
                strokeDasharray={2 * Math.PI * 110}
                initial={{ strokeDashoffset: 2 * Math.PI * 110 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 110 * (1 - diagnostics.globalHealth / 100) }}
                transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
                className={`${diagnostics.globalHealth > 75 ? 'text-emerald-500' : diagnostics.globalHealth > 50 ? 'text-amber-500' : 'text-red-500'}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-7xl font-black text-slate-900 dark:text-white leading-none">{diagnostics.globalHealth}%</motion.span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">Health Index</span>
            </div>
          </div>

          <div className="mt-10 px-6 py-4 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
              &quot;{diagnostics.globalHealth > 75 
                ? "Ativos em conformidade total. Manutenção preventiva recomendada apenas para itens com > 36 meses." 
                : diagnostics.globalHealth > 50 
                ? "Alerta de obsolescência média. Considere renovação de 20% da frota no próximo semestre." 
                : "Risco operacional elevado. Substituição imediata de ativos com Score < 30 requerida."}&quot;
            </p>
          </div>
        </div>

        {/* Lifecycle Matrix (8 cols) */}
        <div className="col-span-12 lg:col-span-8 bg-surface dark:bg-slate-900 rounded-[2.5rem] border border-border-subtle p-8 shadow-nm-flat">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-layer-group text-indigo-500"></i> Matriz de Vida Útil
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{diagnostics.totalCount} Ativos Monitorados</span>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <LifecycleCard label="Impecáveis" sub="< 18 meses" count={diagnostics.ageCategories.nova} total={diagnostics.totalCount} color="bg-emerald-500" icon="fa-seedling" />
            <LifecycleCard label="Operacionais" sub="18 - 36 meses" count={diagnostics.ageCategories.media} total={diagnostics.totalCount} color="bg-blue-500" icon="fa-bolt" />
            <LifecycleCard label="Vulneráveis" sub="36 - 48 meses" count={diagnostics.ageCategories.antiga} total={diagnostics.totalCount} color="bg-amber-500" icon="fa-hourglass-end" />
            <LifecycleCard label="Obsoletos" sub="> 48 meses" count={diagnostics.ageCategories.critica} total={diagnostics.totalCount} color="bg-red-500" icon="fa-skull" />
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-500/20 shrink-0">
                   <i className="fa-solid fa-microchip"></i>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Hardware Monitor</h4>
                   <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">Sensores indicam que ativos {diagnostics.ageCategories.critica > 0 ? 'obsoletos' : 'antigos'} podem causar perda de 15% na produtividade.</p>
                </div>
             </div>
             <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20 shrink-0">
                   <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                   <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Risk Prevention</h4>
                   <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">Nenhum incidente de falha catastrófica reportado nas últimas 24 horas.</p>
                </div>
             </div>
          </div>
        </div>

        {/* Critical Items Details (Full width) */}
        <div className="col-span-12 space-y-6">
          <div className="flex items-center justify-between px-4">
             <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
               <i className="fa-solid fa-list-check text-slate-400"></i> Relatório de Diagnóstico Individual
             </h3>
             <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 dark:bg-slate-800 rounded-full border border-white/10">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{diagnostics.items.length} Resultados</span>
               </div>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             <AnimatePresence>
                {diagnostics.items.map((item, idx) => (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
                    key={item.etiquetaID} 
                    onClick={() => { setSelectedEq(item); setIsModalOpen(true); }}
                    className="bg-surface dark:bg-slate-900 border border-border-subtle rounded-[2.5rem] p-6 shadow-nm-flat hover-nm-elevated transition-all cursor-pointer group hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-between mb-6">
                       <SmartAvatar 
                         src={item.fotoEquipamento} 
                         name={`${item.marca} ${item.modelo}`} 
                         size="md" 
                         type="item"
                         status={item.healthScore < 40 ? 'maintenance' : 'available'}
                       />
                       <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-white shadow-xl ${
                         item.healthScore >= 75 ? 'bg-emerald-500 shadow-emerald-500/20' : item.healthScore >= 40 ? 'bg-amber-500 shadow-amber-500/20' : 'bg-red-500 shadow-red-500/20'
                       }`}>
                          <span className="text-[10px] font-black leading-none mb-0.5">{item.healthScore}%</span>
                          <i className="fa-solid fa-heart-pulse text-[10px]"></i>
                       </div>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-black text-slate-900 dark:text-white truncate group-hover:text-indigo-600 transition-colors uppercase text-sm tracking-tight">{item.marca} {item.modelo}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">#{item.etiquetaID}</span>
                        <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{item.tipoEquipamento}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-1.5 mb-6 min-h-[42px]">
                      {item.reasons.length > 0 ? item.reasons.slice(0, 2).map((r: string, i: number) => (
                        <div key={i} className={`flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight ${item.healthScore < 40 ? 'text-red-500' : 'text-slate-400'}`}>
                          <i className={`fa-solid ${item.healthScore < 40 ? 'fa-triangle-exclamation' : 'fa-circle-info'} text-[9px]`}></i> {r}
                        </div>
                      )) : (
                        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-tight text-emerald-500">
                          <i className="fa-solid fa-check-circle text-[9px]"></i> Hardware estável
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-5 border-t border-slate-50 dark:border-slate-800">
                       <p className="text-[9px] font-black uppercase text-slate-400 group-hover:text-indigo-500 transition-colors tracking-widest">Análise Completa</p>
                       <i className="fa-solid fa-chevron-right text-[10px] text-slate-300 group-hover:translate-x-1 transition-transform"></i>
                    </div>
                  </motion.div>
                ))}
             </AnimatePresence>
          </div>
          
          {diagnostics.items.length === 0 && (
            <div className="py-32 text-center bg-white dark:bg-slate-900 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800">
               <div className="w-24 h-24 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-sm">
                  <i className="fa-solid fa-shield-heart-pulse"></i>
               </div>
               <h4 className="text-2xl font-black text-slate-800 dark:text-white">Diagnóstico Realizado</h4>
               <p className="text-slate-400 font-medium max-w-sm mx-auto mt-2">Nenhum ativo operando fora dos parâmetros de risco neste momento.</p>
            </div>
          )}
        </div>

        {/* Diagnostic Basis Panel */}
        <div className="col-span-12 bg-surface dark:bg-slate-900 rounded-[3rem] p-10 shadow-nm-flat-lg relative overflow-hidden mb-12 border border-border-subtle">
           <div className="absolute top-0 right-0 w-96 h-96 bg-brand/5 blur-[100px] rounded-full -mr-48 -mt-48"></div>
           <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                 <h3 className="text-xl font-black text-strong mb-4 flex items-center gap-3 italic">
                    <i className="fa-solid fa-microchip text-brand/60"></i> Metodologia de Cálculo de Saúde
                 </h3>
                 <p className="text-main font-medium leading-relaxed mb-8 uppercase text-[10px] tracking-widest opacity-70">
                    O Score de Integridade Global é um índice técnico que combina telemetria estatística e auditoria física para prever a confiabilidade do ativo.
                 </p>
                 <div className="space-y-6">
                    <BasisItem icon="fa-hourglass-half" title="Ciclo de Vida & Ambiente" desc="O desgaste base é calculado pela idade versus categoria. Localizações controladas (CPD/Rack) mitigam 30% da penalidade por temperatura e proteção." />
                    <BasisItem icon="fa-wrench" title="Histórico de Intervenções" desc="Cada ida para manutenção ou chamado técnico registrado retira 5 pontos do score de confiabilidade a longo prazo." />
                    <BasisItem icon="fa-clipboard-check" title="Peso de Auditoria Física" desc="Vistorias reais possuem peso de 80% sobre o cálculo lógico, sendo o fator determinante para a nota final do equipamento." />
                 </div>
              </div>
              <div className="bg-surface-soft dark:bg-white/5 backdrop-blur-md rounded-[2.5rem] p-8 border border-border-subtle shadow-nm-inset">
                 <h4 className="text-xs font-black text-brand uppercase tracking-[0.3em] mb-6">Tabela de Impactos (Pontos)</h4>
                 <div className="space-y-4">
                    <PenaltyRow label="Vida Útil Excedida (Máx)" value="-60 pts" color="text-red-500" />
                    <PenaltyRow label="A cada Manutenção Realizada" value="-5 pts" color="text-amber-600" />
                    <PenaltyRow label="Status 'Em Manutenção' Atual" value="-30 pts" color="text-red-600" />
                    <PenaltyRow label="Ambiente Controlado (TI/CPD)" value="+30% Bonus" color="text-emerald-500" />
                    <PenaltyRow label="Sem NF ou Data de Compra" value="-10 pts" color="text-slate-400" />
                    <PenaltyRow label="Criticidade (Servidor/Switch)" value="-5 pts" color="text-indigo-400" />
                 </div>
                 <div className="mt-8 pt-8 border-t border-border-subtle">
                    <p className="text-[10px] font-bold text-muted leading-tight uppercase tracking-tighter">
                       * Ativos com Score &lt; 40 são classificados como "Risco Crítico" e devem ser substituídos para evitar interrupções operacionais.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <HealthModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        item={selectedEq} 
        onVistoria={() => {
          setEqToInspect(selectedEq);
          setIsVistoriaModalOpen(true);
        }}
        vistorias={selectedEq ? (vistoriasMap[selectedEq.etiquetaID] || []) : []}
      />

      <VistoriaModal 
        isOpen={isVistoriaModalOpen}
        onClose={() => setIsVistoriaModalOpen(false)}
        item={eqToInspect}
        onSave={async (data) => {
          if (eqToInspect) {
            await EquipamentosService.salvarVistoria(eqToInspect.etiquetaID, data);
            await fetchVistorias(eqToInspect.etiquetaID);
            setIsVistoriaModalOpen(false);
          }
        }}
      />
    </div>
  );
}

function LifecycleCard({ label, sub, count, total, color, icon }: { label: string, sub: string, count: number, total: number, color: string, icon: string }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-surface dark:bg-slate-800/40 rounded-3xl p-6 border border-border-subtle flex flex-col items-center justify-between text-center group transition-all shadow-nm-flat hover-nm-elevated">
      <div className={`w-14 h-14 rounded-[1.25rem] ${color} flex items-center justify-center text-white shadow-xl shadow-nm-flat mb-5`}>
        <i className={`fa-solid ${icon} text-xl`}></i>
      </div>
      <div className="mb-4">
        <p className="text-3xl font-black text-strong mb-1 leading-none">{count}</p>
        <p className="text-[11px] font-black text-main uppercase tracking-widest">{label}</p>
        <p className="text-[9px] font-bold text-muted uppercase mt-1">{sub}</p>
      </div>
      <div className="w-full bg-surface-soft dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-2 shadow-nm-inset">
        <motion.div 
          initial={{ width: 0 }} 
          animate={{ width: `${Math.max(0, isNaN(percentage) ? 0 : percentage)}%` }} 
          className={`h-full ${color}`} 
        />
      </div>
      <span className="text-[10px] font-black text-muted mt-2">{isNaN(percentage) ? 0 : percentage}% do Total</span>
    </div>
  );
}

function HealthModal({ isOpen, onClose, item, onVistoria, vistorias }: { isOpen: boolean, onClose: () => void, item: AnalyzedEquipamento | null, onVistoria: () => void, vistorias: Vistoria[] }) {
  if (!item) return null;

  const getStatusDescription = (score: number) => {
    if (score >= 90) return { label: "Excelente", color: "text-emerald-500", bg: "bg-emerald-500/10", detail: "Ativo em estado de novo. Performance nominal máxima." };
    if (score >= 75) return { label: "Estável", color: "text-emerald-400", bg: "bg-emerald-400/10", detail: "Operação confiável com desgaste mínimo esperado." };
    if (score >= 60) return { label: "Operacional", color: "text-blue-400", bg: "bg-blue-400/10", detail: "Sinais leves de uso. Requer monitoramento preventivo." };
    if (score >= 40) return { label: "Alerta", color: "text-amber-500", bg: "bg-amber-500/10", detail: "Degradação detectada. Risco moderado de falha." };
    return { label: "Crítico", color: "text-red-500", bg: "bg-red-500/10", detail: "Alto risco de downtime. Substituição imediata recomendada." };
  };

  const status = getStatusDescription(item.healthScore);

  return (
    <SlidebarPanel 
      isOpen={isOpen} 
      onClose={onClose}
      panelClassName="bg-surface h-full w-full max-w-4xl shadow-2xl border-l border-border-subtle flex flex-col"
      header={
        <SlidebarHeader 
          title="Laudo Técnico Especializado" 
          subtitle="Sistemas de Diagnóstico de Infraestrutura v2.0"
          onClose={onClose} 
          iconClassName="fa-file-waveform"
          className="p-8 border-b border-border-subtle bg-surface flex items-center justify-between"
          titleClassName="text-2xl font-black text-slate-900 dark:text-white tracking-tight"
          subtitleClassName="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1"
        />
      }
    >
      <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-10 bg-app-bg/30">
        {/* Device Header Card - Premium View */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative flex flex-col sm:flex-row items-center gap-8 p-8 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="relative shrink-0">
               <SmartAvatar src={item.fotoEquipamento} name={item.marca} size="xl" type="item" className="p-1 bg-white dark:bg-slate-700 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-600" />
               <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${item.healthScore >= 75 ? 'bg-emerald-500' : item.healthScore >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}>
                  <i className="fa-solid fa-shield-check"></i>
               </div>
            </div>
            
            <div className="text-center sm:text-left min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2 justify-center sm:justify-start">
                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] px-3 py-1 bg-indigo-500/5 border border-indigo-500/20 rounded-full">{item.tipoEquipamento}</span>
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 ${status.bg} ${status.color} border border-current/20 rounded-full`}>{status.label}</span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white truncate leading-tight tracking-tight uppercase">{item.marca} <span className="text-indigo-500">{item.modelo}</span></h2>
              <div className="flex items-center gap-4 mt-4 justify-center sm:justify-start">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Patrimônio</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">#{item.etiquetaID}</span>
                 </div>
                 <div className="w-px h-8 bg-slate-200 dark:bg-slate-700"></div>
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Vida Restante</span>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.remainingLifeMonths} Meses (Est.)</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Health Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Circular Score Gauge */}
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <i className="fa-solid fa-heart-pulse text-6xl"></i>
            </div>
            <div className="relative w-40 h-40 mb-6 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100 dark:text-slate-800" />
                <motion.circle
                  cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="12" fill="transparent"
                  strokeDasharray={2 * Math.PI * 70}
                  initial={{ strokeDashoffset: 2 * Math.PI * 70 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 70 * (1 - item.healthScore / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={`${item.healthScore > 75 ? 'text-emerald-500' : item.healthScore > 40 ? 'text-amber-500' : 'text-red-500'}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black text-slate-900 dark:text-white">{item.healthScore}%</span>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Score</span>
              </div>
            </div>
            <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-200 uppercase tracking-[0.2em]">Índice de Saúde</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-2 leading-relaxed">{status.detail}</p>
          </div>

          {/* Risk Impact Panel */}
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-sm relative overflow-hidden flex flex-col group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <i className="fa-solid fa-triangle-exclamation text-6xl"></i>
            </div>
            <div className="flex-1">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center md:text-left">Fator de Risco</p>
               <div className="flex items-baseline gap-2 justify-center md:justify-start">
                  <span className="text-6xl font-black text-slate-900 dark:text-white leading-none">{item.riskScore}</span>
                  <span className="text-sm font-black text-slate-400 uppercase">/100</span>
               </div>
               
               <div className="mt-8 space-y-4">
                  <RiskIndicator label="Performance" value={100 - (item.riskScore * 0.4)} color="bg-indigo-500" />
                  <RiskIndicator label="Confiabilidade" value={100 - (item.riskScore * 0.7)} color="bg-purple-500" />
                  <RiskIndicator label="Ciclo de Vida" value={Math.min(100, (item.remainingLifeMonths / 48) * 100)} color="bg-pink-500" />
               </div>
            </div>
          </div>
        </div>

        {/* Score Breakdown Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-chart-pie"></i> Decomposição Analítica do Score
            </h3>
            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100 dark:border-indigo-800">Cálculo de Precisão</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-sm space-y-4">
             {item.impacts && item.impacts.length > 0 ? item.impacts.map((impact, i) => (
                <div key={i} className="flex items-center justify-between group/item">
                   <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${
                        impact.type === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 
                        impact.type === 'negative' ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-500'
                      }`}>
                         <i className={`fa-solid ${impact.type === 'positive' ? 'fa-plus' : impact.type === 'negative' ? 'fa-minus' : 'fa-equals'}`}></i>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Fator de Impacto</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase">{impact.label}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className={`text-lg font-black ${
                        impact.type === 'positive' ? 'text-emerald-500' : 
                        impact.type === 'negative' ? 'text-red-500' : 'text-slate-500'
                      }`}>
                         {impact.value > 0 ? '+' : ''}{impact.value}{impact.label.includes('Auditória') ? '%' : ' pts'}
                      </p>
                   </div>
                </div>
             )) : (
                <p className="text-center py-4 text-xs font-bold text-slate-400 uppercase italic">Dados de impacto não disponíveis para este ativo.</p>
             )}

             <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-end">
                <div>
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base de Cálculo</p>
                   <p className="text-xs font-bold text-slate-600 dark:text-slate-300">100 Pontos Iniciais (Estado Refactor)</p>
                </div>
                <div className="text-right">
                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Score Final</p>
                   <p className="text-2xl font-black text-slate-900 dark:text-white">{item.healthScore}%</p>
                </div>
             </div>
          </div>
        </div>

        {/* Technical Diagnostics */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <i className="fa-solid fa-microchip"></i> Telemetria de Hardware & Diagnóstico
            </h3>
            <span className="text-[8px] font-black text-slate-300 uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Atualizado em Tempo Real</span>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
             {item.reasons.length > 0 ? item.reasons.map((reason, i) => (
               <div key={i} className="group relative">
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/20 to-amber-500/20 rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500"></div>
                 <div className="relative flex items-center gap-6 p-6 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl hover:border-red-500/30 transition-all">
                   <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center text-xl shrink-0 shadow-inner">
                     <i className="fa-solid fa-triangle-exclamation"></i>
                   </div>
                   <div className="flex-1 min-w-0">
                      <h5 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest mb-1">Ponto de Atenção</h5>
                      <p className="text-sm font-bold text-red-600 dark:text-red-400 leading-tight uppercase">{reason}</p>
                   </div>
                   <i className="fa-solid fa-bolt text-red-500/30 text-xs"></i>
                 </div>
               </div>
             )) : (
               <div className="flex items-center gap-6 p-8 bg-emerald-500/5 border border-emerald-500/20 border-dashed rounded-[2rem] justify-center text-center flex-col">
                 <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-3xl shadow-inner">
                   <i className="fa-solid fa-circle-check"></i>
                 </div>
                 <div>
                    <h5 className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Sistemas Estáveis</h5>
                    <p className="text-xs font-semibold text-slate-400 max-w-xs leading-relaxed uppercase">Nenhuma anomalia crítica detectada nos sensores de hardware nos últimos ciclos.</p>
                 </div>
               </div>
             )}
          </div>
        </div>

        {/* Technical Recommendation */}
        <div className="relative overflow-hidden p-8 bg-surface-soft border border-border-subtle rounded-[3rem] shadow-nm-inset group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full blur-[80px] -mr-32 -mt-32 transition-transform duration-1000 group-hover:scale-110"></div>
          
          <div className="relative z-10">
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3 text-brand">
               <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-brand shadow-nm-flat border border-border-subtle">
                 <i className="fa-solid fa-user-doctor"></i>
               </div>
               Parecer Técnico Especializado
            </h4>
            
            <p className="text-lg font-black text-strong leading-relaxed tracking-tight italic">
              &quot;{item.healthScore < 40 
                ? "FALHA IMINENTE: Ativo com severa degradação técnica. A operação contínua representa risco crítico de perda de dados e indisponibilidade. Recomendamos a desativação imediata (BAIXA) e substituição por hardware Tier 1."
                : item.healthScore < 60
                ? "DEPRECIAÇÃO MODERADA: Ciclo de vida avançado detectado. Recomenda-se realocação para tarefas de baixa criticidade ou setup de upgrade preventivo (SSD/RAM) para estender a vida útil por mais 6-12 meses."
                : item.healthScore < 85
                ? "CONFORMIDADE OPERACIONAL: Ativo saudável com sinais naturais de desgaste. Manter rotinas preventivas semestrais de limpeza física e auditoria de firmware para garantir estabilidade."
                : "ESTADO NOMINAL: Hardware em perfeitas condições. Ativo validado para aplicações de alta criticidade e performance máxima. Garantia de disponibilidade absoluta."}&quot;
            </p>
            
            <div className="mt-10 pt-8 border-t border-border-subtle flex flex-wrap items-center gap-8">
               <SummaryMiniDetail icon="fa-clock" label="Tempo Restante" value={`${item.remainingLifeMonths} meses`} />
               <SummaryMiniDetail icon="fa-chart-line" label="Eficiência" value={`${item.healthScore}%`} />
               <SummaryMiniDetail icon="fa-shield-halved" label="Confiança" value={item.healthScore > 75 ? "Alta" : item.healthScore > 40 ? "Média" : "Baixa"} />
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            className="flex-1 py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.4em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            onClick={onVistoria}
          >
            <i className="fa-solid fa-clipboard-check"></i> Realizar Vistoria Técnica
          </button>
          <button 
            className="flex-1 py-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.4em] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            onClick={() => window.print()}
          >
            <i className="fa-solid fa-print"></i> Imprimir Laudo
          </button>
        </div>

        {vistorias.length > 0 && (
           <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800">
             <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2 px-2">
               <i className="fa-solid fa-history"></i> Histórico de Vistorias Reais
             </h3>
             <div className="grid grid-cols-1 gap-3">
               {vistorias.slice(0, 3).map((v) => (
                 <div key={v.id} className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                   <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${v.scoreCalculado >= 75 ? 'bg-emerald-500' : v.scoreCalculado >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}>
                       <span className="text-[10px] font-black">{v.scoreCalculado}%</span>
                     </div>
                     <div>
                       <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase">{new Date(v.dataVistoria).toLocaleDateString()}</p>
                       <p className="text-[9px] font-bold text-slate-400">Por: {v.inspectorNome}</p>
                     </div>
                   </div>
                   <div className="text-[10px] font-bold text-slate-500 max-w-[200px] truncate italic">&quot;{v.notasGerais || 'Sem observações'}&quot;</div>
                 </div>
               ))}
             </div>
           </div>
        )}
      </div>
    </SlidebarPanel>
  );
}

function VistoriaModal({ isOpen, onClose, item, onSave }: { isOpen: boolean, onClose: () => void, item: AnalyzedEquipamento | null, onSave: (data: any) => Promise<void> }) {
  const [itens, setItens] = useState<VistoriaItem[]>([]);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      const tipo = (item.tipoEquipamento || "").toLowerCase();
      let defaultItens: VistoriaItem[] = [];

      if (tipo.includes('computador') || tipo.includes('notebook') || tipo.includes('laptop') || tipo.includes('desktop')) {
        defaultItens = [
          { nome: 'Memória RAM (Saúde/Frequência)', status: 'bom' },
          { nome: 'Travamentos/Lentidão (Estabilidade)', status: 'bom' },
          { nome: 'Armazenamento (Saúde SSD/HD)', status: 'bom' },
          { nome: 'Teclado/Mouse/Trackpad', status: 'bom' },
          { nome: 'Integridade Física (Carcaça)', status: 'bom' },
        ];
      } else if (tipo.includes('monitor') || tipo.includes('tela') || tipo.includes('tv')) {
        defaultItens = [
          { nome: 'Funcionamento da Tela (Imagem)', status: 'bom' },
          { nome: 'Listras ou Dead Pixels', status: 'bom' },
          { nome: 'Cabos e Conexões', status: 'bom' },
          { nome: 'Botões e Ajustes', status: 'bom' },
          { nome: 'Estado Físico da Moldura', status: 'bom' },
        ];
      } else if (tipo.includes('switch') || tipo.includes('roteador') || tipo.includes('router') || tipo.includes('rede')) {
        defaultItens = [
          { nome: 'Integridade das Portas RJ45/SFP', status: 'bom' },
          { nome: 'Leds de Status e Atividade', status: 'bom' },
          { nome: 'Aquecimento e Ventilação', status: 'bom' },
          { nome: 'Fontes e Alimentação', status: 'bom' },
          { nome: 'Estado Físico/Gabinete', status: 'bom' },
        ];
      } else {
        defaultItens = [
          { nome: 'Funcionamento Geral', status: 'bom' },
          { nome: 'Estado Físico', status: 'bom' },
          { nome: 'Limpeza e Conservação', status: 'bom' },
          { nome: 'Conectividade (se aplicável)', status: 'bom' },
          { nome: 'Componentes e Acessórios', status: 'bom' },
        ];
      }
      setItens(defaultItens);
      setNotas("");
    }
  }, [isOpen, item]);

  if (!item) return null;

  const handleStatusChange = (index: number, status: 'bom' | 'alerta' | 'critico') => {
    const newItens = [...itens];
    newItens[index].status = status;
    setItens(newItens);
  };

  const currentScore = Math.round(
    (itens.reduce((acc, it) => acc + (it.status === 'bom' ? 1 : it.status === 'alerta' ? 0.5 : 0), 0) / (itens.length || 1)) * 100
  );

  return (
    <SlidebarPanel 
      isOpen={isOpen} 
      onClose={onClose}
      panelClassName="bg-surface w-full max-w-lg h-full shadow-2xl border-l border-border-subtle flex flex-col"
      header={
        <SlidebarHeader 
          title="Nova Vistoria Técnica" 
          subtitle={`Equipamento: ${item.etiquetaID}`}
          onClose={onClose} 
        />
      }
    >
       <div className="p-8 overflow-y-auto flex-1 space-y-8 bg-app-bg/20">
          <div className="bg-surface rounded-[2rem] p-8 border border-border-subtle shadow-nm-flat flex items-center justify-between group">
              <div className="relative">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand mb-1">Score Resultante</p>
                 <h3 className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{currentScore}%</h3>
                 <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-12 bg-brand rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div className="text-right">
                 <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-2">Status Previsto</p>
                 <div className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-widest border border-border-subtle ${
                   currentScore >= 75 ? 'bg-emerald-500/10 text-emerald-500' : currentScore >= 40 ? 'bg-amber-500/10 text-amber-500' : 'bg-red-500/10 text-red-500'
                 }`}>
                    {currentScore >= 75 ? 'Excelente' : currentScore >= 40 ? 'Regular' : 'Crítico'}
                 </div>
              </div>
           </div>

          <div className="space-y-4">
             {itens.map((it, idx) => (
                <div key={it.nome} className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                   <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{it.nome}</span>
                      <div className="flex gap-1.5 p-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-xl">
                         {['critico', 'alerta', 'bom'].map((s) => (
                            <button
                               key={s}
                               onClick={() => handleStatusChange(idx, s as any)}
                               className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] transition-all ${
                                 it.status === s 
                                   ? (s === 'bom' ? 'bg-emerald-500 text-white shadow-lg' : s === 'alerta' ? 'bg-amber-500 text-white shadow-lg' : 'bg-red-500 text-white shadow-lg') 
                                   : 'text-slate-400 hover:text-slate-600'
                               }`}
                            >
                               <i className={`fa-solid ${s === 'bom' ? 'fa-check' : s === 'alerta' ? 'fa-exclamation' : 'fa-xmark'}`}></i>
                            </button>
                         ))}
                      </div>
                   </div>
                </div>
             ))}
          </div>

          <div className="space-y-3">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações Gerais</label>
             <textarea 
               value={notas}
               onChange={(e) => setNotas(e.target.value)}
               placeholder="Descreva detalhes como lentidão percebida, danos físicos na carcaça, etc..."
               className="w-full h-32 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-semibold"
             />
          </div>
       </div>

       <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-4">
          <button 
             disabled={saving}
             onClick={async () => {
               setSaving(true);
               try {
                 await onSave({ itens, notasGerais: notas });
                 onClose();
               } finally {
                 setSaving(false);
               }
             }}
             className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
             {saving ? 'Salvando...' : 'Finalizar Vistoria'}
          </button>
          <button 
             onClick={onClose}
             className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest"
          >
             Cancelar
          </button>
       </div>
    </SlidebarPanel>
  );
}

function RiskIndicator({ label, value, color }: { label: string, value: number, color: string }) {
   return (
      <div className="space-y-1.5">
         <div className="flex justify-between items-center px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className="text-[9px] font-black text-slate-900 dark:text-slate-100">{Math.round(value)}%</span>
         </div>
         <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
            <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1, delay: 0.5 }} className={`h-full ${color} rounded-full`} />
         </div>
      </div>
   );
}

function SummaryMiniDetail({ icon, label, value }: { icon: string, label: string, value: string }) {
   return (
      <div className="flex items-center gap-3">
         <div className="w-8 h-8 rounded-full bg-surface-soft border border-border-subtle flex items-center justify-center text-brand/60 text-xs shrink-0 shadow-nm-inset">
            <i className={`fa-solid ${icon}`}></i>
         </div>
         <div className="flex flex-col">
            <span className="text-[8px] font-black text-muted uppercase tracking-widest">{label}</span>
            <span className="text-[10px] font-black text-strong uppercase tracking-tight">{value}</span>
         </div>
      </div>
   )
}

function BasisItem({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-surface-soft text-brand flex items-center justify-center shrink-0 shadow-nm-inset border border-border-subtle">
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <div>
        <h5 className="text-[10px] font-black text-strong uppercase tracking-widest mb-1">{title}</h5>
        <p className="text-xs text-main font-medium leading-normal">{desc}</p>
      </div>
    </div>
  );
}

function PenaltyRow({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-5 bg-surface-soft rounded-2xl border border-border-subtle shadow-nm-inset">
      <span className="text-[10px] font-black text-main uppercase">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}
