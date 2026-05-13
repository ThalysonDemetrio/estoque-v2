import { api } from "@/lib/api-client";
import { ChatConversation, ChatMessage } from "@/types";

export const ChatService = {
  // GET /api/chat/notificacoes
  async getNotificacoes(): Promise<{ total: number; porContexto: any[] }> {
    const res = await api.fetchWithRetry(`${api.baseURL}/api/chat/notificacoes`);
    return res?.data ?? { total: 0, porContexto: [] };
  },

  // GET /api/chat/conversas
  async getConversas(): Promise<ChatConversation[]> {
    const res = await api.fetchWithRetry(`${api.baseURL}/api/chat/conversas`);
    return Array.isArray(res?.data) ? res.data : [];
  },

  // GET /api/chat/:tipo/:id
  async getMensagens(tipo: string, id: string): Promise<ChatMessage[]> {
    const res = await api.fetchWithRetry(`${api.baseURL}/api/chat/${tipo}/${id}`);
    return Array.isArray(res?.data) ? res.data : [];
  },

  // POST /api/chat/:tipo/:id
  async enviarMensagem(tipo: string, id: string, payload: {
    texto?: string;
    arquivoNome?: string;
    arquivoTipo?: string;
    arquivoDados?: string;
  }): Promise<any> {
    const res = await api.fetchWithRetry(`${api.baseURL}/api/chat/${tipo}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res?.data;
  },

  // PUT /api/chat/:tipo/:id/lido
  async marcarLido(tipo: string, id: string): Promise<void> {
    await api.fetchWithRetry(`${api.baseURL}/api/chat/${tipo}/${id}/lido`, { method: "PUT" });
  },

  // PATCH /api/chat/:tipo/:id/mensagem/:msgId/pin
  async togglePin(tipo: string, id: string, msgId: string): Promise<any> {
    const res = await api.fetchWithRetry(`${api.baseURL}/api/chat/${tipo}/${id}/mensagem/${msgId}/pin`, { method: "PATCH" });
    return res?.data;
  },

  // DELETE mensagem
  async deletarMensagem(tipo: string, id: string, msgId: string): Promise<void> {
    await api.fetchWithRetry(`${api.baseURL}/api/chat/${tipo}/${id}/mensagem/${msgId}`, { method: "DELETE" });
  },
};
