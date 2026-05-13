'use strict';

const { query } = require('../db');

/**
 * audit.service.js
 * Centralização de registros de auditoria.
 */

async function logAction({ entidade, entidade_id, acao, payload, userId, userNome, ipAddress, userAgent }) {
  const sql = `
    INSERT INTO audit_logs (entidade, entidade_id, acao, payload, user_id, user_nome, ip_address, user_agent)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
    RETURNING audit_id
  `;
  const params = [
    entidade,
    String(entidade_id),
    acao,
    JSON.stringify(payload || {}),
    userId || null,
    userNome || null,
    ipAddress || null,
    userAgent || null
  ];

  try {
    const res = await query(sql, params);
    return res.rows[0].audit_id;
  } catch (err) {
    console.error('[AUDIT] Erro ao gravar log:', err);
    // Não lançamos erro para não quebrar a transação principal do negócio
    return null;
  }
}

async function listar(filters = {}) {
  let sql = 'SELECT * FROM audit_logs';
  const where = [];
  const params = [];

  if (filters.entidade) {
    params.push(filters.entidade);
    where.push(`entidade = $${params.length}`);
  }
  if (filters.entidade_id) {
    params.push(filters.entidade_id);
    where.push(`entidade_id = $${params.length}`);
  }
  if (filters.acao) {
    params.push(filters.acao);
    where.push(`acao = $${params.length}`);
  }

  if (where.length) {
    sql += ` WHERE ${where.join(' AND ')}`;
  }

  sql += ' ORDER BY created_at DESC LIMIT 500';

  const res = await query(sql, params);
  return res.rows;
}

module.exports = {
  logAction,
  listar
};
