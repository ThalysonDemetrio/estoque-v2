'use strict';

const { AppError } = require('../errors');
const { pool } = require('../db');
const queries = require('./equipamentos.queries');
const socketLib = require('../lib/socket');
const auditService = require('../audit/audit.service');
const { sanitizeNetworkPayload, hasAnyNetworkField } = require('../network/network.utils');

/**
 * equipamentos.service.js
 * Lógica de negócio pesada, SerpAPI, Gestão de Famílias e Rede.
 */

// --- Helpers Internos ---

function normalizeText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function isEmUsoStatus(status) {
  const s = normalizeText(status);
  return ['em uso', 'em_uso', 'emuso', 'em uso - pessoal', 'em uso pessoal', 'em_uso_pessoal', 'em uso - infraestrutura', 'em uso infraestrutura', 'em_uso_infraestrutura'].includes(s);
}

function normalizePriceValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  const raw = String(value).replace(/[^\d,.-]/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') && raw.includes('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isFinite(parsed) ? parsed : null;
}

function parseSpecs(payload) {
  if (payload?.especificacoes && typeof payload.especificacoes === 'object') return payload.especificacoes;
  const specs = {};
  if (payload?.polegadas) specs.polegadas = payload.polegadas;
  if (payload?.descricao) specs.descricao = payload.descricao;
  return specs;
}

// --- Funções de Família ---

function buildFamiliaDescricao(tipo, marca, modelo, especificacoes) {
  const base = [tipo, marca, modelo].filter(Boolean).join(' ').trim();
  const extras = [];
  if (especificacoes?.polegadas) extras.push(`${especificacoes.polegadas}"`);
  if (especificacoes?.processador) extras.push(especificacoes.processador);
  if (especificacoes?.ram) extras.push(`${especificacoes.ram} RAM`);
  return [base, extras.join(' • ')].filter(Boolean).join(' - ');
}

async function ensureFamilia(client, payload) {
  const specs = parseSpecs(payload);
  const { tipoEquipamento: tipo, marca, modelo } = payload;

  const existing = await client.query(
    `SELECT id FROM familias_equipamentos WHERE tipo = $1 AND marca = $2 AND modelo = $3 AND especificacoes = $4::jsonb`,
    [tipo, marca, modelo, JSON.stringify(specs)]
  );

  if (existing.rowCount > 0) return existing.rows[0].id;

  const desc = buildFamiliaDescricao(tipo, marca, modelo, specs);
  const inserted = await client.query(
    `INSERT INTO familias_equipamentos (tipo, marca, modelo, especificacoes, quantidade_total, descricao_completa)
     VALUES ($1, $2, $3, $4::jsonb, 0, $5) RETURNING id`,
    [tipo, marca, modelo, JSON.stringify(specs), desc]
  );
  return inserted.rows[0].id;
}

// --- Funções de Rede ---

