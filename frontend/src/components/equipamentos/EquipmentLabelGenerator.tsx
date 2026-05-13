"use client";

import { useRef } from "react";
import Barcode from "react-barcode";
import { QRCodeSVG } from "qrcode.react";
import { domToDataUrl } from "modern-screenshot";
import { Equipamento } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";

interface Props {
  equipamento: Equipamento | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EquipmentLabelGenerator({ equipamento, isOpen, onClose }: Props) {
  const labelRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const handleDownload = async () => {
    if (!labelRef.current || !equipamento) return;
    
    try {
      const dataUrl = await domToDataUrl(labelRef.current, {
        scale: 4,
        backgroundColor: "#ffffff",
      });
      
      const link = document.createElement("a");
      link.download = `etiqueta-${equipamento.etiquetaID}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Erro ao gerar imagem:", err);
    }
  };

  if (!equipamento) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full max-w-md ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} border rounded-[2.5rem] shadow-2xl overflow-hidden`}
          >
            <div className="p-8 space-y-8">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}>Etiqueta do Ativo</h3>
                  <p className="text-[10px] font-black text-brand uppercase tracking-widest mt-1">Pronta para impressão</p>
                </div>
                <button onClick={onClose} className="text-muted hover:text-strong transition-colors">
                  <i className="fa-solid fa-xmark text-xl"></i>
                </button>
              </div>

              {/* The Visual Label (Hidden from layout but used for capture or shown in modal) */}
              <div className="flex items-center justify-center py-6">
                <div 
                  ref={labelRef}
                  className="bg-white p-8 rounded-2xl shadow-nm-flat border border-slate-100 flex flex-col items-center gap-6"
                  style={{ width: "350px", backgroundColor: "#ffffff", color: "#000000" }}
                >
                  <div className="text-center space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: "#475569" }}>Patrimônio</p>
                    <p className="text-2xl font-black leading-none" style={{ color: "#000000" }}>{equipamento.etiquetaID}</p>
                    <p className="text-[10px] font-bold uppercase" style={{ color: "#1e293b" }}>{equipamento.marca} {equipamento.modelo}</p>
                  </div>

                  <div className="w-full flex justify-center bg-white p-2" style={{ backgroundColor: "#ffffff" }}>
                    <Barcode 
                      value={equipamento.etiquetaID} 
                      width={2} 
                      height={60} 
                      fontSize={12}
                      background="#ffffff"
                      lineColor="#000000"
                      margin={0}
                    />
                  </div>

                  <div className="w-full flex items-center justify-between gap-6 pt-4 border-t border-slate-100" style={{ borderTopColor: "#f1f5f9" }}>
                    <div style={{ backgroundColor: "#ffffff", padding: "4px", borderRadius: "4px" }}>
                      <QRCodeSVG 
                        value={equipamento.etiquetaID} 
                        size={100} 
                        level="M"
                        includeMargin={false}
                        fgColor="#000000"
                        bgColor="#ffffff"
                      />
                    </div>
                    <div className="flex-1 text-right">
                       <p className="text-[8px] font-black uppercase tracking-widest" style={{ color: "#475569" }}>Sistema Neo Inventário</p>
                       <p className="text-[9px] font-bold mt-1 line-clamp-2" style={{ color: "#000000" }}>{equipamento.marca} {equipamento.modelo}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={onClose}
                  className="py-4 rounded-2xl bg-surface border border-border-subtle text-[10px] font-black uppercase tracking-widest text-muted hover:shadow-nm-flat active:scale-95 transition-all"
                >
                  Fechar
                </button>
                <button 
                  onClick={handleDownload}
                  className="py-4 rounded-2xl bg-brand text-white text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 hover:bg-brand/90 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-download"></i>
                  Baixar Imagem
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
