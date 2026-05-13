import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Equipamento, Colaborador } from '@/types';

interface MindMapProps {
  equipamentos: Equipamento[];
  colaboradores: Colaborador[];
  onAssetClick?: (eq: Equipamento) => void;
}

export function MindMap({ equipamentos, colaboradores, onAssetClick }: MindMapProps) {
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterSetor, setFilterSetor] = useState("");
  const centerRef = useRef<HTMLDivElement>(null);
  const sectorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [lines, setLines] = useState<{ x1: number, y1: number, x2: number, y2: number }[]>([]);
  const stageRef = useRef<HTMLDivElement>(null);

  const hierarchy = useMemo(() => {
    const activeCols = colaboradores.filter(c => c.ativo !== false);
    const sectors: Record<string, any> = {};

    activeCols.forEach(col => {
      const dept = col.departamento || "Sem Setor";
      
      // Filter by sector if selected
      if (filterSetor && dept !== filterSetor) return;

      if (!sectors[dept]) {
        sectors[dept] = { name: dept, collaborators: [] };
      }

      const colEqs = equipamentos.filter(eq => 
        eq.colaboradorAtualID === col.colaboradorID
      );

      sectors[dept].collaborators.push({
        id: col.colaboradorID,
        name: col.nome,
        equipments: colEqs
      });
    });

    return Object.values(sectors).sort((a, b) => a.name.localeCompare(b.name));
  }, [equipamentos, colaboradores, filterSetor]);

  const allSectors = useMemo(() => {
    const s = new Set<string>();
    colaboradores.forEach(c => { if(c.departamento) s.add(c.departamento); });
    return Array.from(s).sort();
  }, [colaboradores]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  useLayoutEffect(() => {
    const updateLines = () => {
      if (!centerRef.current) return;
      const stage = document.getElementById('mindmap-stage');
      if (!stage) return;
      const containerRect = stage.getBoundingClientRect();
      const centerRect = centerRef.current.getBoundingClientRect();

      const centerX = (centerRect.left + centerRect.width / 2) - containerRect.left;
      const centerY = (centerRect.bottom) - containerRect.top;

      const newLines = Object.entries(sectorRefs.current).map(([name, el]) => {
        if (!el) return null;
        const rect = (el as HTMLElement).getBoundingClientRect();
        
        const x1 = centerX / (zoom || 1);
        const y1 = centerY / (zoom || 1);
        const x2 = (rect.left + rect.width / 2 - containerRect.left) / (zoom || 1);
        const y2 = (rect.top - containerRect.top) / (zoom || 1);

        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) return null;

        return { x1, y1, x2, y2 };
      }).filter((l): l is { x1: number, y1: number, x2: number, y2: number } => l !== null);

      setLines(newLines);
    };

    updateLines();
    const t = setTimeout(updateLines, 50);
    const t2 = setTimeout(updateLines, 200);
    const t3 = setTimeout(updateLines, 1000);

    const observer = new ResizeObserver(updateLines);
    if (centerRef.current) observer.observe(centerRef.current);
    Object.values(sectorRefs.current).forEach(el => el && observer.observe(el as HTMLElement));

    window.addEventListener('resize', updateLines);
    return () => {
      observer.disconnect();
      clearTimeout(t);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', updateLines);
    };
  }, [hierarchy, zoom, isFullscreen]);

  // Handle native wheel event to prevent page scroll/zoom
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) > 0) {
        e.preventDefault();
        e.stopPropagation();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.min(2, Math.max(0.5, prev * scaleFactor)));
      }
    };

    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    
    // Prevent body scroll when in fullscreen
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(2, Math.max(0.5, prev + delta)));
  };

  const content = (
    <div 
      id="mindmap-container" 
      className={`bg-surface border border-border-subtle rounded-[2.5rem] overflow-hidden transition-all duration-300 flex flex-col ${
        isFullscreen 
          ? 'fixed inset-0 z-[99990] rounded-none !h-screen !w-screen top-0 left-0 m-0' 
          : 'h-[600px] shadow-nm-flat relative'
      }`}
    >
      {/* ToolBar */}
      <div className="p-5 border-b border-border-subtle bg-surface/80 backdrop-blur-md flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-surface-soft text-brand flex items-center justify-center shadow-nm-inset">
            <i className="fa-solid fa-network-wired text-lg"></i>
          </div>
          <div>
            <h3 className="text-sm font-black text-strong uppercase tracking-widest leading-none mb-1">Mapa Mental de Distribuição</h3>
            <p className="text-[10px] text-muted font-black uppercase tracking-tighter opacity-60">Visualização hierárquica do inventário</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-muted/40 pointer-events-none group-focus-within:text-brand transition-colors"></i>
            <input
              type="text"
              placeholder="Buscar no mapa (setor, pessoa...)"
              className="bg-surface-soft border-none rounded-xl py-1.5 pl-8 pr-4 text-[10px] font-black uppercase tracking-widest text-main placeholder-muted/30 focus:ring-2 focus:ring-brand/20 w-56 transition-all"
              onChange={(e) => {/* Implement local search if needed */}}
            />
          </div>
          
          <select 
            className="bg-surface-soft border-none rounded-xl py-1.5 px-3 text-[10px] font-black uppercase tracking-widest text-muted hover:text-brand cursor-pointer focus:ring-2 focus:ring-brand/20 transition-all"
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
          >
            <option value="">Todos os Setores</option>
            {allSectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <div className="h-6 w-px bg-border-subtle/50 mx-2"></div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-soft text-muted hover:text-strong transition-all"
              title="Zoom Out"
            >
              <i className="fa-solid fa-minus text-[10px]"></i>
            </button>
            <span className="text-[10px] font-black text-brand w-10 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface-soft text-muted hover:text-strong transition-all"
              title="Zoom In"
            >
              <i className="fa-solid fa-plus text-[10px]"></i>
            </button>
          </div>

          <div className="h-6 w-px bg-border-subtle/50 mx-2"></div>

          <button 
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-xl bg-surface-soft hover:bg-brand/10 text-muted hover:text-brand flex items-center justify-center transition-all shadow-nm-flat border border-border-subtle/50"
            title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
          >
            <i className={`fa-solid ${isFullscreen ? "fa-compress" : "fa-expand"} text-xs`}></i>
          </button>
        </div>
      </div>

      {/* Stage */}
      <div className="flex-1 relative overflow-auto cursor-grab active:cursor-grabbing p-16 no-scrollbar bg-[radial-gradient(circle,var(--border-subtle)_1px,transparent_1px)] bg-[size:32px_32px]">
        <div 
          className="origin-top transition-transform duration-200"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* Connection Lines Layer */}
          <svg className="absolute inset-0 pointer-events-none z-0 overflow-visible" style={{ width: '100%', height: '100%' }}>
            {lines.map((line, i) => (
              <path
                key={i}
                d={`M ${line.x1} ${line.y1} L ${line.x1} ${line.y1 + 20} L ${line.x2} ${line.y1 + 20} L ${line.x2} ${line.y2}`}
                fill="none"
                stroke="var(--brand)"
                strokeWidth="2"
                strokeOpacity="0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {/* Legend/Center */}
          <div className="flex flex-col items-center mb-16 relative z-10" ref={centerRef}>
            <div className="px-8 py-4 bg-brand text-white rounded-[2rem] shadow-xl shadow-brand/20 font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 hover:scale-105 transition-all">
              <i className="fa-solid fa-building"></i>
              Estoque Central
            </div>
            <div className="w-0.5 h-12 bg-gradient-to-b from-brand to-transparent"></div>
          </div>

          {/* Sectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 relative z-10">
            {hierarchy.map((setor) => (
              <div 
                key={setor.name} 
                className="flex flex-col gap-6"
                ref={el => { sectorRefs.current[setor.name] = el; }}
              >
                <div className="p-6 bg-surface border border-border-subtle rounded-[2.5rem] shadow-nm-flat hover-nm-elevated transition-all">
                  <div className="flex items-center justify-between mb-5">
                    <h4 className="font-black text-strong text-[10px] uppercase tracking-widest">{setor.name}</h4>
                    <span className="bg-brand/10 text-brand text-[10px] font-black px-3 py-1 rounded-full shadow-nm-inset">
                      {setor.collaborators.length}
                    </span>
                  </div>
                  
                  <div className="space-y-4">
                    {setor.collaborators.map((col: any) => (
                      <details key={col.id} className="group" open={setor.collaborators.length === 1}>
                        <summary className="flex items-center gap-3 cursor-pointer list-none hover:bg-surface-soft p-2 rounded-2xl transition-all">
                          <div className="w-8 h-8 rounded-xl bg-surface-soft flex items-center justify-center text-[10px] font-black text-muted group-open:bg-brand group-open:text-white group-open:shadow-lg transition-all shadow-nm-inset">
                            {col.name.charAt(0)}
                          </div>
                          <span className="text-xs font-bold text-main flex-1">{col.name}</span>
                          <i className="fa-solid fa-chevron-down text-[8px] text-muted opacity-40 group-open:rotate-180 transition-transform"></i>
                        </summary>
                        
                        <div className="mt-4 pl-11 flex flex-col gap-2">
                          {col.equipments.length === 0 ? (
                            <span className="text-[10px] text-muted font-black uppercase opacity-40 italic">Sem equipamentos</span>
                          ) : (
                            col.equipments.map((eq: any) => {
                              const getIcon = (tipo: string) => {
                                const t = (tipo || "").toLowerCase();
                                if (t.includes("switch")) return "fa-network-wired";
                                if (t.includes("router") || t.includes("roteador")) return "fa-route";
                                if (t.includes("firewall") || t.includes("fortigate") || t.includes("mikrotik")) return "fa-shield-halved";
                                if (t.includes("wifi") || t.includes("wlan") || t.includes("access point")) return "fa-wifi";
                                if (t.includes("server") || t.includes("servidor")) return "fa-server";
                                if (t.includes("nas") || t.includes("storage")) return "fa-database";
                                if (t.includes("ups") || t.includes("nobreak")) return "fa-battery-three-quarters";
                                if (t.includes("notebook") || t.includes("laptop")) return "fa-laptop";
                                if (t.includes("computador") || t.includes("desktop") || t.includes("pc") || t.includes("monitor")) return "fa-desktop";
                                if (t.includes("printer") || t.includes("impressora")) return "fa-print";
                                if (t.includes("phone") || t.includes("celular")) return "fa-mobile-screen";
                                if (t.includes("tablet") || t.includes("ipad")) return "fa-tablet-screen-button";
                                if (t.includes("video") || t.includes("camera")) return "fa-video";
                                return "fa-box";
                              };

                              return (
                                <button 
                                  key={eq.etiquetaID} 
                                  onClick={() => onAssetClick?.(eq)}
                                  className="w-full bg-surface-soft border border-border-subtle px-3 py-2 rounded-xl text-[10px] font-black text-main flex items-center gap-3 shadow-nm-flat hover:shadow-sm hover:border-brand/30 transition-all text-left group/btn"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-surface flex items-center justify-center text-muted group-hover/btn:text-brand transition-colors shadow-nm-inset">
                                    <i className={`fa-solid ${getIcon(eq.tipoEquipamento)} text-[10px]`}></i>
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                     <span className="uppercase tracking-tight leading-tight mb-0.5">{eq.marca} {eq.modelo}</span>
                                    <span className="text-[8px] opacity-40">#{eq.etiquetaID}</span>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}