async function persistEquipmentNetwork(client, equipamentoID, payload) {
  const net = {
    ip_address: payload.ipAddress || payload.ip_address,
    mac_address: payload.macAddress || payload.mac_address,
    subnet_mask: payload.subnetMask || payload.subnet_mask,
    default_gateway: payload.defaultGateway || payload.default_gateway,
    dns_primary: payload.dnsPrimary || payload.dns_primary,
    vlan_id: payload.vlanId || payload.vlan_id,
    switch_name: payload.switchName || payload.switch_name,
    switch_port: payload.switchPort || payload.switch_port,
    network_notes: payload.networkNotes || payload.network_notes,
    total_ports: payload.totalPorts || payload.total_ports
  };

  const sanitized = sanitizeNetworkPayload(net);
  // Extender sanitizeNetworkPayload ou tratar total_ports aqui
  sanitized.total_ports = net.total_ports ? Number(net.total_ports) : null;

  if (!hasAnyNetworkField(sanitized)) {
    await client.query('DELETE FROM equipment_network WHERE equipment_id = $1', [equipamentoID]);
    return;
  }

  // --- Verificação de Segurança e Conflitos ---
  if (sanitized.ip_address) {
    const conflict = await client.query(
      'SELECT equipment_id FROM equipment_network WHERE ip_address = $1 AND equipment_id <> $2',
      [sanitized.ip_address, equipamentoID]
    );
    if (conflict.rowCount > 0) {
       console.warn(`[REDE] Conflito de IP detectado: ${sanitized.ip_address} já em uso por ${conflict.rows[0].equipment_id}`);
       // Aqui poderíamos lançar um erro ou apenas anotar no log/audit
    }
  }

  if (sanitized.switch_name && sanitized.switch_port) {
    const conflict = await client.query(
      'SELECT equipment_id FROM equipment_network WHERE switch_name = $1 AND switch_port = $2 AND equipment_id <> $3',
      [sanitized.switch_name, sanitized.switch_port, equipamentoID]
    );
    if (conflict.rowCount > 0) {
       throw new Error(`Porta ${sanitized.switch_port} do switch ${sanitized.switch_name} já está sendo utilizada por ${conflict.rows[0].equipment_id}`);
    }
  }

  // Garantir existência da coluna total_ports (Migração dinâmica se necessário)
  try {
     await client.query('ALTER TABLE equipment_network ADD COLUMN IF NOT EXISTS total_ports INTEGER');
  } catch (e) { /* Coluna pode já existir */ }

  await client.query(
    `INSERT INTO equipment_network (
       equipment_id, ip_address, mac_address, subnet_mask, default_gateway, dns_primary, vlan_id, switch_name, switch_port, network_notes, total_ports, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
     ON CONFLICT (equipment_id) DO UPDATE SET
       ip_address = EXCLUDED.ip_address, mac_address = EXCLUDED.mac_address, subnet_mask = EXCLUDED.subnet_mask,
       default_gateway = EXCLUDED.default_gateway, dns_primary = EXCLUDED.dns_primary, vlan_id = EXCLUDED.vlan_id,
       switch_name = EXCLUDED.switch_name, switch_port = EXCLUDED.switch_port, network_notes = EXCLUDED.network_notes, 
       total_ports = EXCLUDED.total_ports, updated_at = NOW()`,
    [equipamentoID, sanitized.ip_address, sanitized.mac_address, sanitized.subnet_mask, sanitized.default_gateway, sanitized.dns_primary, sanitized.vlan_id, sanitized.switch_name, sanitized.switch_port, sanitized.network_notes, sanitized.total_ports]
  );

  // --- Auto-Registro na Topologia ---
  // Se o dispositivo tem dados de rede ou é um switch configurado, garantir que ele apareça no mapa
  const hasNetwork = !!(sanitized.ip_address || sanitized.mac_address || sanitized.switch_name || sanitized.total_ports);
  if (hasNetwork) {
    const nodeExists = await client.query('SELECT 1 FROM network_topology_nodes WHERE equipment_id = $1', [equipamentoID]);
    if (nodeExists.rowCount === 0) {
      await client.query(
        'INSERT INTO network_topology_nodes (equipment_id, pos_x, pos_y, updated_at) VALUES ($1, $2, $3, NOW())',
        [equipamentoID, 200 + (Math.random() * 400), 200 + (Math.random() * 300)]
      );
      // console.log(`[TOPOLOGIA] Dispositivo ${equipamentoID} auto-registrado no mapa.`);
    }
  }
}

// --- Exportados do Service ---

async function listar(queryObj) {
  const where = [];
  const params = [];
  if (queryObj.status) { params.push(queryObj.status); where.push(`e.status = $${params.length}`); }
  if (queryObj.tipoEquipamento) { params.push(queryObj.tipoEquipamento); where.push(`e.tipo_equipamento = $${params.length}`); }
  if (queryObj.propriedade) { params.push(queryObj.propriedade); where.push(`e.propriedade = $${params.length}`); }
  if (queryObj.colaboradorAtualID) { params.push(queryObj.colaboradorAtualID); where.push(`e.colaborador_atual_id = $${params.length}`); }
  
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const result = await queries.findEquipamentos(whereClause, params);
  return result.rows;
}

async function getResumoGeral() {
  const res = await queries.getResumoGeral();
  return res.rows;
}

