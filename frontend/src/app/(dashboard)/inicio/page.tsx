"use client";

import React, { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { domToPng } from 'modern-screenshot';
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { useToast } from "@/contexts/ToastContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useChat } from "@/contexts/ChatContext";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { EquipamentosService } from "@/services/equipamentos.service";
import { ColaboradoresService } from "@/services/colaboradores.service";
import { SolicitacoesService } from "@/services/solicitacoes.service";
import { MovimentacoesService } from "@/services/movimentacoes.service";
import { AuditService, AuditLog } from "@/services/audit.service";
import { Equipamento, Colaborador, Solicitacao, Movimentacao } from "@/types";

export default function InicioPage() {
  const { user, hasPermission } = useAuth();
  const { t } = useTranslation("common");
  const { theme } = useTheme();
  const router = useRouter();
  const { success, info } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const { unreadByContext, setIsPanelOpen } = useChat();

  const [processing, setProcessing] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  const [reportData, setReportData] = useState<{
    novosAtivos: Equipamento[];
    movRecentes: Movimentacao[];
    solRecentes: Solicitacao[];
    solConcluidas: number;
    solPendentes: number;
    totalAtivos: number;
    dias: number;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const generateReport = async (days: number) => {
    startLoading(`Compilando dados dos últimos ${days} dias...`);
    setProcessing(`report-${days}d`);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const referenceDate = new Date();
      referenceDate.setDate(referenceDate.getDate() - days);

      const [equipamentos, colaboradores, solicitacoes, movimentacoes] = await Promise.all([
        EquipamentosService.getEquipamentos(),
        ColaboradoresService.getColaboradores(),
        SolicitacoesService.getSolicitacoes(),
        MovimentacoesService.getMovimentacoes()
      ]);

      const novosAtivos = (equipamentos as Equipamento[]).filter(e => {
        const d = new Date(e.dataAquisicao || e.dataCompra || "");
         return d >= referenceDate;
      });

      const movRecentes = (movimentacoes as Movimentacao[]).filter(m => {
        const d = new Date(m.dataHora || "");
        return d >= referenceDate;
      });

      const solRecentes = (solicitacoes as Solicitacao[]).filter(s => {
        const d = new Date(s.dataCriacao || s.dataSolicitacao || "");
        return d >= referenceDate;
      });
      const solConcluidas = solRecentes.filter(s => s.status === 'concluido').length;
      const solPendentes = solRecentes.filter(s => s.status === 'pendente' || s.status === 'em_atendimento').length;

      setReportData({
        novosAtivos,
        movRecentes,
        solRecentes,
        solConcluidas,
        solPendentes,
        totalAtivos: (equipamentos as Equipamento[]).length,
        dias: days
      });

      // Espera o DOM renderizar o layout escondido
      setTimeout(async () => {
        if (reportRef.current) {
          try {
            const dataUrl = await domToPng(reportRef.current, {
              quality: 1,
              scale: 2,
              backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
            });
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `relatorio_analitico_inventario_rede_${days}d_${new Date().toISOString().split('T')[0]}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            success("Relatório Inteligente Gerado", "O documento analítico visual (PNG) foi baixado.");
          } catch (e) {
            console.error("Screenshot error:", e);
            info("Erro", "Falha ao gerar a imagem PNG do relatório.");
          }
        }
        stopLoading();
        setProcessing(null);
        setReportData(null);
      }, 800);

    } catch (err) {
       console.error("Erro ao gerar relatório:", err);
       info("Erro de Sincronização", "Não foi possível compilar todos os dados para o relatório.");
       stopLoading();
       setProcessing(null);
    }
  };
  
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return "Boa madrugada";
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const ATALHOS = [
    // Principal
    { label: "Dashboard",       href: "/dashboard",        icon: "fa-chart-line", color: "text-blue-500", permission: "dashboard", group: "Principal" },
    { label: "Equipamentos",    href: "/equipamentos",     icon: "fa-laptop", color: "text-cyan-500", permission: "equipamentos", group: "Principal" },
    { label: "Colaboradores",   href: "/colaboradores",    icon: "fa-users", color: "text-emerald-500", permission: "colaboradores", group: "Principal" },
    { label: "Movimentações",   href: "/movimentacoes",    icon: "fa-arrows-rotate", color: "text-orange-500", permission: "movimentacoes", group: "Principal" },
    { label: "Solicitações",    href: "/solicitacoes",     icon: "fa-file-pen", color: "text-amber-500", permission: "solicitacoes", group: "Principal" },
    
    // Avançado
    { label: "Rede",            href: "/rede",             icon: "fa-globe", color: "text-indigo-500", permission: "rede", group: "Avançado" },
    { label: "Auditoria",       href: "/auditoria",        icon: "fa-shield-halved", color: "text-lime-500", permission: "auditoria", group: "Avançado" },
    { label: "Rastreabilidade", href: "/rastreabilidade",  icon: "fa-route", color: "text-purple-500", permission: "rastreabilidade", group: "Avançado" },
    { label: "Investimentos",   href: "/investimentos",    icon: "fa-coins", color: "text-yellow-500", permission: "investimentos", group: "Avançado" },
    { label: "Diagnósticos",    href: "/diagnosticos",     icon: "fa-heart-pulse", color: "text-rose-500", permission: "diagnosticos", group: "Avançado" },
    { label: "Calendário",      href: "/calendario",       icon: "fa-calendar-days", color: "text-sky-500", permission: "calendario", group: "Avançado" },
    
    // Sistema
    { label: "Configurações",    href: "/configuracoes",    icon: "fa-gear", color: "text-slate-500", permission: "configuracoes", group: "Sistema" },
  ];

  const atalhosPermitidos = useMemo(() => {
    const filtered = ATALHOS.filter(a => hasPermission(a.permission));
    // Group by category
    return {
      Principal: filtered.filter(a => a.group === "Principal"),
      Avançado: filtered.filter(a => a.group === "Avançado"),
      Sistema: filtered.filter(a => a.group === "Sistema")
    };
  }, [hasPermission]);

  const [stats, setStats] = useState({ ativos: 0, pendentes: 0, operacional: 0, manutencao: 0, avariado: 0 });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchStats = async () => {
    try {
      const [eqs, sols] = await Promise.all([
        EquipamentosService.getEquipamentos(),
        SolicitacoesService.getSolicitacoes() // Fetch all to get accurate pendentes count locally or from server
      ]);
      const eqsArray = eqs as Equipamento[];
      const op = eqsArray.filter(e => e.status === 'operacional').length;
      const man = eqsArray.filter(e => e.status === 'manutencao').length;
      const des = eqsArray.filter(e => e.status === 'avariado' || e.status === 'desativado').length;
      
      const solsArray = sols as Solicitacao[];
      const pends = solsArray.filter(s => s.status === 'pendente' || s.status === 'em_atendimento').length;

      setStats({ ativos: eqsArray.length, pendentes: pends, operacional: op, manutencao: man, avariado: des });
    } catch (err) {
      console.error("Erro ao buscar estatísticas do hub:", err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const logs = await AuditService.getLogs({ limit: 10 });
      const mapped = logs.slice(0, 10).map((log: AuditLog) => {
        let color = "text-blue-500";
        let icon = "fa-circle-dot";
        
        if (log.acao.includes("create") || log.acao.includes("register")) {
          color = "text-emerald-500";
          icon = "fa-plus-circle";
        } else if (log.acao.includes("delete")) {
          color = "text-red-500";
          icon = "fa-trash-can";
        } else if (log.acao.includes("login")) {
          color = "text-indigo-500";
          icon = "fa-right-to-bracket";
        } else if (log.acao.includes("update") || log.acao.includes("edit")) {
          color = "text-amber-500";
          icon = "fa-pen-to-square";
        }

        // Formata o texto amigável
        let friendlyText = `${log.user_nome || "Sistema"}: ${log.acao} no módulo ${log.entidade}`;
        if (log.acao === "login") friendlyText = `${log.user_nome || "Usuário"} acessou o cockpit`;
        
        // Formata o tempo amigável de forma nativa
        const diffMs = new Date().getTime() - new Date(log.created_at).getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMin / 60);
        const timeStr = diffHrs > 0 ? `${diffHrs}h` : (diffMin > 0 ? `${diffMin}min` : "agora");
        
        return {
          id: log.audit_id,
          text: friendlyText,
          time: timeStr,
          timestamp: new Date(log.created_at).getTime(),
          icon,
          color
        };
      });
      setRecentActivity(mapped);
    } catch (err) {
      console.error("Erro ao buscar logs de auditoria:", err);
    }
  };

  const radarFeed = useMemo(() => {
    const feed = [...recentActivity];
    (unreadByContext || []).filter((c: any) => c.naoLidos > 0).forEach((msg: any) => {
      feed.push({
        id: `chat-${msg.contextoTipo}-${msg.contextoId}`,
        text: `Chat: Nova mensagem de ${msg.ultimoRemetente}`,
        time: msg.ultimaMensagemAt ? `${Math.floor((new Date().getTime() - new Date(msg.ultimaMensagemAt).getTime())/60000)}m` : 'agora',
        timestamp: new Date(msg.ultimaMensagemAt).getTime(),
        icon: "fa-comment-dots",
        color: "text-indigo-400 font-bold",
        isChat: true
      });
    });
    return feed.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 10);
  }, [recentActivity, unreadByContext]);

  React.useEffect(() => {
    fetchStats();
    fetchRecentActivity();
  }, []);

  return (
    <div className="flex flex-col gap-10 pb-20 animate-in fade-in duration-700">
      
      {/* 1. HERO BANNER - With Solar System Animation */}
      <section className="relative overflow-hidden rounded-[3rem] bg-surface shadow-nm-flat border border-border-subtle/30 p-10 md:p-14 min-h-[320px] flex items-center">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-12 w-full">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="flex items-center gap-6 mb-8 px-1">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-500/70">
                   Gestão de Ativos
                </div>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500/70">
                   Sincronizado
                </div>
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-strong tracking-tighter leading-[1.05] mb-6">
                {getGreeting()}, <br />
                <span className="text-blue-500">{user?.nome?.split(' ')[0]}</span>.
              </h1>
              <p className="text-muted text-lg font-medium max-w-lg leading-relaxed">
                O console de comando **Inventário e Rede** está pronto. Todos os sistemas de inventário e rastreabilidade estão nominais.
              </p>
            </motion.div>
          </div>
          
          {/* SOLAR SYSTEM / SATELLITE ANIMATION */}
          <div className="relative hidden lg:flex items-center justify-center w-72 h-72 mr-10">
            {/* Outer Orbit */}
            <div 
              className="absolute inset-0 border border-blue-500/10 rounded-full"
            />
            {/* Middle Orbit */}
            <div 
              className="absolute inset-8 border border-indigo-500/15 rounded-full"
            >
            </div>
            {/* Inner Content */}
            <div className="relative w-32 h-32 rounded-full bg-surface shadow-nm-inset flex items-center justify-center border border-blue-500/5">
              <i className="fa-solid fa-satellite-dish text-blue-500/40 text-4xl" />
              <div 
                className="absolute inset-0"
              >
              </div>
            </div>
          </div>
        </div>
        
        {/* Background Atmosphere (Nebula Effect) */}
        <div className="absolute top-0 right-0 w-2/3 h-full pointer-events-none overflow-hidden rounded-r-[3rem] z-0">
          <div className="absolute inset-0 bg-gradient-to-l from-blue-600/[0.25] via-purple-600/[0.15] to-transparent" />
          <div className="absolute top-1/4 right-12 w-40 h-40 bg-white/[0.12] blur-[50px] rounded-full" />
          <div className="absolute bottom-4 right-32 w-56 h-56 bg-purple-500/[0.2] blur-[60px] rounded-full" />
          <div className="absolute top-1/2 right-56 w-32 h-32 bg-blue-300/[0.15] blur-[40px] rounded-full" />
        </div>
      </section>

      {/* 2. MAIN HUB CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 items-start">
        
        {/* LEFT COMPONENT: Modules & Categories (8/12) */}
        <div className="xl:col-span-8 space-y-12">
          
          {/* Category: Principal */}
          <section className="space-y-6">
            <h2 className="text-xs font-black text-muted uppercase tracking-[0.4em] px-2 flex items-center gap-4">
              <span className="w-10 h-[1px] bg-border-subtle" />
              Núcleo Operacional
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {atalhosPermitidos.Principal.map((a) => (
                <Link key={a.href} href={a.href} className="group h-full p-8 rounded-[2.5rem] bg-surface shadow-nm-flat hover-nm-elevated border border-transparent hover:border-blue-500/10 transition-[border-color,transform,box-shadow] duration-500 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-surface-soft shadow-nm-inset flex items-center justify-center mb-6 group-hover:scale-110 transition-all">
                    <i className={`fa-solid ${a.icon} ${a.color} text-xl`} />
                  </div>
                  <h3 className="text-sm font-black text-strong uppercase tracking-tight">{a.label}</h3>
                </Link>
              ))}
            </div>
          </section>

          {/* Category: Avançado */}
          <section className="space-y-6">
            <h2 className="text-xs font-black text-muted uppercase tracking-[0.4em] px-2 flex items-center gap-4">
              <span className="w-10 h-[1px] bg-border-subtle" />
              Sistemas Avançados
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {atalhosPermitidos.Avançado.map((a) => (
                <Link key={a.href} href={a.href} className="group h-full p-5 rounded-3xl bg-surface shadow-nm-flat-sm hover:shadow-nm-inset border border-transparent hover:border-indigo-500/10 transition-[box-shadow,background-color] duration-500 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-surface-soft shadow-nm-inset flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                    <i className={`fa-solid ${a.icon} ${a.color} text-sm`} />
                  </div>
                  <h3 className="text-[11px] font-black text-main uppercase tracking-tighter truncate">{a.label}</h3>
                </Link>
              ))}
            </div>
          </section>

          {/* 3. PROTOCOLOS DE RESPOSTA RÁPIDA (Enhanced) */}
          <section className="p-8 rounded-[2.5rem] bg-surface shadow-nm-flat border border-border-subtle/30 overflow-hidden relative">
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-sm font-black text-strong uppercase tracking-[0.2em] flex items-center gap-3">
                    <i className="fa-solid fa-bolt-lightning text-blue-500" />
                    Protocolos de Resposta Rápida
                  </h3>
                  <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-widest">Execução prioritária de processos críticos</p>
                </div>
                {/* Omnisearch Bar */}
                <form 
                  onSubmit={(e) => { 
                    e.preventDefault(); 
                    if (searchQuery.trim()) {
                      startLoading('Sondando radares...');
                      router.push(`/equipamentos?search=${encodeURIComponent(searchQuery)}`);
                    }
                  }}
                  className="relative group w-full md:w-64"
                >
                  <i className="fa-solid fa-satellite-dish absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Radar Ominisearch..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-soft border border-border-subtle/50 rounded-2xl py-2.5 pl-10 pr-4 text-[11px] font-black tracking-widest uppercase text-strong focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 shadow-nm-inset transition-all"
                  />
                  {searchQuery && (
                    <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                      <i className="fa-solid fa-arrow-right text-[10px]" />
                    </button>
                  )}
                </form>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Ação 1: Novo Ativo */}
                <button 
                  onClick={() => router.push("/equipamentos?action=new")} 
                  style={{ willChange: "transform" }}
                  className="group h-full p-6 rounded-3xl bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:-translate-y-1 hover:shadow-blue-600/50 active:scale-95 transition-all duration-300 flex flex-col gap-4 text-left border border-white/10"
                >
                  <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <i className="fa-solid fa-laptop-medical text-lg" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">Inventário</span>
                    <span className="text-xs font-black">Novo Ativo</span>
                  </div>
                </button>

                {/* Ação 2: Novo Colaborador */}
                <button 
                  onClick={() => router.push("/colaboradores?action=new")} 
                  style={{ willChange: "transform" }}
                  className="group h-full p-6 rounded-3xl bg-surface shadow-nm-flat hover:shadow-nm-elevated hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 text-left border border-border-subtle/20 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-2xl bg-surface-soft shadow-nm-inset flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform duration-300">
                    <i className="fa-solid fa-user-plus text-sm" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-muted uppercase tracking-widest mb-0.5">Equipe</span>
                    <span className="text-xs font-black text-strong">Novo Colaborador</span>
                  </div>
                </button>

                {/* Ação 3: Nova Solicitação */}
                <button 
                  onClick={() => router.push("/solicitacoes?action=new")} 
                  style={{ willChange: "transform" }}
                  className="group h-full p-6 rounded-3xl bg-surface shadow-nm-flat hover:shadow-nm-elevated hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 text-left border border-border-subtle/20 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-2xl bg-surface-soft shadow-nm-inset flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform duration-300">
                    <i className="fa-solid fa-file-circle-plus text-sm" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-muted uppercase tracking-widest mb-0.5">Serviços</span>
                    <span className="text-xs font-black text-strong">Nova Solicitação</span>
                  </div>
                </button>

                {/* Ação 4: Nova Movimentação */}
                <button 
                  onClick={() => router.push("/movimentacoes?action=new")} 
                  style={{ willChange: "transform" }}
                  className="group h-full p-6 rounded-3xl bg-surface shadow-nm-flat hover:shadow-nm-elevated hover:-translate-y-1 transition-all duration-300 flex flex-col gap-4 text-left border border-border-subtle/20 active:scale-95"
                >
                  <div className="w-10 h-10 rounded-2xl bg-surface-soft shadow-nm-inset flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform duration-300">
                    <i className="fa-solid fa-truck-ramp-box text-sm" />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-muted uppercase tracking-widest mb-0.5">Logística</span>
                    <span className="text-xs font-black text-strong">Nova Movimentação</span>
                  </div>
                </button>
              </div>

              {/* Technical Utilities Bar */}
              <div className="mt-8 pt-6 border-t border-border-subtle/20 flex flex-col sm:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-4">
                    <button 
                      disabled={!!processing}
                      onClick={() => generateReport(7)}
                      className="px-4 py-2 rounded-xl bg-surface-soft shadow-nm-flat hover:shadow-nm-inset text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-2 border border-border-subtle/20"
                    >
                      <i className={`fa-solid ${processing === 'report-7d' ? 'fa-spinner animate-spin' : 'fa-file-medical'} text-blue-500`} />
                      Relatório 7D
                    </button>

                    <button 
                      disabled={!!processing}
                      onClick={() => generateReport(30)}
                      className="px-4 py-2 rounded-xl bg-surface-soft shadow-nm-flat hover:shadow-nm-inset text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-2 border border-border-subtle/20"
                    >
                      <i className={`fa-solid ${processing === 'report-30d' ? 'fa-spinner animate-spin' : 'fa-file-medical'} text-indigo-500`} />
                      Relatório 30D
                    </button>
                    
                    <button 
                      onClick={() => {
                        startLoading("Realizando varredura de rede...");
                        setTimeout(() => { 
                          stopLoading(); 
                          info("Scan Completo", "Topologia de rede nominal."); 
                        }, 2000);
                      }}
                      className="px-4 py-2 rounded-xl bg-surface-soft shadow-nm-flat hover:shadow-nm-inset text-[9px] font-black uppercase tracking-widest text-muted flex items-center gap-2 border border-border-subtle/20"
                    >
                      <i className={`fa-solid ${processing === 'scan' ? 'fa-spinner animate-spin' : 'fa-satellite'} text-indigo-500`} />
                      Scan Rápido
                    </button>
                 </div>
                 <div className="flex items-center gap-3">
                    <i className="fa-solid fa-bolt-auto text-blue-500/40 text-[10px]" />
                    <span className="text-[9px] text-muted font-bold italic tracking-tight">Otimizado para operações em um clique.</span>
                 </div>
              </div>

              {/* Status Bar for Actions */}
              <div className="mt-8 pt-6 border-t border-border-subtle/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <div className="flex items-center gap-6">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                        <i className="fa-solid fa-file-invoice text-blue-500/50" />
                        Solicitações
                      </span>
                      <span className="text-[10px] font-bold text-strong ml-4">
                        {stats.pendentes > 0 ? `${stats.pendentes} Pendentes` : "Tudo em dia"}
                      </span>
                    </div>
                    <div className="w-[1px] h-6 bg-border-subtle/30" />
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mb-1 flex items-center gap-1.5">
                        <i className="fa-solid fa-microchip text-indigo-500/50" />
                        Ativos em Rede
                      </span>
                      <span className="text-[10px] font-bold text-main ml-4">
                        {stats.ativos} Equipamentos
                      </span>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <i className="fa-solid fa-circle-info text-blue-500/40 text-[10px]" />
                    <span className="text-[9px] text-muted font-bold italic">Clique nos protocolos para execução instantânea.</span>
                 </div>
              </div>
            </div>
            
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/[0.02] blur-3xl rounded-full" />
          </section>
        </div>

        {/* RIGHT COMPONENT: Sidebar Monitor (4/12) */}
        <aside className="xl:col-span-4 space-y-12">
          
          {/* Mural de Avisos (Integrated Accent) */}
          <section className="space-y-6">
            <h2 className="text-xs font-black text-muted uppercase tracking-[0.4em] px-2 flex items-center gap-4">
              <span className="w-10 h-[1px] bg-border-subtle" />
              Inteligência
            </h2>
            <div className="p-7 rounded-[2.5rem] bg-surface dark:bg-indigo-600 shadow-nm-flat dark:shadow-indigo-600/30 text-strong dark:text-white border-2 border-indigo-500/20 dark:border-transparent relative overflow-hidden group">
              <div 
                style={{ willChange: "transform, opacity" }}
                className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 dark:bg-white/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-110 transition-all duration-700" 
              />
              <div className="flex items-center gap-3 mb-4">
                 <i className="fa-solid fa-microchip text-indigo-500 dark:text-white/40 text-sm" />
                 <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 dark:text-white/60">Análise de IA Tática</h4>
              </div>
              
              <div className="space-y-4 px-1">
                <p className="text-[11px] font-bold text-main dark:text-white/90 leading-relaxed">
                  Varredura profunda concluída. Analisando telemetria de <span className="text-indigo-600 dark:text-indigo-400">{stats.ativos}</span> módulos operacionais via rede central.
                </p>
                
                <div className="space-y-2">
                  <div className={`p-3 rounded-xl border ${stats.manutencao > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                      <i className={`fa-solid ${stats.manutencao > 0 ? 'fa-triangle-exclamation animate-pulse' : 'fa-check-circle'}`} />
                      Infraestrutura
                    </p>
                    <p className="text-xs font-bold leading-snug">
                      {stats.manutencao > 0 
                        ? `ALERTA CRÍTICO: ${stats.manutencao} ativo(s) reportando status de manutenção. Risco de gargalo operacional nas próximas 24 horas.` 
                        : "Sistemas no verde. Zero manutenções excedentes. Todos os ativos performando dentro do envelope projetado."}
                    </p>
                  </div>

                  <div className={`p-3 rounded-xl border ${stats.pendentes > 0 ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 flex items-center gap-2">
                      <i className={`fa-solid ${stats.pendentes > 0 ? 'fa-battery-quarter animate-pulse' : 'fa-battery-full'}`} />
                      Fluxo Lógico
                    </p>
                    <p className="text-xs font-bold leading-snug">
                      {stats.pendentes > 0 
                        ? `ATENÇÃO: ${stats.pendentes} chamados retidos na malha. Libere os protocolos de rede pendentes para manter a sincronia.`
                        : "Tráfego impecável. Nenhuma pendência logística interceptada nos nós de aprovação."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3">
                <span className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-nm-flat ${stats.manutencao > 0 || stats.pendentes > 0 ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'}`}>
                  {stats.manutencao > 0 || stats.pendentes > 0 ? 'AÇÕES REQUERIDAS' : 'STATUS ÓTIMO'}
                </span>
                <span className="text-[8px] font-bold text-indigo-400 mt-0.5"><i className="fa-solid fa-satellite-dish mr-1 animate-pulse" />Sincronia IA Online</span>
              </div>
            </div>
          </section>

          {/* System Health / Metrificação (Recharts App-like) */}
          <section className="p-6 rounded-[2.5rem] bg-surface shadow-nm-flat border border-border-subtle/30 flex flex-col gap-5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Saúde da Bateria</span>
                <span className="text-[10px] font-black text-emerald-500 tracking-widest">{stats.ativos > 0 ? Math.round((stats.operacional/stats.ativos)*100) : 0}% OVERALL</span>
              </div>
              <div className="h-32 w-full relative">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={stats.ativos > 0 ? [
                         { name: 'Oper.', value: stats.operacional, color: '#10b981' }, 
                         { name: 'Manut.', value: stats.manutencao, color: '#f59e0b' }, 
                         { name: 'Indisp.', value: stats.avariado || 0, color: '#ef4444' }
                       ] : [{ name: 'Vazio', value: 1, color: '#e2e8f0' }]}
                       innerRadius={45}
                       outerRadius={60}
                       paddingAngle={5}
                       dataKey="value"
                       stroke="none"
                       isAnimationActive={true}
                     >
                       {stats.ativos > 0 ? [
                         { name: 'Oper.', value: stats.operacional, color: '#10b981' }, 
                         { name: 'Manut.', value: stats.manutencao, color: '#f59e0b' }, 
                         { name: 'Indisp.', value: stats.avariado || 0, color: '#ef4444' }
                       ].map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       )) : <Cell fill="#e2e8f0" />}
                     </Pie>
                   </PieChart>
                 </ResponsiveContainer>
                 {/* Center metric */}
                 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                    <span className="text-2xl font-black text-strong leading-none">{stats.ativos}</span>
                    <span className="text-[8px] font-black text-muted uppercase tracking-[0.2em] mt-1">Ativos</span>
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                 <div className="text-center rounded-2xl bg-surface-soft py-3 border border-border-subtle/30 shadow-nm-inset">
                   <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-1">Opera.</p>
                   <p className="text-xs font-black text-strong">{stats.operacional}</p>
                 </div>
                 <div className="text-center rounded-2xl bg-surface-soft py-3 border border-border-subtle/30 shadow-nm-inset">
                   <p className="text-[8px] font-black text-amber-500 uppercase tracking-widest mb-1">Manut.</p>
                   <p className="text-xs font-black text-strong">{stats.manutencao}</p>
                 </div>
                 <div className="text-center rounded-2xl bg-surface-soft py-3 border border-border-subtle/30 shadow-nm-inset">
                   <p className="text-[8px] font-black text-blue-500 uppercase tracking-widest mb-1">Cham.</p>
                   <p className="text-xs font-black text-strong">{stats.pendentes}</p>
                 </div>
              </div>
          </section>

          {/* Monitor de Atividade */}
          <section className="p-6 rounded-[2.5rem] bg-surface shadow-nm-flat border border-border-subtle/30 overflow-hidden">
            <h3 className="text-[10px] font-black text-strong uppercase tracking-[0.3em] mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-radar text-blue-500" />
                Monitor de Radar
              </div>
            </h3>
            <div className="space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-border-subtle/40 max-h-[320px] overflow-y-auto custom-scrollbar pr-2">
              {radarFeed.map(act => (
                <div key={act.id} className="relative flex gap-4 pl-1 group cursor-pointer" onClick={() => act.isChat && setIsPanelOpen(true)}>
                   <div className="w-5 h-5 rounded-full bg-surface shadow-nm-flat border border-border-subtle/50 flex items-center justify-center shrink-0 z-10">
                     {act.isChat ? (
                       <i className="fa-solid fa-comment text-[8px] text-indigo-500 animate-pulse" />
                     ) : (
                       <span className={`w-1.5 h-1.5 rounded-full ${act.color} group-hover:scale-150 transition-transform`} />
                     )}
                   </div>
                   <div>
                     <p className={`text-[11px] font-black leading-snug mb-1 ${act.isChat ? 'text-indigo-400' : 'text-strong'}`}>{act.text}</p>
                     <p className="text-[9px] text-muted font-bold uppercase tracking-tighter">Sync: {act.time} atrás</p>
                   </div>
                </div>
              ))}
            </div>
            <Link href="/movimentacoes" className="block w-full text-center mt-6 py-2.5 rounded-xl bg-surface-soft border border-border-subtle/50 text-[9px] font-black uppercase tracking-widest text-muted hover:text-blue-500 transition-all shadow-nm-inset">
              Ver Terminal Completo
            </Link>
          </section>

        </aside>
      </div>

      {reportData && (
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', zIndex: -9999 }}>
          <div 
            ref={reportRef} 
            className="p-16 text-strong font-sans" 
            style={{ width: '900px', minHeight: '1273px', backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', overflow: 'hidden' }}
          >
            {/* HEADER */}
            <div className="flex items-center justify-between border-b-2 border-border-subtle border-dashed pb-8 mb-8">
              <div>
                <h1 className="text-4xl font-black tracking-tighter text-blue-600 dark:text-blue-500 uppercase">
                  INVENTÁRIO E REDE
                </h1>
                <p className="text-sm font-bold tracking-widest uppercase text-muted mt-2">Relatório Analítico de Inventário e Rede</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-main">PERÍODO ({reportData.dias} DIAS)</p>
                <p className="text-xs text-muted uppercase tracking-widest">{new Date(new Date().setDate(new Date().getDate() - reportData.dias)).toLocaleDateString()} a {new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* RESUMO EXECUTIVO */}
            <div className="mb-10">
              <h2 className="text-sm font-black text-muted uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                <span className="w-10 h-[1px] bg-border-subtle" />
                Resumo Executivo
              </h2>
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-border-subtle/30 text-center">
                  <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Total Ativos</p>
                  <p className="text-3xl font-black mt-2">{reportData.totalAtivos}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-border-subtle/30 text-center">
                  <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Novos ({reportData.dias}d)</p>
                  <p className="text-3xl font-black mt-2">{reportData.novosAtivos.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-border-subtle/30 text-center">
                  <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest">Moviment.</p>
                  <p className="text-3xl font-black mt-2">{reportData.movRecentes.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-border-subtle/30 text-center">
                  <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Pendentes</p>
                  <p className="text-3xl font-black mt-2">{reportData.solPendentes}</p>
                </div>
              </div>
            </div>

            {/* EXPANSAO DE INVENTARIO */}
            <div className="mb-10">
              <h2 className="text-sm font-black text-muted uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                <span className="w-10 h-[1px] bg-border-subtle" />
                Expansão de Inventário
              </h2>
              {reportData.novosAtivos.length > 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden shadow-sm border border-border-subtle/30">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 border-b border-border-subtle/30 text-[10px] uppercase tracking-widest text-muted">
                      <tr>
                        <th className="py-4 px-6">Etiqueta</th>
                        <th className="py-4 px-6">Equipamento</th>
                        <th className="py-4 px-6 text-right">Tipo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.novosAtivos.map(e => (
                        <tr key={e.etiquetaID} className="border-b border-border-subtle/10 last:border-0">
                          <td className="py-3 px-6 font-bold text-[11px]">{e.etiquetaID}</td>
                          <td className="py-3 px-6 text-main font-medium">{e.marca} {e.modelo}</td>
                          <td className="py-3 px-6 text-muted font-medium text-right">{e.tipoEquipamento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 text-sm text-muted font-medium border border-dashed border-border-subtle/50 text-center">
                  Nenhum novo ativo registrado neste período.
                </div>
              )}
            </div>

            {/* MOVIMENTACOES */}
            <div className="mb-10">
              <h2 className="text-sm font-black text-muted uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                <span className="w-10 h-[1px] bg-border-subtle" />
                Logística e Movimentações
              </h2>
              {reportData.movRecentes.length > 0 ? (
                <div className="space-y-3">
                  {reportData.movRecentes.map(m => (
                    <div key={m.movimentacaoID} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-border-subtle/30 flex justify-between items-center">
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{m.tipoMovimentacao}</span>
                          <span className="text-sm font-bold text-main mt-1">{m.marca} {m.modelo} <span className="text-muted ml-2">&rarr; {m.novoDonoNome || 'Estoque/N/A'}</span></span>
                       </div>
                       <span className="text-[11px] text-muted font-bold tracking-widest">{new Date(m.dataHora || "").toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-3xl p-6 text-sm text-muted font-medium border border-dashed border-border-subtle/50 text-center">
                  Sem movimentações registradas nos últimos {reportData.dias} dias.
                </div>
              )}
            </div>

            {/* SOLICITACOES */}
            <div className="mb-10 flex gap-8">
              <div className="flex-1">
                <h2 className="text-sm font-black text-muted uppercase tracking-[0.4em] mb-6 flex items-center gap-4">
                  <span className="w-10 h-[1px] bg-border-subtle" />
                  Workflow e Demandas
                </h2>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-border-subtle/30 flex gap-10">
                   <div className="flex-1">
                       <p className="text-[10px] font-black uppercase text-muted tracking-widest">Volume ({reportData.dias}d)</p>
                       <p className="text-3xl font-black text-main mt-1">{reportData.solRecentes.length}</p>
                   </div>
                   <div className="flex-1">
                       <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Concluídas</p>
                       <p className="text-3xl font-black mt-1">{reportData.solConcluidas}</p>
                   </div>
                   <div className="flex-1">
                       <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest">Em Aberto</p>
                       <p className="text-3xl font-black mt-1">{reportData.solPendentes}</p>
                   </div>
                </div>

                {reportData.solRecentes.length > 0 && (
                  <div className="mt-6 space-y-3">
                     <p className="text-[10px] font-black text-muted uppercase tracking-widest">Detalhamento Recente</p>
                     {reportData.solRecentes.slice(0, 5).map(s => (
                        <div key={s.solicitacaoID} className="flex justify-between items-center text-xs pb-2 border-b border-border-subtle/20 last:border-0">
                           <div className="flex gap-4">
                              <span className="font-bold text-main">{s.protocolo}</span>
                              <span className="text-muted">{s.solicitanteNome}</span>
                           </div>
                           <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${s.status === 'concluido' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                              {s.status.replace("_", " ")}
                           </span>
                        </div>
                     ))}
                  </div>
                )}
              </div>

              <div className="w-64 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-dashed border-border-subtle/40 text-center relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full" />
                 <i className="fa-solid fa-satellite-dish text-4xl text-blue-500/50 mb-4" />
                 <p className="text-[10px] font-black uppercase tracking-widest text-muted">Gerado por</p>
                 <h3 className="text-lg font-black text-main uppercase tracking-tighter mt-1 mb-2">Inventário e Rede Hub</h3>
                 <p className="text-[9px] font-bold text-muted bg-surface-soft px-3 py-1 rounded-full shadow-nm-inset">{new Date().toLocaleString()}</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
