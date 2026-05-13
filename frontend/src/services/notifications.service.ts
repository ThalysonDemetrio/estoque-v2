import { api } from "@/lib/api-client";

export interface NotificationAlert {
  id: string;
  type: "critical" | "warning" | "info";
  category: "garantia" | "manutencao";
  icon: string;
  title: string;
  description: string;
  equipmentId?: string;
  path?: string;
  timestamp: string;
  dias?: number;
}

export interface NotificationsResponse {
  data: NotificationAlert[];
  total: number;
  critical: number;
  warning: number;
}

export const NotificationsService = {
  async getAlerts(): Promise<NotificationsResponse> {
    const url = `${api.baseURL}/api/notifications/alerts`;
    const response = await api.fetchWithRetry(url);
    return response || { data: [], total: 0, critical: 0, warning: 0 };
  },
};
