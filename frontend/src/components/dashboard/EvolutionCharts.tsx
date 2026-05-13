import React, { useMemo, useState } from 'react';
import { NeumorphicContainer, NeumorphicAreaChart } from './NeumorphicCharts';
import { useTheme } from '@/contexts/ThemeContext';

interface GrowthDataPoint {
  label: string;
  value: number;
}

interface SectorGrowthData {
  [sector: string]: GrowthDataPoint[];
}

interface EvolutionChartsProps {
  totalGrowth: GrowthDataPoint[];
  sectorGrowth: SectorGrowthData;
  sectors: string[];
  types?: string[];
  selectedType?: string;
  onTypeChange?: (type: string) => void;
}

export function EvolutionCharts({ 
  totalGrowth, 
  sectorGrowth, 
  sectors, 
  types = [], 
  selectedType = "", 
  onTypeChange 
}: EvolutionChartsProps) {
  const { theme } = useTheme();
  const [selectedSector, setSelectedSector] = useState(sectors[0] || "");

  const currentSectorData = useMemo(() => {
    return sectorGrowth[selectedSector] || [];
  }, [sectorGrowth, selectedSector]);

  return (
    <div className="flex flex-col gap-10">
      {/* Total Growth Chart */}
      <NeumorphicContainer 
        title="Crescimento Geral do Inventário" 
        icon="fa-chart-line"
        extra={
          <select 
            value={selectedType}
            onChange={(e) => onTypeChange?.(e.target.value)}
            className="h-9 bg-surface-soft border border-border-subtle rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand/20 text-brand shadow-sm"
          >
            <option value="">Todos os Dispositivos</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        }
      >
        <div className="h-max w-full pt-4">
          <NeumorphicAreaChart 
            data={totalGrowth}
            height={320}
            color="#6366f1"
            valuePrefix=""
            showDots={true}
          />
        </div>
      </NeumorphicContainer>

      {/* Sector Evolution Chart */}
      <NeumorphicContainer 
        title="Evolução por Setor" 
        icon="fa-users-gear"
        extra={
          <select 
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="h-9 bg-surface-soft border border-border-subtle rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand/20 text-brand shadow-sm"
          >
            {sectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        }
      >
        <div className="h-max w-full pt-4">
          <NeumorphicAreaChart 
            data={currentSectorData}
            height={320}
            color="#10b981"
            valuePrefix=""
            showDots={true}
          />
        </div>
      </NeumorphicContainer>
    </div>
  );
}
