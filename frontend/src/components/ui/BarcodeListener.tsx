"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/contexts/ToastContext";

export function BarcodeListener() {
  const router = useRouter();
  const { success } = useToast();
  const buffer = useRef<string>("");
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      
      // Scanners de código de barras digitam muito rápido (< 50ms entre teclas)
      if (now - lastKeyTime.current > 50) {
        buffer.current = "";
      }

      lastKeyTime.current = now;

      if (e.key === "Enter") {
        if (buffer.current.length >= 3) {
          const barcode = buffer.current;
          buffer.current = "";
          
          // Emitimos um evento customizado para que páginas específicas possam interceptar
          const event = new CustomEvent("barcode-scanned", { detail: barcode });
          window.dispatchEvent(event);
          
          // Se o evento não for cancelado por alguma página, fazemos o redirecionamento padrão
          if (!event.defaultPrevented) {
            success("Código de Barras Detectado", `Redirecionando para etiqueta: ${barcode}`);
            router.push(`/equipamentos?open=${barcode}`);
          }
        }
        buffer.current = "";
      } else if (e.key && e.key.length === 1) {
        buffer.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, success]);

  return null; // Componente invisível
}
