"use client";

import { useMemo, useState, useEffect } from "react";
import { SmartAvatar } from "@/components/ui/SmartAvatar";
import { useToast } from "@/contexts/ToastContext";
import InvestimentosService, { InvestimentoRelatorio } from "@/services/investimentos.service";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { SlidebarPanel, SlidebarHeader, SlidebarFooter } from "@/components/layout/SlidebarPanel";
import { BIWidget } from "@/components/dashboard/BIWidget";
import { NeumorphicWidget } from "@/components/dashboard/NeumorphicWidget";
import { NeumorphicDonut, NeumorphicMultiDonut, NeumorphicMultiDonutSegment, NeumorphicContainer, NeumorphicBar, NeumorphicAreaChart } from "@/components/dashboard/NeumorphicCharts";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

type EquipRow = {
  etiquetaID: string;
  nome: string;
  categoria: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  usuario: string;
  setor: string;
  dataCompra: string;
  valorPago: number;
  status: string;
};

type PersonAgg = {
  nome: string;
  setor: string;
  qtdEquipamentos: number;
  valorTotal: number;
};

type SetorAgg = {
  setor: string;
  pessoas: Set<string>;
  qtdEquipamentos: number;
  valorTotal: number;
  porCategoria: Record<string, number>;
};

type ComparativoStatus = "valorizou" | "desvalorizou" | "estavel";

type ComparativoLinha = {
  loading: boolean;
  erro?: string;
  precoAtual?: number;
  precoAtualLabel?: string;
  diffAbs?: number;
  diffPct?: number;
  status?: ComparativoStatus;
  link?: string;
};

type OfertaMercado = {
  titulo: string;
  preco: string;
  preco_numerico?: number;
  loja?: string;
  link?: string;
  thumbnail?: string;
  entrega?: string;
};

type SortKey =
  | "etiquetaID"
  | "nome"
  | "categoria"
  | "marca"
  | "modelo"
  | "numeroSerie"
  | "usuario"
  | "setor"
  | "dataCompra"
  | "valorPago"
  | "status";

const CATEGORY_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const SECTION_LINKS = [
  { id: "resumo", label: "Resumo", icon: "fa-chart-pie" },
  { id: "categoria", label: "Categorias", icon: "fa-tags" },
  { id: "pessoa", label: "Pessoas", icon: "fa-user-tie" },
  { id: "setor", label: "Setores", icon: "fa-building" },
  { id: "timeline", label: "Timeline", icon: "fa-clock-rotate-left" },
  { id: "mercado", label: "Mercado", icon: "fa-shop" },
  { id: "inventario", label: "Inventário", icon: "fa-boxes-stacked" },
];

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(toNumber(value));
}

