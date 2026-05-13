"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSearch, SearchResult } from "@/contexts/SearchContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SearchDropdown } from "@/components/layout/SearchDropdown";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

const HEADER_INFO: Record<string, { title: string; desc: string; icon: string; colorClass: string }> = {
  "/inicio": { title: "Início", desc: "Seu centro de comando e hub de operações rápidas", icon: "fa-rocket", colorClass: "text-blue-500" },
  "/dashboard": { title: "Dashboard", desc: "Visão executiva com indicadores e movimentações recentes", icon: "fa-chart-line", colorClass: "text-blue-500" },
  "/dashboard-equip": { title: "Painel de Equipamentos", desc: "Visão geral do inventário e distribuição", icon: "fa-chart-column", colorClass: "text-purple-500" },
  "/equipamentos": { title: "Equipamentos", desc: "Gerenciamento completo do inventário, filtros e ações rápidas", icon: "fa-laptop", colorClass: "text-cyan-500" },
  "/colaboradores": { title: "Colaboradores", desc: "Base de usuários, departamentos e status de vínculo", icon: "fa-users", colorClass: "text-emerald-500" },
  "/movimentacoes": { title: "Movimentações", desc: "Rastreabilidade operacional, timeline e relatórios", icon: "fa-arrows-rotate", colorClass: "text-orange-500" },
  "/solicitacoes": { title: "Solicitações de Equip.", desc: "Processamento, alocação e conclusão de solicitações", icon: "fa-file-pen", colorClass: "text-amber-500" },
  "/rede": { title: "Rede", desc: "Inventário de endereços e mapa de topologia da rede", icon: "fa-globe", colorClass: "text-indigo-500" },
  "/investimentos": { title: "Investimentos", desc: "Custos de equipamentos e crescimento de investimento", icon: "fa-coins", colorClass: "text-green-500" },
  "/calendario": { title: "Calendário", desc: "Visualização cronológica de solicitações e movimentações", icon: "fa-calendar-days", colorClass: "text-sky-500" },
  "/configuracoes": { title: "Configurações", desc: "Gestão de usuários, permissões e manutenção do sistema", icon: "fa-gear", colorClass: "text-slate-500" },
  "/rastreabilidade": { title: "Rastreabilidade", desc: "Histórico completo de movimentações por equipamento", icon: "fa-route", colorClass: "text-blue-500" },
  "/diagnosticos": { title: "Diagnósticos", desc: "Saúde do inventário, previsões e recomendações automáticas", icon: "fa-heart-pulse", colorClass: "text-rose-500" },
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const { hasPermission } = useAuth();
  const { searchQuery, setSearchQuery, searchResults, isSearching, clearSearch } = useSearch();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const info = HEADER_INFO[pathname] || HEADER_INFO["/dashboard"];
  const actionButton = useMemo(() => {
    switch (pathname) {
      case "/equipamentos": return { label: "Novo Ativo", icon: "fa-plus" };
      case "/colaboradores": return { label: "Novo Talento", icon: "fa-plus" };
      case "/solicitacoes": return { label: "Nova Solicitação", icon: "fa-plus" };
      case "/movimentacoes": return { label: "Nova Transação", icon: "fa-plus" };
      case "/investimentos": return { label: "Atualizar", icon: "fa-rotate" };
      case "/rastreabilidade": return { label: "Abrir Câmera", icon: "fa-camera" };
      default: return null;
    }
  }, [pathname]);

  const canEditCurrentPage = useMemo(() => {
    const key = pathname.replace("/", "");
    if (!key || key === "dashboard") return true; // Dashboard is usually view only anyway or has its own logic
    return hasPermission(key, "edit");
  }, [pathname, hasPermission]);

  useEffect(() => { setIsMac(navigator.platform.toUpperCase().includes("MAC")); }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!searchRef.current?.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "Escape") {
        setShowDropdown(false);
        clearSearch();
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clearSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
    clearSearch();
    setShowDropdown(false);
    router.push(result.rota);
  }, [clearSearch, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setShowDropdown(val.length >= 2);
  };

  const handleFocus = () => { if (searchQuery.length >= 2) setShowDropdown(true); };

  const isDark = theme === "dark";

  return (
    <header className="relative z-30 rounded-2xl mb-6 transition-all duration-300 border border-border-subtle bg-surface/80 backdrop-blur-xl shadow-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
      {/* Page Title — hidden on mobile (small space) */}
      <div className="hidden sm:block flex-1 min-w-0">
        <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-strong">
          <i className={`fa-solid ${info.icon} ${info.colorClass} text-base`} />
          {info.title}
        </h2>
        <p className="text-sm font-medium mt-0.5 truncate text-muted">
          {info.desc}
        </p>
      </div>

      {/* Mobile title (compact) - removed ml-12 as top hamburger is removed */}
      <div className="sm:hidden flex items-center gap-2">
        <i className={`fa-solid ${info.icon} ${info.colorClass} text-sm`} />
        <span className="font-bold text-sm text-strong">{info.title}</span>
      </div>

      {/* Search + Actions */}
      <div className="flex items-center gap-2 w-full sm:max-w-xl">
        {/* Search Bar */}
        <div ref={searchRef} className="flex-1 relative">
          <i className={`fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none transition-colors
            ${isSearching ? "text-blue-500" : isDark ? "text-slate-300" : "text-slate-500"}`} />

          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleChange}
            onFocus={handleFocus}
            placeholder="Buscar..."
            className="w-full rounded-xl py-2.5 pl-9 pr-9 text-sm font-medium transition-all outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 bg-surface-soft border border-border-subtle text-main placeholder-subtle"
          />

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery ? (
              <button
                onClick={() => { clearSearch(); setShowDropdown(false); inputRef.current?.focus(); }}
                title="Limpar busca"
                aria-label="Limpar busca"
                className="transition-colors text-muted hover:text-strong"
              >
                <i className="fa-solid fa-xmark text-xs" />
              </button>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono hidden sm:block text-muted bg-surface-tertiary">
                {isMac ? "⌘K" : "Ctrl K"}
              </span>
            )}
          </div>

          {showDropdown && (
            <SearchDropdown
              results={searchResults}
              query={searchQuery}
              isSearching={isSearching}
              onSelect={handleSelect}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* Primary Action Button (Route specific) */}
        {actionButton && canEditCurrentPage && (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("PAGE_ACTION_CLICKED", { detail: { path: pathname } }))}
            className="ml-2 hidden lg:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95 shrink-0"
          >
            <i className={`fa-solid ${actionButton.icon}`}></i>
            <span className="hidden xl:inline">{actionButton.label}</span>
          </button>
        )}
      </div>
    </header>
  );
}
