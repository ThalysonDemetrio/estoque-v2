"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Equipamento } from "@/types";
import { NeumorphicContainer } from "./NeumorphicCharts";
import { calculateAssetHealth } from "@/lib/health";

export function MaintenancePredictor({ equipamentos }: { equipamentos: Equipamento[] }) {
  const risks = useMemo(() => {
    return equipamentos.map(e => {
      const healthInfo = calculateAssetHealth(e);
      
      return {
        ...e,
        healthScore: healthInfo.healthScore,
        riskScore: healthInfo.riskScore,
        reasons: healthInfo.reasons
      };
    })
    .filter(e => e.riskScore >= 30) // Filter assets with meaningful risk
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);
  }, [equipamentos]);

  if (risks.length === 0) return null;

  return (
    <NeumorphicContainer title="Saúde do Inventário (Predição)" icon="fa-heart-pulse">
      <div className="flex items-center justify-between mb-6">
        <span className="text-[10px] font-black bg-red-500/10 text-red-500 px-3 py-1 rounded-full uppercase tracking-widest border border-red-500/20">Atenção Crítica</span>
      </div>

      <div className="space-y-4">
        {risks.map((item, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={item.etiquetaID} 
            className="flex items-start gap-4 p-4 rounded-3xl border border-border-subtle bg-surface-soft shadow-nm-flat hover-nm-elevated transition-all group"
          >
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-nm-inset ${
                item.healthScore < 40 ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
              }`}>
                <i className="fa-solid fa-triangle-exclamation text-base"></i>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-surface flex items-center justify-center border border-border-subtle shadow-sm">
                 <span className="text-[8px] font-black text-strong">{item.healthScore}%</span>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-1">
                <p className="text-sm font-black text-strong truncate pr-2 group-hover:text-brand transition-colors">
                  {item.marca} {item.modelo}
                </p>
                <span className="font-mono text-[10px] font-black text-muted opacity-40 uppercase tracking-tighter">#{item.etiquetaID}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {item.reasons.slice(0, 2).map((r, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md bg-surface border border-border-subtle text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter shadow-sm">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      <Link href="/diagnosticos" className="block w-full text-center mt-6 py-4 bg-surface-soft border border-border-subtle rounded-2xl text-[10px] font-black text-muted uppercase tracking-widest hover:text-brand hover:border-brand/30 transition-all shadow-nm-flat hover:shadow-nm-inset">
        Ver Relatório Completo de Saúde
      </Link>
    </NeumorphicContainer>
  );
}
