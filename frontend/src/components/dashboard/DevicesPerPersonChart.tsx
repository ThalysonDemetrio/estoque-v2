"use client";

import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import { NeumorphicContainer } from './NeumorphicCharts';
import { Equipamento, Colaborador } from '@/types';

interface DevicesPerPersonChartProps {
  equipamentos: Equipamento[];
  colaboradores: Colaborador[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-border-subtle p-4 rounded-3xl shadow-nm-flat backdrop-blur-md">
        <p className="text-[10px] font-black text-strong uppercase tracking-widest mb-3 border-b border-border-subtle pb-2">{label}</p>
        <div className="flex items-center justify-between gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand shadow-[0_0_8px_rgba(59,94,255,0.4)]"></div>
            <span className="text-[9px] font-bold text-muted uppercase tracking-tight">Equipamentos</span>
          </div>
          <span className="text-sm font-black text-brand tabular-nums">{payload[0].value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function DevicesPerPersonChart({ equipamentos, colaboradores }: DevicesPerPersonChartProps) {
  const chartData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Inicializa todos os colaboradores encontrados nos equipamentos 
    // ou passados via props 
    colaboradores.forEach(c => {
      counts[c.nome] = 0;
    });

    equipamentos.forEach(e => {
      if (e.colaboradorAtualID) {
        const colab = colaboradores.find(c => c.colaboradorID === e.colaboradorAtualID);
        if (colab) {
          counts[colab.nome] = (counts[colab.nome] || 0) + 1;
        }
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [equipamentos, colaboradores]);

  const { theme } = useTheme();
  const isDark = theme === 'dark';

  if (chartData.length === 0) return null;

  const minWidth = Math.max(chartData.length * 80, 400);

  return (
    <NeumorphicContainer title="Dispositivos por Pessoa" icon="fa-chart-bar" className="h-[400px]">
      <div className="w-full h-full overflow-x-auto custom-scrollbar pb-2">
        <div 
          className="bg-surface-soft/20 rounded-[2rem] p-4 border border-border-subtle/30 shadow-nm-inset-lg relative overflow-hidden"
          style={{ width: chartData.length > 8 ? `${minWidth}px` : '100%', height: '320px' }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
              <defs>
                <linearGradient id="barGradientPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "var(--border-subtle)" : "rgba(0,0,0,0.05)"} />
              <XAxis 
                dataKey="name" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 800, fill: "var(--text-muted)" }}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 9, fontWeight: 800, fill: "var(--text-muted)" }}
                tickMargin={10}
                allowDecimals={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--brand)', opacity: 0.05 }} />
              <Bar 
                dataKey="count" 
                radius={[12, 12, 0, 0]}
                barSize={32}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={'url(#barGradientPrimary)'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </NeumorphicContainer>
  );
}
