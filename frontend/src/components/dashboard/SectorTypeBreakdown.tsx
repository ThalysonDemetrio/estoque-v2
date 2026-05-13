"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { NeumorphicContainer, NeumorphicDonut } from './NeumorphicCharts';

const DONUT_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#6366f1", // Indigo
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#f43f5e", // Rose
  "#06b6d4", // Cyan
];

interface TypeStat {
  setor: string;
  tipo: string;
  quantidade: number;
}

interface SectorTypeBreakdownProps {
  stats: TypeStat[];
  selectedSector: string;
  onSelectType?: (tipo: string) => void;
  selectedType?: string;
  title?: string;
  icon?: string;
  unitLabel?: string;
  unitLabelPlural?: string;
}

export function SectorTypeBreakdown({ 
  stats = [], 
  selectedSector, 
  onSelectType, 
  selectedType,
  title,
  icon = "fa-list-check",
  unitLabel = "Unidade",
  unitLabelPlural = "Unidades"
}: SectorTypeBreakdownProps) {
  const filteredStats = useMemo(() => {
    if (!selectedSector) return stats;
    return stats.filter(s => s.setor === selectedSector);
  }, [stats, selectedSector]);

  const { aggregatedStats, totalQuantity } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    filteredStats.forEach(s => {
      map[s.tipo] = (map[s.tipo] || 0) + s.quantidade;
      total += s.quantidade;
    });
    const agg = Object.entries(map)
      .map(([tipo, quantidade]) => ({ tipo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
    return { aggregatedStats: agg, totalQuantity: total };
  }, [filteredStats]);

  if (aggregatedStats.length === 0) return null;

  return (
    <NeumorphicContainer 
      title={title || (selectedSector ? `Distribuição: ${selectedSector}` : 'Distribuição Geral')}
      icon={icon}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {aggregatedStats.map((item, idx) => {
          const isSelected = selectedType === item.tipo;
          const percentage = totalQuantity > 0 ? (item.quantidade / totalQuantity) * 100 : 0;
          const color = DONUT_COLORS[idx % DONUT_COLORS.length];

          return (
            <motion.div
              key={item.tipo}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              onClick={() => onSelectType?.(item.tipo === selectedType ? "" : item.tipo)}
              className={`group flex items-center justify-between p-5 rounded-[2.5rem] cursor-pointer transition-all border border-border-subtle
                ${isSelected 
                  ? "bg-brand shadow-nm-inset" 
                  : "bg-surface shadow-nm-flat hover-nm-elevated"
                }`}
            >
              <div className="flex items-center gap-4">
                <div className="shrink-0 scale-110">
                  <NeumorphicDonut 
                    percentage={percentage}
                    centerLabel={item.quantidade}
                    size={56}
                    strokeWidth={6}
                    color={isSelected ? "#FFF" : color}
                    showPercentage={false}
                    className={isSelected ? "drop-shadow-sm" : ""}
                    textColor={isSelected ? "!text-white" : ""}
                  />
                </div>
                <div className="flex flex-col">
                  <span className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 ${
                    isSelected ? "!text-white" : "text-strong"
                  }`}>
                    {item.tipo}
                  </span>
                  <span className={`text-[8px] font-black uppercase tracking-tighter ${
                    isSelected ? "text-white/70" : "text-muted"
                  }`}>
                    {item.quantidade === 1 ? unitLabel : unitLabelPlural}
                  </span>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isSelected ? "bg-white/20 text-white shadow-inner" : "bg-surface-soft text-muted opacity-40 group-hover:opacity-100 group-hover:text-brand"
              }`}>
                <i className={`fa-solid ${isSelected ? "fa-check text-[10px]" : "fa-chevron-right text-[8px]"}`}></i>
              </div>
            </motion.div>
          );
        })}
      </div>
    </NeumorphicContainer>
  );
}

