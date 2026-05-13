import { api } from "@/lib/api-client";

export interface NetworkNode {
  id: number;
  equipment_id: string;
  pos_x: number;
  pos_y: number;
  status?: string;
  tipo_equipamento?: string;
  marca?: string;
  modelo?: string;
  ip_address?: string;
  mac_address?: string;
  subnet_mask?: string;
  default_gateway?: string;
  dns_primary?: string;
  dns_secondary?: string;
  network_notes?: string;
  vlan_id?: number;
  switch_name?: string;
  switch_port?: string;
  total_ports?: number;
  usuarioNome?: string;
  localizacao?: string;
  fotoEquipamento?: string;
}

export interface NetworkConnection {
  id: number;
  source_equipment_id: string;
  target_equipment_id: string;
  label?: string;
  connection_type: "wired" | "wireless" | "problem";
}

export const RedeService = {
  async getInventory(filters: Record<string, string> = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    const url = `${api.baseURL}/api/network/inventory${params.toString() ? "?" + params.toString() : ""}`;
    const response = await api.fetchWithRetry(url);
    const data = response?.data || [];

    return data.map((it: NetworkNode) => ({
      ...it,
      fotoEquipamento:
        it.fotoEquipamento && (it.fotoEquipamento.startsWith("http") || it.fotoEquipamento.startsWith("data:"))
          ? it.fotoEquipamento
          : it.fotoEquipamento
          ? `${api.baseURL}/${it.fotoEquipamento.replace(/^\//, "")}`
          : null,
    }));
  },

  getExportUrl() {
    return `${api.baseURL}/api/network/inventory/export`;
  },

  // Topology Nodes
  async getTopologyNodes() {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/nodes`);
    return response?.data || [];
  },

  async upsertTopologyNode(node: Partial<NetworkNode>) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/nodes`, {
      method: "POST",
      body: JSON.stringify(node),
    });
    return response?.data;
  },

  async updateTopologyNodePosition(id: number, pos: { pos_x: number; pos_y: number }) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/nodes/${id}`, {
      method: "PUT",
      body: JSON.stringify(pos),
    });
    return response?.data;
  },

  async deleteTopologyNode(id: number) {
    await api.fetchWithRetry(`${api.baseURL}/api/network/topology/nodes/${id}`, {
      method: "DELETE",
    });
  },

  async updateNetworkDetails(equipmentId: string, details: Partial<NetworkNode>) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/${equipmentId}`, {
      method: "PUT",
      body: JSON.stringify(details),
    });
    return response;
  },

  // Topology Connections
  async getTopologyConnections() {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/connections`);
    return response?.data || [];
  },

  async createTopologyConnection(connection: Partial<NetworkConnection>) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/connections`, {
      method: "POST",
      body: JSON.stringify(connection),
    });
    return response?.data;
  },

  async updateTopologyConnection(id: number, connection: Partial<NetworkConnection>) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/topology/connections/${id}`, {
      method: "PUT",
      body: JSON.stringify(connection),
    });
    return response?.data;
  },

  async deleteTopologyConnection(id: number) {
    await api.fetchWithRetry(`${api.baseURL}/api/network/topology/connections/${id}`, {
      method: "DELETE",
    });
  },

  async ping(ip: string) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/ping`, {
      method: "POST",
      body: JSON.stringify({ ip }),
    });
    return response?.data;
  },

  async pingBatch(ips: string[]) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/ping/batch`, {
      method: "POST",
      body: JSON.stringify({ ips }),
    });
    return response?.data || [];
  },
  
  async discoverDevices() {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/discover`);
    return response?.data || [];
  },

  async scanSubnet() {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/scan-subnet`, {
      method: "POST"
    });
    return response?.data;
  },

  async syncMikrotik(config: any) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/mikrotik/sync`, {
      method: "POST",
      body: JSON.stringify(config)
    });
    return response?.data;
  },

  async syncUnifi(config: any) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/unifi/sync`, {
      method: "POST",
      body: JSON.stringify(config)
    });
    return response?.data;
  },

  async syncOmada(config: any) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/omada/sync`, {
      method: "POST",
      body: JSON.stringify(config)
    });
    return response?.data;
  },

  async syncIntelbras(config: any) {
    const response = await api.fetchWithRetry(`${api.baseURL}/api/network/intelbras/sync`, {
      method: "POST",
      body: JSON.stringify(config)
    });
    return response?.data;
  }
};
