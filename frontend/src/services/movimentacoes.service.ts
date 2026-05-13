import { api } from "@/lib/api-client";
import { Movimentacao } from "@/types";

export const MovimentacoesService = {
  async getMovimentacoes(filters: Record<string, string> = {}): Promise<Movimentacao[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    const url = `${api.baseURL}/api/movimentacoes${params.toString() ? "?" + params.toString() : ""}`;
    const response = await api.fetchWithRetry(url);
    return response?.data || [];
  },

  async createMovimentacao(data: Partial<Movimentacao>): Promise<Movimentacao> {
    const payload = {
      ...data,
      motivo: data?.motivo || "Movimentacao registrada via sistema",
      dataHora: data?.dataHora || new Date().toISOString(),
      responsavel: data?.responsavel || "Sistema",
    };

    const response = await api.fetchWithRetry(`${api.baseURL}/api/movimentacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response?.data || response;
  },

  async deleteMovimentacao(id: string) {
    await api.fetchWithRetry(`${api.baseURL}/api/movimentacoes/${id}`, { method: "DELETE" });
    return true;
  },
};
