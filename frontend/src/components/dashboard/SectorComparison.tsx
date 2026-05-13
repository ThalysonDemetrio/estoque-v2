"use client";

import React, { useMemo } from 'react';
import { Equipamento, Colaborador } from '@/types';
import { NeumorphicContainer, NeumorphicStackedBar } from './NeumorphicCharts';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts';

interface SectorComparisonProps {
  equipamentos: Equipamento[];
  colaboradores: Colaborador[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border-subtle p-4 rounded-3xl shadow-nm-flat backdrop-blur-md">
        <p className="text-[10px] font-black text-strong uppercase tracking-widest mb-3 border-b border-border-subtle pb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }}></div>
                <span className="text-[9px] font-bold text-muted uppercase tracking-tight">{entry.name}</span>
              </div>
              <span className="text-xs font-black text-strong tabular-nums">{entry.value}</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-border-subtle flex justify-between items-center">
            <span className="text-[10px] font-black text-brand uppercase tracking-widest">Total</span>
            <span className="text-xs font-black text-brand tabular-nums">
              {payload.reduce((acc: number, curr: any) => acc + curr.value, 0)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function SectorComparison({ equipamentos, colaboradores }: SectorComparisonProps) {
  const sectorData = useMemo(() => {
    const sectors: Record<string, { inUse: number, available: number, maintenance: number, total: number }> = {};

    equipamentos.forEach(eq => {
      // Prioridade: Departamento do Colaborador > Setor do Equipamento > Geral
      const col = colaboradores.find(c => String(c.colaboradorID) === String(eq.colaboradorAtualID));
      const dept = col?.departamento || eq.setor || "Geral";

      if (!sectors[dept]) {
        sectors[dept] = { inUse: 0, available: 0, maintenance: 0, total: 0 };
      }

      sectors[dept].total++;
      const status = (eq.status || "").toLowerCase();
      if (status.includes("uso")) sectors[dept].inUse++;
      else if (status.includes("disp")) sectors[dept].available++;
      else if (status.includes("manut")) sectors[dept].maintenance++;
    });

    return Object.entries(sectors)
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8); // Top 8 sectors for clarity
  }, [equipamentos, colaboradores]);

  const topSector = sectorData[0];
  const avgEquip = sectorData.length > 0 ? (equipamentos.length / sectorData.length).toFixed(1) : 0;

  return (
    <NeumorphicContainer title="Análise Comparativa por Setor" icon="fa-chart-column">
      <div className="pt-2">
        {/* Top KPIs Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Setor Líder", value: topSector?.name || "-", sub: `${topSector?.total || 0} ativos`, color: "text-brand", bg: "bg-surface-soft" },
            { label: "Média/Setor", value: avgEquip, sub: "ativos", color: "text-emerald-500", bg: "bg-surface-soft" },
            { label: "Total Setores", value: sectorData.length, sub: "mapeados", color: "text-blue-500", bg: "bg-surface-soft" },
            { label: "Eficiência", value: "94%", sub: "alocação", color: "text-amber-500", bg: "bg-surface-soft" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${kpi.bg} p-5 rounded-[2rem] border border-border-subtle shadow-nm-flat flex flex-col items-center text-center gap-1 hover-nm-elevated transition-all`}>
              <span className="text-[9px] font-black text-muted uppercase tracking-widest opacity-60">{kpi.label}</span>
              <span className={`text-sm font-black text-strong truncate w-full px-1 tracking-tight`}>{kpi.value}</span>
              <span className={`text-[8px] font-black ${kpi.color} uppercase tracking-[0.2em] mt-1`}>{kpi.sub}</span>
            </div>
          ))}
        </div>

        {/* Vertical Bar Chart */}
        <div className="h-[340px] w-full bg-surface-soft/20 rounded-[2.5rem] p-4 border border-border-subtle/30 relative overflow-hidden group shadow-nm-inset-lg">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>

          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sectorData}
              margin={{ top: 20, right: 10, left: 20, bottom: 20 }}
              barGap={8}
            >
              <defs>
                <linearGradient id="barInUse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="barAvailable" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
                </linearGradient>
                <linearGradient id="barMaintenance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.8} />
                </linearGradient>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feOffset dx="2" dy="2" result="offsetBlur" />
                  <feComposite in="SourceGraphic" in2="offsetBlur" operator="over" />
                </filter>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" opacity={0.4} />

              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 900, fill: "var(--text-muted)" }}
                interval={0}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 900, fill: "var(--text-muted)" }}
                tickMargin={10}
                width={50}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--brand)', opacity: 0.05 }} />

              <Bar
                dataKey="inUse"
                name="Em Uso"
                stackId="a"
                fill="url(#barInUse)"
                barSize={32}
              >
                {sectorData.map((entry, index) => {
                  const isTop = entry.available === 0 && entry.maintenance === 0;
                  return (
                    <Cell 
                      key={`cell-inuse-${index}`} 
                      radius={(isTop ? [10, 10, 0, 0] : [0, 0, 0, 0]) as any} 
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="available"
                name="Disponível"
                stackId="a"
                fill="url(#barAvailable)"
              >
                {sectorData.map((entry, index) => {
                  const isTop = entry.maintenance === 0;
                  // Only round top if it's the highest bar in stack
                  return (
                    <Cell 
                      key={`cell-available-${index}`} 
                      radius={(isTop ? [10, 10, 0, 0] : [0, 0, 0, 0]) as any} 
                    />
                  );
                })}
              </Bar>
              <Bar
                dataKey="maintenance"
                name="Manutenção"
                stackId="a"
                fill="url(#barMaintenance)"
              >
                {sectorData.map((entry, index) => {
                  // Maintenance is always the top-most if value > 0
                  return (
                    <Cell 
                      key={`cell-maintenance-${index}`} 
                      radius={[10, 10, 0, 0] as any} 
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Customized Legend */}
        <div className="flex flex-wrap justify-center gap-6 mt-6">
          {[
            { label: "Em Uso", color: "bg-indigo-500", glow: "shadow-indigo-500/40" },
            { label: "Disponível", color: "bg-emerald-500", glow: "shadow-emerald-500/40" },
            { label: "Manutenção", color: "bg-amber-500", glow: "shadow-amber-500/40" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[9px] font-black text-muted uppercase tracking-widest">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-lg ${item.glow}`}></div>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </NeumorphicContainer>
  );
}
