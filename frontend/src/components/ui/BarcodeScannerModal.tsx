"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (decodedText: string) => void;
}

export function BarcodeScannerModal({ isOpen, onClose, onScan }: BarcodeScannerModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "reader";

  useEffect(() => {
    if (isOpen) {
      setIsInitializing(true);
      setError(null);
      
      const startScanner = async () => {
        try {
          // Formatos específicos para etiquetas de patrimônio
          const formatsToSupport = [
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ];

          const html5QrCode = new Html5Qrcode(containerId, { 
            formatsToSupport,
            useBarCodeDetectorIfSupported: true,
            verbose: false 
          });
          scannerRef.current = html5QrCode;

          const config = {
            fps: 20,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.0,
          };

          await html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
              onScan(decodedText);
              stopScanner();
              onClose();
            },
            () => {
              // Erros de leitura ignorados
            }
          );
          setIsInitializing(false);
        } catch (err: any) {
          console.error("Erro ao iniciar scanner:", err);
          setError("Não foi possível acessar a câmera. Verifique as permissões.");
          setIsInitializing(false);
        }
      };

      // Pequeno delay para garantir que o elemento DOM existe
      const timeout = setTimeout(startScanner, 300);
      return () => {
        clearTimeout(timeout);
        stopScanner();
      };
    }
  }, [isOpen]);

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        console.error("Erro ao parar scanner:", err);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-white/10"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Escanear Etiqueta</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Aponte a câmera para o patrimônio</p>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          </div>

          {/* Scanner Viewport */}
          <div className="relative aspect-square md:aspect-video bg-black flex items-center justify-center">
            <div id={containerId} className="w-full h-full"></div>
            
            {isInitializing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Iniciando Câmera...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 p-8 flex flex-col items-center justify-center text-center gap-4 bg-slate-900">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center">
                  <i className="fa-solid fa-camera-slash text-rose-500 text-2xl"></i>
                </div>
                <p className="text-sm text-slate-300 font-medium">{error}</p>
                <button 
                  onClick={onClose}
                  className="px-6 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-widest"
                >
                  Fechar
                </button>
              </div>
            )}

            {/* Overlay assistente */}
            {!error && !isInitializing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-[280px] h-[180px] border-2 border-dashed border-blue-400/50 rounded-2xl relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)]">
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                  
                  <div className="absolute inset-x-0 top-1/2 -mt-[0.5px] h-[1px] bg-blue-500/50 animate-pulse"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              DICA: Centralize o código de barras no retângulo. <br/>
              Em ambientes escuros, aproxime mais o celular.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
