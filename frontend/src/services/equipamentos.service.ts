import { api } from "@/lib/api-client";
import { Equipamento } from "@/types";

export interface EquipamentoFilter {
  status?: string;
  colaboradorAtualID?: string;
  tipoEquipamento?: string;
  propriedade?: string;
}

export interface VistoriaItem {
  nome: string;
  status: 'bom' | 'alerta' | 'critico';
  comentario?: string;
}

export interface Vistoria {
  id: string;
  equipmentID: string;
  inspectorID: string;
  inspectorNome: string;
  dataVistoria: string;
  scoreCalculado: number;
  notasGerais: string;
  itens: VistoriaItem[];
}

export const EquipamentosService = {
  async getEquipamentos(filters: EquipamentoFilter = {}): Promise<Equipamento[]> {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.colaboradorAtualID)
      params.append("colaboradorAtualID", filters.colaboradorAtualID);
    if (filters.tipoEquipamento)
      params.append("tipoEquipamento", filters.tipoEquipamento);
    if (filters.propriedade) params.append("propriedade", filters.propriedade);

    const url = `${api.baseURL}/api/equipamentos${
      params.toString() ? "?" + params.toString() : ""
    }`;
    const response = await api.fetchWithRetry(url);
    const data = response?.data || [];
    
    // Normalizar URLs das fotos
    return data.map((eq: Equipamento) => ({
      ...eq,
      fotoEquipamento:
        eq.fotoEquipamento && (eq.fotoEquipamento.startsWith("http") || eq.fotoEquipamento.startsWith("data:"))
          ? eq.fotoEquipamento
          : eq.fotoEquipamento
          ? `${api.baseURL}/${eq.fotoEquipamento.replace(/^\//, "")}`
          : null,
    }));
  },

  async getEquipamento(etiquetaID: string) {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/equipamentos/${etiquetaID}`
    );
    const eq = response?.data;
    if (eq && eq.fotoEquipamento && !eq.fotoEquipamento.startsWith('http')) {
      eq.fotoEquipamento = `${api.baseURL}/${eq.fotoEquipamento.replace(/^\//, '')}`;
    }
    return eq;
  },

  async createEquipamento(data: Partial<Equipamento>): Promise<Equipamento> {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/equipamentos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return response?.data;
  },

  async updateEquipamento(etiquetaID: string, data: Partial<Equipamento>): Promise<Equipamento> {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/equipamentos/${etiquetaID}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return response?.data;
  },

  async deleteEquipamento(etiquetaID: string) {
    await api.fetchWithRetry(
      `${api.baseURL}/api/equipamentos/${etiquetaID}`,
      {
        method: "DELETE",
      }
    );
    return true;
  },
  getExportUrl() {
    return `${api.baseURL}/api/equipamentos/export/pdf`;
  },
  async getTiposPorSetor(): Promise<{ setor: string, tipo: string, quantidade: number }[]> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/equipamentos/stats/tipos-por-setor`);
    return response?.data || [];
  },

  async getVistorias(etiquetaID: string): Promise<Vistoria[]> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/equipamentos/${etiquetaID}/vistorias`);
    return response?.data || [];
  },

  async salvarVistoria(etiquetaID: string, data: { itens: VistoriaItem[], notasGerais: string }): Promise<any> {
    const response = await api.fetchWithRetry(
      `${api.baseURL}/api/equipamentos/${etiquetaID}/vistorias`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }
    );
    return response?.data;
  }
};
