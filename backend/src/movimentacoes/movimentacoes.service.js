'use strict';

const { AppError } = require('../errors');
const { pool, query } = require('../db');
const queries = require('./movimentacoes.queries');

/**
 * movimentacoes.service.js
 * Lógica de negócio pesada, normalizações, cálculos e transações DB.
 */

// --- Helpers de Normalização (Mantidos da rota para compatibilidade) ---

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeTipo(tipo) {
  const t = normalizeText(tipo);
  if (t === 'entrega' || t.startsWith('aloc')) return 'alocacao';
  if (t.startsWith('devolu')) return 'devolucao';
  if (t.startsWith('transfer')) return 'transferencia';
  if (t.startsWith('manut')) return 'manutencao';
  if (t.startsWith('substitu')) return 'substituicao';
  return normalizeText(tipo) || 'movimentacao';
}

function formatDateTimePT(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function buildDescricao(row) {
  const equipLabel = `${row.tipoEquipamento || 'Equipamento'} ${row.marca || ''} ${row.modelo || ''}`.trim();
  const equipamento = `${equipLabel} (#${row.numeroSerie || row.codigoBarras || row.equipamentoID || '-'})`;
  
  const fmtOwner = (nome, matricula, setor) => nome ? `${nome} (Mat: ${matricula || '-'}, Setor: ${setor || '-'})` : 'Sem vínculo';
  
  const donoAnterior = fmtOwner(row.donoAnteriorNome, row.donoAnteriorMatricula, row.donoAnteriorSetor);
  const novoDono = fmtOwner(row.novoDonoNome, row.novoDonoMatricula, row.novoDonoSetor);
  const dataHora = formatDateTimePT(row.dataHora);
  const responsavel = row.tecnicoResponsavelNome || row.responsavel || '-';
  const protocolo = row.protocoloSolicitacao ? ` Protocolo: ${row.protocoloSolicitacao}.` : '';
  const motivo = row.motivo ? ` Motivo: ${row.motivo}.` : '';

  switch (normalizeTipo(row.tipoMovimentacao)) {
    case 'alocacao':
      return `${equipamento} foi ALOCADO para ${novoDono} em ${dataHora}. Equipamento estava disponível no estoque. Responsável: ${responsavel}.${protocolo}`.trim();
    case 'transferencia':
      return `${equipamento} foi TRANSFERIDO de ${donoAnterior} para ${novoDono} em ${dataHora}.${motivo} Responsável: ${responsavel}.${protocolo}`.trim();
    case 'devolucao':
      return `${equipamento} foi DEVOLVIDO por ${donoAnterior} em ${dataHora}. Equipamento retorna ao estoque.${motivo} Responsável: ${responsavel}.${protocolo}`.trim();
    case 'manutencao':
      return `${equipamento} de ${donoAnterior} foi enviado para MANUTENÇÃO em ${dataHora}.${motivo} Responsável: ${responsavel}.${protocolo}`.trim();
    case 'substituicao':
      return `${equipamento} de ${donoAnterior} foi SUBSTITUÍDO por ${row.equipamentoSubstitutoID || 'equipamento substituto'} em ${dataHora}.${motivo} Responsável: ${responsavel}.${protocolo}`.trim();
    default:
      return `${equipamento} teve movimentação registrada em ${dataHora}.${motivo} Responsável: ${responsavel}.${protocolo}`.trim();
  }
}

// --- Funções Auxiliares de Serviço ---

async function getColaborador(client, colaboradorID) {
  if (!colaboradorID) return null;
  const result = await client.query(
    `SELECT colaborador_id AS "colaboradorID", nome, departamento FROM colaboradores WHERE colaborador_id = $1`,
    [colaboradorID]
  );
  return result.rowCount ? result.rows[0] : null;
}

async function syncSolicitacaoByProtocolo(client, protocoloRaw) {
  const protocolo = String(protocoloRaw || '').trim();
  if (!protocolo) return;

  const solRes = await client.query(
    `SELECT solicitacao_id AS "solicitacaoID", status FROM solicitacoes WHERE protocolo = $1 LIMIT 1`,
    [protocolo]
  );
  if (!solRes.rowCount) return;

  const solicitacao = solRes.rows[0];
  const statusAtual = normalizeText(solicitacao.status);
  if (statusAtual === 'rejeitado') return;

  const movsRes = await client.query(
    `SELECT tipo_movimentacao AS "tipoMovimentacao", status_novo AS "statusNovo", confirmado_usuario AS "confirmadoUsuario"
       FROM movimentacoes WHERE protocolo_solicitacao = $1`,
    [protocolo]
  );

  const movs = movsRes.rows;
  const hasConfirmado = movs.some(m => Boolean(m.confirmadoUsuario));
  const hasStatusEmUso = movs.some(m => {
    const s = normalizeText(m.statusNovo || '');
    return s.includes('em uso');
  });

  let novoStatus = statusAtual;
  if (hasConfirmado && hasStatusEmUso) novoStatus = 'concluido';
  else if (movs.length > 0) novoStatus = 'em_atendimento';

  if (novoStatus !== statusAtual) {
    await client.query(
      `UPDATE solicitacoes SET status = $1, data_conclusao = CASE WHEN $1 = 'concluido' THEN COALESCE(data_conclusao, NOW()) ELSE NULL END, atualizado_em = NOW() WHERE solicitacao_id = $2`,
      [novoStatus, solicitacao.solicitacaoID]
    );
  }
}

// --- Funções de API ---

function buildWhereFilters(queryObj, params) {
  const where = [];
  const { equipamentoID, colaboradorID, tipoMovimentacao, dataInicio, dataFim, equipamento, usuario, setor, tecnico, protocolo, ativa } = queryObj;

  if (equipamentoID) { params.push(equipamentoID); where.push(`m.equipamento_id = $${params.length}`); }
  if (colaboradorID) { params.push(colaboradorID); where.push(`(m.colaborador_id = $${params.length} OR m.novo_dono_id = $${params.length} OR m.dono_anterior_id = $${params.length})`); }
  if (tipoMovimentacao) { params.push(normalizeTipo(tipoMovimentacao)); where.push(`m.tipo_movimentacao = $${params.length}`); }
  if (dataInicio) { params.push(dataInicio); where.push(`m.data_hora >= $${params.length}::timestamptz`); }
  if (dataFim) { params.push(dataFim); where.push(`m.data_hora <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`); }
  
  if (equipamento) { params.push(`%${equipamento}%`); where.push(`(m.equipamento_id ILIKE $${params.length} OR e.numero_serie ILIKE $${params.length} OR e.codigo_barras ILIKE $${params.length})`); }
  if (usuario) { params.push(`%${usuario}%`); where.push(`(COALESCE(m.dono_anterior_nome, '') ILIKE $${params.length} OR COALESCE(m.novo_dono_nome, '') ILIKE $${params.length})`); }
  if (setor) { params.push(`%${setor}%`); where.push(`(COALESCE(m.setor_origem, '') ILIKE $${params.length} OR COALESCE(m.setor_destino, '') ILIKE $${params.length} OR COALESCE(m.dono_anterior_setor, '') ILIKE $${params.length} OR COALESCE(m.novo_dono_setor, '') ILIKE $${params.length})`); }
  if (tecnico) { params.push(`%${tecnico}%`); where.push(`COALESCE(m.tecnico_responsavel_nome, m.responsavel, '') ILIKE $${params.length}`); }
  if (protocolo) { params.push(`%${protocolo}%`); where.push(`COALESCE(m.protocolo_solicitacao, '') ILIKE $${params.length}`); }

  if (ativa === 'true') where.push('m.data_fim IS NULL');
  else if (ativa === 'false') where.push('m.data_fim IS NOT NULL');

  return where.length ? ` WHERE ${where.join(' AND ')}` : '';
}

async function listar(queryObj) {
  const params = [];
  const where = buildWhereFilters(queryObj, params);
  const result = await queries.findMovimentacoes(where, params);
  return result.rows.map(row => ({
    ...row,
    tipoMovimentacao: normalizeTipo(row.tipoMovimentacao),
    descricaoDetalhada: row.descricaoDetalhada || buildDescricao(row)
  }));
}

async function getResumo(queryObj) {
  const params = [];
  const where = buildWhereFilters(queryObj, params);
  const [porTipo, topEquips, tempoMedio] = await Promise.all([
    queries.countPorTipo(where, params),
    queries.findTopEquipamentos(where, params),
    queries.findTempoMedio(where, params)
  ]);
  return {
    porTipo: porTipo.rows.map(r => ({ ...r, tipoMovimentacao: normalizeTipo(r.tipoMovimentacao) })),
    topEquipamentos: topEquips.rows,
    tempoMedioPorEquipamento: tempoMedio.rows
  };
}

async function findByEquipamento(equipamentoID) {
  const result = await queries.findByEquipamento(equipamentoID);
  return result.rows.map(row => ({
    ...row,
    tipoMovimentacao: normalizeTipo(row.tipoMovimentacao),
    descricaoDetalhada: row.descricaoDetalhada || buildDescricao(row)
  }));
}

async function criarMovimentacao(payload, user) {
  const client = await pool.connect();
  try {
    if (!payload.equipamentoID || !payload.tipoMovimentacao || !payload.motivo || !payload.dataHora) {
      throw new AppError('Campos obrigatórios: equipamentoID, tipoMovimentacao, dataHora, motivo', 400);
    }

    await client.query('BEGIN');

    const tipo = normalizeTipo(payload.tipoMovimentacao);
    const tecnicoNome = payload.tecnicoResponsavelNome || payload.responsavel || user?.nome || user?.email;
    if (!tecnicoNome) throw new AppError('Técnico/responsável é obrigatório', 400);

    const equipRes = await client.query(
      `SELECT etiqueta_id, status, localizacao, colaborador_atual_id, propriedade, tipo_equipamento, marca, modelo, numero_serie, codigo_barras
         FROM equipamentos WHERE etiqueta_id = $1`,
      [payload.equipamentoID]
    );
    if (!equipRes.rowCount) throw new AppError('Equipamento não encontrado', 404);
    const equip = equipRes.rows[0];

    // Validações de Negócio
    if (['alocacao', 'transferencia', 'substituicao'].includes(tipo) && !payload.novoDonoID && !payload.novoDonoNome) {
      throw new AppError('Novo dono é obrigatório para este tipo de movimentação', 400);
    }
    if (equip.propriedade === 'usuario' && ['alocacao', 'transferencia', 'devolucao'].includes(tipo)) {
      throw new AppError('Equipamento pessoal não pode ser realocado', 400);
    }

    const movId = payload.movimentacaoID || `MOV-${Date.now()}`;
    const donoAntID = payload.donoAnteriorID || equip.colaborador_atual_id || null;
    const novoDonoID = payload.novoDonoID || payload.colaboradorID || null;

    const [donoAnt, novoDono, tecnicoObj] = await Promise.all([
      payload.donoAnteriorNome ? { nome: payload.donoAnteriorNome, departamento: payload.donoAnteriorSetor } : getColaborador(client, donoAntID),
      payload.novoDonoNome ? { nome: payload.novoDonoNome, departamento: payload.novoDonoSetor } : getColaborador(client, novoDonoID),
      getColaborador(client, payload.tecnicoResponsavelID)
    ]);

    const dataHora = payload.dataHora || new Date().toISOString();
    
    // Cálculos de Status e Localização
    const statusNovo = payload.statusNovo || (
      tipo === 'devolucao' ? 'Disponível' : tipo === 'manutencao' ? 'Manutenção' : tipo === 'substituicao' ? 'Retirado' : 'Em Uso'
    );
    const locNova = payload.localizacaoNova || novoDono?.departamento || (tipo === 'devolucao' ? 'Estoque' : equip.localizacao);

    const rowForDesc = {
      ...payload, tipoMovimentacao: tipo, dataHora,
      tipoEquipamento: equip.tipo_equipamento, marca: equip.marca, modelo: equip.modelo,
      numeroSerie: equip.numero_serie, codigoBarras: equip.codigo_barras,
      donoAnteriorNome: donoAnt?.nome, donoAnteriorSetor: donoAnt?.departamento,
      novoDonoNome: novoDono?.nome, novoDonoSetor: novoDono?.departamento,
      tecnicoResponsavelNome: tecnicoNome
    };
    const descricao = payload.descricaoDetalhada || buildDescricao(rowForDesc);

    const insertSql = `
      INSERT INTO movimentacoes (
        movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao, setor_origem, setor_destino,
        data_inicio, responsavel, observacao, data_hora, dono_anterior_id, dono_anterior_nome,
        dono_anterior_setor, novo_dono_id, novo_dono_nome, novo_dono_setor, tecnico_responsavel_id,
        tecnico_responsavel_nome, motivo, protocolo_solicitacao, status_anterior, status_novo,
        localizacao_anterior, localizacao_nova, descricao_detalhada, anexos, link_solicitacao,
        assinatura_digital, confirmado_usuario, equipamento_substituto_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
      RETURNING movimentacao_id`;
    
    await client.query(insertSql, [
      movId, payload.equipamentoID, novoDonoID, tipo, payload.setorOrigem || donoAnt?.departamento || equip.localizacao,
      locNova, payload.dataInicio || dataHora, tecnicoNome, payload.observacao, dataHora,
      donoAntID, rowForDesc.donoAnteriorNome, rowForDesc.donoAnteriorSetor, novoDonoID, rowForDesc.novoDonoNome,
      rowForDesc.novoDonoSetor, payload.tecnicoResponsavelID || null, tecnicoNome, payload.motivo,
      payload.protocoloSolicitacao, equip.status, statusNovo, equip.localizacao, locNova, descricao,
      JSON.stringify(payload.anexos || []), payload.linkSolicitacao, payload.assinaturaDigital,
      Boolean(payload.confirmadoUsuario), payload.equipamentoSubstitutoID
    ]);

    // Updates em Equipamentos
    if (tipo === 'alocacao' || tipo === 'transferencia') {
      await client.query(`UPDATE equipamentos SET status = 'Em Uso', colaborador_atual_id = $1, localizacao = $2, updated_at = NOW() WHERE etiqueta_id = $3`, [novoDonoID, locNova, payload.equipamentoID]);
    } else if (tipo === 'devolucao') {
      await client.query(`UPDATE equipamentos SET status = 'Disponível', colaborador_atual_id = NULL, localizacao = $1, updated_at = NOW() WHERE etiqueta_id = $2`, [locNova, payload.equipamentoID]);
      await client.query(`UPDATE movimentacoes SET data_fim = $1 WHERE equipamento_id = $2 AND tipo_movimentacao = 'alocacao' AND data_fim IS NULL`, [dataHora, payload.equipamentoID]);
    } else if (tipo === 'manutencao') {
      await client.query(`UPDATE equipamentos SET status = $1, colaborador_atual_id = NULL, localizacao = $2, updated_at = NOW() WHERE etiqueta_id = $3`, [statusNovo, locNova, payload.equipamentoID]);
    } else if (tipo === 'substituicao') {
      await client.query(`UPDATE equipamentos SET status = 'Retirado', updated_at = NOW() WHERE etiqueta_id = $1`, [payload.equipamentoID]);
      if (payload.equipamentoSubstitutoID) {
        await client.query(`UPDATE equipamentos SET status = 'Em Uso', colaborador_atual_id = $1, localizacao = $2, updated_at = NOW() WHERE etiqueta_id = $3`, [novoDonoID, locNova, payload.equipamentoSubstitutoID]);
      }
    }

    if (payload.protocoloSolicitacao) await syncSolicitacaoByProtocolo(client, payload.protocoloSolicitacao);

    await client.query('COMMIT');
    return queries.findByID(movId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deletar(id) {
  const client = await pool.connect();
  try {
    const mov = await queries.findByID(id);
    if (!mov) throw new AppError('Movimentação não encontrada', 404);

    await client.query('BEGIN');
    await client.query('DELETE FROM movimentacoes WHERE movimentacao_id = $1', [id]);
    if (mov.protocoloSolicitacao) await syncSolicitacaoByProtocolo(client, mov.protocoloSolicitacao);
    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  listar,
  getResumo,
  criarMovimentacao,
  deletar,
  findByID: queries.findByID,
  findByEquipamento,
  buildDescricao,
  normalizeTipo
};