async function criar(payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const specs = parseSpecs(payload);
    const familiaID = await ensureFamilia(client, payload);
    
    // Simplificado para o MVP do refactor - portar resto das colunas se necessário
    const res = await client.query(
      `INSERT INTO equipamentos (
        etiqueta_id, tipo_equipamento, marca, modelo, numero_serie, foto_equipamento,
        propriedade, proprietario_id, status, localizacao, data_compra, custo_aquisicao,
        nota_fiscal, local_compra, link_loja, lote_tag, especificacoes, familia_id, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,NOW()) RETURNING etiqueta_id`,
      [
        payload.etiquetaID, payload.tipoEquipamento, payload.marca, payload.modelo, 
        payload.numeroSerie || null, payload.fotoEquipamento || null,
        payload.propriedade || 'empresa', payload.proprietarioID || null, 
        payload.status || 'Disponível', payload.localizacao || null,
        payload.dataCompra || null, normalizePriceValue(payload.custoAquisicao),
        payload.notaFiscal || null, payload.localCompra || null,
        payload.linkLoja || null, payload.loteTag || null,
        JSON.stringify(specs), familiaID
      ]
    );
    
    await persistEquipmentNetwork(client, payload.etiquetaID, payload);
    await queries.updateFamiliaCount(familiaID);
    await client.query('COMMIT');
    
    const eq = await queries.findByID(payload.etiquetaID);
    socketLib.emit('equipamento_update', { action: 'create', data: eq });
    
    await auditService.logAction({
      entidade: 'equipamento',
      entidade_id: payload.etiquetaID,
      acao: 'create',
      payload: eq,
      userId: payload.userId, // Depende de como o payload chega, se tiver userId
      userNome: payload.userNome
    });

    return eq;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function atualizar(id, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const specs = parseSpecs(payload);
    const familiaID = await ensureFamilia(client, payload);
    
    // Simplificado para o refactor
    await client.query(
      `UPDATE equipamentos SET 
        tipo_equipamento = $1, marca = $2, modelo = $3, numero_serie = $4, 
        foto_equipamento = $5, propriedade = $6, status = $7, localizacao = $8,
        data_compra = $9, custo_aquisicao = $10, nota_fiscal = $11, 
        local_compra = $12, link_loja = $13, lote_tag = $14, especificacoes = $15::jsonb,
        familia_id = $16, updated_at = NOW() 
       WHERE etiqueta_id = $17`,
      [
        payload.tipoEquipamento, payload.marca, payload.modelo, payload.numeroSerie || null,
        payload.fotoEquipamento || null, payload.propriedade || 'empresa',
        payload.status || 'Disponível', payload.localizacao || null,
        payload.dataCompra || null, normalizePriceValue(payload.custoAquisicao),
        payload.notaFiscal || null, payload.localCompra || null,
        payload.linkLoja || null, payload.loteTag || null,
        JSON.stringify(specs), familiaID, id
      ]
    );
    
    await persistEquipmentNetwork(client, id, payload);
    await queries.updateFamiliaCount(familiaID);
    await client.query('COMMIT');
    
    const eq = await queries.findByID(id);
    socketLib.emit('equipamento_update', { action: 'update', data: eq });

    await auditService.logAction({
      entidade: 'equipamento',
      entidade_id: id,
      acao: 'update',
      payload: eq,
      userId: payload.userId,
      userNome: payload.userNome
    });

    return eq;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deletar(id, user) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = await queries.findByID(id);
    if (!item) throw new AppError('Equipamento não encontrado', 404);
    
    await client.query('DELETE FROM equipamentos WHERE etiqueta_id = $1', [id]);
    await queries.updateFamiliaCount(item.familiaID);
    await client.query('COMMIT');
    
    socketLib.emit('equipamento_update', { action: 'delete', id: id });

    await auditService.logAction({
      entidade: 'equipamento',
      entidade_id: id,
      acao: 'delete',
      payload: item,
      userId: user?.userId,
      userNome: user?.nome
    });

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getComparativoSetores() {
  const res = await queries.getComparativoSetores();
  return res.rows;
}

async function getRelatorioInvestimentos() {
  const res = await queries.getRelatorioInvestimentos();
  return res.rows[0];
}

async function getTiposPorSetor() {
  const res = await queries.getTiposPorSetor();
  return res.rows;
}

// --- Vistorias (Inspeções) ---

async function listarVistorias(equipamentoID) {
  const res = await queries.getVistorias(equipamentoID);
  return res.rows;
}

async function salvarVistoria(id, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Calcular Score baseado nos itens (Proporcional ao número de itens)
    const weights = { bom: 1, alerta: 0.5, critico: 0 };
    let scoreBase = 0;
    const itens = payload.itens || [];
    
    let scoreTotal = 0;
    if (itens.length > 0) {
      for (const item of itens) {
        scoreBase += weights[item.status] || 0;
      }
      scoreTotal = Math.round((scoreBase / itens.length) * 100);
    } else {
      scoreTotal = 100; // Caso não haja itens, score padrão
    }

    const inspectionID = await queries.salvarVistoria(client, {
      equipmentID: id,
      inspectorID: payload.userId,
      score: scoreTotal,
      notas: payload.notasGerais
    });

    for (const item of itens) {
      await queries.salvarItemVistoria(client, {
        inspectionID,
        itemNome: item.nome,
        status: item.status,
        comentario: item.comentario
      });
    }

    await client.query('COMMIT');
    
    // Audit
    await auditService.logAction({
      entidade: 'equipamento',
      entidade_id: id,
      acao: 'vistoria_realizada',
      payload: { inspectionID, score: scoreTotal },
      userId: payload.userId,
      userNome: payload.userNome
    });

    return { id: inspectionID, score: scoreTotal };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listar,
  getResumoGeral,
  getComparativoSetores,
  getRelatorioInvestimentos,
  getTiposPorSetor,
  // Vistorias
  listarVistorias,
  salvarVistoria,
  criar,
  atualizar,
  deletar,
  findByID: queries.findByID
};
