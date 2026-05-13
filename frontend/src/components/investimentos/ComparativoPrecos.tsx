"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import InvestimentosService from "@/services/investimentos.service";
import { useTheme } from "@/contexts/ThemeContext";

interface Oferta {
  titulo: string;
  preco: string;
  preco_numerico: number | null;
  loja: string;
  link: string;
  thumbnail?: string;
  avaliacao?: number;
  num_avaliacoes?: number;
  entrega?: string;
}

export function ComparativoPrecos() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [query, setQuery] = useState("");
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [showSugestoes, setShowSugestoes] = useState(false);

  useEffect(() => {
    InvestimentosService.getSugestoes().then(setSugestoes).catch(() => {});
  }, []);

  const handleBuscar = async (q?: string) => {
    const termo = q ?? query;
    if (!termo.trim() || termo.trim().length < 3) return;
    try {
      setLoading(true);
      setError("");
      setOfertas([]);
      setShowSugestoes(false);
      const data = await InvestimentosService.getComparativo(termo);
      setOfertas(data);
      setLoaded(true);
    } catch (err: any) {
      setError("Não foi possível buscar os preços. Verifique a conexão com a SERPAPI.");
    } finally {
      setLoading(false);
    }
  };

  const melhorPreco = ofertas.length > 0 ? ofertas.reduce((a, b) => ((a.preco_numerico || 99999) < (b.preco_numerico || 99999) ? a : b)) : null;

  const filteredSugestoes = sugestoes.filter(s => s.toLowerCase().includes(query.toLowerCase())).slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
          <i className="fa-brands fa-google text-yellow-400 text-base" />
        </div>
        <div>
          <h3 className={`text-sm font-black ${isDark ? "text-white" : "text-slate-900"}`}>Comparativo de Preços</h3>
          <p className="text-[10px] text-slate-500">Google Shopping via SerpAPI · Resultados reais em tempo real</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <i className={`fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`} />
            <input
              type="text"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowSugestoes(e.target.value.length > 0); }}
              onKeyDown={e => { if (e.key === "Enter") handleBuscar(); if (e.key === "Escape") setShowSugestoes(false); }}
              onFocus={() => query.length > 0 && setShowSugestoes(true)}
              placeholder="Ex: Dell Inspiron 15 3000, HP EliteBook 840..."
              className={`w-full rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/20 focus:border-yellow-500/30 transition-all ${isDark ? "bg-white/5 border border-white/10 text-slate-200 placeholder-slate-600" : "bg-white border border-slate-200 text-slate-800 placeholder-slate-400"}`}
            />
            {/* Sugestoes dropdown */}
            <AnimatePresence>
              {showSugestoes && filteredSugestoes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`absolute top-[calc(100%+4px)] left-0 right-0 rounded-xl shadow-2xl z-10 overflow-hidden ${isDark ? "bg-slate-900 border border-white/10" : "bg-white border border-slate-200"}`}
                >
                  {filteredSugestoes.map(s => (
                    <button
                      key={s}
                      onMouseDown={() => { setQuery(s); handleBuscar(s); }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2 ${isDark ? "text-slate-300 hover:bg-white/[0.06]" : "text-slate-700 hover:bg-slate-50"}`}
                    >
                      <i className={`fa-solid fa-box text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`} />
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={() => handleBuscar()}
            disabled={loading || query.trim().length < 3}
            className="px-5 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-slate-900 font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-yellow-500/20"
          >
            {loading ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-magnifying-glass-dollar" />}
            Buscar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold">
          <i className="fa-solid fa-triangle-exclamation mr-2" />{error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      )}

      {/* Melhor oferta destaque */}
      {!loading && melhorPreco && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-trophy text-emerald-400 text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">🏆 Melhor Preço Encontrado</p>
            <p className={`text-sm font-black truncate ${isDark ? "text-white" : "text-slate-900"}`}>{melhorPreco.titulo}</p>
            <p className={`text-[11px] ${isDark ? "text-slate-400" : "text-slate-600"}`}>{melhorPreco.loja}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-black text-emerald-400">{melhorPreco.preco}</p>
            <a
              href={melhorPreco.link} target="_blank" rel="noopener noreferrer"
              className="text-[10px] font-bold text-emerald-500 hover:text-emerald-300 transition-colors flex items-center gap-1 mt-1"
            >
              Ver oferta <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" />
            </a>
          </div>
        </motion.div>
      )}

      {/* Resultados grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ofertas.map((o, i) => {
            const isBest = o === melhorPreco;
            return (
              <motion.a
                key={i}
                href={o.link}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`group flex flex-col rounded-2xl border ${isBest ? "border-emerald-500/30 bg-emerald-500/5" : isDark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"} overflow-hidden transition-all hover:shadow-xl hover:-translate-y-1`}
              >
                {/* Imagem Quadrada */}
                <div className="aspect-square w-full bg-white dark:bg-slate-900 relative p-4 flex items-center justify-center border-b border-slate-100 dark:border-slate-800">
                  {o.thumbnail ? (
                    <img
                      src={o.thumbnail}
                      alt={o.titulo}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <i className="fa-solid fa-image text-slate-200 text-4xl" />
                  )}
                  {isBest && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-full bg-emerald-600 text-white text-[8px] font-black uppercase shadow-lg">
                      Melhor Preço
                    </div>
                  )}
                </div>

                {/* Conteúdo */}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex-1 space-y-1">
                    <p className="text-[8px] font-black text-indigo-500 uppercase tracking-widest leading-none">
                      {o.loja}
                    </p>
                    <h4 className={`text-[11px] font-bold line-clamp-2 leading-tight min-h-[1.5rem] ${isDark ? "text-slate-200" : "text-slate-800"}`}>
                      {o.titulo}
                    </h4>
                    <p className={`text-sm font-black mt-2 ${isBest ? "text-emerald-500" : isDark ? "text-indigo-400" : "text-indigo-600"}`}>
                      {o.preco}
                    </p>
                    {o.entrega && <p className="text-[8px] text-emerald-500 font-black uppercase mt-1">{o.entrega}</p>}
                  </div>

                  {o.link && o.link !== "#" ? (
                    <div className={`mt-3 w-full py-2 flex items-center justify-center gap-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all
                      ${isBest ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20" : "bg-indigo-600 text-white shadow-lg shadow-indigo-600/10"} group-hover:scale-[1.02]`}>
                      Ir à Loja
                      <i className="fa-solid fa-arrow-up-right-from-square text-[7px]" />
                    </div>
                  ) : (
                    <div className="mt-3 w-full py-2 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[8px] font-black uppercase tracking-widest flex items-center justify-center rounded-xl cursor-not-allowed">
                      Link Indisponível
                    </div>
                  )}
                </div>
              </motion.a>
            );
          })}
        </div>

      {/* Empty state */}
      {loaded && !loading && ofertas.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
          <i className="fa-solid fa-store-slash text-3xl opacity-30" />
          <p className="text-xs font-bold">Nenhum resultado encontrado para &quot;{query}&quot;.</p>
          <p className="text-[10px] text-slate-700">Tente um termo mais genérico como &quot;notebook&quot; ou &quot;monitor&quot;.</p>
        </div>
      )}
    </div>
  );
}
