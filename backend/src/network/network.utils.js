'use strict';

/**
 * Funções de utilidade para normalização e sanitização de dados de rede.
 * Separado em um arquivo util para evitar dependências circulares.
 */

function normalizeIpv4(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split('.');
  if (parts.length !== 4) return null;

  const normalized = parts.map((part) => {
    if (!/^\d+$/.test(part)) return null;
    const num = Number(part);
    if (!Number.isInteger(num) || num < 0 || num > 255) return null;
    return String(num);
  });

  if (normalized.some((item) => item === null)) return null;
  return normalized.join('.');
}

function normalizeMac(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const compact = raw.replace(/[^a-fA-F0-9]/g, '');
  if (compact.length !== 12) return null;
  const pairs = compact.match(/.{1,2}/g);
  if (!pairs || pairs.length !== 6) return null;
  return pairs.map((pair) => pair.toUpperCase()).join(':');
}

function normalizeVlan(value) {
  if (value === undefined || value === null || value === '') return null;
  const vlan = Number(value);
  if (!Number.isInteger(vlan) || vlan < 1 || vlan > 4094) return null;
  return vlan;
}

function sanitizeNetworkPayload(payload = {}) {
  const mapIpv4 = (field) => {
    const normalized = normalizeIpv4(payload[field]);
    if (normalized === null) {
      const error = new Error(`Campo inválido: ${field}`);
      error.status = 400;
      throw error;
    }
    return normalized || null;
  };

  const mac = normalizeMac(payload.mac_address);
  if (mac === null) {
    const error = new Error('Campo inválido: mac_address');
    error.status = 400;
    throw error;
  }

  const vlan = normalizeVlan(payload.vlan_id);
  if (payload.vlan_id !== undefined && payload.vlan_id !== null && payload.vlan_id !== '' && vlan === null) {
    const error = new Error('Campo inválido: vlan_id (1-4094)');
    error.status = 400;
    throw error;
  }

  return {
    ip_address: mapIpv4('ip_address'),
    mac_address: mac || null,
    subnet_mask: mapIpv4('subnet_mask'),
    default_gateway: mapIpv4('default_gateway'),
    dns_primary: mapIpv4('dns_primary'),
    dns_secondary: mapIpv4('dns_secondary'),
    vlan_id: vlan,
    switch_name: String(payload.switch_name || '').trim() || null,
    switch_port: String(payload.switch_port || '').trim() || null,
    total_ports: Number.isInteger(Number(payload.total_ports)) ? Number(payload.total_ports) : null,
    network_notes: String(payload.network_notes || '').trim() || null
  };
}

function hasAnyNetworkField(network) {
  if (!network || typeof network !== 'object') return false;
  return Object.values(network).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
}

module.exports = {
  normalizeIpv4,
  normalizeMac,
  normalizeVlan,
  sanitizeNetworkPayload,
  hasAnyNetworkField
};
