"use client";

import React, { useMemo } from 'react';
import { Equipamento, Colaborador } from '@/types';
import { NeumorphicContainer, NeumorphicDonut } from './NeumorphicCharts';

interface SectorShareChartProps {
  equipamentos: Equipamento[];
  colaboradores: Colaborador[];
}

const SECTOR_COLORS = [
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#06b6d4", // Cyan
  "#f43f5e", // Rose
];

export function SectorShareChart({ equipamentos, colaboradores }: SectorShareChartProps) {
  const sectorShareData = useMemo(() => {
    const sectors: Record<string, number> = {};
    let total = 0;

    equipamentos.forEach(eq => {
      // Prioridade: Departamento do Colaborador > Setor do Equipamento > Geral
      const col = colaboradores.find(c => String(c.colaboradorID) === String(eq.colaboradorAtualID));
      const dept = col?.departamento || eq.setor || "Geral";
      sectors[dept] = (sectors[dept] || 0) + 1;
      total++;
    });

    return Object.entries(sectors)
      .map(([name, count], index) => ({
        name,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
        color: SECTOR_COLORS[index % SECTOR_COLORS.length]
      }))
      .sort((a, b) => b.count - a.count);
  }, [equipamentos, colaboradores]);

  const totalDevices = equipamentos.length;

  return (
    <NeumorphicContainer title="Market Share por Setor" icon="fa-chart-pie">
      <div className="flex flex-col lg:flex-row items-center gap-8 py-2">
        {/* Donut Area */}
        <div className="relative group">
          <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          
          <div className="relative flex items-center justify-center">
            {/* We'll use a stacked approach or just the top sector for the main donut, 
                but for a true "Multi-Donut" we might need a separate component. 
                For now, let's use the NeumorphicDonut to show the 'Líder' or a simplified view. 
                Actually, let's render a custom simplified Pie for Sectors using Neumorphic principles.
            */}
            <NeumorphicDonut 
              percentage={sectorShareData[0]?.percentage || 0}
              centerLabel={totalDevices}
              label="Ativos Totais"
              size={180}
              strokeWidth={16}
              color={sectorShareData[0]?.color || "#6366f1"}
            />
            
            {/* Secondary rings could go here, but let's focus on the legend for precision */}
          </div>
        </div>

        {/* Legend/List Area */}
        <div className="flex-1 w-full space-y-3 min-h-[320px] max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {sectorShareData.map((item) => (
            <div 
              key={item.name}
              className="group flex items-center justify-between p-3 rounded-2xl bg-surface-soft border border-border-subtle hover:border-brand/30 transition-all shadow-nm-flat-sm hover:shadow-nm-flat"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div 
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-lg" 
                  style={{ 
                    backgroundColor: item.color,
                    boxShadow: `0 0 10px ${item.color}40`
                  }}
                ></div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-black text-strong truncate uppercase tracking-widest">{item.name}</span>
                  <span className="text-[8px] font-bold text-muted uppercase tracking-tighter">{item.count} Dispositivos</span>
                </div>
              </div>
              <div className="bg-surface px-2.5 py-1 rounded-lg border border-border-subtle shadow-inner">
                <span className="text-[10px] font-black text-brand tabular-nums">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </NeumorphicContainer>
  );
}
