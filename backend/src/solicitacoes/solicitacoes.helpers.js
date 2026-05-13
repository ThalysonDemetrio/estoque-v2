'use strict';

/**
 * solicitacoes.helpers.js
 * Utilitários, normalizadores, migrations de schema e integração com sistema legado.
 * Nenhuma dependência de Express aqui — importável por qualquer camada.
 */

const { pool, query } = require('../db');
const auditService = require('../audit/audit.service');
const { AppError } = require('../errors');

// ─── Normalizadores ───────────────────────────────────────────────────────────

function parseJsonArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_) {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function mapTipoSolicitacao(tipo) {
  const t = normalizeText(tipo);
  if (t === 'manutencao' || t === 'manutenção') return 'manutencao';
  if (t === 'alocacao' || t === 'alocação') return 'alocacao';
  if (t === 'substituicao' || t === 'substituição') return 'substituicao';
  if (t === 'demanda_manual' || t === 'demanda manual' || t === 'checklist') return 'demanda_manual';
  return tipo || 'alocacao';
}

function mapChecklistItemStatus(status) {
  const s = normalizeText(status);
  if (s === 'concluido' || s === 'concluida') return 'concluido';
  if (s === 'nao_efetuada' || s === 'nao efetuada' || s === 'não efetuada') return 'nao_efetuada';
  if (s === 'atencao' || s === 'atenção') return 'atencao';
  return 'pendente';
}

// ─── Schema migrations (lazy, singleton por processo) ─────────────────────────

let processamentosSchemaReadyPromise = null;
let checklistSchemaReadyPromise = null;

async function ensureProcessamentosDestinoColumns() {
  if (processamentosSchemaReadyPromise) return processamentosSchemaReadyPromise;

  processamentosSchemaReadyPromise = (async () => {
    await query(`ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL`);
    await query(`ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_nome TEXT`);
    await query(`ALTER TABLE processamentos ADD COLUMN IF NOT EXISTS colaborador_destino_departamento TEXT`);
  })().catch((err) => {
    processamentosSchemaReadyPromise = null;
    throw err;
  });

  return processamentosSchemaReadyPromise;
}

async function ensureSolicitacoesChecklistSchema() {
  if (checklistSchemaReadyPromise) return checklistSchemaReadyPromise;

  checklistSchemaReadyPromise = (async () => {
    await query(
      `CREATE TABLE IF NOT EXISTS solicitacao_checklists (
        checklist_id TEXT PRIMARY KEY,
        solicitacao_id TEXT NOT NULL UNIQUE REFERENCES solicitacoes(solicitacao_id) ON DELETE CASCADE,
        titulo TEXT NOT NULL,
        responsavel_colaborador_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
        responsavel_colaborador_nome TEXT,
        status TEXT NOT NULL DEFAULT 'pendente',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await query(
      `CREATE TABLE IF NOT EXISTS solicitacao_checklist_itens (
        item_id TEXT PRIMARY KEY,
        checklist_id TEXT NOT NULL REFERENCES solicitacao_checklists(checklist_id) ON DELETE CASCADE,
        ordem INTEGER NOT NULL DEFAULT 1,
        descricao TEXT NOT NULL,
        tipo_item TEXT NOT NULL DEFAULT 'geral',
        equipamento_id TEXT REFERENCES equipamentos(etiqueta_id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pendente',
        observacao TEXT,
        anexos JSONB NOT NULL DEFAULT '[]'::jsonb,
        concluido_em TIMESTAMPTZ,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await query(`ALTER TABLE solicitacao_checklist_itens ADD COLUMN IF NOT EXISTS anexos JSONB NOT NULL DEFAULT '[]'::jsonb`);

    await query(
      `CREATE TABLE IF NOT EXISTS checklist_templates (
        template_id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        descricao TEXT,
        responsavel_colaborador_id TEXT REFERENCES colaboradores(colaborador_id) ON DELETE SET NULL,
        responsavel_colaborador_nome TEXT,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        criado_por_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await query(
      `CREATE TABLE IF NOT EXISTS checklist_template_itens (
        template_item_id TEXT PRIMARY KEY,
        template_id TEXT NOT NULL REFERENCES checklist_templates(template_id) ON DELETE CASCADE,
        ordem INTEGER NOT NULL DEFAULT 1,
        descricao TEXT NOT NULL,
        tipo_item TEXT NOT NULL DEFAULT 'geral',
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );

    await query(`CREATE INDEX IF NOT EXISTS idx_checklists_solicitacao ON solicitacao_checklists(solicitacao_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_checklist_itens_checklist ON solicitacao_checklist_itens(checklist_id, ordem)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_checklist_template_nome ON checklist_templates(nome)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_checklist_template_itens_template ON checklist_template_itens(template_id, ordem)`);

    // Garantir que a constraint chk_checklist_status aceite os termos usados pelo sistema
    await query(`ALTER TABLE solicitacao_checklists DROP CONSTRAINT IF EXISTS chk_checklist_status`);
    await query(`ALTER TABLE solicitacao_checklists ADD CONSTRAINT chk_checklist_status CHECK (status = ANY (ARRAY['pendente'::text, 'em_andamento'::text, 'em_atendimento'::text, 'concluido'::text]))`);
  })().catch((err) => {
    checklistSchemaReadyPromise = null;
    throw err;
  });

  return checklistSchemaReadyPromise;
}

// ─── Protocolo sequencial ─────────────────────────────────────────────────────

async function nextProtocolo(client) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const periodo = `${yyyy}-${mm}`;

  const seq = await client.query(
    `INSERT INTO solicitacao_protocolos_seq (periodo, ultimo_numero)
     VALUES ($1, 1)
     ON CONFLICT (periodo)
     DO UPDATE SET ultimo_numero = solicitacao_protocolos_seq.ultimo_numero + 1,
                   atualizado_em = NOW()
     RETURNING ultimo_numero`,
    [periodo]
  );

  return `${periodo}-${String(seq.rows[0].ultimo_numero).padStart(4, '0')}`;
}

// ─── Auditoria e sync ─────────────────────────────────────────────────────────

// auditoria_eventos removida — registrarAuditoria é no-op
async function registrarAuditoria(client, entidade, entidadeID, acao, payload, userId) {
  return auditService.logAction({
    entidade,
    entidade_id: entidadeID,
    acao,
    payload,
    userId
  });
}

// logs_sincronizacao removida — gravarLogSync é no-op
async function gravarLogSync(_client, _data) {
  // tabela removida em 2026-03-10
}

async function syncWithLegacy(client, { endpoint, method, payload, protocolo, tipoOperacao }) {
  const base = String(process.env.LEGACY_SYNC_BASE_URL || '').trim();
  const maxRetries = Number(process.env.LEGACY_SYNC_MAX_RETRIES || 3);

  if (!base) {
    await gravarLogSync(client, { protocolo, tipoOperacao, payload, status: 'pendente', tentativas: 1, mensagemErro: 'LEGACY_SYNC_BASE_URL não configurada' });
    return { status: 'pendente' };
  }

  let lastError = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (typeof fetch !== 'function') throw new Error('Fetch indisponível no runtime Node');

      const response = await fetch(`${base}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      await gravarLogSync(client, { protocolo, tipoOperacao, payload, status: 'sucesso', tentativas: attempt, dataSucesso: new Date().toISOString() });
      return { status: 'sucesso' };
    } catch (err) {
      lastError = err;
      await gravarLogSync(client, {
        protocolo, tipoOperacao, payload,
        status: attempt >= maxRetries ? 'falha' : 'pendente',
        tentativas: attempt,
        mensagemErro: err.message
      });
    }
  }

  return { status: 'falha', erro: lastError?.message || 'Falha desconhecida' };
}

module.exports = {
  parseJsonArray,
  normalizeText,
  mapTipoSolicitacao,
  mapChecklistItemStatus,
  ensureProcessamentosDestinoColumns,
  ensureSolicitacoesChecklistSchema,
  nextProtocolo,
  registrarAuditoria,
  syncWithLegacy,
};
