"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { ChatService } from "@/services/chat.service";
import { ChatConversation } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

interface ChatContextType {
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;
  activeContext: { tipo: "movimentacao" | "solicitacao" | "colaborador"; id: string; titulo: string } | null;
  openChat: (tipo: "movimentacao" | "solicitacao" | "colaborador", id: string, titulo: string) => void;
  closeChat: () => void;
  totalUnread: number;
  unreadByContext: ChatConversation[];
  refreshNotifications: () => Promise<void>;
  processForm: { equipamentoID: string; estaSubstituindo: "nao" | "sim"; equipamentoTrocadoID: string };
  setProcessForm: React.Dispatch<React.SetStateAction<{ equipamentoID: string; estaSubstituindo: "nao" | "sim"; equipamentoTrocadoID: string }>>;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { hasPermission, user } = useAuth();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [activeContext, setActiveContext] = useState<{ tipo: "movimentacao" | "solicitacao" | "colaborador"; id: string; titulo: string } | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadByContext, setUnreadByContext] = useState<ChatConversation[]>([]);
  const [processForm, setProcessForm] = useState({
    equipamentoID: "",
    estaSubstituindo: "nao" as "nao" | "sim",
    equipamentoTrocadoID: "",
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  const refreshNotifications = useCallback(async () => {
    // Só buscar se tiver permissão e houver usuário logado
    if (!user || !hasPermission("chat")) {
      return;
    }

    // Só buscar se a aba estiver visível para poupar taxa de requisição
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    
    try {
      const data = await ChatService.getNotificacoes();
      setTotalUnread(data.total);
      setUnreadByContext(data.porContexto);
    } catch (error) {
      console.error("Erro ao carregar notificações de chat:", error);
    }
  }, [user, hasPermission]);

  const openChat = useCallback((tipo: "movimentacao" | "solicitacao" | "colaborador", id: string, titulo: string) => {
    setActiveContext({ tipo, id, titulo });
    setIsPanelOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsPanelOpen(false);
    // We don't clear activeContext immediately to allow exit animation
    setTimeout(() => setActiveContext(null), 300);
  }, []);

  // Poll for notifications every 60 seconds (optimized)
  useEffect(() => {
    refreshNotifications();
    const interval = setInterval(refreshNotifications, 60000);
    
    // Refresh immediately when returning to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshNotifications]);

  const contextValue = useMemo(() => ({
    isPanelOpen,
    setIsPanelOpen,
    activeContext,
    openChat,
    closeChat,
    totalUnread,
    unreadByContext,
    refreshNotifications,
    processForm,
    setProcessForm,
    refreshTrigger,
    triggerRefresh,
  }), [
    isPanelOpen,
    activeContext,
    totalUnread,
    unreadByContext,
    refreshNotifications,
    processForm,
    refreshTrigger,
    triggerRefresh
  ]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
