"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  NotificationsService,
  NotificationAlert,
} from "@/services/notifications.service";
import { api } from "@/lib/api-client";

interface NotificationContextValue {
  alerts: NotificationAlert[];
  total: number;
  critical: number;
  unread: number;
  loading: boolean;
  markAllRead: () => void;
  dismissAlert: (id: string) => void;
  dismissAll: () => void;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  alerts: [],
  total: 0,
  critical: 0,
  unread: 0,
  loading: false,
  markAllRead: () => {},
  dismissAlert: () => {},
  dismissAll: () => {},
  refresh: async () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<NotificationAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [critical, setCritical] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const readIds = useRef<Set<string>>(new Set());

  // Registra Service Worker e Pede permissão de Push
  useEffect(() => {
    async function initPush() {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        
        if (!vapidPublicKey) return;

        // Converter Base64URL to Uint8Array para o applicationServerKey
        const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
        const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: outputArray
            });
          }

          // Salvar Inscrição no Backend
          await api.fetchWithRetry(`${api.baseURL}/api/notifications/subscribe`, {
            method: 'POST',
            body: JSON.stringify(subscription.toJSON())
          });
        }
      } catch (err) {
        console.error('[WebPush] Falha ao registrar Service Worker ou Push:', err);
      }
    }
    
    // Inicia depois de um atraso mínimo para não travar a UI inicial
    setTimeout(initPush, 3000);
  }, []);

  // Carregar descartados do localStorage
  useEffect(() => {
    const saved = localStorage.getItem("estoque_dismissed_alerts");
    if (saved) {
      try {
        setDismissedIds(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error("Erro ao carregar notificações descartadas", e);
      }
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await NotificationsService.getAlerts();
      const allAlerts = result.data || [];
      
      // Filtra os descartados
      const filtered = allAlerts.filter(a => !dismissedIds.has(a.id));
      
      setAlerts(filtered);
      setTotal(filtered.length);
      setCritical(filtered.filter(a => a.type === 'critical').length);
      
      const newUnread = filtered.filter(
        (a) => !readIds.current.has(a.id)
      ).length;
      setUnread(newUnread);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dismissedIds]);

  const markAllRead = useCallback(() => {
    alerts.forEach((a) => readIds.current.add(a.id));
    setUnread(0);
  }, [alerts]);

  const dismissAlert = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("estoque_dismissed_alerts", JSON.stringify(Array.from(next)));
      return next;
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      alerts.forEach(a => next.add(a.id));
      localStorage.setItem("estoque_dismissed_alerts", JSON.stringify(Array.from(next)));
      return next;
    });
    setAlerts([]);
  }, [alerts]);

  // Carrega na montagem e re-carrega a cada 5 minutos
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <NotificationContext.Provider
      value={{ alerts, total, critical, unread, loading, markAllRead, dismissAlert, dismissAll, refresh }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
