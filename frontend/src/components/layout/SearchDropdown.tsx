"use client";

import { useMemo } from "react";
import { SearchResult } from "@/contexts/SearchContext";

interface Props {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
  onSelect: (r: SearchResult) => void;
  onClose: () => void;
}

const GROUPS: { tipo: SearchResult["tipo"]; label: string; icon: string; color: string }[] = [
  { tipo: "equipamento",  label: "EQUIPAMENTOS",  icon: "fa-laptop",         color: "text-cyan-600" },
  { tipo: "colaborador",  label: "COLABORADORES",  icon: "fa-user",           color: "text-emerald-600" },
  { tipo: "movimentacao", label: "MOVIMENTAÇÕES",  icon: "fa-arrows-rotate",  color: "text-orange-500" },
  { tipo: "solicitacao",  label: "SOLICITAÇÕES",   icon: "fa-clipboard-list", color: "text-amber-600" },
  { tipo: "rede",         label: "REDE",            icon: "fa-network-wired",  color: "text-indigo-600" },
];

export function SearchDropdown({ results, query, isSearching, onSelect }: Props) {
  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    results.forEach(r => {
      if (!map[r.tipo]) map[r.tipo] = [];
      map[r.tipo].push(r);
    });
    return map;
  }, [results]);

  const hasAny = results.length > 0;

  return (
    <div
      className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl shadow-2xl max-h-[480px] overflow-y-auto z-[1000] animate-in fade-in slide-in-from-top-2 duration-150
        bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10"
      onMouseDown={e => e.preventDefault()}
    >
      {/* Searching indicator */}
      {isSearching && (
        <div className="px-4 py-3 flex items-center gap-2 text-slate-400 text-sm border-b border-slate-100">
          <i className="fa-solid fa-spinner fa-spin text-blue-500 text-xs"></i>
          Buscando...
        </div>
      )}

      {/* No results */}
      {!isSearching && !hasAny && (
        <div className="flex flex-col items-center gap-2 py-10 text-slate-400 text-sm">
          <i className="fa-solid fa-magnifying-glass text-2xl opacity-30"></i>
          <p>Nenhum resultado para <span className="font-semibold text-slate-600">"{query}"</span></p>
          <p className="text-xs text-slate-300">Tente palavras-chave diferentes</p>
        </div>
      )}

      {/* Groups */}
      {GROUPS.map(g => {
        const items = grouped[g.tipo] || [];
        if (items.length === 0) return null;
        return (
          <div key={g.tipo}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-white/5 sticky top-0 backdrop-blur-md">
              <i className={`fa-solid ${g.icon} text-xs ${g.color}`}></i>
              <span className="text-xs font-bold tracking-widest text-slate-500 dark:text-slate-400">{g.label}</span>
              <span className="ml-auto text-xs font-bold text-slate-400 dark:text-slate-500">{items.length}</span>
            </div>

            {/* Results */}
            {items.map(r => (
              <button
                key={r.id}
                onClick={() => onSelect(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-600/10 transition-colors text-left group"
              >
                <span className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 flex items-center justify-center shrink-0 transition-colors">
                  <i className={`fa-solid ${r.icone} text-xs text-slate-500 group-hover:text-blue-600 dark:text-slate-400 dark:group-hover:text-blue-400`}></i>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-700 dark:group-hover:text-blue-400">{r.titulo}</p>
                  {r.subtitulo && <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{r.subtitulo}</p>}
                </div>
                <i className="fa-solid fa-arrow-right text-xs text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 shrink-0 transition-colors"></i>
              </button>
            ))}
          </div>
        );
      })}

      {/* Footer hint */}
      {hasAny && (
        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-slate-500">
          {results.length} resultado{results.length !== 1 ? "s" : ""} · pressione <kbd className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-xs">ESC</kbd> para fechar
        </div>
      )}
    </div>
  );
}
