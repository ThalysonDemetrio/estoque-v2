"use client";

import React, { useMemo } from 'react';
import { NeumorphicContainer } from './NeumorphicCharts';
import { FunnelChart, Funnel, Tooltip, LabelList, Cell, ResponsiveContainer } from 'recharts';

const FUNNEL_COLORS = [
  "#6366f1", // Indigo
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#ec4899", // Pink
  "#8b5cf6", // Violet
];

interface TypeStat {
  setor: string;
  tipo: string;
  quantidade: number;
}

interface SectorFunnelChartProps {
  stats: TypeStat[];
  selectedSector: string;
  onSelectType?: (tipo: string) => void;
  selectedType?: string;
  title?: string;
  icon?: string;
}

const CustomFunnelTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-surface/90 backdrop-blur-md p-3 rounded-xl border border-border-subtle shadow-xl">
        <p className="text-[10px] font-black text-strong uppercase tracking-widest mb-1 border-b border-border-subtle pb-1">{data.tipo}</p>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full shadow-md" style={{ backgroundColor: data.fill }}></div>
          <span className="text-xs font-black text-brand tabular-nums">{data.quantidade}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function SectorFunnelChart({ 
  stats = [], 
  selectedSector, 
  onSelectType, 
  selectedType,
  title,
  icon = "fa-filter"
}: SectorFunnelChartProps) {
  const filteredStats = useMemo(() => {
    if (!selectedSector) return stats;
    return stats.filter(s => s.setor === selectedSector);
  }, [stats, selectedSector]);

  const { aggregatedStats } = useMemo(() => {
    const map: Record<string, number> = {};
    let total = 0;
    filteredStats.forEach(s => {
      map[s.tipo] = (map[s.tipo] || 0) + s.quantidade;
      total += s.quantidade;
    });
    const agg = Object.entries(map)
      .map(([tipo, quantidade], index) => {
        const percentage = total > 0 ? Math.round((quantidade / total) * 100) : 0;
        return { 
          tipo, 
          quantidade,
          percentage,
          label: `${tipo} - ${quantidade} (${percentage}%)`,
          fill: FUNNEL_COLORS[index % FUNNEL_COLORS.length]
        };
      })
      .sort((a, b) => b.quantidade - a.quantidade);
    return { aggregatedStats: agg };
  }, [filteredStats]);

  if (aggregatedStats.length === 0) return null;

  return (
    <NeumorphicContainer 
      title={title || (selectedSector ? `Distribuição: ${selectedSector}` : 'Distribuição Geral')}
      icon={icon}
    >
      <div className="w-full h-[400px] sm:h-[450px] relative px-4" style={{ minWidth: 300, minHeight: 400 }}>
        <ResponsiveContainer width="99%" height="99%">
          <FunnelChart>
            <defs>
              <filter id="funnelShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feOffset dx="2" dy="2" result="offsetBlur" />
                <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
              </filter>
              {aggregatedStats.map((entry, index) => (
                <linearGradient key={`grad-${index}`} id={`grad-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={entry.fill} stopOpacity={1} />
                  <stop offset="100%" stopColor={entry.fill} stopOpacity={0.7} />
                </linearGradient>
              ))}
            </defs>
            <Tooltip content={<CustomFunnelTooltip />} />
            <Funnel
              dataKey="quantidade"
              data={aggregatedStats}
              isAnimationActive={false}
              onClick={(data: any) => onSelectType?.(data.tipo === selectedType ? "" : data.tipo)}
              className="cursor-pointer"
            >
              {aggregatedStats.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`url(#grad-${index})`}
                  stroke="var(--surface)"
                  strokeWidth={2}
                  filter="url(#funnelShadow)"
                  className={`transition-all duration-300 ${selectedType === entry.tipo ? 'drop-shadow-lg opacity-100 scale-[1.02]' : selectedType ? 'opacity-60 hover:opacity-100' : 'hover:drop-shadow-md'}`}
                />
              ))}
              <LabelList 
                position="center" 
                fill="#fff" 
                stroke="none" 
                dataKey="label" 
                className="text-[10px] font-black uppercase tracking-widest drop-shadow-md pointer-events-none"
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </NeumorphicContainer>
  );
}
