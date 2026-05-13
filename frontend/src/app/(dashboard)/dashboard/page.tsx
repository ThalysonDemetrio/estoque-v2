"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Equipamento, Colaborador } from "@/types";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { MindMap } from "@/components/dashboard/MindMap";
import { calculateGlobalHealthScore } from "@/lib/health";
import { SectorComparison } from "@/components/dashboard/SectorComparison";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { MaintenancePredictor } from "@/components/dashboard/MaintenancePredictor";
import { InventoryPieChart } from "@/components/dashboard/InventoryPieChart";
import { logger } from "@/lib/logger";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { BIWidget } from "@/components/dashboard/BIWidget";
import { NeumorphicWidget } from "@/components/dashboard/NeumorphicWidget";
import { NeumorphicProgressBar, NeumorphicContainer, NeumorphicMultiDonut } from "@/components/dashboard/NeumorphicCharts";
import { SectorTypeBreakdown } from "@/components/dashboard/SectorTypeBreakdown";
import { SectorFunnelChart } from "@/components/dashboard/SectorFunnelChart";
import { AssetListModal } from "@/components/dashboard/AssetListModal";
import { EquipamentoDetailSidebar } from "@/components/equipamentos/EquipamentoDetailSidebar";
import { EquipamentoModal } from "@/components/equipamentos/EquipamentoModal";
import { ColaboradorDetailSidebar } from "@/components/colaboradores/ColaboradorDetailSidebar";
import { useSocket } from "@/contexts/SocketContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SectorShareChart } from "@/components/dashboard/SectorShareChart";
import { DevicesPerPersonChart } from "@/components/dashboard/DevicesPerPersonChart";
import { EvolutionCharts } from "@/components/dashboard/EvolutionCharts";

const DONUT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const BRAND_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#06b6d4"];

// Usando interfaces globais do "@/types"

