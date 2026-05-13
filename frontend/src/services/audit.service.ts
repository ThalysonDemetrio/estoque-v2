import { api } from "@/lib/api-client";

export interface AuditLog {
  audit_id: number;
  entidade: string;
  entidade_id: string;
  acao: string;
  payload: any;
  user_id: string | null;
  user_nome: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const AuditService = {
  async getLogs(filters: any = {}): Promise<AuditLog[]> {
    const query = new URLSearchParams(filters).toString();
    const url = `${api.baseURL}/api/audit${query ? "?" + query : ""}`;
    const res = await api.fetchWithRetry(url);
    return Array.isArray(res) ? res : [];
  }
};