function normalizeLabel(value: unknown, fallback: string): string {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function parseOfferPrice(oferta: any): number | null {
  const num = Number(oferta?.preco_numerico);
  if (Number.isFinite(num) && num > 0) return num;

  const raw = String(oferta?.preco || "").replace(/[^\d,\.]/g, "").replace(".", "").replace(",", ".");
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return null;
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function buildDonutArcPath(
  centerX: number,
  centerY: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const x1 = centerX + outerR * Math.cos(startAngle);
  const y1 = centerY + outerR * Math.sin(startAngle);
  const x2 = centerX + outerR * Math.cos(endAngle);
  const y2 = centerY + outerR * Math.sin(endAngle);

  const x3 = centerX + innerR * Math.cos(endAngle);
  const y3 = centerY + innerR * Math.sin(endAngle);
  const x4 = centerX + innerR * Math.cos(startAngle);
  const y4 = centerY + innerR * Math.sin(startAngle);

  return [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

function ResumoCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="bg-[#f0f2f5] dark:bg-slate-900 p-6 rounded-[2rem] border border-white/5 flex items-center gap-5
      shadow-[10px_10px_20px_#d1d9e6,-10px_-10px_20px_#ffffff]
      dark:shadow-[8px_8px_16px_#020617,-8px_-8px_16px_#0f172a]
      hover:shadow-md transition-all group"
    >
      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner group-hover:scale-110 transition-transform">
        <i className={`fa-solid ${icon} text-xl`}></i>
      </div>
      <div className="space-y-0.5">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function ThSort({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`py-2 px-3 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 font-black uppercase tracking-wider text-[10px]"
      >
        {label}
        {sortKey === k ? <i className={`fa-solid ${sortDir === "asc" ? "fa-sort-up" : "fa-sort-down"}`}></i> : <i className="fa-solid fa-sort"></i>}
      </button>
    </th>
  );
}

export default function InvestimentosPage() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  const [data, setData] = useState<InvestimentoRelatorio | null>(null);
  const [setorFiltro, setSetorFiltro] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [usuarioFiltro, setUsuarioFiltro] = useState("");
  const [faixaValor, setFaixaValor] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isNavMenuVisible, setIsNavMenuVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    if (!mounted) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Sempre visível no topo da página
      if (currentScrollY < 100) {
        setIsNavMenuVisible(true);
      } 
      // Mostra ao rolar para cima significativamente (>10px)
      else if (currentScrollY < lastScrollY - 10) {
        setIsNavMenuVisible(true);
      }
      // Esconde ao rolar para baixo significativamente (>10px)
      else if (currentScrollY > lastScrollY + 10) {
        setIsNavMenuVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY, mounted]);

  // ... rest of constants
  const [selectedCategoria, setSelectedCategoria] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valorPago");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [comparativos, setComparativos] = useState<Record<string, ComparativoLinha>>({});
  const [comparandoTodos, setComparandoTodos] = useState(false);
  const [timelineCategoria, setTimelineCategoria] = useState("");
  const [comparativoSidebarOpen, setComparativoSidebarOpen] = useState(false);
  const [comparativoSidebarItem, setComparativoSidebarItem] = useState<EquipRow | null>(null);
  const [comparativoSidebarLoading, setComparativoSidebarLoading] = useState(false);
  const [comparativoSidebarError, setComparativoSidebarError] = useState("");
  const [comparativoSidebarOffers, setComparativoSidebarOffers] = useState<OfertaMercado[]>([]);
  const { hasPermission } = useAuth();
  const { success, error, info } = useToast();

  const canEdit = useMemo(() => hasPermission("investimentos", "edit"), [hasPermission]);

  const handleUnlock = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (pin.length < 4) {
      info("Informe o PIN de 4 ou mais dígitos");
      return;
    }
    try {
      setValidating(true);
      const ok = await InvestimentosService.validatePin(pin);
      if (ok) {
        setUnlocked(true);
        success("Acesso Liberado", "Relatórios financeiros carregados com sucesso.");
        await loadData();
      } else {
        error("PIN Incorreto", "O código inserido não é válido.");
      }
    } catch (err: any) {
      if (err?.status === 401) {
        error("Sessão Expirada", "Sua sessão expirou. Por favor, faça login novamente.");
        setTimeout(() => window.location.href = "/", 2000);
      } else {
        error("Erro de Conexão", "Não foi possível validar o PIN agora.");
      }
    } finally {
      setValidating(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const report = await InvestimentosService.getRelatorio();
      setData(report);
      setComparativos({});
    } catch (err) {
      error("Erro ao carregar dados de investimentos");
    } finally {
      setLoading(false);
    }
  };

  const equipamentos = useMemo<EquipRow[]>(() => {
    if (!data?.equipamentos) return [];
    return data.equipamentos.map((eq) => ({
      etiquetaID: normalizeLabel(eq.etiquetaID, "-"),
      nome: `${normalizeLabel(eq.tipoEquipamento, "Equipamento")} ${normalizeLabel(eq.marca, "")}`.trim(),
      categoria: normalizeLabel(eq.tipoEquipamento, "Outros"),
      marca: normalizeLabel(eq.marca, "-"),
      modelo: normalizeLabel(eq.modelo, "-"),
      numeroSerie: normalizeLabel(eq.notaFiscal, "-"),
      usuario: normalizeLabel(eq.pessoaNome, "Disponível (Estoque)"),
      setor: normalizeLabel(eq.setor, "---"),
      dataCompra: normalizeLabel(eq.dataCompra, ""),
      valorPago: toNumber(eq.custoAquisicao),
      status: normalizeLabel(eq.status, "-"),
    }));
  }, [data]);

  const categoriasDisponiveis = useMemo(() => {
    return Array.from(new Set(equipamentos.map((e) => e.categoria))).sort();
  }, [equipamentos]);

  const setoresDisponiveis = useMemo(() => {
    return Array.from(new Set(equipamentos.map((e) => e.setor))).sort();
  }, [equipamentos]);

  const usuariosDisponiveis = useMemo(() => {
    return Array.from(new Set(equipamentos.map((e) => e.usuario))).sort();
  }, [equipamentos]);

  const equipamentosFiltrados = useMemo(() => {
    return equipamentos.filter((e) => {
      if (setorFiltro && e.setor !== setorFiltro) return false;
      if (categoriaFiltro && e.categoria !== categoriaFiltro) return false;
      if (usuarioFiltro && e.usuario !== usuarioFiltro) return false;

      if (faixaValor === "ate1000" && e.valorPago > 1000) return false;
      if (faixaValor === "1000a3000" && (e.valorPago < 1000 || e.valorPago > 3000)) return false;
      if (faixaValor === "3000a7000" && (e.valorPago < 3000 || e.valorPago > 7000)) return false;
      if (faixaValor === "acima7000" && e.valorPago < 7000) return false;
 
      if (dateFrom || dateTo) {
        const d = new Date(e.dataCompra);
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo) {
          const dTo = new Date(dateTo);
          dTo.setHours(23, 59, 59, 999);
          if (d > dTo) return false;
        }
      }

      if (search) {
        const haystack = [
          e.etiquetaID,
          e.nome,
          e.categoria,
          e.marca,
          e.modelo,
          e.usuario,
          e.setor,
          e.status,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }

      return true;
    });
  }, [equipamentos, setorFiltro, categoriaFiltro, usuarioFiltro, faixaValor, search]);

  const categoriaAgg = useMemo(() => {
    const map = new Map<string, { categoria: string; valor: number; itens: EquipRow[] }>();
    for (const eq of equipamentosFiltrados) {
      const current = map.get(eq.categoria) || { categoria: eq.categoria, valor: 0, itens: [] };
      current.valor += eq.valorPago;
      current.itens.push(eq);
      map.set(eq.categoria, current);
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [equipamentosFiltrados]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleAction = (e: any) => {
      if (e.detail?.path === "/investimentos") {
        loadData();
      }
    };
    window.addEventListener("PAGE_ACTION_CLICKED", handleAction);
    return () => window.removeEventListener("PAGE_ACTION_CLICKED", handleAction);
  }, [canEdit]);

  useEffect(() => {
    if (!selectedCategoria && categoriaAgg.length > 0) {
      setSelectedCategoria(categoriaAgg[0].categoria);
      return;
    }
    if (selectedCategoria && !categoriaAgg.some((c) => c.categoria === selectedCategoria)) {
      setSelectedCategoria(categoriaAgg[0]?.categoria || "");
    }
  }, [categoriaAgg, selectedCategoria]);

  const pessoaAgg = useMemo<PersonAgg[]>(() => {
    const map = new Map<string, PersonAgg>();
    for (const eq of equipamentosFiltrados) {
      const key = `${eq.usuario}::${eq.setor}`;
      const current = map.get(key) || {
        nome: eq.usuario,
        setor: eq.setor,
        qtdEquipamentos: 0,
        valorTotal: 0,
      };
      current.qtdEquipamentos += 1;
      current.valorTotal += eq.valorPago;
      map.set(key, current);
    }
    return Array.from(map.values())
      .filter((p) => p.nome !== "Disponível (Estoque)")
      .sort((a, b) => b.valorTotal - a.valorTotal);
  }, [equipamentosFiltrados]);

  const setorAgg = useMemo(() => {
    const map = new Map<string, SetorAgg>();
    for (const eq of equipamentosFiltrados) {
      const current =
        map.get(eq.setor) || {
          setor: eq.setor,
          pessoas: new Set<string>(),
          qtdEquipamentos: 0,
          valorTotal: 0,
          porCategoria: {},
        };
      current.pessoas.add(eq.usuario);
      current.qtdEquipamentos += 1;
      current.valorTotal += eq.valorPago;
      current.porCategoria[eq.categoria] = (current.porCategoria[eq.categoria] || 0) + eq.valorPago;
      map.set(eq.setor, current);
    }
    return Array.from(map.values()).sort((a, b) => b.valorTotal - a.valorTotal);
  }, [equipamentosFiltrados]);

  const linhaTempoCompras = useMemo(() => {
    const map = new Map<string, number>();
    for (const eq of equipamentosFiltrados) {
      if (!eq.dataCompra) continue;
      if (timelineCategoria && eq.categoria !== timelineCategoria) continue;
      const d = new Date(eq.dataCompra);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + eq.valorPago);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, valor]) => ({ mes, valor }));
  }, [equipamentosFiltrados, timelineCategoria]);

  const linhaTempoEquipamentos = useMemo(() => {
    const map = new Map<string, number>();
    for (const eq of equipamentosFiltrados) {
      if (!eq.dataCompra) continue;
      if (timelineCategoria && eq.categoria !== timelineCategoria) continue;
      const d = new Date(eq.dataCompra);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([mes, qtd]) => ({ mes, qtd }));
  }, [equipamentosFiltrados, timelineCategoria]);

  const resumo = useMemo(() => {
    const totalEstoque = equipamentosFiltrados.reduce((acc, item) => acc + item.valorPago, 0);
    const totalEquip = equipamentosFiltrados.length;
    const totalCategorias = categoriaAgg.length;
    const topCategoria = categoriaAgg[0]?.categoria || "-";
    const topSetor = setorAgg[0]?.setor || "-";
    const topPessoa = pessoaAgg[0]?.nome || "-";
    const valorPorCategoria: Record<string, number> = {};
    categoriaAgg.forEach(cat => {
      valorPorCategoria[cat.categoria] = cat.valor;
    });

    const totalManutencao = equipamentosFiltrados.filter(e => e.status.toLowerCase().includes("manut")).length;
    const totalBaixados = equipamentosFiltrados.filter(e => e.status.toLowerCase().includes("baixado")).length;
    const totalSaudaveis = totalEquip - totalManutencao - totalBaixados;

    return {
      totalEstoque,
      totalEquip,
      totalCategorias,
      topCategoria,
      topSetor,
      topPessoa,
      valorPorCategoria,
      totalManutencao,
      totalSaudaveis,
      totalBaixados
    };
  }, [equipamentosFiltrados, categoriaAgg, setorAgg, pessoaAgg]);

  const selectedCategoriaItens = useMemo(() => {
    return categoriaAgg.find((c) => c.categoria === selectedCategoria)?.itens || [];
  }, [categoriaAgg, selectedCategoria]);

  const comparativoRows = useMemo(() => {
    return equipamentosFiltrados.map((item) => ({
      item,
      comparativo: comparativos[item.etiquetaID],
    }));
  }, [equipamentosFiltrados, comparativos]);

  const sortedInventario = useMemo(() => {
    const copy = [...equipamentosFiltrados];
    copy.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];

      const an = typeof va === "number" ? va : String(va || "").toLowerCase();
      const bn = typeof vb === "number" ? vb : String(vb || "").toLowerCase();

      if (an < bn) return sortDir === "asc" ? -1 : 1;
      if (an > bn) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [equipamentosFiltrados, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const getComparativoStatus = (diffPct: number): ComparativoStatus => {
    if (diffPct > 5) return "valorizou";
    if (diffPct < -5) return "desvalorizou";
    return "estavel";
  };

  const applyComparativoResult = (item: EquipRow, ofertasRaw: any[]) => {
    const id = item.etiquetaID;
    const best = (Array.isArray(ofertasRaw) ? ofertasRaw : [])
      .map((o) => ({ ...o, _valor: parseOfferPrice(o) }))
      .filter((o) => o._valor !== null)
      .sort((a, b) => Number(a._valor) - Number(b._valor))[0];

    if (!best || best._valor === null) {
      setComparativos((prev) => ({
        ...prev,
        [id]: { loading: false, erro: "Sem preço válido" },
      }));
      return;
    }

    const precoAtual = Number(best._valor);
    const diffAbs = precoAtual - item.valorPago;
    const diffPct = item.valorPago > 0 ? (diffAbs / item.valorPago) * 100 : 0;
    const status = getComparativoStatus(diffPct);

    setComparativos((prev) => ({
      ...prev,
      [id]: {
        loading: false,
        precoAtual,
        precoAtualLabel: formatCurrency(precoAtual),
        diffAbs,
        diffPct,
        status,
        link: String(best.link || ""),
      },
    }));
  };

  const compareOne = async (item: EquipRow) => {
    const id = item.etiquetaID;
    setComparativos((prev) => ({ ...prev, [id]: { loading: true } }));

    try {
      // Corrigir: pesquisar apenas por marca e modelo
      const query = `${item.marca} ${item.modelo}`.trim();
      const ofertas = await InvestimentosService.getComparativo(query);
      applyComparativoResult(item, Array.isArray(ofertas) ? ofertas : []);
    } catch {
      setComparativos((prev) => ({
        ...prev,
        [id]: { loading: false, erro: "Falha na busca" },
      }));
    }
  };

  const openComparativoSidebar = async (item: EquipRow) => {
    const id = item.etiquetaID;
    setComparativoSidebarItem(item);
    setComparativoSidebarOpen(true);
    setComparativoSidebarLoading(true);
    setComparativoSidebarError("");
    setComparativoSidebarOffers([]);
    setComparativos((prev) => ({ ...prev, [id]: { loading: true } }));

    try {
      // Corrigir: pesquisar apenas por marca e modelo
      const query = `${item.marca} ${item.modelo}`.trim();
      const ofertas = await InvestimentosService.getComparativo(query);
      const normalized = (Array.isArray(ofertas) ? ofertas : []) as OfertaMercado[];
      setComparativoSidebarOffers(normalized);
      applyComparativoResult(item, normalized);
    } catch {
      setComparativoSidebarError("Não foi possível carregar opções de mercado para este item.");
      setComparativos((prev) => ({
        ...prev,
        [id]: { loading: false, erro: "Falha na busca" },
      }));
    } finally {
      setComparativoSidebarLoading(false);
    }
  };

  const compareAll = async () => {
    const list = [...equipamentosFiltrados];
    if (list.length === 0) {
      info("Nenhum equipamento para comparar");
      return;
    }

    setComparandoTodos(true);
    try {
      for (const item of list) {
        await compareOne(item);
      }
      success("Comparação concluída", `${list.length} itens processados.`);
    } finally {
      setComparandoTodos(false);
    }
  };

  const exportCsv = () => {
    if (sortedInventario.length === 0) {
      info("Sem dados para exportar");
      return;
    }

    const header = [
      "ID",
      "Nome",
      "Categoria",
      "Marca",
      "Modelo",
      "Nº Série",
      "Usuário",
      "Setor",
      "Data de compra",
      "Valor pago",
      "Status",
    ];

    const rows = sortedInventario.map((r) => [
      r.etiquetaID,
      r.nome,
      r.categoria,
      r.marca,
      r.modelo,
      r.numeroSerie,
      r.usuario,
      r.setor,
      r.dataCompra || "-",
      String(r.valorPago).replace(".", ","),
      r.status,
    ]);

    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `investimentos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxCategoriaValor = Math.max(...categoriaAgg.map((c) => c.valor), 1);
  const maxPessoaValor = Math.max(...pessoaAgg.map((p) => p.valorTotal), 1);
  const maxSetorValor = Math.max(...setorAgg.map((s) => s.valorTotal), 1);
  const maxTimelineValor = Math.max(...linhaTempoCompras.map((t) => t.valor), 1);

  const donutArcs = useMemo(() => {
    const total = resumo.totalEstoque || 1;
    let start = -Math.PI / 2;
    return categoriaAgg.map((cat, idx) => {
      const ratio = cat.valor / total;
      const end = start + ratio * Math.PI * 2;
      const path = buildDonutArcPath(120, 120, 100, 58, start, end);
      const arc = {
        categoria: cat.categoria,
        path,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        valor: cat.valor,
      };
      start = end;
      return arc;
    });
  }, [categoriaAgg, resumo.totalEstoque]);

  const timelinePoints = useMemo(() => {
    if (linhaTempoCompras.length === 0) return "";
    const width = 900;
    const height = 240;
    const padX = 36;
    const padY = 20;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;

    return linhaTempoCompras
      .map((point, index) => {
        const x = padX + (index / Math.max(1, linhaTempoCompras.length - 1)) * innerW;
        const y = padY + innerH - (point.valor / maxTimelineValor) * innerH;
        return `${x},${y}`;
      })
      .join(" ");
  }, [linhaTempoCompras, maxTimelineValor]);

  const top5Pessoas = pessoaAgg.slice(0, 5);

  if (!mounted) return null;

  if (!unlocked) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl shadow-indigo-500/10 border border-slate-100 dark:border-slate-800 p-8 text-center"
        >
          <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-lock text-2xl text-indigo-600 dark:text-indigo-400"></i>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Área Restrita</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Insira o PIN de segurança para acessar os relatórios financeiros e de investimentos.
          </p>

          <form onSubmit={handleUnlock} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="······"
                className="w-full h-16 text-center text-3xl tracking-[1em] rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700"
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={validating}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
            >
              {validating ? (
                <i className="fa-solid fa-circle-notch animate-spin"></i>
              ) : (
                <>
                  <i className="fa-solid fa-unlock text-sm"></i>
                  Desbloquear Acesso
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-400 dark:text-slate-500">
            O PIN padrão do sistema é <span className="font-mono font-bold text-indigo-500">123456</span>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto">

      <AnimatePresence>
        {isNavMenuVisible ? (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-28 md:bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[95%] md:w-max px-4 md:px-8 py-4 rounded-[2.5rem] bg-brand/95 backdrop-blur-md shadow-2xl shadow-brand/20 flex items-center justify-around md:justify-center gap-2 md:gap-6 whitespace-nowrap"
          >
            {SECTION_LINKS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-white/70 hover:text-white transition-all group scale-90 md:scale-100 min-w-0"
              >
                <div className="w-8 h-8 md:w-5 md:h-5 flex items-center justify-center bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors shrink-0 shadow-inner">
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
            className="fixed bottom-28 md:bottom-8 right-6 z-[100] w-12 h-12 rounded-full bg-brand shadow-2xl shadow-brand/20 flex items-center justify-center text-white border border-white/20 hover:scale-110 transition-all"
            title="Mostrar Atalhos"
          >
            <i className="fa-solid fa-compass"></i>
          </motion.button>
        )}
      </AnimatePresence>

      <div className="bg-surface shadow-nm-flat rounded-[2.5rem] p-4 lg:p-6 border border-border-subtle">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Menu Global de Filtros</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUnlocked(false)}
              className="px-4 py-2 rounded-xl bg-surface shadow-nm-flat text-muted font-black text-[10px] uppercase tracking-widest hover:shadow-nm-inset transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-lock text-rose-500/70"></i>
              Bloquear
            </button>
            <button
              onClick={loadData}
              className="px-4 py-2 rounded-xl bg-brand text-white font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-brand/20 flex items-center gap-2"
            >
              <i className="fa-solid fa-rotate"></i>
              Atualizar
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <select
            value={setorFiltro}
            onChange={(e) => setSetorFiltro(e.target.value)}
            title="Filtrar por setor"
            aria-label="Filtrar por setor"
            className="h-11 rounded-xl bg-surface-soft shadow-nm-inset border-none px-4 text-sm font-bold text-strong outline-none focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-muted/50"
          >
            <option value="">Todos os setores</option>
            {setoresDisponiveis.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            title="Filtrar por categoria"
            aria-label="Filtrar por categoria"
            className="h-11 rounded-xl bg-surface-soft shadow-nm-inset border-none px-4 text-sm font-bold text-strong outline-none focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-muted/50"
          >
            <option value="">Todas as categorias</option>
            {categoriasDisponiveis.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={usuarioFiltro}
            onChange={(e) => setUsuarioFiltro(e.target.value)}
            title="Filtrar por usuário"
            aria-label="Filtrar por usuário"
            className="h-11 rounded-xl bg-surface-soft shadow-nm-inset border-none px-4 text-sm font-bold text-strong outline-none focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-muted/50"
          >
            <option value="">Todos os usuários</option>
            {usuariosDisponiveis.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <select
            value={faixaValor}
            onChange={(e) => setFaixaValor(e.target.value)}
            title="Filtrar por faixa de valor"
            aria-label="Filtrar por faixa de valor"
            className="h-11 rounded-xl bg-surface-soft shadow-nm-inset border-none px-4 text-sm font-bold text-strong outline-none focus:ring-2 focus:ring-brand/20 transition-all placeholder:text-muted/50"
          >
            <option value="all">Todas as faixas</option>
            <option value="ate1000">Até R$ 1.000</option>
            <option value="1000a3000">R$ 1.000 a R$ 3.000</option>
            <option value="3000a7000">R$ 3.000 a R$ 7.000</option>
            <option value="acima7000">Acima de R$ 7.000</option>
          </select>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca livre"
            className="h-11 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 text-sm font-semibold"
          />

          <button
            onClick={() => {
              setSetorFiltro("");
              setCategoriaFiltro("");
              setUsuarioFiltro("");
              setFaixaValor("all");
              setSearch("");
            }}
            className="h-11 rounded-xl bg-surface shadow-nm-flat text-brand font-black text-[10px] uppercase tracking-widest hover:shadow-nm-inset transition-all"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[50vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Processando dados financeiros...</p>
          </div>
        </div>
      ) : (
        <div id="resumo" className="space-y-8 pb-20 scroll-mt-24">
          <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-6">
            <i className="fa-solid fa-chart-line text-brand"></i>
            Seção 1 - Resumo Geral do Patrimônio
          </h2>
          {/* Main summary cards */}
          {/* Main summary cards */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8 items-stretch">
            {/* Coluna da Esquerda: Gráficos com Altura Assimétrica */}
            <div className="lg:col-span-2 grid grid-rows-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6">
              {(() => {
                const saudavelPct = resumo.totalEquip > 0 ? Math.round((resumo.totalSaudaveis / resumo.totalEquip) * 100) : 0;
                const manutencaoPct = resumo.totalEquip > 0 ? Math.round((resumo.totalManutencao / resumo.totalEquip) * 100) : 0;
                
                return (
                  <NeumorphicWidget
                    title="Patrimônio Total Bruto"
                    value={formatCurrency(resumo.totalEstoque)}
                    numericValue={toNumber(resumo.totalEstoque)}
                    percentage={resumo.totalEquip > 0 ? 100 : 0}
                    trend={undefined}
                    rings={[
                      { percentage: resumo.totalEquip > 0 ? 100 : 0, color: "#3B5EFF" },
                      { percentage: saudavelPct, color: "#10b981" },
                      { percentage: manutencaoPct, color: "#f59e0b" }
                    ]}
                    labels={[
                      { name: `Inv. Saudável (${saudavelPct}%)`, color: "bg-emerald-500" },
                      { name: `Manutenção (${manutencaoPct}%)`, color: "bg-amber-500" }
                    ]}
                    className="h-full"
                  />
                );
              })()}

              <NeumorphicContainer title="Composição por Categoria" icon="fa-chart-pie" className="h-full">
                <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 gap-12 h-full">
                  <div className="shrink-0 relative">
                    <div className="absolute inset-0 bg-brand/10 blur-[40px] rounded-full"></div>
                    <NeumorphicMultiDonut
                      segments={categoriaAgg.slice(0, 10).map((cat, idx) => ({
                        label: cat.categoria,
                        value: cat.valor,
                        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                      }))}
                      size={200}
                      strokeWidth={20}
                      showCenterPercentage={true}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 flex-1">
                    {categoriaAgg.slice(0, 8).map((cat, idx) => (
                      <div key={cat.categoria} className="flex items-center gap-2 group">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest truncate group-hover:text-brand transition-colors leading-none">{cat.categoria}</span>
                            <span className="text-[11px] font-black text-strong">{Math.round((cat.valor/resumo.totalEstoque)*100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </NeumorphicContainer>
            </div>

            {/* Coluna da Direita: KPIs Uniformes */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-rows-2 gap-6">
              <BIWidget
                title="Ativos no Inventário"
                value={resumo.totalEquip}
                subtitle="Equipamentos totais"
                icon="fa-laptop-code"
                color="blue"
              />
              <BIWidget
                title="Ticket Médio"
                value={formatCurrency(resumo.totalEstoque / (resumo.totalEquip || 1))}
                subtitle="Valor por unidade"
                icon="fa-tag"
                color="emerald"
              />
              <BIWidget
                title="Categorias"
                value={resumo.totalCategorias}
                subtitle="Tipos ativos"
                icon="fa-layer-group"
                color="violet"
              />
              <BIWidget
                title="Top Investidor"
                value={resumo.topPessoa || "-"}
                subtitle="Líder alocações"
                icon="fa-user-tie"
                color="amber"
              />
            </div>
          </div>

          {/* Detailed Summary Cards */}
          <NeumorphicContainer title="Painel de Resumo Financeiro" icon="fa-money-bill-trend-up">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <ResumoCard title="Valor total do estoque" value={formatCurrency(resumo.totalEstoque)} icon="fa-money-bill-trend-up" />
              <ResumoCard title="Número de equipamentos" value={String(resumo.totalEquip)} icon="fa-laptop" />
              <ResumoCard title="Quantidade de categorias" value={String(resumo.totalCategorias)} icon="fa-layer-group" />
              <ResumoCard title="Categoria de Maior Valor" value={resumo.topCategoria} icon="fa-crown" />
              <ResumoCard title="Maior Gasto por Setor" value={resumo.topSetor} icon="fa-building" />
              <ResumoCard title="Maior Gasto por Pessoa" value={resumo.topPessoa} icon="fa-user-tie" />
            </div>
          </NeumorphicContainer>

          {/* Distribution Section - Stacked vertically */}
          <div id="categoria" className="flex flex-col gap-8 scroll-mt-24 pt-10 border-t border-slate-100 dark:border-slate-800/30">
            <h2 className="text-xl font-black text-strong flex items-center gap-3 mb-2">
              <i className="fa-solid fa-tags text-brand"></i>
              Seção 2 - Distribuição por Categoria
            </h2>
            <NeumorphicContainer title="Top 10 Categorias (R$)" icon="fa-chart-bar">
              <div className="space-y-6 py-2">
                {categoriaAgg.slice(0, 10).map((cat, idx) => (
                  <NeumorphicBar
                    key={cat.categoria}
                    label={cat.categoria}
                    value={formatCurrency(cat.valor)}
                    percentage={(cat.valor / (maxCategoriaValor || 1)) * 100}
                    color={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                  />
                ))}
              </div>
            </NeumorphicContainer>

            <NeumorphicContainer title="Distribuição por Categoria" icon="fa-layer-group">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex flex-col items-center justify-center p-6 rounded-3xl bg-white/40 dark:bg-slate-800/20 shadow-inner shrink-0 scale-90">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6 text-center">Participação no Valor Total</h3>
                  <NeumorphicDonut
                    percentage={100}
                    label="Share Total"
                    size={200}
                    color="#3B5EFF"
                  />
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pr-2 custom-scrollbar">
                  {categoriaAgg.map((cat, idx) => {
                    const isSelected = selectedCategoria === cat.categoria;
                    return (
                      <button
                        key={cat.categoria}
                        onClick={() => setSelectedCategoria(isSelected ? "" : cat.categoria)}
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all border border-white/5
                          ${isSelected
                            ? "bg-indigo-600 text-white shadow-lg scale-[1.02]"
                            : "bg-[#f0f2f5] dark:bg-slate-900 shadow-[4px_4px_8px_#d1d9e6,-4px_-4px_8px_#ffffff] dark:shadow-[4px_4px_8px_#020617,-4px_-4px_8px_#0f172a]"
                          }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 scale-90">
                            <NeumorphicDonut 
                              percentage={Math.round(pct(cat.valor, (resumo.totalEstoque || 1)))} 
                              size={42} 
                              strokeWidth={5} 
                              color={isSelected ? (isDarkMode ? "white" : CATEGORY_COLORS[idx % CATEGORY_COLORS.length]) : CATEGORY_COLORS[idx % CATEGORY_COLORS.length]}
                              showPercentage={false}
                            />
                          </div>
                          <div className="text-left min-w-0">
                            <p className={`text-[10px] font-black uppercase tracking-tighter truncate ${isSelected ? "!text-white" : "text-slate-500 dark:text-slate-400"}`}>{cat.categoria}</p>
                            <p className={`text-sm font-black truncate ${isSelected ? "!text-white" : "text-slate-800 dark:text-slate-100"}`}>{formatCurrency(cat.valor)}</p>
                          </div>
                        </div>
                        <span className={`text-lg font-black shrink-0 ${isSelected ? "!text-white" : "text-indigo-700 dark:text-indigo-400"}`}>
                          {Math.round(pct(cat.valor, (resumo.totalEstoque || 1)))}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </NeumorphicContainer>
          </div>

          {/* Detailed Sector Breakdown */}
          <NeumorphicContainer title={`Detalhamento: ${selectedCategoria || "Selecione uma categoria"}`} icon="fa-list-check">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-slate-400 font-black text-[9px] uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="py-4 px-4 text-left">ID</th>
                    <th className="py-4 px-4 text-left">Equipamento</th>
                    <th className="py-4 px-4 text-left">Usuário</th>
                    <th className="py-4 px-4 text-left">Setor</th>
                    <th className="py-4 px-4 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {selectedCategoriaItens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-[10px] font-black uppercase text-slate-400">Sem itens para exibir</td>
                    </tr>
                  ) : selectedCategoriaItens.slice(0, 15).map((e) => (
                    <tr key={e.etiquetaID} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-[10px] font-black text-indigo-600">{e.etiquetaID}</td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-200 text-xs">{e.nome}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-500">{e.usuario}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-500">{e.setor}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900 dark:text-white text-xs">{formatCurrency(e.valorPago)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </NeumorphicContainer>

          <section id="setor" className="space-y-6 pt-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <i className="fa-solid fa-building text-indigo-500"></i>
              Seção 3 - Análise por Setor
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <NeumorphicContainer title="Distribuição de Valor (%)" icon="fa-chart-pie" className="h-full">
                  <div className="flex flex-col items-center justify-center h-full py-6">
                    <NeumorphicMultiDonut 
                      segments={setorAgg.map((s, idx) => ({
                        label: s.setor,
                        value: s.valorTotal,
                        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                      }))}
                      size={180}
                      strokeWidth={18}
                      showCenterPercentage
                    />
                    <div className="w-full mt-8 space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                       {setorAgg.map((s, idx) => (
                         <div key={s.setor} className="flex items-center justify-between p-2 rounded-xl bg-surface-soft border border-border-subtle">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></div>
                             <span className="text-[10px] font-black text-strong uppercase">{s.setor}</span>
                           </div>
                           <span className="text-[10px] font-black text-brand">{Math.round((s.valorTotal / (resumo.totalEstoque || 1)) * 100)}%</span>
                         </div>
                       ))}
                    </div>
                  </div>
                </NeumorphicContainer>
              </div>

              <div className="lg:col-span-8">
                <NeumorphicContainer title="Comparação entre setores por consumo de recursos" icon="fa-chart-simple" className="h-full">
                  <div className="space-y-6 pt-2">
                    {setorAgg.slice(0, 15).map((s) => (
                      <NeumorphicBar
                        key={s.setor}
                        label={s.setor}
                        value={formatCurrency(s.valorTotal)}
                        percentage={(s.valorTotal / maxSetorValor) * 100}
                        color="#0ea5e9"
                      />
                    ))}
                  </div>
                </NeumorphicContainer>
              </div>
            </div>
          </section>

          <section id="pessoa" className="space-y-6 pt-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <i className="fa-solid fa-users text-indigo-500"></i>
              Seção 4 - Análise por Pessoa/Usuário
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              {top5Pessoas.map((p, idx) => (
                <div key={`${p.nome}-${p.setor}`}
                  className="bg-[#f0f2f5] dark:bg-slate-900 p-4 rounded-3xl border border-white/5
                    shadow-[10px_10px_25px_#d1d9e6,-10px_-10px_25px_#ffffff]
                    dark:shadow-[8px_8px_16px_#020617,-8px_-8px_16px_#0f172a]"
                >
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TOP {idx + 1}</p>
                  <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{p.nome}</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase truncate">{p.setor}</p>
                  <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-2">{formatCurrency(p.valorTotal)}</p>
                </div>
              ))}
            </div>

            <NeumorphicContainer title="Custo total por pessoa" icon="fa-chart-bar">
              <div className="space-y-6 pt-2">
                {pessoaAgg.slice(0, 15).map((p) => (
                  <NeumorphicBar
                    key={`${p.nome}-${p.setor}`}
                    label={p.nome}
                    subLabel={p.setor}
                    value={formatCurrency(p.valorTotal)}
                    percentage={(p.valorTotal / maxPessoaValor) * 100}
                    color="#8b5cf6"
                  />
                ))}
              </div>
            </NeumorphicContainer>
          </section>

          <section id="timeline" className="space-y-6 pt-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                <i className="fa-solid fa-clock-rotate-left text-indigo-500"></i>
                Fase 5 - Evolução Temporal de Investimentos
              </h2>

              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Filtrar Timeline:</span>
                <select
                  value={timelineCategoria}
                  onChange={(e) => setTimelineCategoria(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs font-bold px-3 py-1.5 focus:ring-2 focus:ring-indigo-500/20 outline-none dark:[color-scheme:dark]"
                >
                  <option value="">Todos os Dispositivos</option>
                  {categoriasDisponiveis.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8">
              <NeumorphicContainer title="Investimento Mensal (R$)" icon="fa-chart-line">
                {linhaTempoCompras.length === 0 ? (
                  <div className="py-20 text-center">
                    <i className="fa-solid fa-calendar-xmark text-slate-300 text-3xl mb-3"></i>
                    <p className="text-[10px] font-black uppercase text-slate-400">Sem dados financeiros</p>
                  </div>
                ) : (
                  <div className="pt-4">
                    <NeumorphicAreaChart
                      data={linhaTempoCompras.map(t => ({
                        label: `${t.mes.slice(5)}/${t.mes.slice(2, 4)}`,
                        value: t.valor
                      }))}
                      color="#4f46e5"
                      height={280}
                    />
                    <div className="mt-6 flex items-center justify-between p-4 bg-white/40 dark:bg-slate-800/20 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Média Mensal</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white">
                          {formatCurrency(linhaTempoCompras.reduce((acc, t) => acc + t.valor, 0) / (linhaTempoCompras.length || 1))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Maior Pico</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                          {formatCurrency(Math.max(...linhaTempoCompras.map(t => t.valor)))}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </NeumorphicContainer>

              <NeumorphicContainer title="Equipamentos Adquiridos (Unidades)" icon="fa-laptop-medical">
                {linhaTempoEquipamentos.length === 0 ? (
                  <div className="py-20 text-center">
                    <i className="fa-solid fa-microchip text-slate-300 text-3xl mb-3"></i>
                    <p className="text-[10px] font-black uppercase text-slate-400">Sem histórico de compras</p>
                  </div>
                ) : (
                  <div className="pt-4">
                    <NeumorphicAreaChart
                      data={linhaTempoEquipamentos.map(t => ({
                        label: `${t.mes.slice(5)}/${t.mes.slice(2, 4)}`,
                        value: t.qtd
                      }))}
                      color="#10b981"
                      height={280}
                      valuePrefix=""
                    />
                    <div className="mt-6 flex items-center justify-between p-4 bg-white/40 dark:bg-slate-800/20 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total de Ativos</p>
                        <p className="text-lg font-black text-slate-800 dark:text-white">{resumo.totalEquip} Un.</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1">Ritmo Mensal</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {Math.round(linhaTempoEquipamentos.reduce((acc, t) => acc + t.qtd, 0) / (linhaTempoEquipamentos.length || 1))} Itens/mês
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </NeumorphicContainer>
            </div>

          </section>

          <section id="mercado" className="space-y-6 pt-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <i className="fa-solid fa-store text-indigo-500"></i>
              Seção 6 - Comparativo de Mercado
            </h2>
            <NeumorphicContainer title="Comparação de preço atual (Google Shopping)" icon="fa-magnifying-glass-dollar">
              <div className="flex items-center justify-end mb-6">
                {canEdit && (
                  <button
                    onClick={compareAll}
                    disabled={comparandoTodos || sortedInventario.length === 0}
                    className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <i className={`fa-solid ${comparandoTodos ? "fa-circle-notch animate-spin" : "fa-magnifying-glass-chart"}`}></i>
                    Compare Tudo
                  </button>
                )}
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                      <th className="py-3 px-3 text-left">Equipamento</th>
                      <th className="py-3 px-3 text-left">Categoria</th>
                      <th className="py-3 px-3 text-left">Usuário</th>
                      <th className="py-3 px-3 text-right">Valor Pago</th>
                      <th className="py-3 px-3 text-right">Preço Mercado</th>
                      <th className="py-3 px-3 text-right">Diferença</th>
                      <th className="py-3 px-3 text-left">Status</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {comparativoRows.slice(0, 80).map(({ item, comparativo }) => {
                      const status = comparativo?.status;
                      const statusClass =
                        status === "valorizou"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                          : status === "desvalorizou"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300";

                      return (
                        <tr key={item.etiquetaID} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                          <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{item.nome}</td>
                          <td className="py-3 px-3 text-[10px] font-bold uppercase text-slate-500">{item.categoria}</td>
                          <td className="py-3 px-3 text-slate-500 font-medium">{item.usuario}</td>
                          <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">{formatCurrency(item.valorPago)}</td>
                          <td className="py-3 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">{comparativo?.precoAtualLabel || "-"}</td>
                          <td className="py-3 px-3 text-right">
                            {comparativo?.diffAbs !== undefined ? (
                              <span className="font-black text-slate-700 dark:text-slate-300">
                                {formatCurrency(comparativo.diffAbs)} ({Math.round(comparativo.diffPct || 0)}%)
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {status ? (
                              <span className={`text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest border border-white/10 ${statusClass} shadow-sm`}>
                                {status === "valorizou" ? "Valorizou" : status === "desvalorizou" ? "Desvalorizou" : "Estável"}
                              </span>
                            ) : comparativo?.erro ? (
                              <span className="text-[9px] text-red-500 font-black uppercase tracking-widest">{comparativo.erro}</span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {canEdit && (
                              <div className="flex justify-end gap-1">
                                {!comparativo?.precoAtual && !comparativo?.erro && (
                                  <button
                                    onClick={() => compareOne(item)}
                                    disabled={comparativo?.loading}
                                    title="Comparar com mercado"
                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all"
                                  >
                                    {comparativo?.loading ? (
                                      <i className="fa-solid fa-circle-notch animate-spin text-[10px]"></i>
                                    ) : (
                                      <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
                                    )}
                                  </button>
                                )}
                                <button
                                  onClick={() => openComparativoSidebar(item)}
                                  title="Ver detalhes de mercado"
                                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all"
                                >
                                  <i className="fa-solid fa-chart-line text-[10px]"></i>
                                </button>
                                {comparativo?.link && (
                                  <a
                                    href={comparativo.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 transition-all flex items-center justify-center"
                                    title="Ver na loja"
                                  >
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                                  </a>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </NeumorphicContainer>
          </section>

          <section id="inventario" className="space-y-6 pt-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <i className="fa-solid fa-box-archive text-indigo-500"></i>
              Seção 7 - Inventário Completo
            </h2>
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-900 p-4 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
                <div className="relative flex-1 min-w-[200px]">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input 
                    type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar inventário..."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 pl-12 pr-4 text-xs font-bold placeholder-slate-400 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl items-center gap-2 border border-slate-100 dark:border-slate-800">
                  <i className="fa-solid fa-calendar-days text-[10px] text-slate-400 ml-2"></i>
                  <input 
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                    title="Data inicial"
                  />
                  <span className="text-[10px] text-slate-400 font-black opacity-30">→</span>
                  <input 
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest p-0 focus:ring-0 w-24 text-slate-700 dark:text-slate-200 dark:[color-scheme:dark]"
                    title="Data final"
                  />
                </div>

                <select 
                  value={setorFiltro} onChange={(e) => setSetorFiltro(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 px-4 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:[color-scheme:dark]"
                >
                  <option value="">Setor</option>
                  {setoresDisponiveis.map(s => <option key={s} value={s}>{s}</option>)}
                </select>

                <select 
                  value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800/50 border-none rounded-xl py-2.5 px-4 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 dark:[color-scheme:dark]"
                >
                  <option value="">Categoria</option>
                  {categoriasDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                <button
                  onClick={exportCsv}
                  className="h-10 px-4 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-[9px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2"
                >
                  <i className="fa-solid fa-file-csv"></i>
                  CSV
                </button>
            </div>
            <NeumorphicContainer title="Tabela mestra com ordenação" icon="fa-table">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 font-black uppercase tracking-tighter border-b border-slate-100 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                      <ThSort label="ID" k="etiquetaID" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Nome" k="nome" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Categoria" k="categoria" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Marca" k="marca" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Modelo" k="modelo" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Data" k="dataCompra" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                      <ThSort label="Valor" k="valorPago" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} align="right" />
                      <ThSort label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {sortedInventario.map((e) => (
                      <tr key={e.etiquetaID} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-black text-indigo-500">{e.etiquetaID}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800 dark:text-white">{e.nome}</td>
                        <td className="py-3 px-3 text-[10px] font-bold uppercase text-slate-500">{e.categoria}</td>
                        <td className="py-3 px-3 text-slate-500">{e.marca}</td>
                        <td className="py-3 px-3 text-slate-500">{e.modelo}</td>
                        <td className="py-3 px-3 text-slate-500">{e.dataCompra ? new Date(e.dataCompra).toLocaleDateString("pt-BR") : "-"}</td>
                        <td className="py-3 px-3 text-right font-black text-slate-900 dark:text-white">{formatCurrency(e.valorPago)}</td>
                        <td className="py-3 px-3">
                           <span className="text-[9px] font-black uppercase tracking-widest text-muted bg-surface-soft border border-border-subtle px-3 py-1.5 rounded-xl shadow-sm">
                             {e.status}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </NeumorphicContainer>
          </section>
        </div>
      )}

      {/* Slidebar de Comparativo */}
      <SlidebarPanel
        isOpen={comparativoSidebarOpen}
        onClose={() => setComparativoSidebarOpen(false)}
        size="wide"
        panelClassName="bg-white dark:bg-slate-900 h-full w-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
      >
        <SlidebarHeader
          title="Opções de Comparação"
          subtitle={comparativoSidebarItem ? `${comparativoSidebarItem.marca} ${comparativoSidebarItem.modelo}` : "Comparativo de mercado"}
          iconClassName="fa-store"
          onClose={() => setComparativoSidebarOpen(false)}
          className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between"
          titleClassName="text-xl font-black text-slate-900 dark:text-white"
          subtitleClassName="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1"
        />

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {comparativoSidebarItem && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor pago</p>
              <p className="text-lg font-black text-slate-900 dark:text-slate-100">{formatCurrency(comparativoSidebarItem.valorPago)}</p>
            </div>
          )}

          {comparativoSidebarLoading ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fa-solid fa-spinner fa-spin text-xl"></i>
              <p className="text-xs font-bold mt-2">Buscando ofertas...</p>
            </div>
          ) : comparativoSidebarError ? (
            <div className="p-4 rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm font-semibold">
              {comparativoSidebarError}
            </div>
          ) : comparativoSidebarOffers.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <i className="fa-solid fa-store-slash text-2xl"></i>
              <p className="text-xs font-bold mt-2">Sem opções para este item.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {comparativoSidebarOffers.map((offer, idx) => {
                const ofertaValor = parseOfferPrice(offer);
                const valorPago = comparativoSidebarItem?.valorPago || 0;
                const diff = ofertaValor !== null ? ofertaValor - valorPago : null;
                const diffPct = ofertaValor !== null && valorPago > 0 ? (diff! / valorPago) * 100 : null;
                const status: ComparativoStatus | null = diffPct === null ? null : getComparativoStatus(diffPct);
                  const badgeClass =
                    status === "valorizou"
                      ? "bg-red-600 text-white"
                      : status === "desvalorizou"
                        ? "bg-emerald-600 text-white"
                        : "bg-amber-500 text-white";

                  const hasLink = offer.link && offer.link !== "#";

                return (
                  <a
                    key={`${offer.link || offer.titulo}-${idx}`}
                    href={hasLink ? offer.link : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex flex-col rounded-3xl border ${hasLink ? "border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 cursor-pointer" : "border-slate-100 dark:border-slate-800 opacity-60 cursor-default"} bg-white dark:bg-slate-800/40 overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-1`}
                  >
                    {/* Imagem Quadrada */}
                    <div className="aspect-square w-full bg-white dark:bg-slate-900 relative p-6 flex items-center justify-center border-b border-slate-100 dark:border-slate-800">
                      <SmartAvatar
                        src={offer.thumbnail}
                        name={offer.titulo || "Oferta"}
                        size="full"
                        type="item"
                        className="w-full h-full"
                      />
                      {status && diff !== null && diffPct !== null && (
                        <div className={`absolute top-4 right-4 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg border border-white/10 ${badgeClass}`}>
                           {status === "valorizou" ? "+" : ""}{Math.round(diffPct)}%
                        </div>
                      )}
                    </div>

                    {/* Conteúdo */}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex-1 space-y-2">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">
                          {(() => {
                            const lojasConhecidas = ["amazon", "magazineluiza", "magalu", "mercadolivre", "kabum", "pichau", "shopee", "shoppe", "casasbahia", "kalunga", "miranda", "aliexpress"];
                            const loja = (offer.loja || "").toLowerCase().replace(/\s/g, "");
                            const match = lojasConhecidas.find(l => loja.includes(l));
                            return match ? offer.loja : offer.loja || "Loja não informada";
                          })()}
                        </p>
                        <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 line-clamp-3 leading-tight min-h-[2.5rem]">
                          {offer.titulo || "Oferta de Ativo"}
                        </h4>
                        
                        <div className="pt-2 flex items-baseline justify-between gap-2">
                          <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                            {offer.preco || "-"}
                          </p>
                          {status && diff !== null && (
                             <p className={`text-[11px] font-bold ${status === "desvalorizou" ? "text-emerald-500" : "text-red-500"}`}>
                               {formatCurrency(diff)}
                             </p>
                          )}
                        </div>
                      </div>

                      {/* Botão Inferior */}
                      {hasLink ? (
                        <div className="mt-6 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 active:scale-95 group-hover:bg-indigo-500">
                          Ir à Loja
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                        </div>
                      ) : (
                        <div className="mt-6 w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center justify-center rounded-2xl cursor-not-allowed">
                          Link Indisponível
                        </div>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        <SlidebarFooter className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
          <button
            onClick={() => setComparativoSidebarOpen(false)}
            className="w-full h-10 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-black uppercase tracking-wider"
          >
            Fechar comparativo
          </button>
        </SlidebarFooter>
      </SlidebarPanel>
    </div>
  );
}
