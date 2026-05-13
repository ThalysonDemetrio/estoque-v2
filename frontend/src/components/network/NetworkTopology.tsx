"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { RedeService, NetworkNode, NetworkConnection } from "@/services/rede.service";
import { useToast } from "@/contexts/ToastContext";
import { NetworkNodeSidebar } from "./NetworkNodeSidebar";

export interface NetworkTopologyProps {
  inventory: any[];
  pingResults: Record<string, "pending" | "online" | "offline">;
  isPingingAll: boolean;
  onPingAll: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onPingResult?: (ip: string, status: "online" | "offline") => void;
}

export function NetworkTopology({ 
  inventory, 
  pingResults, 
  isPingingAll, 
  onPingAll,
  onRefresh,
  onPingResult
}: NetworkTopologyProps) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [transform, setTransform] = useState({ x: 100, y: 100, scale: 1 });
  const [isDraggingNode, setIsDraggingNode] = useState(false);
  const [toolsPanelMode, setToolsPanelMode] = useState<"add" | "link" | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [linkForm, setLinkForm] = useState({
    source_equipment_id: "",
    target_equipment_id: "",
    connection_type: "wired" as NetworkConnection["connection_type"],
    label: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesLayerRef = useRef<HTMLDivElement>(null);
  const { success, error } = useToast();
  const panRafRef = useRef<number | null>(null);
  const pendingPanRef = useRef<{ dx: number; dy: number } | null>(null);
  const nodesRef = useRef<NetworkNode[]>([]);
  const activeDragRef = useRef<{ id: number; lastX: number; lastY: number; moved: boolean } | null>(null);
  const nodeDragRafRef = useRef<number | null>(null);
  const pendingNodeMoveRef = useRef<{ dx: number; dy: number } | null>(null);
  const suppressClickRef = useRef<number | null>(null);
  const norm = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const normLoose = (value: unknown) => norm(value).replace(/[^a-z0-9]/g, "");

  const normalizeConnType = (rawType: unknown, label: unknown): NetworkConnection["connection_type"] => {
    const t = norm(rawType);
    const l = norm(label);
    const combined = `${t} ${l}`;

    if (combined.includes("wifi") || combined.includes("wireless") || combined.includes("wlan")) {
      return "wireless";
    }

    if (
      combined.includes("problem") ||
      combined.includes("crit") ||
      combined.includes("falha") ||
      combined.includes("erro")
    ) {
      return "problem";
    }

    return "wired";
  };

  const buildNodeAliases = (node: Partial<NetworkNode>) => {
    const brandModel = `${node.marca || ""} ${node.modelo || ""}`.trim();
    const aliases = [
      norm(node.equipment_id),
      normLoose(node.equipment_id),
      norm(brandModel),
      normLoose(brandModel),
      norm(node.marca),
      normLoose(node.marca),
      norm(node.modelo),
      normLoose(node.modelo),
    ].filter(Boolean);
    return Array.from(new Set(aliases));
  };

  const findSwitchNode = (switchRef: string | undefined, nodeList: NetworkNode[]) => {
    const ref = norm(switchRef);
    if (!ref) return undefined;

    // Prioridade total: ID exato (Etiqueta)
    let match = nodeList.find((candidate) => norm(candidate.equipment_id) === ref);
    if (match) return match;

    // Fallback: Nome/Marca/Modelo exato (apenas se for uma string longa o suficiente para evitar colisões simples como "Switch")
    if (ref.length > 5) {
       match = nodeList.find((candidate) => {
          const brandModel = norm(`${candidate.marca || ""} ${candidate.modelo || ""}`);
          return brandModel === ref || brandModel.includes(ref);
       });
    }

    return match;
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [nodesData, connsData] = await Promise.all([
        RedeService.getTopologyNodes(),
        RedeService.getTopologyConnections(),
      ]);
      setNodes(nodesData);
      setConnections(connsData);
    } catch (err) {
      console.error("Erro ao buscar dados de topologia:", err);
      error("Erro ao carregar mapa de rede");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!Array.isArray(inventory) || inventory.length === 0) return;

    const byEquipmentId = new Map(
      inventory.map((item) => [norm(item?.etiquetaID), item])
    );
    setNodes((prev) =>
      prev.map((node) => {
        const inv = byEquipmentId.get(norm(node.equipment_id));
        if (!inv) return node;
        return {
          ...node,
          status: inv.status ?? node.status,
          tipo_equipamento: inv.tipoEquipamento ?? node.tipo_equipamento,
          marca: inv.marca ?? node.marca,
          modelo: inv.modelo ?? node.modelo,
          ip_address: inv.ip_address ?? node.ip_address,
          mac_address: inv.mac_address ?? node.mac_address,
          subnet_mask: inv.subnet_mask ?? node.subnet_mask,
          default_gateway: inv.default_gateway ?? node.default_gateway,
          dns_primary: inv.dns_primary ?? node.dns_primary,
          dns_secondary: inv.dns_secondary ?? node.dns_secondary,
          network_notes: inv.network_notes ?? node.network_notes,
          vlan_id: inv.vlan_id ?? node.vlan_id,
          switch_name: inv.switch_name ?? node.switch_name,
          switch_port: inv.switch_port ?? node.switch_port,
          usuarioNome: inv.usuarioNome ?? node.usuarioNome,
          localizacao: inv.localizacao ?? node.localizacao,
          fotoEquipamento: inv.fotoEquipamento ?? node.fotoEquipamento,
        };
      })
    );

    // Se houver novos itens no inventário com rede que não estão nos nodes, forçar recarregamento
    const existingIds = new Set(nodes.map(n => norm(n.equipment_id)));
    const hasMissing = inventory.some(item => 
       (item.ip_address || item.mac_address || item.switch_name || item.total_ports) && 
       !existingIds.has(norm(item.etiquetaID))
    );
    if (hasMissing && !loading) {
       // console.log("[TOPOLOGIA] Detectados novos nodes com rede. Recarregando...");
       fetchData();
    }
  }, [inventory]);


  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const active = activeDragRef.current;
      if (!active) return;

      if (!pendingNodeMoveRef.current) {
        pendingNodeMoveRef.current = { dx: 0, dy: 0 };
      }

      pendingNodeMoveRef.current.dx += (e.clientX - active.lastX) / transform.scale;
      pendingNodeMoveRef.current.dy += (e.clientY - active.lastY) / transform.scale;
      active.lastX = e.clientX;
      active.lastY = e.clientY;
      active.moved = true;

      if (nodeDragRafRef.current !== null) return;

      nodeDragRafRef.current = requestAnimationFrame(() => {
        const pending = pendingNodeMoveRef.current;
        pendingNodeMoveRef.current = null;
        nodeDragRafRef.current = null;
        if (!pending) return;

        setNodes((prev) =>
          prev.map((n) =>
            n.id === active.id
              ? {
                  ...n,
                  pos_x: Number(n.pos_x) + pending.dx,
                  pos_y: Number(n.pos_y) + pending.dy,
                }
              : n
          )
        );
      });
    };

    const onPointerUp = () => {
      const active = activeDragRef.current;
      if (!active) return;

      const movedNode = nodesRef.current.find((n) => n.id === active.id);
      if (movedNode) {
        saveNodePosition(active.id, movedNode.pos_x, movedNode.pos_y);
      }

      if (active.moved) {
        suppressClickRef.current = active.id;
      }

      activeDragRef.current = null;
      setIsDraggingNode(false);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [transform.scale]);

  // Removido useEffect de fullscreenchange nativo, usaremos estado interno manual

  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewport({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    return () => observer.disconnect();
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

  // Handle native wheel event to prevent page scroll/zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const scaleFactor = e.deltaY > 0 ? 0.95 : 1.05;
      const newScale = Math.min(Math.max(transform.scale * scaleFactor, 0.1), 3);
      
      if (panRafRef.current !== null) return;
      
      panRafRef.current = requestAnimationFrame(() => {
        panRafRef.current = null;
        setTransform((prev) => ({ ...prev, scale: newScale }));
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [transform.scale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
  }, [viewport]);

  useEffect(() => {
    const el = nodesLayerRef.current;
    if (!el) return;
    el.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`;
    el.style.transformOrigin = "0 0";
  }, [transform]);

  useEffect(() => {
    return () => {
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current);
      }
    };
  }, []);

  // Draw background grid only when transform/viewport changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      ctx.save();
      ctx.strokeStyle = "rgba(100, 116, 139, 0.05)";
      ctx.lineWidth = 1;
      const gridSize = 50 * transform.scale;
      const startX = transform.x % gridSize;
      const startY = transform.y % gridSize;

      for (let x = startX; x < rect.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, rect.height);
        ctx.stroke();
      }

      for (let y = startY; y < rect.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(rect.width, y);
        ctx.stroke();
      }

      ctx.restore();
    });

    return () => cancelAnimationFrame(frame);
  }, [transform, viewport]);

  const handleZoom = (e: React.WheelEvent) => {
    // Handled by native listener for non-passive support
  };

  const handlePan = (e: React.MouseEvent) => {
    if (e.buttons !== 1 || isDraggingNode) return;
    if (!pendingPanRef.current) {
      pendingPanRef.current = { dx: 0, dy: 0 };
    }

    pendingPanRef.current.dx += e.movementX;
    pendingPanRef.current.dy += e.movementY;

    if (panRafRef.current !== null) return;

    panRafRef.current = requestAnimationFrame(() => {
      const pending = pendingPanRef.current;
      pendingPanRef.current = null;
      panRafRef.current = null;
      if (!pending) return;

      setTransform((prev) => ({
        ...prev,
        x: prev.x + pending.dx,
        y: prev.y + pending.dy,
      }));
    });
  };

  const saveNodePosition = async (id: number, x: number, y: number) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;

    const posX = Number(x);
    const posY = Number(y);
    if (!Number.isFinite(posX) || !Number.isFinite(posY)) {
      error("Posição inválida para salvar");
      return;
    }

    try {
      if (id < 0) {
        // New node (implicit), create it permanently in the DB
        const result = await RedeService.upsertTopologyNode({
          equipment_id: node.equipment_id,
          pos_x: posX,
          pos_y: posY
        });
        if (result?.id) {
          // Update local state ID so future moves use PUT
          setNodes(prev => prev.map(n => n.equipment_id === node.equipment_id ? { ...n, id: result.id } : n));
        }
      } else {
        await RedeService.updateTopologyNodePosition(id, { pos_x: posX, pos_y: posY });
      }
    } catch (err) {
      error("Erro ao salvar posição");
    }
  };

  const switchesOnly = useMemo(
    () => nodes.filter(n => (n.tipo_equipamento || "").toLowerCase().includes("switch")),
    [nodes]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const visibleConnections = useMemo(() => {
    if (nodes.length === 0) return [];

    // Pre-calculate node map for O(1) lookups by equipment_id
    const nodeMap = new Map<string, NetworkNode>();
    nodes.forEach(n => {
      nodeMap.set(norm(n.equipment_id), n);
    });

    const autoConns: NetworkConnection[] = [];
    nodes.forEach((node) => {
      if (!node.switch_name || !node.switch_port) return;
      
      const sName = node.switch_name.trim();
      const sPort = node.switch_port.trim();
      if (sName === "" || sPort === "") return;

      const switchNode = findSwitchNode(sName, nodes);
      if (!switchNode) return;

      const nodeEqId = norm(node.equipment_id);
      const switchEqId = norm(switchNode.equipment_id);
      if (switchEqId === nodeEqId) return;

      autoConns.push({
        id: -Math.abs(node.id * 1000 + switchNode.id),
        source_equipment_id: node.equipment_id,
        target_equipment_id: switchNode.equipment_id,
        connection_type: normalizeConnType("", node.switch_port),
        label: node.switch_port || "",
      });
    });

    const filteredManualConns = connections.filter(conn => {
      const srcId = norm(conn.source_equipment_id);
      const tgtId = norm(conn.target_equipment_id);
      
      const srcNode = nodeMap.get(srcId);
      const tgtNode = nodeMap.get(tgtId);
      if (!srcNode || !tgtNode) return false;

      const srcIsSwitch = srcNode.tipo_equipamento?.toLowerCase().includes("switch");
      const tgtIsSwitch = tgtNode.tipo_equipamento?.toLowerCase().includes("switch");

      if (srcIsSwitch && !tgtIsSwitch) {
        if (!tgtNode.switch_name || norm(tgtNode.switch_name) !== srcId) return false;
      }
      if (tgtIsSwitch && !srcIsSwitch) {
        if (!srcNode.switch_name || norm(srcNode.switch_name) !== tgtId) return false;
      }

      return !autoConns.some(ac => 
        (norm(ac.source_equipment_id) === srcId && norm(ac.target_equipment_id) === tgtId) ||
        (norm(ac.source_equipment_id) === tgtId && norm(ac.target_equipment_id) === srcId)
      );
    });

    return [...filteredManualConns, ...autoConns]
      .map((conn) => {
        const source = nodeMap.get(norm(conn.source_equipment_id));
        const target = nodeMap.get(norm(conn.target_equipment_id));
        if (!source || !target) return null;

        return { 
          conn, 
          source, 
          target, 
          type: normalizeConnType(conn.connection_type, conn.label), 
          selected: selectedNodeId === source.id || selectedNodeId === target.id,
          isValid: Number.isFinite(source.pos_x) && Number.isFinite(source.pos_y) && 
                   Number.isFinite(target.pos_x) && Number.isFinite(target.pos_y)
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item && item.isValid));
  }, [nodes, connections, selectedNodeId]);

  const availableForAdd = useMemo(() => {
    const existingIds = new Set(nodes.map((n) => n.equipment_id));
    return inventory.filter((item) => !existingIds.has(item.etiquetaID));
  }, [inventory, nodes]);

  const handleAddDevice = async (equip: any) => {
    try {
      const newNode: Partial<NetworkNode> = {
        equipment_id: equip.etiquetaID,
        status: equip.status,
        tipo_equipamento: equip.tipoEquipamento,
        marca: equip.marca,
        modelo: equip.modelo,
        ip_address: equip.ip_address,
        mac_address: equip.mac_address,
        subnet_mask: equip.subnet_mask,
        default_gateway: equip.default_gateway,
        dns_primary: equip.dns_primary,
        dns_secondary: equip.dns_secondary,
        network_notes: equip.network_notes,
        switch_name: equip.switch_name,
        switch_port: equip.switch_port,
        vlan_id: equip.vlan_id,
        usuarioNome: equip.usuarioNome,
        localizacao: equip.localizacao,
        pos_x: 400 + (Math.random() * 100),
        pos_y: 300 + (Math.random() * 100)
      };
      
      const created = await RedeService.upsertTopologyNode(newNode);
      // Merge inventory info with topology record for immediate UI update
      const fullNode = { ...equip, ...created, equipment_id: equip.etiquetaID, tipo_equipamento: equip.tipo || equip.tipoEquipamento };
      setNodes([...nodes, fullNode]);
      setToolsPanelMode(null);
      success(`Dispositivo ${equip.etiquetaID} mapeado com sucesso`);

      // Auto-Connection Logic: usa equipment_id diretamente (switch_name = etiqueta_id do switch)
      if (equip.switch_name) {
        const targetNode = findSwitchNode(equip.switch_name, nodes);
         if (targetNode) {
            await RedeService.createTopologyConnection({
               source_equipment_id: created.equipment_id,
               target_equipment_id: targetNode.equipment_id,
               connection_type: "wired",
               label: equip.switch_port || "Auto-Link"
            });
            const updatedConns = await RedeService.getTopologyConnections();
            setConnections(updatedConns);
            success(`Auto-conexão estabelecida com ${equip.switch_name}`);
         }
      }
    } catch (err) {
      error("Erro ao mapear dispositivo");
    }
  };

  const handleUpdateNode = (updated: NetworkNode) => {
    setNodes(nodes.map(n => n.id === updated.id ? updated : n));
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openManualLinkMenu = () => {
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    setLinkForm((prev) => ({
      ...prev,
      source_equipment_id: selectedNode?.equipment_id || prev.source_equipment_id || nodes[0]?.equipment_id || "",
      target_equipment_id: prev.target_equipment_id || nodes[1]?.equipment_id || "",
    }));
    setToolsPanelMode((prev) => (prev === "link" ? null : "link"));
  };

  const handleCreateManualLink = async () => {
    const source = linkForm.source_equipment_id;
    const target = linkForm.target_equipment_id;

    if (!source || !target || norm(source) === norm(target)) {
      error("Selecione origem e destino diferentes");
      return;
    }

    const exists = connections.some((conn) =>
      (norm(conn.source_equipment_id) === norm(source) && norm(conn.target_equipment_id) === norm(target)) ||
      (norm(conn.source_equipment_id) === norm(target) && norm(conn.target_equipment_id) === norm(source))
    );

    if (exists) {
      error("Essa conexao ja existe no mapa");
      return;
    }

    try {
      const created = await RedeService.createTopologyConnection({
        source_equipment_id: source,
        target_equipment_id: target,
        connection_type: linkForm.connection_type,
        label: linkForm.label || undefined,
      });

      if (created) {
        setConnections((prev) => [...prev, created]);
      } else {
        const updatedConns = await RedeService.getTopologyConnections();
        setConnections(updatedConns);
      }

      success("Conexao criada com sucesso");
      setToolsPanelMode(null);
      setLinkForm((prev) => ({ ...prev, label: "" }));
    } catch {
      error("Erro ao criar conexao manual");
    }
  };

  const rectCenter = () => {
     if(!containerRef.current) return { x: 400, y: 300 };
     const rect = containerRef.current.getBoundingClientRect();
     return { x: rect.width / 2, y: rect.height / 2 };
  };

  const getIcon = (tipo: string) => {
    const t = (tipo || "").toLowerCase();
    
    // Infraestrutura e Rede
    if (t.includes("switch")) return "fa-network-wired";
    if (t.includes("router") || t.includes("roteador")) return "fa-route";
    if (t.includes("firewall") || t.includes("fortigate") || t.includes("mikrotik")) return "fa-shield-halved";
    if (t.includes("wifi") || t.includes("wlan") || t.includes("access point") || t.includes("ubiquiti") || t.includes("unifi")) return "fa-wifi";
    if (t.includes("modem")) return "fa-bridge";
    if (t.includes("antena") || t.includes("radio")) return "fa-tower-broadcast";
    
    // Servidores e Armazenamento
    if (t.includes("server") || t.includes("servidor")) return "fa-server";
    if (t.includes("nas") || t.includes("storage")) return "fa-database";
    if (t.includes("ups") || t.includes("nobreak") || t.includes("bateria")) return "fa-battery-three-quarters";
    
    // End-points e Periféricos
    if (t.includes("computador") || t.includes("desktop") || t.includes("pc") || t.includes("monitor") || t.includes("tela")) return "fa-desktop";
    if (t.includes("notebook") || t.includes("laptop") || t.includes("macbook")) return "fa-laptop";
    if (t.includes("printer") || t.includes("impressora") || t.includes("plotter")) return "fa-print";
    if (t.includes("phone") || t.includes("celular") || t.includes("smartphone")) return "fa-mobile-screen";
    if (t.includes("tablet") || t.includes("ipad")) return "fa-tablet-screen-button";
    
    // Segurança e IoT
    if (t.includes("video") || t.includes("camera") || t.includes("dvr") || t.includes("nvr")) return "fa-video";
    if (t.includes("tv") || t.includes("smart tv")) return "fa-tv";
    if (t.includes("biometria") || t.includes("facial") || t.includes("controle de acesso")) return "fa-fingerprint";
    
    return "fa-box-open";
  };

  const handleOpenDetail = (node: any) => {
     setSelectedNodeId(node.id);
  };

  const handlePingAll = async () => {
    await onPingAll();
  };

  const content = (
    <div
      ref={containerRef}
      className={`network-topology-surface relative w-full h-[700px] bg-[#020617] border border-white/5 rounded-[2.5rem] overflow-hidden cursor-crosshair shadow-2xl transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-[99990] rounded-none !h-screen !w-screen top-0 left-0 m-0' : ''}`}
      onWheel={handleZoom}
      onMouseMove={handlePan}
    >
      {/* Cinematic Background Scanlines */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%)] z-0 opacity-20"></div>

      {/* Canvas for connections & grid */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

      {/* SVG layer for robust connection rendering */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-[15]"
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
          {visibleConnections.map(({ conn, source, target, type, selected }) => (
            <line
              key={`conn-${conn.id}-${source.id}-${target.id}`}
              x1={source.pos_x}
              y1={source.pos_y}
              x2={target.pos_x}
              y2={target.pos_y}
              stroke={type === "problem" ? "#ef4444" : "#3b82f6"}
              strokeOpacity={selected ? 1 : 0.98}
              strokeWidth={selected ? 4 : 3}
              strokeDasharray={type === "wireless" ? "8 6" : undefined}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      </svg>

      {/* Nodes Container */}
      <div
        ref={nodesLayerRef}
        className="absolute inset-0 z-20 origin-top-left will-change-transform"
      >
        {nodes.map((node) => (
          <motion.div
            key={node.id}
            onPointerDown={(e: React.PointerEvent) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              activeDragRef.current = {
                id: node.id,
                lastX: e.clientX,
                lastY: e.clientY,
                moved: false,
              };
              setIsDraggingNode(true);
            }}
            onPointerUp={() => {
              // pointerup global handler finalizes movement and save
            }}
            initial={false}
            style={{ position: "absolute", left: node.pos_x, top: node.pos_y, x: "-50%", y: "-50%" }}
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              if (suppressClickRef.current === node.id) {
                suppressClickRef.current = null;
                return;
              }
              handleOpenDetail(node);
            }}
            className="group relative cursor-grab active:cursor-grabbing"
          >
            {/* Status Pulse Simplified */}
            <div className={`absolute -inset-4 rounded-full opacity-10 transition-all ${selectedNodeId === node.id ? 'bg-blue-400 scale-150' : 'bg-blue-500 scale-100 group-hover:scale-125'}`}></div>
            
            <div className={`
              w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-300 relative z-10 overflow-hidden
              ${selectedNodeId === node.id 
                ? "bg-white text-blue-600 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-2 ring-blue-500/20 scale-110" 
                : "bg-slate-900 text-blue-400 shadow-lg border border-white/5 hover:border-blue-500/30 hover:text-blue-300"
              }
            `}>
               <i className={`fa-solid ${getIcon(node.tipo_equipamento || "")} text-2xl`}></i>
               
               {/* Ping Status Indicator Dot */}
               {node.ip_address && (
                 <div 
                   className={`
                     absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-slate-900 transition-colors duration-500
                     ${!pingResults[node.ip_address] || pingResults[node.ip_address] === "pending" 
                       ? "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" 
                       : pingResults[node.ip_address] === "online"
                       ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                       : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                     }
                     ${isPingingAll ? "animate-pulse" : ""}
                   `}
                   title={pingResults[node.ip_address] === "online" ? "Online" : pingResults[node.ip_address] === "offline" ? "Offline" : "Pendente"}
                 ></div>
               )}

               {!node.ip_address && (
                 <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-slate-900 opacity-50"></div>
               )}
            </div>
            
            {/* Permanent Cyber Label (Mini) */}
            <div className={`
              absolute top-14 left-1/2 -translate-x-1/2 w-36 text-center pointer-events-none transition-all duration-300
              ${selectedNodeId === node.id ? 'opacity-100 scale-110 z-30' : 'opacity-70 scale-100 z-10'}
            `}>
               <p className="text-[9px] font-bold text-slate-200 drop-shadow-md truncate">{node.marca} {node.modelo}</p>
               <p className="text-[8px] font-mono text-blue-400 drop-shadow-md">{node.ip_address || "SEM IP"}</p>
               {node.usuarioNome && (
                 <p className="text-[8px] font-bold text-slate-500 truncate mt-0.5" title={node.usuarioNome}>
                   <i className="fa-solid fa-user text-[8px] mr-1 opacity-50"></i>{node.usuarioNome}
                 </p>
               )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* HUD Overlay Controls Simplified */}
      <div className="absolute top-8 left-8 flex flex-col gap-3 z-30">
        <button
          onClick={() => setTransform({ x: 100, y: 100, scale: 1 })}
          className="w-12 h-12 bg-slate-900 border border-white/5 rounded-2xl flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-95"
          title="Centralizar Visão"
        >
          <i className="fa-solid fa-crosshairs"></i>
        </button>
        <button
          onClick={() => setToolsPanelMode((prev) => (prev === "add" ? null : "add"))}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 border ${toolsPanelMode === "add" ? "bg-blue-600 border-blue-400 text-white" : "bg-slate-900 border-white/5 text-slate-400"}`}
          title="Mapear Novo Dispositivo"
        >
          <i className="fa-solid fa-plus-minus"></i>
        </button>
        <button
          onClick={openManualLinkMenu}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 border ${toolsPanelMode === "link" ? "bg-emerald-600 border-emerald-400 text-white" : "bg-slate-900 border-white/5 text-slate-400"}`}
          title="Criar Conexao Manual"
        >
          <i className="fa-solid fa-link"></i>
        </button>

        <div className="w-12 h-px bg-white/5 my-2"></div>

        <button
          onClick={handlePingAll}
          disabled={isPingingAll}
          className={`
            w-12 h-12 rounded-2xl flex items-center justify-center transition-all shadow-xl hover:scale-110 active:scale-95 border
            ${isPingingAll 
              ? "bg-blue-600/30 border-blue-500/50 text-blue-400 cursor-wait" 
              : "bg-slate-900 border-white/5 text-blue-400 hover:text-blue-300 hover:border-blue-500/30"
            }
          `}
          title="Verificar Conectividade (Ping All)"
        >
          <i className={`fa-solid ${isPingingAll ? "fa-circle-notch fa-spin" : "fa-bolt-lightning"}`}></i>
        </button>
      </div>

      {/* Legend & Stats HUD Simplified */}
      <div className="absolute bottom-8 left-8 bg-slate-950 border border-white/5 rounded-3xl p-6 z-30 flex gap-8 shadow-2xl">
         <div className="flex flex-col gap-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Protocolos</p>
            <div className="flex items-center gap-6">
               <div className="flex items-center gap-2 group cursor-help" title="Cabo Ethernet">
                  <div className="w-4 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                  <span className="text-[10px] font-bold text-slate-300">WIRED</span>
               </div>
               <div className="flex items-center gap-2 group cursor-help" title="Conexão Wireless">
                  <div className="w-4 h-1 border-t-2 border-dashed border-slate-500"></div>
                  <span className="text-[10px] font-bold text-slate-300">WIFI</span>
               </div>
               <div className="flex items-center gap-2 group cursor-help" title="Falha no Link">
                  <div className="w-4 h-1 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
                  <span className="text-[10px] font-bold text-slate-300">CRIT</span>
               </div>
            </div>
         </div>
         <div className="w-px h-10 bg-white/5"></div>
         <div className="flex flex-col">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Taxa de Dados</p>
            <div className="flex items-baseline gap-1">
               <span className="text-xl font-black text-white italic">1.2</span>
               <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Gbps</span>
            </div>
         </div>
      </div>

      {/* Tools Sidebar */}
      <AnimatePresence>
        {toolsPanelMode && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="absolute right-0 top-0 h-full w-full md:w-1/2 bg-[#0f172a] backdrop-blur-xl border-l border-white/10 shadow-2xl z-40 flex flex-col text-[#ffffff]"
          >
            <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setToolsPanelMode("add")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${toolsPanelMode === "add" ? "bg-[#2563eb] text-[#ffffff]" : "bg-[#1e293b] text-[#ffffff]/60"}`}
                >
                  Mapear
                </button>
                <button
                  onClick={() => setToolsPanelMode("link")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${toolsPanelMode === "link" ? "bg-[#059669] text-[#ffffff]" : "bg-[#1e293b] text-[#ffffff]/60"}`}
                >
                  Conexao
                </button>
              </div>
              <button
                onClick={() => setToolsPanelMode(null)}
                className="w-9 h-9 rounded-xl bg-[#1e293b] text-[#ffffff] hover:bg-[#334155]"
                title="Fechar painel"
                aria-label="Fechar painel"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {toolsPanelMode === "add" ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">Escaneando Inventário...</p>
                  {availableForAdd.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 font-bold uppercase tracking-widest">
                      Fim da Fila de Mapeamento
                    </div>
                  ) : (
                    availableForAdd.map((item) => (
                      <button
                        key={item.etiquetaID}
                        onClick={() => handleAddDevice(item)}
                        className="w-full text-left p-3 rounded-2xl bg-surface-soft dark:bg-white/5 hover:bg-surface-tertiary dark:hover:bg-white/10 border border-border-subtle dark:border-white/5 hover:border-brand/30 transition-all flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-surface-tertiary dark:bg-slate-800 flex items-center justify-center text-brand dark:text-blue-400 group-hover:scale-110 transition-transform">
                          <i className={`fa-solid ${getIcon(item.tipoEquipamento)} text-xs`}></i>
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black text-strong dark:text-white tracking-tight">{item.etiquetaID}</div>
                          <div className="text-[9px] font-bold text-muted dark:text-slate-500 uppercase truncate mt-0.5">{item.marca} {item.modelo}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-sm font-black text-strong dark:text-white uppercase tracking-[0.2em]">Fluxo de Conexão Manual</h2>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2 block">Origem (Switch/Router)</label>
                    <select
                      value={linkForm.source_equipment_id}
                      onChange={(e) => setLinkForm((prev) => ({ ...prev, source_equipment_id: e.target.value }))}
                      title="Origem da conexao"
                      aria-label="Origem da conexao"
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                    >
                      <option value="">Selecione a origem</option>
                      {nodes.map((n) => (
                        <option key={`src-${n.id}`} value={n.equipment_id}>
                          {n.equipment_id} - {n.marca || ""} {n.modelo || ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2 block">Destino (Equipamento)</label>
                    <select
                      value={linkForm.target_equipment_id}
                      onChange={(e) => setLinkForm((prev) => ({ ...prev, target_equipment_id: e.target.value }))}
                      title="Destino da conexao"
                      aria-label="Destino da conexao"
                      className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                    >
                      <option value="">Selecione o destino</option>
                      {nodes.map((n) => (
                        <option key={`dst-${n.id}`} value={n.equipment_id}>
                          {n.equipment_id} - {n.marca || ""} {n.modelo || ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2 block">Tipo de Link</label>
                      <select
                        value={linkForm.connection_type}
                        onChange={(e) => setLinkForm((prev) => ({ ...prev, connection_type: e.target.value as NetworkConnection["connection_type"] }))}
                        title="Tipo da conexao"
                        aria-label="Tipo da conexao"
                        className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-[#ffffff] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [color-scheme:dark]"
                      >
                        <option value="wired">Wired (azul)</option>
                        <option value="wireless">WiFi (pontilhado)</option>
                        <option value="problem">Critico (vermelho)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-[#94a3b8] uppercase tracking-widest mb-2 block">Rótulo da Porta (Ex: Port 1)</label>
                      <input
                        value={linkForm.label}
                        onChange={(e) => setLinkForm((prev) => ({ ...prev, label: e.target.value }))}
                        placeholder="Ex: Gi1/0/24"
                        className="w-full bg-[#1e293b]/50 border border-white/10 rounded-xl px-4 py-3 text-sm font-black text-[#ffffff] placeholder:text-[#94a3b8]/50 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-nm-inset"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreateManualLink}
                      className="flex-1 py-2.5 rounded-xl bg-[#059669] hover:bg-[#10b981] text-[#ffffff] text-[10px] font-black uppercase tracking-widest shadow-lg"
                    >
                      Criar Linha
                    </button>
                    <button
                      onClick={() => setToolsPanelMode(null)}
                      className="flex-1 py-2.5 rounded-xl bg-[#1e293b] hover:bg-[#334155] text-[#ffffff] text-[10px] font-black uppercase tracking-widest"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Sidebar Component */}
      <NetworkNodeSidebar 
        node={nodes.find(n => n.id === selectedNodeId) || null}
        isOpen={selectedNodeId !== null}
        onClose={() => setSelectedNodeId(null)}
        onUpdate={handleUpdateNode}
        switches={switchesOnly}
        allNodes={nodes}
        onRefresh={onRefresh}
        onPingResult={onPingResult}
      />

      {loading && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
           <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin mb-4"></div>
           <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em]">Decodificando Topologia...</p>
        </div>
      )}
    </div>
  );

  if (isFullscreen && typeof document !== "undefined") {
    return createPortal(content, document.body);
  }

  return content;
}
