import { api } from "@/lib/api-client";
import { Solicitacao, Checklist, ChecklistItem, Equipamento } from "@/types";

export const SolicitacoesService = {
  normalize(raw: any): Solicitacao {
    return {
      solicitacaoID: String(raw?.solicitacaoID || raw?.solicitacao_id || raw?.id || ""),
      protocolo: raw?.protocolo || raw?.protocoloSolicitacao || raw?.protocolo_solicitacao,
      tipoSolicitacao: raw?.tipoSolicitacao || raw?.tipo || "alocacao",
      solicitanteNome: raw?.solicitanteNome || raw?.solicitante || raw?.solicitante_nome || raw?.nomeSolicitante || "",
      solicitanteID: raw?.solicitanteID || raw?.solicitante_id || "",
      departamento: raw?.departamento || "",
      equipamentoAtualID: raw?.equipamentoAtualID || raw?.equipamento_atual_id || "",
      urgencia: (raw?.urgencia || "media") as any,
      status: raw?.status || "pendente",
      dataNecessidade: raw?.dataNecessidade,
      dataSolicitacao: raw?.dataSolicitacao,
      dataCriacao: raw?.dataCriacao || raw?.criadoEm || raw?.created_at,
      dataConclusao: raw?.dataConclusao,
      descricaoResumo: raw?.descricaoProblema || raw?.justificativa || raw?.descricao || "Sem descrição.",
      solicitanteFoto: raw?.solicitanteFoto,
      tecnicoTIFoto: raw?.tecnicoTIFoto,
      tecnicoTINome: raw?.tecnicoTINome,
      colaboradorDestinoFoto: raw?.colaboradorDestinoFoto,
      colaboradorDestinoID: raw?.colaboradorDestinoID,
      colaboradorDestinoNome: raw?.colaboradorDestinoNome,
      colaboradorDestinoDepartamento: raw?.colaboradorDestinoDepartamento,
      checklistResponsavelFoto: raw?.checklistResponsavelFoto,
      tipoAcao: raw?.tipoAcao,
      observacoesTI: raw?.observacoesTI,
      processamentoID: raw?.processamentoID,
      equipamentoAlocadoID: raw?.equipamentoAlocadoID,
      confirmacaoEntrega: raw?.confirmacaoEntrega,
      dataProcessamento: raw?.dataProcessamento,
      dataConfirmacao: raw?.dataConfirmacao,
      checklistID: raw?.checklistID,
      checklistStatus: raw?.checklistStatus,
      checklistTotalItens: raw?.checklistTotalItens,
      checklistItensPendentes: raw?.checklistItensPendentes,
      checklistItensConcluidos: raw?.checklistItensConcluidos,
      anexos: raw?.anexos,
    };
  },

  async getSolicitacoes(filters: Record<string, string> = {}): Promise<Solicitacao[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    const url = `${api.baseURL}/api/solicitacoes${params.toString() ? "?" + params.toString() : ""}`;
    const response = await api.fetchWithRetry(url);
    const data = Array.isArray(response?.data) ? response.data : response || [];
    return data.map(SolicitacoesService.normalize);
  },

  async createSolicitacao(data: Partial<Solicitacao>): Promise<Solicitacao> {
    const payload = {
      ...data,
      tipoSolicitacao: data?.tipoSolicitacao || "alocacao",
      solicitanteNome: data?.solicitanteNome || "",
      urgencia: data?.urgencia || "media",
    };

    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response?.data || response;
  },

  async updateStatus(id: string, status: string) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    return response?.data || response;
  },

  async deleteSolicitacao(id: string) {
    await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${id}`, { method: "DELETE" });
    return true;
  },

  async getChecklistTemplates() {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/checklist-templates`);
    return response?.data || [];
  },

  async getInventarioDisponivel(tipo?: string): Promise<Equipamento[]> {
    const params = new URLSearchParams();
    if (tipo) params.append("tipo", tipo);
    const url = `${api.baseURL}/api/solicitacoes/inventario-disponivel${params.toString() ? "?" + params.toString() : ""}`;
    const response = await api.fetchWithRetry(url);
    return response?.data || [];
  },

  async getChecklist(solicitacaoID: string): Promise<Checklist | null> {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${solicitacaoID}/checklist`);
    return response?.data || null;
  },

  async updateChecklist(solicitacaoID: string, itens: Partial<ChecklistItem>[]) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${solicitacaoID}/checklist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itens }),
    });
    return response?.data || response;
  },

  async concluirChecklist(solicitacaoID: string, body: any = {}) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${solicitacaoID}/checklist/concluir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response?.data || response;
  },

  async processarSolicitacao(solicitacaoID: string, body: any = {}) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${solicitacaoID}/processar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response?.data || response;
  },

  async confirmarEntrega(solicitacaoID: string, body: any = {}) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/solicitacoes/${solicitacaoID}/confirmar-entrega`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response?.data || response;
  },
};
