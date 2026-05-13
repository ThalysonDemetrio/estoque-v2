"use client";

import React from 'react';
import { NeumorphicMultiDonut } from './NeumorphicCharts';

interface InventoryPieChartProps {
  data: {
    label: string;
    count: number;
    color: string;
  }[];
}

const COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#f87171',
  slate: '#64748b'
};

export function InventoryPieChart({ data }: InventoryPieChartProps) {
  const chartData = data
    .filter(item => item.count > 0)
    .map(item => ({
      label: item.label,
      value: item.count,
      color: item.color.includes('emerald') ? COLORS.emerald :
             item.color.includes('blue')    ? COLORS.blue :
             item.color.includes('amber')   ? COLORS.amber :
             item.color.includes('red')    ? COLORS.red : COLORS.slate
    }));

  if (chartData.length === 0) {
    return <div className="h-64 flex items-center justify-center text-slate-400">Sem dados</div>;
  }

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-8 py-2 w-full h-full min-h-[220px]">
      {/* Donut Area */}
      <div className="relative group shrink-0">
        <div className="absolute inset-0 bg-brand/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <NeumorphicMultiDonut 
          segments={chartData}
          size={180}
          strokeWidth={16}
        />
      </div>

      {/* Legend Area */}
      <div className="flex-1 w-full space-y-3">
        {chartData.map((item) => (
          <div 
            key={item.label}
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
                <span className="text-[10px] font-black text-strong truncate uppercase tracking-widest">{item.label}</span>
                <span className="text-[8px] font-bold text-muted uppercase tracking-tighter">{item.value} Unidades</span>
              </div>
            </div>
            <div className="bg-surface px-2.5 py-1 rounded-lg border border-border-subtle shadow-inner">
              <span className="text-[10px] font-black text-brand tabular-nums">
                {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
