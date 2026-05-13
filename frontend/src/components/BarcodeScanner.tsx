"use client";

import { useEffect, useRef, useState } from "react";
import { SlidebarPanel } from "@/components/layout/SlidebarPanel";
import { useTheme } from "@/contexts/ThemeContext";

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  title?: string;
}

declare global {
  interface Window { Html5Qrcode: any; }
}

export function BarcodeScanner({ isOpen, onClose, onScan, title = "Scanner de Código de Barras" }: BarcodeScannerProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [status, setStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [manualCode, setManualCode] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [libLoaded, setLibLoaded] = useState(false);
  const scannerRef = useRef<any>(null);

  // Dynamically load Html5Qrcode
  useEffect(() => {
    if (typeof window.Html5Qrcode !== "undefined") {
      setLibLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.onload = () => setLibLoaded(true);
    script.onerror = () => setErrorMsg("Falha ao carregar biblioteca de scanner.");
    document.head.appendChild(script);
  }, []);

  const startCamera = async () => {
    if (!libLoaded || !window.Html5Qrcode) {
      setErrorMsg("Biblioteca de scanner ainda não carregou.");
      return;
    }

    setStatus("starting");
    setErrorMsg("");

    try {
      const divId = "qr-scanner-container";
      scannerRef.current = new window.Html5Qrcode(divId);

      // Definição de formatos para otimizar a leitura
      const config = {
        fps: 25,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          // Caixa de leitura equilibrada, condizente com o overlay visual (280x180)
          return { width: 280, height: 180 };
        },
        aspectRatio: 1.0,
        useBarCodeDetectorIfSupported: true,
        // Habilitar processamento de múltiplos formatos
        formatsToSupport: [
          0, // QR_CODE
          5, // CODE_128
          3, // CODE_39
          8, // EAN_13
        ]
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (decoded: string) => {
          // Beep feedback
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 900; gain.gain.value = 0.3;
            osc.start(); osc.stop(ctx.currentTime + 0.12);
          } catch {}

          stopCamera();
          onScan(decoded);
          onClose();
        },
        () => { /* ignore scan failures */ }
      );
      setStatus("active");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message?.includes("Permission") || err?.message?.includes("NotAllowed")
        ? "Permissão de câmera negada. Autorize no navegador."
        : "Não foi possível acessar a câmera."
      );
    }
  };

  const stopCamera = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().catch(() => {});
      scannerRef.current = null;
    }
    setStatus("idle");
  };

  const handleClose = () => {
    stopCamera();
    setManualCode("");
    setErrorMsg("");
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      onClose();
    }
  };

  // Handle start/stop of camera based on isOpen and status
  useEffect(() => {
    if (isOpen) {
      if (status === "idle" && libLoaded) {
        startCamera();
      }
    } else {
      if (status !== "idle") {
        stopCamera();
      }
    }
  }, [isOpen, status, libLoaded]);

  if (!isOpen) return null;

  return (
    <SlidebarPanel
      isOpen={isOpen}
      onClose={handleClose}
      className="z-[9998]"
      panelClassName={`${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} h-full w-full shadow-2xl overflow-hidden flex flex-col border-l`}
      withAnimation={true}
    >
        {/* Header */}
        <div className={`${isDark ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-900 border-b border-slate-200"} px-5 py-4 flex items-center justify-between`}>
          <h3 className="font-bold flex items-center gap-2">
            <i className="fa-solid fa-barcode text-emerald-400"></i> {title}
          </h3>
          <button onClick={handleClose} title="Fechar scanner" aria-label="Fechar scanner" className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-slate-200"}`}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Camera View Box */}
          <div className={`relative rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center ${isDark ? "bg-slate-900" : "bg-slate-100 border border-slate-200"}`}>
            <div id="qr-scanner-container" className="w-full h-full"></div>

            {status !== "active" && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 ${isDark ? "text-white bg-slate-900" : "text-slate-800 bg-slate-100"}`}>
                <i className={`fa-solid text-4xl ${status === "starting" ? "fa-spinner fa-spin text-emerald-400" : status === "error" ? "fa-circle-xmark text-red-400" : "fa-camera text-slate-400"}`}></i>
                <p className={`text-sm ${isDark ? "text-slate-300" : "text-slate-500"}`}>
                  {status === "starting" ? "Iniciando câmera..." : status === "error" ? errorMsg : "Câmera desligada"}
                </p>
                {/* Targeting crosshair overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-36 border-2 border-emerald-400/40 rounded-lg"></div>
                </div>
              </div>
            )}

            {/* Active overlay guide */}
            {status === "active" && (
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[180px] border-2 border-emerald-400 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl"></div>
                  <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-emerald-400/50 animate-pulse"></div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {status !== "active" ? (
              <button onClick={startCamera} disabled={status === "starting"}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <i className="fa-solid fa-camera"></i> Iniciar Câmera
              </button>
            ) : (
              <button onClick={stopCamera}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                <i className="fa-solid fa-stop"></i> Parar Câmera
              </button>
            )}
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm py-2 px-3 rounded-lg">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>{errorMsg}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400">ou informe manualmente</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          {/* Manual input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text" value={manualCode} onChange={e => setManualCode(e.target.value)}
              placeholder="Digite o código / etiqueta..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button type="submit" disabled={!manualCode.trim()}
              className={`${isDark ? "bg-slate-700 hover:bg-slate-600" : "bg-indigo-600 hover:bg-indigo-700"} text-white px-4 rounded-xl font-medium disabled:opacity-40 transition-colors`}>
              OK
            </button>
          </form>
        </div>
    </SlidebarPanel>
  );
}
