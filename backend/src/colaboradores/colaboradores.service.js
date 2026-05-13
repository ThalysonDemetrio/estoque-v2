'use strict';

const { AppError } = require('../errors');
const queries = require('./colaboradores.queries');
const socketLib = require('../lib/socket');
const auditService = require('../audit/audit.service');

/**
 * colaboradores.service.js
 * Lógica de negócio e coordenação de ações para Colaboradores.
 */

async function listar(filters) {
  const params = [];
  const where = [];
  if (filters.ativo !== undefined) {
    params.push(filters.ativo === 'true');
    where.push(`ativo = $${params.length}`);
  }
  if (filters.departamento) {
    params.push(filters.departamento);
    where.push(`departamento = $${params.length}`);
  }
  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = await queries.findColaboradores(whereClause, params);
  return res.rows;
}

async function buscarPorID(id) {
  const colab = await queries.findByID(id);
  if (!colab) throw new AppError('Colaborador não encontrado', 404);
  return colab;
}

async function criar(payload, user) {
  if (!payload.colaboradorID || !payload.nome) {
    throw new AppError('colaboradorID e nome são obrigatórios', 400);
  }
  const res = await queries.insertColaborador(payload);
  socketLib.emit('colaborador_update', { action: 'create', data: res });
  
  await auditService.logAction({
    entidade: 'colaborador',
    entidade_id: payload.colaboradorID,
    acao: 'create',
    payload: res,
    userId: user?.userId,
    userNome: user?.nome
  });

  return res;
}

async function atualizar(id, payload, user) {
  const before = await queries.findByID(id);
  if (!before) throw new AppError('Colaborador não encontrado', 404);

  const wasActive = before.ativo === true;
  const willBeActive = payload.ativo !== false;

  const result = await queries.updateColaborador(id, payload);

  // Lógica de desvinculação em cascata se inativado
  if (wasActive && !willBeActive) {
    await queries.releaseEquipamentos(id);
  }

  socketLib.emit('colaborador_update', { action: 'update', data: result });
  
  await auditService.logAction({
    entidade: 'colaborador',
    entidade_id: id,
    acao: 'update',
    payload: result,
    userId: user?.userId,
    userNome: user?.nome
  });

  return result;
}

async function deletar(id, user) {
  const res = await queries.deleteColaborador(id);
  if (res.rowCount === 0) throw new AppError('Colaborador não encontrado', 404);
  socketLib.emit('colaborador_update', { action: 'delete', id: id });
  
  await auditService.logAction({
    entidade: 'colaborador',
    entidade_id: id,
    acao: 'delete',
    userId: user?.userId,
    userNome: user?.nome
  });

  return true;
}

module.exports = {
  listar,
  buscarPorID,
  criar,
  atualizar,
  deletar
};
