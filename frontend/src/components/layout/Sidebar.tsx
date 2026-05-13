"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "@/contexts/ChatContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSwitcher } from "@/components/common/LanguageSwitcher";
import { AnimatedHamburger } from "@/components/ui/AnimatedHamburger";
import { Logo } from "@/components/common/Logo";

export default function Sidebar() {
  const { t } = useTranslation("common");
  const [mounted, setMounted] = useState(false);
  const { user, logout, hasPermission } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { setIsPanelOpen, totalUnread } = useChat();
  const { theme, toggleTheme } = useTheme();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  const NAV_GROUPS = [
    {
      label: mounted ? (t("navigation.main") || "Principal") : "Principal",
      items: [
        { label: mounted ? (t("navigation.home", "Início")) : "Início", href: "/inicio", icon: "fa-rocket", color: "text-blue-500", permission: "dashboard" },
        { label: mounted ? (t("navigation.dashboard", "Painel")) : "Painel", href: "/dashboard", icon: "fa-chart-line", color: "text-blue-400", permission: "dashboard" },
        { label: mounted ? (t("navigation.inventory", "Inventário")) : "Inventário", href: "/equipamentos", icon: "fa-laptop", color: "text-cyan-400", permission: "equipamentos" },
        { label: mounted ? (t("navigation.collaborators", "Colaboradores")) : "Colaboradores", href: "/colaboradores", icon: "fa-users", color: "text-emerald-400", permission: "colaboradores" },
        { label: mounted ? (t("navigation.movements", "Movimentações")) : "Movimentações", href: "/movimentacoes", icon: "fa-arrows-rotate", color: "text-orange-400", permission: "movimentacoes" },
        { label: mounted ? (t("navigation.requests", "Solicitações")) : "Solicitações", href: "/solicitacoes", icon: "fa-file-pen", color: "text-amber-400", permission: "solicitacoes" },
      ],
    },
    {
      label: mounted ? (t("navigation.advanced") || "Avançado") : "Avançado",
      items: [
        { label: mounted ? (t("navigation.network", "Rede")) : "Rede", href: "/rede", icon: "fa-globe", color: "text-indigo-400", permission: "rede" },
        { label: mounted ? (t("navigation.calendar", "Calendário")) : "Calendário", href: "/calendario", icon: "fa-calendar-days", color: "text-sky-400", permission: "calendario" },
        { label: mounted ? (t("navigation.investments", "Investimentos")) : "Investimentos", href: "/investimentos", icon: "fa-coins", color: "text-yellow-400", permission: "investimentos" },
        { label: mounted ? (t("navigation.traceability", "Rastreabilidade")) : "Rastreabilidade", href: "/rastreabilidade", icon: "fa-route", color: "text-purple-400", permission: "rastreabilidade" },
        { label: mounted ? (t("navigation.diagnostics", "Diagnósticos")) : "Diagnósticos", href: "/diagnosticos", icon: "fa-heart-pulse", color: "text-rose-400", permission: "diagnosticos" },
        { label: mounted ? (t("navigation.audit", "Auditoria")) : "Auditoria", href: "/auditoria", icon: "fa-shield-halved", color: "text-lime-400", permission: "auditoria" },
      ],
    },
    {
      label: mounted ? (t("navigation.system", "Sistema")) : "Sistema",
      items: [
        { label: mounted ? (t("navigation.settings", "Configurações")) : "Configurações", href: "/configuracoes", icon: "fa-gear", color: "text-slate-400", permission: "configuracoes" },
      ],
    },
  ];

  const FILTERED_GROUPS = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => hasPermission(item.permission))
  })).filter(group => group.items.length > 0);

  const ALL_ITEMS = FILTERED_GROUPS.flatMap((g) => g.items);
  const MOBILE_MAIN = ALL_ITEMS.slice(0, 4);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  const isActive = (href: string) =>
    pathname === href || (pathname === "/" && href === "/dashboard");

  const NavItem = ({ item, mini = false }: { item: any; mini?: boolean }) => {
    const active = isActive(item.href);
    return (
      <Link
        href={item.href}
        title={mini || collapsed ? item.label : ""}
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 
          ${active
            ? "bg-surface-soft text-strong shadow-inner"
            : "text-muted hover:bg-surface-soft hover:text-strong"
          }
          ${collapsed && !mini ? "w-10 flex justify-center p-0 mx-auto" : ""}
        `}
      >
        {active && (
          <motion.div
            layoutId="sidebar-active"
            className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-400"
          />
        )}
        <i className={`fa-solid ${item.icon} flex-shrink-0 text-base transition-colors
          ${active ? (isDark ? "text-white" : "text-slate-900") : item.color + (isDark ? " group-hover:text-white" : " group-hover:text-slate-900")}`}
        />
        {!collapsed && !mini && <span className="truncate">{item.label}</span>}
        {(collapsed || mini) && (
          <div className={`pointer-events-none absolute left-full ml-3 px-2.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-xl
            ${isDark ? "bg-slate-800 text-white border border-white/10" : "bg-white text-slate-800 border border-slate-200"}`}>
            {item.label}
          </div>
        )}
      </Link>
    );
  };

  const SidebarContent = ({ isMobile = false }) => (
    <div className="flex flex-col h-full py-3 gap-1">
      {/* Logo Section */}
      <div className={`flex items-center gap-3 mb-4 px-3 py-3 ${collapsed && !isMobile ? "justify-center px-0" : ""}`}>
        <Logo 
          className={`${isDark ? "text-white" : "text-slate-900"} drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]`} 
          size={collapsed && !isMobile ? 32 : 36} 
        />
        {(!collapsed || isMobile) && (
          <div className="flex flex-col truncate">
            <span className={`font-black tracking-tight text-base leading-tight ${isDark ? "text-white" : "text-slate-900"}`}>INVENTÁRIO E REDE</span>
            <span className="text-[9px] text-blue-400 font-bold tracking-[0.2em] uppercase">Inventory & Network</span>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-surface-soft text-muted hover:text-strong"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar">
        {FILTERED_GROUPS.map((group) => (
          <div key={group.label}>
            {(!collapsed || isMobile) && (
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-400 px-4 mb-1.5">
                {group.label}
              </p>
            )}
            {collapsed && !isMobile && <div className={`border-t my-2 ${isDark ? "border-white/5" : "border-slate-200"}`} />}
            <div className={`space-y-0.5 ${!collapsed || isMobile ? "px-3" : ""}`}>
              {group.items.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={`mt-auto flex flex-col gap-2 pt-3 px-3 border-t ${isDark ? "border-white/10" : "border-slate-200"} ${collapsed && !isMobile ? "items-center px-0" : ""}`}>
        {hasPermission("chat") && (
          <button
            onClick={() => setIsPanelOpen(true)}
            className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group text-muted hover:bg-surface-soft hover:text-strong
              ${collapsed && !isMobile ? "w-10 justify-center px-0" : ""}`}
          >
            <i className="fa-solid fa-comments text-base text-indigo-400 group-hover:text-strong transition-colors shrink-0" />
            {(!collapsed || isMobile) && (
              <div className="flex-1 text-left">
                <p className="text-xs font-bold text-main">
                  {mounted ? (t("chat.title") || "Bate-papo") : "Bate-papo"}
                </p>
                <p className="text-[10px] text-muted">
                  {mounted ? (t("chat.subtitle") || "Suporte operacional") : "Suporte operacional"}
                </p>
              </div>
            )}
            {totalUnread > 0 && (
              <span className={`absolute bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-red-500/40
                ${collapsed && !isMobile ? "top-0 right-0 w-4 h-4" : "ml-auto px-1.5 py-0.5 min-w-[20px]"}`}>
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
          </button>
        )}

        <div className={`flex items-center gap-1 ${collapsed && !isMobile ? "flex-col" : "justify-between px-1"}`}>
          <button
            onClick={toggleTheme}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group text-muted hover:bg-surface-soft hover:text-strong
              ${collapsed && !isMobile ? "w-10 justify-center px-0" : "flex-1"}`}
          >
            <i className={`fa-solid ${theme === "dark" ? "fa-sun text-yellow-400" : "fa-moon text-indigo-600"} text-base transition-colors shrink-0`} />
            {(!collapsed || isMobile) && (
              <span className="text-xs font-semibold text-main">
                {theme === "dark" ? "Claro" : "Escuro"}
              </span>
            )}
          </button>
          <LanguageSwitcher />
        </div>

        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-border-subtle
          ${collapsed && !isMobile ? "w-10 justify-center px-0 border-none bg-transparent" : ""}`}>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt={user?.nome} className="w-full h-full object-cover" />
            ) : (
              <i className="fa-solid fa-user text-slate-400 text-xs" />
            )}
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-strong">
                {user?.nome || "Carregando..."}
              </p>
              <p className="text-[10px] text-muted truncate uppercase tracking-widest font-black">
                {user?.cargo || "Acesso"}
              </p>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <button className="text-muted hover:text-red-400 transition-colors ml-auto" onClick={logout}>
              <i className="fa-solid fa-right-from-bracket text-xs" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-300 sidebar-shell border-r border-border-subtle rounded-r-[2rem] shadow-[4px_0_24px_rgba(0,0,0,0.02)] ${isDark ? "sidebar-gradient" : "bg-surface"} ${collapsed ? "w-[68px]" : "w-[260px]"}`}>
        <SidebarContent />

        {/* Floating Toggle Button for PC - Sits on the edge */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`hidden md:flex absolute top-8 z-[60] w-8 h-8 rounded-full items-center justify-center shadow-xl border border-border-subtle transition-all duration-300 
            ${collapsed ? "-right-10" : "-right-4"}
            ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white hover:bg-slate-50"}
            group
          `}
          title={collapsed ? "Expandir" : "Recolher"}
        >
          <AnimatedHamburger
            active={!collapsed}
            className="!w-6 !h-6 !bg-transparent !shadow-none !border-none"
          />
        </button>
      </aside>
      <div className={`hidden md:block transition-all duration-300 shrink-0 ${collapsed ? "w-[68px]" : "w-[260px]"}`} />

      {/* Mobile drawer is now only controlled by the bottom nav or sidebar toggle if it was possible */}

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="md:hidden fixed inset-0 z-[65] backdrop-blur-sm bg-black/60" onClick={() => setMobileOpen(false)} />
            <motion.div ref={drawerRef} initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className={`md:hidden fixed left-0 top-0 bottom-0 z-[70] w-[280px] flex flex-col border-r border-border-subtle rounded-r-[2.5rem] shadow-2xl ${isDark ? "sidebar-mobile-drawer" : "bg-surface"}`}>
              <SidebarContent isMobile />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="md:hidden fixed bottom-6 left-6 right-6 z-[60] flex items-center justify-around px-2 h-18 bg-surface/90 backdrop-blur-xl rounded-[2.5rem] shadow-nm-flat border border-border-subtle overflow-hidden">
        {MOBILE_MAIN.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-2xl transition-all duration-300 active:scale-95
                ${active
                  ? "bg-surface-soft shadow-nm-inset text-brand"
                  : "text-muted hover:text-strong"
                }`}
            >
              <i className={`fa-solid ${item.icon} ${active ? "text-lg" : "text-base"} transition-all`} />
              <span className={`text-[8px] font-black uppercase tracking-widest ${active ? "opacity-100" : "opacity-70"}`}>
                {item.label}
              </span>
              {active && (
                <motion.div
                  layoutId="mobile-nav-active"
                  className="absolute -bottom-1 w-1 h-1 rounded-full bg-brand"
                />
              )}
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-1 h-14 rounded-2xl transition-all active:scale-95 text-muted hover:text-strong
            ${mobileOpen ? "bg-surface-soft shadow-nm-inset text-brand" : ""}
          `}
        >
          <AnimatedHamburger
            active={mobileOpen}
            className="w-10 h-8 !bg-transparent border-none shadow-none"
          />
          <span className="text-[8px] font-black uppercase tracking-widest -mt-1 opacity-70">Menu</span>
        </button>
      </nav>
      <div className="md:hidden h-28" />
    </>
  );
}
