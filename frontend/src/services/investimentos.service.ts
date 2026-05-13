import { api } from "@/lib/api-client";

export interface InvestimentoStats {
  total_itens: number;
  itens_com_custo: number;
  investimento_total: string | number;
  ticket_medio: string | number;
  custo_manutencao_ativo: string | number;
}

export interface InvestimentoSetor {
  setor: string;
  total_itens: number;
  itens_com_custo: number;
  investimento_total: string | number;
  custo_manutencao_setor: string | number;
  ticket_medio: string | number;
}

export interface InvestimentoCrescimento {
  mes: string;
  investimento_mes: string | number;
  investimento_acumulado: string | number;
}

export interface InvestimentoEquipamento {
  etiquetaID: string;
  tipoEquipamento: string;
  marca: string;
  modelo: string;
  status: string;
  pessoaID: string;
  pessoaNome: string;
  setor: string;
  dataCompra: string;
  notaFiscal: string;
  localCompra: string;
  linkLoja: string;
  custoAquisicao: string | number;
}

export interface InvestimentoRelatorio {
  totais: InvestimentoStats;
  porSetor: InvestimentoSetor[];
  crescimento: InvestimentoCrescimento[];
  equipamentos: InvestimentoEquipamento[];
}

class InvestimentosService {
  async validatePin(pin: string): Promise<boolean> {
    try {
      const response = await api.fetchWithRetry(`${api.baseURL}/api/auth/validate-invest-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        skipAuthRedirect: true,
      });
      return !!response?.data?.valid;
    } catch (err) {
      console.error("Erro ao validar PIN:", err);
      return false;
    }
  }

  async getRelatorio(): Promise<InvestimentoRelatorio> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/equipamentos/relatorios/investimentos`);
    return response.data;
  }

  async getComparativo(query: string): Promise<any[]> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/investimentos/comparativo?q=${encodeURIComponent(query)}`);
    return response?.data || [];
  }

  async getSugestoes(): Promise<string[]> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/investimentos/comparativo/sugestoes`);
    return response?.data || [];
  }
}

const instance = new InvestimentosService();
export default instance;