export default function DashboardPage() {
  const { t } = useTranslation("common");
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [sectorTypeStats, setSectorTypeStats] = useState<{ setor: string, tipo: string, quantidade: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Asset Selection & Detail State
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEquipamento, setEditingEquipamento] = useState<Equipamento | null>(null);

  // Colaborador Selection & Detail State
  const [selectedColab, setSelectedColab] = useState<Colaborador | null>(null);
  const [isColabSidebarOpen, setIsColabSidebarOpen] = useState(false);

  // Category Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategoryName, setSelectedCategoryName] = useState("");
  const [modalAssets, setModalAssets] = useState<Equipamento[]>([]);
  
  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterSector, setFilterSector] = useState("");
  const [filterMarca, setFilterMarca] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterGrowthType, setFilterGrowthType] = useState("");
  const [isNavMenuVisible, setIsNavMenuVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Staggered fetches to avoid 429 burst on initial load
      const eqs = await EquipamentosService.getEquipamentos();
      
      // Small delay between requests to respect backend rate limits
      await new Promise(resolve => setTimeout(resolve, 200));
      const cols = await ColaboradoresService.getColaboradores();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const stats = await EquipamentosService.getTiposPorSetor();

      setEquipamentos(Array.isArray(eqs) ? eqs : []);
      setColaboradores(Array.isArray(cols) ? cols : []);
      setSectorTypeStats(Array.isArray(stats) ? stats : []);
    } catch (err) {
      logger.error("Dashboard fetch error", { err });
      setError("Nao foi possivel carregar os dados do dashboard. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const { hasPermission } = useAuth();
  const router = useRouter();
  const { socket } = useSocket();

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 100) {
        setIsNavMenuVisible(true);
      } else if (currentScrollY < lastScrollY - 10) {
        setIsNavMenuVisible(true);
      } else if (currentScrollY > lastScrollY + 10) {
        setIsNavMenuVisible(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const norm = (s: string) => (s || "").toLowerCase();

  const filteredEquipamentos = useMemo(() => {
    return equipamentos.filter(e => {
      const matchType = !filterType || e.tipoEquipamento === filterType;
      const matchSector = !filterSector || e.setor === filterSector;
      const matchMarca = !filterMarca || e.marca === filterMarca;
      
      const searchLower = filterSearch.toLowerCase();
      const matchSearch = !filterSearch || 
        (e.etiquetaID || "").toLowerCase().includes(searchLower) ||
        (e.marca || "").toLowerCase().includes(searchLower) ||
        (e.modelo || "").toLowerCase().includes(searchLower) ||
        (e.tipoEquipamento || "").toLowerCase().includes(searchLower);

      return matchType && matchSector && matchMarca && matchSearch;
    });
  }, [equipamentos, filterType, filterSector, filterMarca, filterSearch]);

  const sectorBrandStats = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    equipamentos.forEach(e => {
      // Prioridade: Departamento do Colaborador > Setor do Equipamento > Geral
      let s = null;
      if (e.colaboradorAtualID) {
        const col = colaboradores.find(c => String(c.colaboradorID) === String(e.colaboradorAtualID));
        s = col?.departamento;
      }
      s = s || e.setor || 'Geral';
      
      const m = e.marca || 'Sem Marca';
      if (!map[s]) map[s] = {};
      map[s][m] = (map[s][m] || 0) + 1;
    });
    
    const result: { setor: string, tipo: string, quantidade: number }[] = [];
    Object.entries(map).forEach(([setor, marcas]) => {
      Object.entries(marcas).forEach(([marca, quantidade]) => {
        result.push({ setor, tipo: marca, quantidade });
      });
    });
    return result;
  }, [equipamentos, colaboradores]);

  const { sectorValueStats, sectorValueShare, totalInvestment } = useMemo(() => {
    const valueMap: Record<string, Record<string, number>> = {};
    const shareMap: Record<string, number> = {};
    let totalInv = 0;

    equipamentos.forEach(e => {
      // Prioridade: Departamento do Colaborador > Setor do Equipamento > Geral
      let s = null;
      if (e.colaboradorAtualID) {
        const col = colaboradores.find(c => String(c.colaboradorID) === String(e.colaboradorAtualID));
        s = col?.departamento;
      }
      s = s || e.setor || 'Geral';

      const m = e.marca || 'Sem Marca';
      // Normalize cost/value
      let val = 0;
      if (typeof e.valorCompra === 'number') val = e.valorCompra;
      else if (typeof e.custoAquisicao === 'number') val = e.custoAquisicao;
      else if (typeof e.custoAquisicao === 'string') val = parseFloat(e.custoAquisicao) || 0;

      if (!valueMap[s]) valueMap[s] = {};
      valueMap[s][m] = (valueMap[s][m] || 0) + val;
      
      shareMap[s] = (shareMap[s] || 0) + val;
      totalInv += val;
    });
    
    const valueStats: { setor: string, tipo: string, quantidade: number }[] = [];
    Object.entries(valueMap).forEach(([setor, marcas]) => {
      Object.entries(marcas).forEach(([marca, quantidade]) => {
        valueStats.push({ setor, tipo: marca, quantidade });
      });
    });

    const valueShare = Object.entries(shareMap)
      .map(([label, value], index) => ({
        label,
        value,
        color: DONUT_COLORS[index % DONUT_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);

    return { sectorValueStats: valueStats, sectorValueShare: valueShare, totalInvestment: totalInv };
  }, [equipamentos, colaboradores]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const filteredColaboradores = useMemo(() => {
    return colaboradores.filter(c => {
      const matchSector = !filterSector || c.departamento === filterSector;
      return matchSector;
    });
  }, [colaboradores, filterSector]);

  // Cálculo de Crescimento Temporal (Últimos 12 meses contínuos)
  const { totalGrowth, sectorGrowth, sectorsList: equipmentSectorsList } = useMemo(() => {
    const months: { key: string, end: Date }[] = [];
    const now = new Date();
    
    // Gerar os últimos 12 meses contínuos
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }),
        end: d
      });
    }

    // Resolver setor para cada equipamento (consistente com o restante da página)
    const eqWithResolvedSector = equipamentos.map(e => {
      let s = null;
      if (e.colaboradorAtualID) {
        const col = colaboradores.find(c => String(c.colaboradorID) === String(e.colaboradorAtualID));
        s = col?.departamento;
      }
      return { ...e, resolvedSector: s || e.setor || "Geral" };
    });

    const sectorsSet = new Set<string>();
    eqWithResolvedSector.forEach(e => sectorsSet.add(e.resolvedSector));
    const allSectors = Array.from(sectorsSet).sort();

    const totalGrowthData = months.map(m => {
      const monthEnd = new Date(m.end.getFullYear(), m.end.getMonth() + 1, 0, 23, 59, 59);
      const count = equipamentos.filter(e => {
        if (filterGrowthType && e.tipoEquipamento !== filterGrowthType) return false;
        const d = new Date(e.dataCompra || e.dataAquisicao || "2000-01-01");
        return d <= monthEnd;
      }).length;
      return { label: m.key, value: count };
    });

    const sectorGrowthMap: Record<string, { label: string, value: number }[]> = {};
    allSectors.forEach(sector => {
      sectorGrowthMap[sector] = months.map(m => {
        const monthEnd = new Date(m.end.getFullYear(), m.end.getMonth() + 1, 0, 23, 59, 59);
        const count = eqWithResolvedSector.filter(e => {
          if (e.resolvedSector !== sector) return false;
          const d = new Date(e.dataCompra || e.dataAquisicao || "2000-01-01");
          return d <= monthEnd;
        }).length;
        return { label: m.key, value: count };
      });
    });

    return { 
      totalGrowth: totalGrowthData,
      sectorGrowth: sectorGrowthMap,
      sectorsList: allSectors
    };
  }, [equipamentos, colaboradores, filterGrowthType]);

  const handleCategoryClick = useCallback((tipo: string) => {
    if (!tipo) return;
    const items = filteredEquipamentos.filter(e => e.tipoEquipamento === tipo);
    setModalAssets(items);
    setSelectedCategoryName(tipo);
    setIsModalOpen(true);
  }, [filteredEquipamentos]);

  const handleOpenDetail = useCallback((eq: Equipamento) => {
    setSelectedEq(eq);
    setIsSidebarOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((eq: Equipamento) => {
    setEditingEquipamento(eq);
    setIsEditModalOpen(true);
  }, []);

  const handleOpenColabDetail = useCallback((colab: Colaborador) => {
    setSelectedColab(colab);
    setIsColabSidebarOpen(true);
  }, []);

  const handleModelClick = useCallback((modelo: string) => {
    if (!modelo) return;
    const items = filteredEquipamentos.filter(e => e.modelo === modelo);
    setModalAssets(items);
    setSelectedCategoryName(modelo);
    setIsModalOpen(true);
  }, [filteredEquipamentos]);

  const {
    total,
    emUso,
    disponiveis,
    manutencao,
    baixados,
    colAtivos,
    topTypes,
    maxType,
    statusDist,
    stats,
    empresaPct,
    usuariosPct,
    typesList,
    sectorsList,
    marcasList,
    topBrands,
    topModels,
    stockItems,
    activeHealth,
    globalHealthScore,
    networkUptime,
    availabilityRate,
    avgLifeYears,
    utilizationRate
  } = useMemo(() => {
    const totalEq = filteredEquipamentos.length;
    const emUsoCount = filteredEquipamentos.filter((e) => norm(e.status || "").includes("uso")).length;
    const disponiveisCount = filteredEquipamentos.filter((e) => norm(e.status || "").includes("disp")).length;
    const manutencaoCount = filteredEquipamentos.filter((e) => norm(e.status || "").includes("manut")).length;
    const baixadosCount = filteredEquipamentos.filter((e) => norm(e.status || "").includes("baixado")).length;
    const colAtivosCount = colaboradores.filter((c) => c.ativo !== false).length;

    const byType: Record<string, number> = {};
    equipamentos.forEach((e) => { // Using raw list for filter options
      const t = e.tipoEquipamento || "Outros";
      byType[t] = (byType[t] || 0) + 1;
    });
    const typesData = Object.keys(byType).sort();
    
    // Recalculate top types based on filtered list
    const filteredByType: Record<string, number> = {};
    filteredEquipamentos.forEach((e) => {
      const t = e.tipoEquipamento || "Outros";
      filteredByType[t] = (filteredByType[t] || 0) + 1;
    });
    const topTypesData = Object.entries(filteredByType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxTypeValue = Math.max(...topTypesData.map((t) => t[1]), 1);

    const sectorsData = Array.from(new Set(colaboradores.map(c => c.departamento).filter(Boolean))).sort() as string[];
    const marcasData = Array.from(new Set(equipamentos.map(e => e.marca).filter(Boolean))).sort() as string[];

    const statusDistData = [
      { label: "Disponível", count: disponiveisCount, color: "bg-emerald-500", text: "text-emerald-600" },
      { label: "Em Uso", count: emUsoCount, color: "bg-blue-500", text: "text-blue-600" },
      { label: "Manutenção", count: manutencaoCount, color: "bg-amber-500", text: "text-amber-600" },
      { label: "Baixados", count: baixadosCount, color: "bg-red-400", text: "text-red-500" },
    ];

    const empresaCount = filteredEquipamentos.filter((e) => e.propriedade !== "usuario").length;
    const usuarioCount = filteredEquipamentos.filter((e) => e.propriedade === "usuario").length;
    const empresaValue = totalEq > 0 ? `${Math.round((empresaCount / totalEq) * 100)}%` : "-";
    const usuariosValue = totalEq > 0 ? `${Math.round((usuarioCount / totalEq) * 100)}%` : "-";

    // Dynamic BI Metrics - Real Health calculation (Synced with Diagnostics)
    const activeHealth = calculateGlobalHealthScore(filteredEquipamentos);
    const globalHealthScore = calculateGlobalHealthScore(equipamentos);
    
    // Stable network uptime (Real monitoring would come from an API/Table)
    const networkUptime = totalEq > 0 ? "100.0" : "0.0";

    const statsData = [
      { label: t("dashboard.total_items"), value: totalEq, color: "text-slate-900 dark:text-slate-100", icon: "fa-laptop" },
      { label: "Em Uso", value: emUsoCount, color: "text-blue-500", icon: "fa-user" },
      { label: "Disponíveis", value: disponiveisCount, color: "text-emerald-500", icon: "fa-circle-check" },
      { label: "Manutenção", value: manutencaoCount, color: "text-amber-500", icon: "fa-wrench" },
      { label: "Baixados", value: baixadosCount, color: "text-red-500", icon: "fa-ban" },
      { label: "Colaboradores Ativos", value: colAtivosCount, color: "text-indigo-500", icon: "fa-users" },
    ];

    const topBrands = Array.from(new Set(equipamentos.map(e => e.marca).filter(Boolean)))
      .map(marca => ({ 
        name: marca as string, 
        count: equipamentos.filter(e => e.marca === marca).length 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const topModels = Array.from(new Set(filteredEquipamentos.map(e => e.modelo).filter(Boolean)))
      .map(modelo => ({
        name: modelo as string,
        count: filteredEquipamentos.filter(e => e.modelo === modelo).length,
        tipo: filteredEquipamentos.find(e => e.modelo === modelo)?.tipoEquipamento
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const stockItems = filteredEquipamentos
      .filter(e => norm(e.status || "").includes("disp"))
      .slice(0, 20);

    const availabilityRate = totalEq > 0 ? Math.round((disponiveisCount / totalEq) * 100) : 0;
    const utilizationRate = totalEq > 0 ? Math.round((emUsoCount / totalEq) * 100) : 0;

    // Calculate Average Life Years based on purchase data
    const totalYears = filteredEquipamentos.reduce((acc, eq) => {
      const buyDate = eq.dataCompra ? new Date(eq.dataCompra) : new Date();
      const diffMs = Math.abs(new Date().getTime() - buyDate.getTime());
      const years = diffMs / (1000 * 60 * 60 * 24 * 365);
      return acc + (years > 0 ? years : 0.5); // Min 0.5y if new
    }, 0);
    const avgLifeYears = totalEq > 0 ? (totalYears / totalEq).toFixed(1) : "0";

    return {
      total: totalEq,
      emUso: emUsoCount,
      disponiveis: disponiveisCount,
      manutencao: manutencaoCount,
      baixados: baixadosCount,
      colAtivos: colAtivosCount,
      topTypes: topTypesData,
      maxType: maxTypeValue,
      statusDist: statusDistData,
      stats: statsData,
      empresaPct: empresaValue,
      usuariosPct: usuariosValue,
      utilizationRate,
      typesList: typesData,
      sectorsList: sectorsData,
      marcasList: marcasData,
      topBrands,
      topModels,
      stockItems,
      activeHealth,
      globalHealthScore,
      networkUptime,
      availabilityRate,
      avgLifeYears
    };
  }, [filteredEquipamentos, colaboradores, equipamentos, t]);

  if (!hasPermission("dashboard")) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <i className="fa-solid fa-lock text-red-500 text-3xl"></i>
        </div>
        <h1 className="text-2xl font-black text-strong mb-2 uppercase tracking-tight">Acesso Restrito</h1>
        <p className="text-muted text-sm max-w-md mb-8">
          Você não possui permissão para visualizar o Painel de Controle (Dashboard). 
          Entre em contato com o administrador para solicitar acesso.
        </p>
        <button 
          onClick={() => window.location.href = "/"}
          className="px-8 py-3 bg-surface border border-border-subtle rounded-xl text-[10px] font-black uppercase tracking-widest text-muted hover:shadow-nm-flat transition-all active:scale-95"
        >
          Voltar para o Início
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 bg-surface-soft rounded-2xl border border-border-subtle"></div>
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <div className="h-[600px] bg-surface-soft rounded-2xl border border-border-subtle"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-64 bg-surface-soft rounded-xl border border-border-subtle"></div>
              <div className="h-64 bg-surface-soft rounded-xl border border-border-subtle"></div>
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="h-96 bg-surface-soft rounded-xl border border-border-subtle"></div>
            <div className="h-64 bg-surface-soft rounded-xl border border-border-subtle"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-32 animate-in fade-in duration-700">
      {/* Header Area: No numbering */}
      <div className="space-y-6">
        {/* Filters Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 bg-surface border border-border-subtle p-4 rounded-3xl shadow-sm">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-subtle text-xs"></i>
              <input 
                type="text"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                placeholder="Pesquisar..."
                className="w-full h-11 bg-surface-soft border-none rounded-xl pl-10 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-brand/10 text-main placeholder-subtle shadow-nm-inset transition-all"
              />
            </div>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              className="h-11 bg-surface-soft border-none rounded-xl px-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-brand/10 text-main dark:[color-scheme:dark] shadow-nm-inset transition-all"
            >
              <option value="">Todos os Tipos</option>
              {typesList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select 
              value={filterSector} 
              onChange={(e) => setFilterSector(e.target.value)}
              className="h-11 bg-surface-soft border-none rounded-xl px-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-brand/10 text-main dark:[color-scheme:dark] shadow-nm-inset transition-all"
            >
              <option value="">Todos os Setores</option>
              {sectorsList.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select 
              value={filterMarca} 
              onChange={(e) => setFilterMarca(e.target.value)}
              className="h-11 bg-surface-soft border-none rounded-xl px-4 text-xs font-black uppercase tracking-widest outline-none focus:ring-4 focus:ring-brand/10 text-main dark:[color-scheme:dark] shadow-nm-inset transition-all"
            >
              <option value="">Todas as Marcas</option>
              {marcasList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <button 
            onClick={() => { setFilterType(""); setFilterSector(""); setFilterMarca(""); setFilterSearch(""); }}
            className="xl:w-auto h-11 px-8 bg-brand text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-nm-flat hover-nm-elevated hover:bg-brand-dark transition-all active:scale-95 border border-brand/20"
          >
            Limpar
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadDashboard}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Section 1 - Análise de Operação */}
      <section id="operacao" className="space-y-6 scroll-mt-24 pt-4">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-chart-line text-brand"></i>
          Seção 1 - Análise de Operação
        </h2>
        {/* Hero Analytics Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          <NeumorphicWidget 
            title="Consolidado de Operação"
            value={String(total)}
            percentage={activeHealth}
            percentageLabel="Score de Integridade Global"
            trendLabel={total > 0 ? "vs mês ant." : undefined}
            trend={undefined} 
            rings={[
              { percentage: total > 0 ? 100 : 0, color: "#3B5EFF" }, // Total (Blue)
              { percentage: total > 0 ? Math.round(((total - manutencao - baixados) / total) * 100) : 0, color: "#10b981" }, // Saudáveis (Green)
              { percentage: total > 0 ? Math.round((manutencao / total) * 100) : 0, color: "#f59e0b" } // Manutenção (Yellow)
            ]}
            labels={[
              { name: `Ativos Saudáveis (${total > 0 ? Math.round(((total - manutencao - baixados) / total) * 100) : 0}%)`, color: "bg-emerald-500" },
              { name: `Em Manutenção (${total > 0 ? Math.round((manutencao / total) * 100) : 0}%)`, color: "bg-amber-500" }
            ]}
            className="lg:col-span-1 h-full"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <BIWidget 
              title="Rede & Conectividade" 
              value={`${networkUptime}%`} 
              subtitle="Uptime de serviços críticos" 
              icon="fa-network-wired" 
              trend={undefined} 
              color="indigo"
              className="h-full"
            />
            <BIWidget 
              title="Prontidão de Estoque" 
              value={`${availabilityRate}%`} 
              subtitle="Prontos para alocação" 
              icon="fa-bolt" 
              trend={undefined} 
              color="violet"
              className="h-full"
            />
          </div>
        </div>

        {/* BI Widgets Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <BIWidget 
            title="Score de Integridade Global" 
            value={`${globalHealthScore}%`} 
            subtitle="Saúde técnica dos ativos" 
            icon="fa-heart-pulse" 
            trend={undefined} 
            color="emerald" 
          />
          <BIWidget 
            title="Ocupação Total" 
            value={`${utilizationRate}%`} 
            subtitle="Ativos atualmente alocados" 
            icon="fa-user-check" 
            trend={undefined} 
            color="blue" 
          />
          <BIWidget 
            title="Vida Útil Média" 
            value={`${avgLifeYears}a`} 
            subtitle="Anos de operação por ativo" 
            icon="fa-hourglass-half" 
            trend={undefined} 
            color="amber" 
          />
          <BIWidget 
            title="Ativos Corporativos" 
            value={empresaPct} 
            subtitle="Patrimônio direto da empresa" 
            icon="fa-building-shield" 
            color="indigo" 
          />
        </div>
      </section>

      {/* Section 2 - Mapeamento */}
      <section id="mapeamento" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-sitemap text-brand"></i>
          Seção 2 - Mapeamento
        </h2>
        
        <div className="grid grid-cols-12 gap-6">
          {/* Main MindMap (Full Width) */}
          <div className="col-span-12">
            <MindMap 
              equipamentos={filteredEquipamentos} 
              colaboradores={filteredColaboradores} 
              onAssetClick={handleOpenDetail}
            />
          </div>

          {/* SectorTypeBreakdown movido para Seção 4 (Giro de Estoque) a pedido */}
        </div>
      </section>


      {/* Section 4 - Distribuição & Marcas */}
      <section id="distribuicao" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-chart-pie text-brand"></i>
          Seção 3 - Distribuição & Marcas
        </h2>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            <SectorComparison equipamentos={filteredEquipamentos} colaboradores={colaboradores} />
          </div>

          {/* New Row: Share Marca & Share Setor */}
          {/* 
          <div className="col-span-12 lg:col-span-6">
            <NeumorphicContainer title="Market Share por Marca" icon="fa-industry" className="h-full">
              ...
            </NeumorphicContainer>
          </div>
          */}

          <div className="col-span-12 lg:col-span-6">
            <SectorShareChart equipamentos={filteredEquipamentos} colaboradores={colaboradores} />
          </div>

          {/* Tipos de Equipamento */}
          <div className="col-span-12 lg:col-span-6">
            <NeumorphicContainer title="Tipos de Equipamento" icon="fa-layer-group" className="h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                {topTypes.map(([tipo, count]) => (
                  <NeumorphicProgressBar
                    key={tipo}
                    label={tipo}
                    value={count}
                    percentage={(count / maxType) * 100}
                    color="bg-indigo-500"
                  />
                ))}
              </div>
            </NeumorphicContainer>
          </div>

          {/* Distribuição Geral por Marca (Abaixo do "Funil" de Tipos) */}
          <div className="col-span-12">
            <SectorTypeBreakdown 
              stats={sectorBrandStats} 
              selectedSector={filterSector} 
              onSelectType={setFilterMarca}
              selectedType={filterMarca}
              title={filterSector ? `Distribuição de Marcas: ${filterSector}` : 'Distribuição Geral por Marca'}
              icon="fa-industry"
            />
          </div>

        </div>
      </section>

      {/* Section 5 - Gestão de Pessoas */}
      <section id="pessoas" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-users text-brand"></i>
          Seção 5 - Gestão de Pessoas
        </h2>

        <div className="grid grid-cols-12 gap-6">
          {/* People KPIs */}
          <div className="col-span-12 lg:col-span-4">
            <NeumorphicContainer title="Métricas de Colaboradores" icon="fa-id-card" className="h-full">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Total", value: colAtivos, icon: "fa-users", color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/10" },
                  { 
                    label: "Com Disp.", 
                    value: `${Math.round((new Set(filteredEquipamentos.filter(e => e.colaboradorAtualID).map(e => e.colaboradorAtualID)).size / (colAtivos || 1)) * 100)}%`, 
                    icon: "fa-laptop-code", 
                    color: "text-emerald-600", 
                    bg: "bg-emerald-50 dark:bg-emerald-900/10" 
                  },
                  { label: "Média Itens", value: (total / (colAtivos || 1)).toFixed(1), icon: "fa-calculator", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/10" },
                  { label: "Setores", value: sectorsList.length, icon: "fa-building", color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/10" },
                ].map((kpi) => (
                  <div key={kpi.label} className={`${kpi.bg} p-4 rounded-2xl flex flex-col items-center justify-center text-center gap-1 border border-border-subtle`}>
                    <i className={`fa-solid ${kpi.icon} ${kpi.color} text-xs`}></i>
                    <span className="text-lg font-black text-strong">{kpi.value}</span>
                    <span className="text-[8px] font-black text-muted uppercase tracking-tighter">{kpi.label}</span>
                  </div>
                ))}
              </div>
            </NeumorphicContainer>
          </div>

          <div className="col-span-12 lg:col-span-8">
            <DevicesPerPersonChart equipamentos={equipamentos} colaboradores={colaboradores} />
          </div>

          {/* Direct Cloud (Colaboradores) - Full Width Row */}
          <div className="col-span-12">
            <NeumorphicContainer title="Direct Cloud (Colaboradores)" icon="fa-cloud" className="w-full">
              <div className="flex overflow-x-auto gap-6 py-4 px-2 custom-scrollbar scroll-smooth snap-x">
                {colaboradores.map((colab) => {
                  const initial = colab.nome.charAt(0).toUpperCase();
                  return (
                    <button 
                      key={colab.colaboradorID}
                      onClick={() => handleOpenColabDetail(colab)}
                      className="flex-shrink-0 flex flex-col items-center gap-3 group snap-start"
                    >
                      <div className="w-16 h-16 rounded-full bg-surface shadow-nm-flat group-hover:shadow-nm-inset flex items-center justify-center border-2 border-transparent group-hover:border-brand transition-all overflow-hidden relative p-0.5">
                         <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                           {colab.fotoColaborador ? (
                             <img src={colab.fotoColaborador} alt={colab.nome} className="w-full h-full object-cover" />
                           ) : (
                             <span className="text-2xl font-black text-brand">{initial}</span>
                           )}
                         </div>
                         <div className="absolute inset-0 bg-brand/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-main group-hover:text-brand transition-colors text-center w-20 truncate uppercase tracking-tighter">
                          {colab.nome.split(' ')[0]}
                        </span>
                        <span className="text-[8px] font-bold text-muted uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">
                          {colab.departamento || 'Geral'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </NeumorphicContainer>
          </div>
        </div>
      </section>

      {/* Section 5 - Giro de Estoque & Gestão */}
      <section id="inventario" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-boxes-stacked text-brand"></i>
          Seção 4 - Giro de Estoque & Gestão
        </h2>

        <div className="grid grid-cols-12 gap-6">
          {/* Main Inventory Table (12 cols expanded) */}
          <div className="col-span-12 xl:col-span-8">
            <NeumorphicContainer title="Últimas Entradas no Inventário" icon="fa-clock-rotate-left">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="text-muted font-extrabold text-[9px] uppercase tracking-[0.2em] border-b border-border-subtle">
                      <th className="py-4 px-4">Etiqueta</th>
                      <th className="py-4 px-4">Equipamento</th>
                      <th className="py-4 px-4">Série / Modelo</th>
                      <th className="py-4 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipamentos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-[10px] font-black uppercase text-muted">
                          Nenhum equipamento cadastrado ainda.
                        </td>
                      </tr>
                    ) : filteredEquipamentos.slice(0, 8).map((e, idx) => {
                      const sl = norm(e.status || '');
                      const badge = sl.includes("disp") ? "bg-emerald-500" : sl.includes("uso") ? "bg-blue-500" : sl.includes("manut") ? "bg-amber-500" : "bg-slate-500";
                      return (
                        <motion.tr 
                          key={e.etiquetaID}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          onClick={() => handleOpenDetail(e)}
                          className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/20 cursor-pointer transition-all group"
                        >
                          <td className="py-4 px-4">
                            <span className="text-[10px] font-black text-brand tabular-nums bg-surface px-2 py-1 rounded-md shadow-inner">
                              {e.etiquetaID}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-main">{e.tipoEquipamento}</span>
                              <span className="text-[9px] font-black text-muted uppercase tracking-tighter">{e.setor || 'Geral'}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex flex-col">
                              <span className="text-[10px] font-bold text-main">{e.marca}</span>
                              <span className="text-[10px] text-subtle truncate max-w-[120px]">{e.modelo}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className={`inline-flex items-center px-3 py-1 rounded-full ${badge} text-white text-[8px] font-black uppercase tracking-widest shadow-lg shadow-${badge.split('-')[1]}-500/20`}>
                              {e.status}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-center">
                <Link href="/equipamentos" className="text-[10px] font-black text-brand hover:text-brand-dark uppercase tracking-[0.2em] flex items-center gap-2 group transition-all">
                  Visualizar Inventário Completo
                  <i className="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
                </Link>
              </div>
            </NeumorphicContainer>
          </div>

          {/* Swap: Disponíveis em Estoque now here */}
          <div className="col-span-12 xl:col-span-4 h-full">
            <NeumorphicContainer title="Disponíveis em Estoque" icon="fa-box" className="h-full">
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-2 custom-scrollbar">
                {stockItems?.slice(0, 10).map((item: Equipamento) => (
                  <button 
                    key={item.etiquetaID} 
                    onClick={() => handleOpenDetail(item)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border-subtle hover:border-brand/30 transition-all group text-left"
                  >
                    <div className="w-8 h-8 shrink-0 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                      <i className="fa-solid fa-box text-[10px]"></i>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-strong truncate">{item.marca} {item.modelo}</span>
                      <span className="text-[8px] font-black text-muted uppercase tracking-tighter">ID: {item.etiquetaID}</span>
                    </div>
                  </button>
                ))}
              </div>
            </NeumorphicContainer>
          </div>
        </div>

        {/* New Operational Grid (Side-by-Side Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {/* Swap: Acesso Rápido por Fabricante now here */}
          <NeumorphicContainer title="Acesso Rápido por Fabricante" icon="fa-industry">
            <div className="grid grid-cols-2 gap-2">
              {topBrands?.map((brand) => {
                const isSelected = filterMarca === brand.name;
                return (
                  <button
                    key={brand.name}
                    onClick={() => setFilterMarca(isSelected ? "" : brand.name)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border border-border-subtle transition-all transform active:scale-95 ${
                      isSelected 
                        ? "bg-brand text-white shadow-inner" 
                        : "bg-[var(--nm-bg)] shadow-nm-flat-sm hover:shadow-nm-flat"
                    }`}
                  >
                    <span className="text-[9px] font-extrabold uppercase truncate max-w-[60px]">{brand.name}</span>
                    <span className={`text-[9px] font-black ${isSelected ? "text-white/80" : "text-brand"}`}>{brand.count}</span>
                  </button>
                );
              })}
            </div>
          </NeumorphicContainer>

          <NeumorphicContainer title="Top Modelos" icon="fa-microchip">
              <div className="grid grid-cols-1 gap-2">
              {topModels?.slice(0, 6).map((model) => (
                <button 
                  key={model.name} 
                  onClick={() => handleModelClick(model.name)}
                  className="w-full flex items-center justify-between p-2 rounded-xl bg-surface border border-border-subtle hover:bg-slate-50 transition-all group"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-[8px] font-black text-muted uppercase tracking-tighter truncate max-w-[80px]">{model.tipo}</span>
                    <span className="text-[10px] font-bold text-strong truncate max-w-[120px]">{model.name}</span>
                  </div>
                  <span className="text-[10px] font-black text-brand">{model.count}</span>
                </button>
              ))}
            </div>
          </NeumorphicContainer>
        </div>

        {/* Distribuição Geral movido da Seção 2 */}
        <div className="mt-6">
          <SectorFunnelChart 
            stats={sectorTypeStats} 
            selectedSector={filterSector} 
            onSelectType={handleCategoryClick}
            selectedType={filterType}
          />
        </div>
      </section>

      {/* Section 6 - Evolução & Crescimento */}
      <section id="evolucao" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-6 px-1">
          <i className="fa-solid fa-chart-line text-brand"></i>
          Seção 6 - Evolução & Crescimento do Inventário
        </h2>
        <div className="mt-4">
          <EvolutionCharts 
            totalGrowth={totalGrowth}
            sectorGrowth={sectorGrowth}
            sectors={equipmentSectorsList}
            types={typesList}
            selectedType={filterGrowthType}
            onTypeChange={setFilterGrowthType}
          />
        </div>
      </section>

      {/* Section 7 - Saúde Preditiva e Resumo Analytics */}
      <section id="predicao" className="space-y-6 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
        <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2 px-1">
          <i className="fa-solid fa-heart-pulse text-brand"></i>
          Seção 7 - Saúde Preditiva e Resumo Analytics
        </h2>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MaintenancePredictor equipamentos={filteredEquipamentos} />
            <NeumorphicContainer title="Resumo Analytics" icon="fa-circle-info" className="h-full">
              <div className="grid grid-cols-2 gap-6">
                {[
                  { label: "Taxa de Uso", value: total > 0 ? `${Math.round((emUso / total) * 100)}%` : "-", icon: "fa-percent", color: "text-blue-600", bg: "bg-blue-100/30" },
                  { label: "Taxa Disp.", value: total > 0 ? `${Math.round((disponiveis / total) * 100)}%` : "-", icon: "fa-check", color: "text-emerald-600", bg: "bg-emerald-100/30" },
                  { label: "Empresa", value: empresaPct, icon: "fa-building", color: "text-main", bg: "bg-surface-soft" },
                  { label: "Usuários", value: usuariosPct, icon: "fa-user-tag", color: "text-brand", bg: "bg-brand/5" },
                ].map((item) => (
                  <div key={item.label} className={`${item.bg} rounded-[1.5rem] p-4 flex flex-col items-center text-center gap-1 border border-border-subtle hover:scale-105 transition-all shadow-inner`}>
                    <i className={`fa-solid ${item.icon} ${item.color} text-sm`}></i>
                    <p className={`text-xl font-black ${item.color.includes('text-main') ? 'text-strong' : item.color}`}>{item.value}</p>
                    <p className="text-[9px] uppercase font-black text-muted tracking-tighter">{item.label}</p>
                  </div>
                ))}
              </div>
            </NeumorphicContainer>
          </div>
        </div>
      </section>

      {/* Support Components */}
      <AssetListModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={selectedCategoryName} 
        assets={modalAssets} 
        colaboradores={colaboradores}
        onAssetClick={handleOpenDetail}
        onColaboradorClick={handleOpenColabDetail}
      />

      <EquipamentoDetailSidebar 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        equipamento={selectedEq}
        onEdit={(eq) => { setIsSidebarOpen(false); handleOpenEditModal(eq); }}
        onRefresh={loadDashboard}
      />

      <EquipamentoModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        switches={equipamentos.filter((eq) => eq.tipoEquipamento?.toLowerCase().includes("switch"))}
        inventory={equipamentos}
        onSuccess={() => {
          setIsEditModalOpen(false);
          loadDashboard();
        }}
        equipamentoData={editingEquipamento || undefined}
      />

      <ColaboradorDetailSidebar 
        colaborador={selectedColab}
        isOpen={isColabSidebarOpen}
        onClose={() => setIsColabSidebarOpen(false)}
        onColaboradorUpdated={() => {
          loadDashboard();
        }}
      />

      {/* Floating Navigation Menu */}
      <AnimatePresence>
        {isNavMenuVisible ? (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            style={{ willChange: "transform, opacity" }}
            className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[95%] md:w-max px-4 md:px-8 py-4 rounded-[2.5rem] bg-brand shadow-2xl shadow-brand/20 flex items-center justify-around md:justify-center gap-2 md:gap-8 whitespace-nowrap"
          >
            {[
              { id: "operacao", icon: "fa-chart-line", label: "Operação" },
              { id: "mapeamento", icon: "fa-sitemap", label: "Mapa" },
              { id: "distribuicao", icon: "fa-chart-pie", label: "Distribuição" },
              { id: "inventario", icon: "fa-boxes-stacked", label: "Estoque" },
              { id: "pessoas", icon: "fa-users", label: "Pessoas" },
              { id: "evolucao", icon: "fa-chart-line", label: "Evolução" },
              { id: "predicao", icon: "fa-heart-pulse", label: "Saúde" },
            ].map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-white/80 hover:text-white transition-all group scale-95 md:scale-100"
              >
                <div className="w-8 h-8 md:w-5 md:h-5 flex items-center justify-center bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors shadow-inner">
                  <i className={`fa-solid ${section.icon} text-[10px] md:text-[10px]`}></i>
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest hidden md:block">
                  {section.label}
                </span>
              </a>
            ))}

            <div className="w-[1px] h-6 md:h-8 bg-white/20 mx-1 md:mx-2 shrink-0"></div>

            <button
              onClick={() => setIsNavMenuVisible(false)}
              className="w-10 h-10 md:w-8 md:h-8 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-rose-500 transition-all shadow-inner shrink-0"
              title="Fechar Menu"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </motion.div>
        ) : (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsNavMenuVisible(true)}
            className="fixed bottom-28 md:bottom-8 right-6 z-[80] w-12 h-12 rounded-full bg-indigo-600 shadow-2xl flex items-center justify-center text-white border border-white/20 hover:scale-110 transition-all"
            title="Mostrar Atalhos"
          >
            <i className="fa-solid fa-compass"></i>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
