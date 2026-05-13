import { api } from "@/lib/api-client";
import { Colaborador } from "@/types";

export interface ColaboradorFilter {
  departamento?: string;
  cargo?: string;
  status?: string;
}

export const ColaboradoresService = {
  async getColaboradores(filters: ColaboradorFilter = {}): Promise<Colaborador[]> {
    const params = new URLSearchParams();
    if (filters.departamento) params.append("departamento", filters.departamento);
    if (filters.cargo) params.append("cargo", filters.cargo);
    if (filters.status) params.append("status", filters.status);

    const url = `${api.baseURL}/api/colaboradores${
      params.toString() ? "?" + params.toString() : ""
    }`;
    const response = await api.fetchWithRetry(url);
    return response?.data || response || [];
  },

  async getColaborador(colaboradorID: string) {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/colaboradores/${colaboradorID}`
    );
    return response?.data || response;
  },

  async createColaborador(data: Partial<Colaborador>): Promise<Colaborador> {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/colaboradores`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return response?.data || response;
  },

  async updateColaborador(colaboradorID: string, data: Partial<Colaborador>): Promise<Colaborador> {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/colaboradores/${colaboradorID}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return response?.data || response;
  },

  async deleteColaborador(colaboradorID: string) {
    await api.fetchWithRetry(
      `${api.baseURL}/api/colaboradores/${colaboradorID}`,
      { method: "DELETE" }
    );
    return true;
  },
};
