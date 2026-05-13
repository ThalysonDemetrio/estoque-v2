"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { SlidebarPanel } from "@/components/layout/SlidebarPanel";

interface SpotlightResult {
  type: "equip" | "colab" | "nav";
  icon: string;
  title: string;
  subtitle?: string;
  href?: string;
  action?: () => void;
}

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: "fa-chart-line" },
  { label: "Painel Equipamentos", href: "/dashboard-equip", icon: "fa-chart-column" },
  { label: "Equipamentos", href: "/equipamentos", icon: "fa-laptop" },
  { label: "Colaboradores", href: "/colaboradores", icon: "fa-users" },
  { label: "Movimentações", href: "/movimentacoes", icon: "fa-arrows-rotate" },
  { label: "Rede", href: "/rede", icon: "fa-globe" },
  { label: "Solicitações", href: "/solicitacoes", icon: "fa-clipboard-list" },
  { label: "Investimentos", href: "/investimentos", icon: "fa-coins" },
  { label: "Calendário", href: "/calendario", icon: "fa-calendar-days" },
  { label: "Configurações", href: "/configuracoes", icon: "fa-gear" },
];

export function SpotlightSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);
  const [allEquip, setAllEquip] = useState<any[]>([]);
  const [allColab, setAllColab] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload data once when opened
  const preload = useCallback(async () => {
    if (allEquip.length > 0) return;
    try {
      const [eq, col] = await Promise.all([
        EquipamentosService.getEquipamentos(),
        ColaboradoresService.getColaboradores(),
      ]);
      setAllEquip(Array.isArray(eq) ? eq : []);
      setAllColab(Array.isArray(col) ? col : []);
    } catch {}
  }, [allEquip.length]);

  // Keyboard shortcut Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      preload(); // Preload when opened
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open, preload]);

  // Search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      // Show nav items when empty
      setResults(NAV_ITEMS.map(n => ({ type: "nav" as const, icon: n.icon, title: n.label, href: n.href })));
      setSelected(0);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const q = query.toLowerCase();

      const navResults: SpotlightResult[] = NAV_ITEMS
        .filter(n => n.label.toLowerCase().includes(q))
        .map(n => ({ type: "nav", icon: n.icon, title: n.label, href: n.href }));

      const equipResults: SpotlightResult[] = allEquip
        .filter(e => [e.etiquetaID, e.marca, e.modelo, e.tipoEquipamento, e.numeroSerie, e.localizacao].join(" ").toLowerCase().includes(q))
        .slice(0, 6)
        .map(e => ({
          type: "equip",
          icon: "fa-laptop",
          title: `${e.etiquetaID} — ${e.marca || ""} ${e.modelo || ""}`,
          subtitle: `${e.tipoEquipamento || ""} · ${e.status || ""}`,
          href: `/equipamentos?open=${e.etiquetaID}`,
        }));

      const colabResults: SpotlightResult[] = allColab
        .filter(c => [c.nome, c.email, c.departamento, c.cargo].join(" ").toLowerCase().includes(q))
        .slice(0, 4)
        .map(c => ({
          type: "colab",
          icon: "fa-user",
          title: c.nome,
          subtitle: `${c.departamento || ""} · ${c.cargo || ""}`,
          href: `/colaboradores?open=${c.colaboradorID}`,
        }));

      setResults([...navResults, ...equipResults, ...colabResults]);
      setSelected(0);
      setLoading(false);
    }, 150);
  }, [query, allEquip, allColab]);

  const execute = (result: SpotlightResult) => {
    setOpen(false);
    if (result.action) result.action();
    else if (result.href) router.push(result.href);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) execute(results[selected]);
    if (e.key === "Escape") setOpen(false);
  };

  const TYPE_COLORS: Record<string, string> = {
    nav:   "text-blue-500 bg-blue-50",
    equip: "text-purple-500 bg-purple-50",
    colab: "text-emerald-500 bg-emerald-50",
  };

  const TYPE_LABELS: Record<string, string> = {
    nav:   "Página",
    equip: "Equipamento",
    colab: "Colaborador",
  };

  if (!open) return null;

  return (
    <SlidebarPanel
      isOpen={open}
      className="z-[9999]"
      panelClassName="bg-white dark:bg-slate-900 h-full w-full shadow-2xl overflow-hidden flex flex-col border-l border-slate-200 dark:border-slate-800"
    >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <i className={`fa-solid fa-magnifying-glass text-slate-400 ${loading ? "fa-spin" : ""}`}></i>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pesquisar páginas, equipamentos, colaboradores..."
            className="flex-1 text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none text-sm bg-transparent"
          />
          <button onClick={() => setOpen(false)} title="Fechar pesquisa" aria-label="Fechar pesquisa" className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <kbd className="shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs px-2 py-1 rounded-md font-mono border border-slate-200 dark:border-slate-700">ESC</kbd>
        </div>

        {/* Results */}
        <ul className="flex-1 overflow-y-auto py-2">
          {results.length === 0 && query && (
            <li className="px-5 py-6 text-center text-slate-400 text-sm">
              <i className="fa-solid fa-search block mb-2 text-xl opacity-30"></i>
              Nenhum resultado para &quot;{query}&quot;
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={i}
              onClick={() => execute(r)}
              onMouseEnter={() => setSelected(i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${i === selected ? "bg-blue-50 dark:bg-blue-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLORS[r.type]} dark:bg-opacity-20`}>
                <i className={`fa-solid ${r.icon} text-xs`}></i>
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.title}</p>
                {r.subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.subtitle}</p>}
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">{TYPE_LABELS[r.type]}</span>
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-xs text-slate-400">
          <span><kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs">↑↓</kbd> navegar</span>
          <span><kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs">↵</kbd> abrir</span>
          <span className="ml-auto"><kbd className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded text-xs">Ctrl K</kbd> abrir/fechar</span>
        </div>
    </SlidebarPanel>
  );
}
