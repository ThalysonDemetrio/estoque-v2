'use strict';

/**
 * solicitacoes.service.js
 * Lógica de negócio — transações, regras de domínio, orquestração.
 * Não conhece Express (sem req/res). Recebe dados limpos, retorna objetos.
 */

const { pool } = require('../db');
const {
  parseJsonArray,
  normalizeText,
  mapTipoSolicitacao,
  mapChecklistItemStatus,
  ensureSolicitacoesChecklistSchema,
  nextProtocolo,
  registrarAuditoria,
  syncWithLegacy,
} = require('./solicitacoes.helpers');
const socketLib = require('../lib/socket');

// ─── Templates ────────────────────────────────────────────────────────────────

async function criarTemplate({ nome, descricao, responsavelID, itens, userId }) {
  if (!nome) throw Object.assign(new Error('Nome do template é obrigatório'), { status: 400 });
  if (!itens?.length) throw Object.assign(new Error('Template exige ao menos um item'), { status: 400 });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let responsavelNome = null;
    if (responsavelID) {
      const r = await client.query(`SELECT nome FROM colaboradores WHERE colaborador_id = $1 LIMIT 1`, [responsavelID]);
      if (!r.rowCount) throw Object.assign(new Error('Responsável do template não encontrado'), { status: 400 });
      responsavelNome = r.rows[0].nome || null;
    }

    const templateID = `TPL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    await client.query(
      `INSERT INTO checklist_templates (template_id, nome, descricao, responsavel_colaborador_id,
        responsavel_colaborador_nome, ativo, criado_por_user_id, criado_em, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6,NOW(),NOW())`,
      [templateID, nome, descricao || null, responsavelID || null, responsavelNome, userId || null]
    );

    for (const item of itens) {
      await client.query(
        `INSERT INTO checklist_template_itens (template_item_id, template_id, ordem, descricao, tipo_item, criado_em, atualizado_em)
         VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
        [`TPL-ITM-${Date.now()}-${Math.floor(Math.random() * 100000)}`, templateID, Number.isFinite(item.ordem) ? item.ordem : 1, item.descricao, item.tipoItem || 'geral']
      );
    }

    await client.query('COMMIT');
    return { templateID, nome, totalItens: itens.length };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Criar solicitação ────────────────────────────────────────────────────────

async function criarSolicitacao(payload, userId) {
  await ensureSolicitacoesChecklistSchema();

  const tipoSolicitacao = mapTipoSolicitacao(payload.tipoSolicitacao);

  // Validação de campos obrigatórios
  if (!payload.solicitanteNome || !payload.departamento || !payload.urgencia || !tipoSolicitacao) {
    throw Object.assign(new Error('Campos obrigatorios: solicitanteNome, departamento, urgencia, tipoSolicitacao'), { status: 400 });
  }
  if (tipoSolicitacao === 'manutencao' && (!payload.equipamentoAtualID || !payload.descricaoProblema)) {
    throw Object.assign(new Error('Manutenção exige equipamentoAtualID e descricaoProblema'), { status: 400 });
  }
  if (tipoSolicitacao === 'alocacao' && !payload.tipoEquipamentoSolicitado) {
    throw Object.assign(new Error('Alocação exige tipoEquipamentoSolicitado'), { status: 400 });
  }

  // Resolver checklist de demanda manual (com suporte a templates)
  let resolvedChecklist = { titulo: '', responsavelID: '', itens: [] };
  if (tipoSolicitacao === 'demanda_manual') {
    resolvedChecklist = await _resolverChecklistDemandaManual(payload);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solicitacaoID = payload.solicitacaoID || `SOL-${Date.now()}`;
    const protocolo = await nextProtocolo(client);

    await client.query(
      `INSERT INTO solicitacoes (
          solicitacao_id, protocolo, tipo_solicitacao, solicitante_id, solicitante_nome,
          departamento, centro_custo, equipamento_atual_id, tipo_equipamento_solicitado,
          descricao_problema, justificativa, urgencia, status, data_necessidade,
          anexos, criado_por_user_id, atualizado_em
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pendente',$13,$14::jsonb,$15,NOW())`,
      [
        solicitacaoID, protocolo, tipoSolicitacao,
        payload.solicitanteID || null, payload.solicitanteNome, payload.departamento,
        payload.centroCusto || null, payload.equipamentoAtualID || null,
        payload.tipoEquipamentoSolicitado || null, payload.descricaoProblema || null,
        payload.justificativa || null, normalizeText(payload.urgencia),
        payload.dataNecessidade || null,
        JSON.stringify(Array.isArray(payload.anexos) ? payload.anexos : []),
        userId || null,
      ]
    );

    if (tipoSolicitacao === 'demanda_manual') {
      await _inserirChecklist(client, solicitacaoID, protocolo, resolvedChecklist);
    }

    await registrarAuditoria(client, 'solicitacao', solicitacaoID, 'criada', payload, userId);
    await syncWithLegacy(client, {
      endpoint: '/api/sync/solicitacao', method: 'POST',
      payload: { protocolo, tipoSolicitacao, solicitanteNome: payload.solicitanteNome, departamento: payload.departamento, status: 'pendente' },
      protocolo, tipoOperacao: 'nova_solicitacao',
    });

    await client.query('COMMIT');
    
    socketLib.emit('solicitacao_update', { action: 'create', data: { solicitacaoID, protocolo } });
    return { solicitacaoID, protocolo };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function _resolverChecklistDemandaManual(payload) {
  let responsavelID = String(payload.checklistResponsavelID || '').trim();
  let itens = Array.isArray(payload.checklistItens) ? payload.checklistItens : [];
  let titulo = String(payload.checklistTitulo || '').trim();
  const templateID = String(payload.checklistTemplateID || '').trim();

  if (templateID) {
    const { query } = require('../db');
    const tmpl = await query(
      `SELECT template_id AS "templateID", nome, responsavel_colaborador_id AS "responsavelID"
         FROM checklist_templates WHERE template_id = $1 AND ativo = TRUE LIMIT 1`,
      [templateID]
    );
    if (!tmpl.rowCount) throw Object.assign(new Error('Template de checklist não encontrado'), { status: 400 });

    const itensResult = await query(
      `SELECT ordem, descricao, tipo_item AS "tipoItem"
         FROM checklist_template_itens WHERE template_id = $1 ORDER BY ordem, criado_em`,
      [templateID]
    );

    if (!titulo) titulo = String(tmpl.rows[0].nome || '').trim();
    if (!responsavelID) responsavelID = String(tmpl.rows[0].responsavelID || '').trim();
    if (!itens.length) itens = itensResult.rows;
  }

  const itensValidos = itens
    .map((item, i) => ({ ordem: Number(item?.ordem || i + 1), descricao: String(item?.descricao || '').trim(), tipoItem: String(item?.tipoItem || 'geral') }))
    .filter((item) => item.descricao);

  if (!responsavelID) throw Object.assign(new Error('Demanda manual exige checklistResponsavelID'), { status: 400 });
  if (!itensValidos.length) throw Object.assign(new Error('Demanda manual exige ao menos um item no checklist'), { status: 400 });

  return { titulo: titulo || `Checklist ${payload.solicitanteNome || 'Demanda Manual'}`, responsavelID, itens: itensValidos };
}

async function _inserirChecklist(client, solicitacaoID, protocolo, { titulo, responsavelID, itens }) {
  const responsavelResult = await client.query(
    `SELECT colaborador_id AS "colaboradorID", nome FROM colaboradores WHERE colaborador_id = $1`,
    [responsavelID]
  );
  if (!responsavelResult.rowCount) throw Object.assign(new Error('Responsável do checklist não encontrado'), { status: 400 });

  const checklistID = `CHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  await client.query(
    `INSERT INTO solicitacao_checklists (checklist_id, solicitacao_id, titulo, responsavel_colaborador_id, responsavel_colaborador_nome, status, criado_em, atualizado_em)
     VALUES ($1,$2,$3,$4,$5,'pendente',NOW(),NOW())`,
    [checklistID, solicitacaoID, titulo || `Checklist ${protocolo}`, responsavelID, responsavelResult.rows[0].nome]
  );

  for (const item of itens) {
    await client.query(
      `INSERT INTO solicitacao_checklist_itens (item_id, checklist_id, ordem, descricao, tipo_item, anexos, status, criado_em, atualizado_em)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,'pendente',NOW(),NOW())`,
      [`ITM-${Date.now()}-${Math.floor(Math.random() * 100000)}`, checklistID, Number.isFinite(item.ordem) ? item.ordem : 1, item.descricao, item.tipoItem || 'geral', JSON.stringify(parseJsonArray(item?.anexos))]
    );
  }
}

// ─── Processar solicitação ────────────────────────────────────────────────────

async function processarSolicitacao(solicitacaoID, payload, user) {
  const { ensureProcessamentosDestinoColumns } = require('./solicitacoes.helpers');
  await ensureProcessamentosDestinoColumns();

  const acao = normalizeText(payload.acao || 'aprovar');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solicitacaoResult = await client.query(
      `SELECT solicitacao_id AS "solicitacaoID", protocolo, tipo_solicitacao AS "tipoSolicitacao",
              solicitante_id AS "solicitanteID", solicitante_nome AS "solicitanteNome",
              departamento, equipamento_atual_id AS "equipamentoAtualID", status
         FROM solicitacoes WHERE solicitacao_id = $1 FOR UPDATE`,
      [solicitacaoID]
    );

    if (!solicitacaoResult.rowCount) throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });

    const sol = solicitacaoResult.rows[0];
    const tipoNorm = normalizeText(sol.tipoSolicitacao);

    if (sol.status === 'concluido' || sol.status === 'rejeitado') {
      throw Object.assign(new Error('Solicitação já finalizada'), { status: 400 });
    }
    if (acao === 'rejeitar' && !payload.motivoRejeicao) {
      throw Object.assign(new Error('Motivo da rejeição é obrigatório'), { status: 400 });
    }
    if (acao !== 'rejeitar' && (tipoNorm === 'alocacao' || tipoNorm === 'substituicao') && !payload.equipamentoID) {
      throw Object.assign(new Error('Selecione um dispositivo para alocar nesta solicitação'), { status: 400 });
    }

    let tipoAcao = sol.tipoSolicitacao;
    let novoStatus = 'em_atendimento';
    let equipamentoID = payload.equipamentoID || null;
    const substituicaoNoProcessamento = (tipoNorm === 'alocacao') && (
      payload.estaSubstituindo === true ||
      normalizeText(payload.estaSubstituindo) === 'sim' ||
      Boolean(payload.equipamentoTrocadoID)
    );
    const equipamentoAnteriorID = payload.equipamentoTrocadoID || sol.equipamentoAtualID || null;
    let colaboradorDestinoID = payload.colaboradorDestinoID || sol.solicitanteID || null;
    let colaboradorDestinoNome = sol.solicitanteNome || null;
    let colaboradorDestinoDepartamento = sol.departamento || null;

    if (acao === 'rejeitar') {
      tipoAcao = 'rejeicao'; novoStatus = 'rejeitado'; equipamentoID = null; colaboradorDestinoID = null;
    }

    if (colaboradorDestinoID) {
      const colResult = await client.query(
        `SELECT colaborador_id AS "colaboradorID", nome, departamento FROM colaboradores WHERE colaborador_id = $1`,
        [colaboradorDestinoID]
      );
      if (!colResult.rowCount && acao !== 'rejeitar') {
        throw Object.assign(new Error('Colaborador destinatário não encontrado'), { status: 400 });
      }
      if (colResult.rowCount) {
        colaboradorDestinoNome = colResult.rows[0].nome;
        colaboradorDestinoDepartamento = colResult.rows[0].departamento || colaboradorDestinoDepartamento;
      }
    }

    if (tipoNorm === 'manutencao' && normalizeText(payload.resultadoManutencao) === 'irrecuperavel') {
      tipoAcao = 'substituicao';
      await client.query(
        `UPDATE solicitacoes SET tipo_solicitacao = 'substituicao', status = 'em_atendimento', atualizado_em = NOW() WHERE solicitacao_id = $1`,
        [solicitacaoID]
      );
    }

    if (substituicaoNoProcessamento) {
      tipoAcao = 'substituicao';
      await client.query(
        `UPDATE solicitacoes
            SET tipo_solicitacao = 'substituicao',
                equipamento_atual_id = COALESCE($1, equipamento_atual_id),
                status = 'em_atendimento',
                atualizado_em = NOW()
          WHERE solicitacao_id = $2`,
        [equipamentoAnteriorID, solicitacaoID]
      );
    }

    const processamentoID = payload.processamentoID || `PROC-${Date.now()}`;
    const tecnicoNome = payload.tecnicoNome || user?.nome || user?.email || 'TI';

    await client.query(
      `INSERT INTO processamentos (processamento_id, solicitacao_id, equipamento_id,
          colaborador_destino_id, colaborador_destino_nome, colaborador_destino_departamento,
          tecnico_ti_user_id, tecnico_ti_nome, tipo_acao, diagnostico, observacoes,
          equipamento_anterior_id, confirmacao_entrega, data_processamento, motivo_rejeicao)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,FALSE,NOW(),$13)`,
      [processamentoID, solicitacaoID, equipamentoID, colaboradorDestinoID, colaboradorDestinoNome,
       colaboradorDestinoDepartamento, user?.userId || null, tecnicoNome, tipoAcao,
       payload.diagnostico || null, payload.observacoes || null,
       equipamentoAnteriorID, payload.motivoRejeicao || null]
    );

    await client.query(
      `UPDATE solicitacoes SET status = $1, atualizado_em = NOW() WHERE solicitacao_id = $2`,
      [novoStatus, solicitacaoID]
    );

    if (equipamentoID && (tipoAcao === 'alocacao' || tipoAcao === 'substituicao')) {
      await _reservarEquipamento(client, { equipamentoID, sol, colaboradorDestinoID, colaboradorDestinoNome, colaboradorDestinoDepartamento, tipoAcao, tecnicoNome, payload, user });
    }

    if (equipamentoID && tipoAcao === 'manutencao' && acao !== 'rejeitar') {
      // 1. Atualizar status do equipamento
      await client.query(`UPDATE equipamentos SET status = 'Em Manutenção', updated_at = NOW() WHERE etiqueta_id = $1`, [equipamentoID]);
      
      // 2. Registrar movimentação de entrada em manutenção para rastreabilidade
      await client.query(
        `INSERT INTO movimentacoes (
            movimentacao_id, equipamento_id, tipo_movimentacao, data_hora, data_inicio, responsavel, 
            status_anterior, status_novo, protocolo_solicitacao, confirmado_usuario, motivo, observacao
         ) VALUES ($1,$2,$3,NOW(),NOW(),$4,$5,$6,$7,TRUE,$8,$9)`,
        [
          `MOV-MAN-${Date.now()}`, 
          equipamentoID, 
          'Manutenção', 
          tecnicoNome, 
          'Em Uso', // Assume-se que estava em uso ou disponível
          'Em Manutenção', 
          sol.protocolo,
          `Entrada em manutenção via solicitação ${sol.protocolo}`,
          payload.observacoes || 'Início de atendimento técnico.'
        ]
      );
    }

    await registrarAuditoria(client, 'solicitacao', solicitacaoID, `processada_${tipoAcao}`, payload, user?.userId);
    await syncWithLegacy(client, {
      endpoint: `/api/sync/solicitacao/${sol.protocolo}`, method: 'PUT',
      payload: { protocolo: sol.protocolo, status: novoStatus, tipoAcao },
      protocolo: sol.protocolo, tipoOperacao: 'processamento',
    });

    await client.query('COMMIT');
    socketLib.emit('solicitacao_update', { action: 'process', id: solicitacaoID, status: novoStatus });
    return { processamentoID, status: novoStatus };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function _reservarEquipamento(client, { equipamentoID, sol, colaboradorDestinoID, colaboradorDestinoNome, colaboradorDestinoDepartamento, tipoAcao, tecnicoNome, payload, user }) {
  const eqResult = await client.query(
    `SELECT etiqueta_id AS "etiquetaID", tipo_equipamento AS "tipoEquipamento", marca, modelo,
            status, localizacao, colaborador_atual_id AS "colaboradorAtualID"
       FROM equipamentos WHERE etiqueta_id = $1 FOR UPDATE`,
    [equipamentoID]
  );
  const eq = eqResult.rowCount ? eqResult.rows[0] : null;
  const donoAnteriorID = eq?.colaboradorAtualID || null;
  let donoAnterior = null;

  if (donoAnteriorID) {
    const r = await client.query(`SELECT colaborador_id AS "colaboradorID", nome, departamento FROM colaboradores WHERE colaborador_id = $1`, [donoAnteriorID]);
    donoAnterior = r.rowCount ? r.rows[0] : null;
  }

  await client.query(`UPDATE equipamentos SET status = 'Reservado', updated_at = NOW() WHERE etiqueta_id = $1`, [equipamentoID]);

  const jaExiste = await client.query(
    `SELECT 1 FROM movimentacoes WHERE protocolo_solicitacao = $1 AND equipamento_id = $2 AND status_novo = 'Reservado' LIMIT 1`,
    [sol.protocolo, equipamentoID]
  );
  if (jaExiste.rowCount) return;

  const tipoMov = tipoAcao === 'substituicao' ? 'substituicao' : 'alocacao';
  const novaLocalizacao = sol.departamento || eq?.localizacao || null;

  await client.query(
    `INSERT INTO movimentacoes (
        movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao,
        setor_origem, setor_destino, data_inicio, data_hora, responsavel, observacao,
        dono_anterior_id, dono_anterior_nome, dono_anterior_matricula, dono_anterior_setor,
        novo_dono_id, novo_dono_nome, novo_dono_matricula, novo_dono_setor,
        tecnico_responsavel_nome, motivo, protocolo_solicitacao,
        status_anterior, status_novo, localizacao_anterior, localizacao_nova,
        confirmado_usuario, equipamento_substituto_id
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)`,
    [
      `MOV-SOL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      equipamentoID, colaboradorDestinoID || sol.solicitanteID || null, tipoMov,
      eq?.localizacao || null, colaboradorDestinoDepartamento || novaLocalizacao,
      new Date().toISOString(), new Date().toISOString(), user?.nome || user?.email || tecnicoNome,
      payload.observacoes || `Vinculado à solicitação ${sol.protocolo}`,
      donoAnteriorID, donoAnterior?.nome || null, donoAnterior?.colaboradorID || null, donoAnterior?.departamento || null,
      colaboradorDestinoID || sol.solicitanteID || null,
      colaboradorDestinoNome || sol.solicitanteNome || null,
      colaboradorDestinoID || sol.solicitanteID || null,
      colaboradorDestinoDepartamento || sol.departamento || null,
      tecnicoNome, `Atribuição de equipamento para solicitação ${sol.protocolo}`,
      sol.protocolo, eq?.status || null, 'Reservado',
      eq?.localizacao || null, colaboradorDestinoDepartamento || novaLocalizacao, false,
      tipoAcao === 'substituicao' ? (payload.equipamentoTrocadoID || sol.equipamentoAtualID || null) : null,
    ]
  );
}

// ─── Confirmar entrega ────────────────────────────────────────────────────────

async function confirmarEntrega(solicitacaoID, payload, user) {
  const { ensureProcessamentosDestinoColumns } = require('./solicitacoes.helpers');
  await ensureProcessamentosDestinoColumns();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const solResult = await client.query(
      `SELECT solicitacao_id AS "solicitacaoID", protocolo, tipo_solicitacao AS "tipoSolicitacao",
              solicitante_id AS "solicitanteID", solicitante_nome AS "solicitanteNome",
              departamento, equipamento_atual_id AS "equipamentoAtualID"
         FROM solicitacoes WHERE solicitacao_id = $1 FOR UPDATE`,
      [solicitacaoID]
    );
    if (!solResult.rowCount) throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });

    const sol = solResult.rows[0];
    const procResult = await client.query(
      `SELECT processamento_id AS "processamentoID", equipamento_id AS "equipamentoID",
              equipamento_anterior_id AS "equipamentoAnteriorID",
              colaborador_destino_id AS "colaboradorDestinoID",
              colaborador_destino_nome AS "colaboradorDestinoNome",
              colaborador_destino_departamento AS "colaboradorDestinoDepartamento",
              tipo_acao AS "tipoAcao"
         FROM processamentos WHERE solicitacao_id = $1 ORDER BY data_processamento DESC LIMIT 1 FOR UPDATE`,
      [solicitacaoID]
    );

    let proc = procResult.rows[0];

    if (!proc) {
      if (sol.tipoSolicitacao === 'manutencao') {
        const procId = `PROC-AUTO-${Date.now()}`;
        const insertProc = await client.query(
          `INSERT INTO processamentos (processamento_id, solicitacao_id, tipo_acao, equipamento_id, observacoes, confirmacao_entrega, data_processamento)
           VALUES ($1, $2, 'manutencao', $3, 'Processamento automatico na finalizacao', FALSE, NOW()) 
           RETURNING processamento_id AS "processamentoID", equipamento_id AS "equipamentoID", tipo_acao AS "tipoAcao"`,
          [procId, solicitacaoID, sol.equipamentoAtualID]
        );
        proc = insertProc.rows[0];
        proc.tipoAcao = 'manutencao';
      } else {
        throw Object.assign(new Error('Processamento TI não encontrado para esta solicitação'), { status: 400 });
      }
    }

    const tipoAcaoNorm = normalizeText(proc.tipoAcao || 'manutencao');
    const destinatarioID = proc.colaboradorDestinoID || sol.solicitanteID || null;
    const destinatarioNome = proc.colaboradorDestinoNome || sol.solicitanteNome || null;
    const destinatarioDepartamento = proc.colaboradorDestinoDepartamento || sol.departamento || null;
    const confirmar = payload.confirmar !== false;

    if (!confirmar) {
      await client.query(`UPDATE processamentos SET cancelado = TRUE, observacoes = COALESCE(observacoes, '') || ' | Entrega cancelada pelo TI', data_confirmacao = NOW() WHERE processamento_id = $1`, [proc.processamentoID]);
      if (proc.equipamentoID && (tipoAcaoNorm === 'alocacao' || tipoAcaoNorm === 'substituicao')) {
        await client.query(`UPDATE equipamentos SET status = 'Disponível', updated_at = NOW() WHERE etiqueta_id = $1`, [proc.equipamentoID]);
      }
      await client.query(`UPDATE solicitacoes SET status = 'pendente', atualizado_em = NOW() WHERE solicitacao_id = $1`, [solicitacaoID]);
      await registrarAuditoria(client, 'solicitacao', solicitacaoID, 'confirmacao_cancelada', payload, user?.userId);
      await client.query('COMMIT');
      
      socketLib.emit('solicitacao_update', { action: 'cancel_confirm', id: solicitacaoID, status: 'pendente' });
      
      return { status: 'pendente', confirmado: false };
    }

    await client.query(
      `UPDATE processamentos SET confirmacao_entrega = TRUE, equipamento_testado = $1, assinatura_recebimento = $2, data_confirmacao = NOW() WHERE processamento_id = $3`,
      [Boolean(payload.equipamentoTestado), payload.assinaturaRecebimento || null, proc.processamentoID]
    );
    await client.query(`UPDATE solicitacoes SET status = 'concluido', data_conclusao = NOW(), atualizado_em = NOW() WHERE solicitacao_id = $1`, [solicitacaoID]);

    if (proc.equipamentoID && (tipoAcaoNorm === 'alocacao' || tipoAcaoNorm === 'substituicao')) {
      if (!destinatarioID) throw Object.assign(new Error('Colaborador destinatário obrigatório para concluir alocação'), { status: 400 });
      await _concluirAlocacao(client, { sol, proc, destinatarioID, destinatarioNome, destinatarioDepartamento, tipoAcaoNorm, payload, user });
    }

    await registrarAuditoria(client, 'solicitacao', solicitacaoID, 'concluida', payload, user?.userId);
    await _syncConclusao(client, { sol, proc, destinatarioID, user });

    await client.query('COMMIT');
    socketLib.emit('solicitacao_update', { action: 'confirm', id: solicitacaoID, status: 'concluido' });
    return { status: 'concluido', confirmado: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function _concluirAlocacao(client, { sol, proc, destinatarioID, destinatarioNome, destinatarioDepartamento, tipoAcaoNorm, payload, user }) {
  const eqResult = await client.query(
    `SELECT etiqueta_id AS "etiquetaID", tipo_equipamento AS "tipoEquipamento", marca, modelo,
            status, localizacao, colaborador_atual_id AS "colaboradorAtualID"
       FROM equipamentos WHERE etiqueta_id = $1 FOR UPDATE`,
    [proc.equipamentoID]
  );
  const eq = eqResult.rowCount ? eqResult.rows[0] : null;
  const donoAnteriorID = eq?.colaboradorAtualID || null;
  let donoAnterior = null;
  if (donoAnteriorID) {
    const r = await client.query(`SELECT colaborador_id AS "colaboradorID", nome, departamento FROM colaboradores WHERE colaborador_id = $1`, [donoAnteriorID]);
    donoAnterior = r.rowCount ? r.rows[0] : null;
  }

  await client.query(`UPDATE equipamentos SET status = 'Em Uso', colaborador_atual_id = COALESCE($1, colaborador_atual_id), updated_at = NOW() WHERE etiqueta_id = $2`, [destinatarioID, proc.equipamentoID]);

  const movExiste = await client.query(
    `SELECT 1 FROM movimentacoes WHERE protocolo_solicitacao = $1 AND equipamento_id = $2 AND status_novo = 'Em Uso' LIMIT 1`,
    [sol.protocolo, proc.equipamentoID]
  );
  if (!movExiste.rowCount) {
    const tipoMovFinal = tipoAcaoNorm === 'substituicao' ? 'substituicao' : 'alocacao';
    const tecnicoNomeFinal = user?.nome || user?.email || 'TI';
    const destinoFinal = sol.departamento || eq?.localizacao || null;
    await client.query(
      `INSERT INTO movimentacoes (
          movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao,
          setor_origem, setor_destino, data_inicio, data_hora, responsavel, observacao,
          dono_anterior_id, dono_anterior_nome, dono_anterior_matricula, dono_anterior_setor,
          novo_dono_id, novo_dono_nome, novo_dono_matricula, novo_dono_setor,
          tecnico_responsavel_nome, motivo, protocolo_solicitacao,
          status_anterior, status_novo, localizacao_anterior, localizacao_nova,
          confirmado_usuario, assinatura_digital, equipamento_substituto_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)`,
      [
        `MOV-SOL-CONF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        proc.equipamentoID, destinatarioID, tipoMovFinal,
        eq?.localizacao || null, destinatarioDepartamento || destinoFinal,
        new Date().toISOString(), new Date().toISOString(), user?.nome || user?.email || null,
        `Entrega confirmada para solicitação ${sol.protocolo}`,
        donoAnteriorID, donoAnterior?.nome || null, donoAnterior?.colaboradorID || null, donoAnterior?.departamento || null,
        destinatarioID, destinatarioNome, destinatarioID, destinatarioDepartamento,
        tecnicoNomeFinal, `Alocação concluída e confirmada para solicitação ${sol.protocolo}`,
        sol.protocolo, eq?.status || null, 'Em Uso',
        eq?.localizacao || null, destinatarioDepartamento || destinoFinal,
        true, payload.assinaturaRecebimento || null,
        tipoAcaoNorm === 'substituicao' ? sol.equipamentoAtualID || null : null,
      ]
    );
  }

  if (tipoAcaoNorm === 'substituicao' && proc.equipamentoAnteriorID) {
    const reparado = payload.reparado !== false;
    const destinoAposManutencao = payload.destinoAposManutencao || 'estoque';

    let statusNovoFinal = payload.statusEquipamentoAnterior || 'Disponível';
    if (!reparado) statusNovoFinal = 'Aguardando Reparo Externo';

    // 1. O item temporário volta para o estoque
    await client.query(
      `UPDATE equipamentos SET status = 'Disponível', colaborador_atual_id = NULL, updated_at = NOW() WHERE etiqueta_id = $1`,
      [proc.equipamentoID]
    );

    await client.query(
      `INSERT INTO movimentacoes (
          movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao,
          setor_origem, setor_destino, data_hora, responsavel, observacao,
          status_anterior, status_novo, confirmado_usuario, motivo
       ) VALUES ($1,$2,NULL,'Devolução',$3,'Estoque',NOW(),$4,$5,'Em Uso','Disponível',TRUE,$6)`,
      [`MOV-RET-TEMP-${Date.now()}`, proc.equipamentoID, sol.departamento, tecnicoNomeFinal, 'Retorno de dispositivo temporario apos reparo do original', `Finalização da solicitação ${sol.protocolo}`]
    );

    // 2. O item original (reparado ou não) segue seu destino
    const novoColaboradorID = (destinoAposManutencao === 'estoque') ? null : sol.solicitanteID;
    const destinoSetor = (destinoAposManutencao === 'estoque') ? 'Estoque' : sol.departamento;

    await client.query(
      `UPDATE equipamentos SET status = $1, colaborador_atual_id = $2, updated_at = NOW() WHERE etiqueta_id = $3`,
      [statusNovoFinal, novoColaboradorID, proc.equipamentoAnteriorID]
    );

    await client.query(
      `INSERT INTO movimentacoes (
          movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao,
          setor_origem, setor_destino, data_hora, responsavel, observacao,
          status_anterior, status_novo, confirmado_usuario, motivo
       ) VALUES ($1,$2,$3,$4,'Estoque',$5,NOW(),$6,$7,'Aguardando Reparo',$8,TRUE,$9)`,
      [`MOV-RET-ORIG-${Date.now()}`, proc.equipamentoAnteriorID, novoColaboradorID, (destinoAposManutencao === 'estoque' ? 'Devolução' : 'Alocação'), destinoSetor, tecnicoNomeFinal, `Retorno do item original (${reparado ? 'reparado' : 'sem reparo'}).`, statusNovoFinal, `Finalização da solicitação ${sol.protocolo}`]
    );
  }

  if (tipoAcaoNorm === 'manutencao') {
    const reparado = payload.reparado !== false;
    const destinoAposManutencao = payload.destinoAposManutencao || 'usuario';

    let statusNovo = reparado ? 'Em Uso' : 'Aguardando Reparo';
    let colaboradorID = (destinoAposManutencao === 'estoque') ? null : sol.solicitanteID;
    let destinoSetor = (destinoAposManutencao === 'estoque') ? 'Estoque' : sol.departamento;

    if (destinoAposManutencao === 'estoque' && reparado) statusNovo = 'Disponível';

    await client.query(
      `UPDATE equipamentos SET status = $1, colaborador_atual_id = $2, updated_at = NOW() WHERE etiqueta_id = $3`,
      [statusNovo, colaboradorID, sol.equipamentoAtualID]
    );

    // Registrar movimentação de retorno ao estoque se for o caso
    if (destinoAposManutencao === 'estoque') {
       await client.query(
         `INSERT INTO movimentacoes (
             movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao,
             setor_origem, setor_destino, data_hora, responsavel, observacao,
             status_anterior, status_novo, confirmado_usuario, motivo
          ) VALUES ($1,$2,NULL,'Devolução',$3,'Estoque',NOW(),$4,$5,'Em Uso',$6,TRUE,$7)`,
         [`MOV-RET-MAN-${Date.now()}`, sol.equipamentoAtualID, sol.departamento, tecnicoNomeFinal, `Retorno ao estoque apos manutencao. Reparado: ${reparado ? 'Sim' : 'Não'}`, statusNovo, `Finalização da solicitação ${sol.protocolo}`]
       );
    }
  }
}

async function _syncConclusao(client, { sol, proc, destinatarioID, user }) {
  await syncWithLegacy(client, {
    endpoint: `/api/sync/solicitacao/${sol.protocolo}`, method: 'PUT',
    payload: { protocolo: sol.protocolo, status: 'concluido', dataConclusao: new Date().toISOString(), tecnico: user?.nome || user?.email || null },
    protocolo: sol.protocolo, tipoOperacao: 'conclusao_solicitacao',
  });
  if (proc.equipamentoID) {
    await syncWithLegacy(client, {
      endpoint: '/api/sync/alocacao', method: 'POST',
      payload: { protocolo: sol.protocolo, equipamentoID: proc.equipamentoID, solicitanteID: destinatarioID, tipoAcao: proc.tipoAcao },
      protocolo: sol.protocolo, tipoOperacao: 'alocacao_dispositivo',
    });
  }
}

// ─── Checklist CRUD ───────────────────────────────────────────────────────────

async function atualizarChecklist(solicitacaoID, itensPayload) {
  await ensureSolicitacoesChecklistSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ckResult = await client.query(
      `SELECT c.checklist_id AS "checklistID"
         FROM solicitacoes s
         JOIN solicitacao_checklists c ON c.solicitacao_id = s.solicitacao_id
        WHERE s.solicitacao_id = $1 AND s.tipo_solicitacao = 'demanda_manual' FOR UPDATE`,
      [solicitacaoID]
    );
    if (!ckResult.rowCount) throw Object.assign(new Error('Checklist não encontrado para a solicitação'), { status: 404 });

    const checklistID = ckResult.rows[0].checklistID;

    for (const item of itensPayload) {
      const itemID = String(item?.itemID || '').trim();
      if (!itemID) continue;

      const status = mapChecklistItemStatus(item.status);
      const observacao = String(item?.observacao || '').trim() || null;
      const equipamentoID = String(item?.equipamentoID || '').trim() || null;
      const anexos = parseJsonArray(item?.anexos);
      const concluidoEm = status === 'concluido' ? new Date().toISOString() : null;

      if (equipamentoID) {
        const eq = await client.query(`SELECT 1 FROM equipamentos WHERE etiqueta_id = $1 LIMIT 1`, [equipamentoID]);
        if (!eq.rowCount) throw Object.assign(new Error(`Equipamento ${equipamentoID} não encontrado`), { status: 400 });
      }

      await client.query(
        `UPDATE solicitacao_checklist_itens
            SET status = $1, observacao = $2, equipamento_id = $3, anexos = $4::jsonb,
                concluido_em = CASE WHEN $5::timestamptz IS NULL THEN NULL ELSE $5::timestamptz END,
                atualizado_em = NOW()
          WHERE item_id = $6 AND checklist_id = $7`,
        [status, observacao, equipamentoID, JSON.stringify(anexos), concluidoEm, itemID, checklistID]
      );
    }

    await client.query(
      `UPDATE solicitacao_checklists
          SET status = CASE
              WHEN EXISTS (SELECT 1 FROM solicitacao_checklist_itens WHERE checklist_id = $1 AND status IN ('concluido','nao_efetuada','atencao'))
              THEN 'em_atendimento' ELSE 'pendente'
            END,
            atualizado_em = NOW()
        WHERE checklist_id = $1`,
      [checklistID]
    );
    await client.query(
      `UPDATE solicitacoes SET status = 'em_atendimento', atualizado_em = NOW() WHERE solicitacao_id = $1 AND status = 'pendente'`,
      [solicitacaoID]
    );

    await client.query('COMMIT');
    return { ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function concluirChecklist(solicitacaoID, body, user) {
  await ensureSolicitacoesChecklistSchema();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const headerResult = await client.query(
      `SELECT s.solicitacao_id AS "solicitacaoID", s.protocolo, s.status AS "statusSolicitacao",
              c.checklist_id AS "checklistID", c.responsavel_colaborador_id AS "responsavelID",
              c.responsavel_colaborador_nome AS "responsavelNome"
         FROM solicitacoes s
         JOIN solicitacao_checklists c ON c.solicitacao_id = s.solicitacao_id
        WHERE s.solicitacao_id = $1 AND s.tipo_solicitacao = 'demanda_manual' FOR UPDATE`,
      [solicitacaoID]
    );
    if (!headerResult.rowCount) throw Object.assign(new Error('Checklist não encontrado para a solicitação'), { status: 404 });

    const header = headerResult.rows[0];
    const pendencias = await client.query(
      `SELECT COUNT(*)::int AS total FROM solicitacao_checklist_itens WHERE checklist_id = $1 AND status = 'pendente'`,
      [header.checklistID]
    );
    if (Number(pendencias.rows[0]?.total) > 0) {
      throw Object.assign(new Error('Ainda existem itens pendentes no checklist'), { status: 400 });
    }

    const itensAloc = await client.query(
      `SELECT item_id AS "itemID", descricao, equipamento_id AS "equipamentoID"
         FROM solicitacao_checklist_itens WHERE checklist_id = $1 AND status = 'concluido' AND equipamento_id IS NOT NULL`,
      [header.checklistID]
    );

    for (const item of itensAloc.rows) {
      const eqResult = await client.query(`SELECT etiqueta_id AS "etiquetaID", status, localizacao FROM equipamentos WHERE etiqueta_id = $1 FOR UPDATE`, [item.equipamentoID]);
      if (!eqResult.rowCount) continue;
      const eq = eqResult.rows[0];

      await client.query(`UPDATE equipamentos SET status = 'Em Uso', colaborador_atual_id = COALESCE($1, colaborador_atual_id), updated_at = NOW() WHERE etiqueta_id = $2`, [header.responsavelID || null, item.equipamentoID]);

      const movExiste = await client.query(`SELECT 1 FROM movimentacoes WHERE protocolo_solicitacao = $1 AND equipamento_id = $2 AND status_novo = 'Em Uso' LIMIT 1`, [header.protocolo, item.equipamentoID]);
      if (!movExiste.rowCount) {
        await client.query(
          `INSERT INTO movimentacoes (movimentacao_id, equipamento_id, colaborador_id, tipo_movimentacao, setor_origem, setor_destino, data_inicio, data_hora, responsavel, observacao, novo_dono_id, novo_dono_nome, tecnico_responsavel_nome, motivo, protocolo_solicitacao, status_anterior, status_novo, localizacao_anterior, localizacao_nova, confirmado_usuario)
           VALUES ($1,$2,$3,'Alocação',$4,$5,NOW(),NOW(),$6,$7,$8,$9,$10,$11,$12,$13,'Em Uso',$14,$15,TRUE)`,
          [`MOV-CHK-${Date.now()}-${Math.floor(Math.random() * 1000)}`, item.equipamentoID, header.responsavelID || null, eq.localizacao || null, null, user?.email || 'TI', `Checklist ${header.protocolo}: ${item.descricao}`, header.responsavelID || null, header.responsavelNome || null, user?.email || 'TI', `Demanda manual concluída (${header.protocolo})`, header.protocolo, eq.status || null, eq.localizacao || null, null]
        );
      }
    }

    await client.query(`UPDATE solicitacao_checklists SET status = 'concluido', atualizado_em = NOW() WHERE checklist_id = $1`, [header.checklistID]);
    await client.query(`UPDATE solicitacoes SET status = 'concluido', data_conclusao = NOW(), atualizado_em = NOW() WHERE solicitacao_id = $1`, [solicitacaoID]);
    await registrarAuditoria(client, 'solicitacao', solicitacaoID, 'checklist_concluido', body || {}, user?.userId);
    await client.query('COMMIT');
    return { status: 'concluido', pendencias: 0 };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Atualizar solicitação (Geral/Kanban) ───────────────────────────────────
/**
 * Permite atualizar campos da solicitação (principalmente status para o Kanban)
 */
async function atualizarSolicitacao(solicitacaoID, payload, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar se existe
    const res = await client.query(
      `SELECT solicitacao_id, protocolo, status FROM solicitacoes WHERE solicitacao_id = $1 FOR UPDATE`,
      [solicitacaoID]
    );
    if (!res.rowCount) throw Object.assign(new Error('Solicitação não encontrada'), { status: 404 });
    const sol = res.rows[0];

    // 2. Montar campos para atualizar
    const updates = [];
    const values = [];
    let idx = 1;

    // Mapeamento de campos permitidos
    const camposPermitidos = ['status', 'urgencia', 'descricao_problema', 'justificativa', 'departamento'];
    for (const campo of camposPermitidos) {
      if (payload[campo] !== undefined) {
        let val = payload[campo];
        if (campo === 'status') val = normalizeText(val);
        if (campo === 'urgencia') val = normalizeText(val);
        
        updates.push(`${campo} = $${idx}`);
        values.push(val);
        idx++;
      }
    }

    if (updates.length > 0) {
      values.push(solicitacaoID);
      await client.query(
        `UPDATE solicitacoes SET ${updates.join(', ')}, atualizado_em = NOW() WHERE solicitacao_id = $${idx}`,
        values
      );

      // 3. Auditoria
      await registrarAuditoria(client, 'solicitacao', solicitacaoID, 'atualizada', payload, userId);

      // 4. Sincronização Legada (especialmente se mudar status)
      if (payload.status) {
        await syncWithLegacy(client, {
          endpoint: `/api/sync/solicitacao/${sol.protocolo}`,
          method: 'PUT',
          payload: { protocolo: sol.protocolo, status: payload.status },
          protocolo: sol.protocolo,
          tipoOperacao: 'atualizacao_status',
        });
      }
    }

    await client.query('COMMIT');

    socketLib.emit('solicitacao_update', { action: 'update', id: solicitacaoID, patch: payload });

    return { solicitacaoID, ok: true };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ─── Sync retry ───────────────────────────────────────────────────────────────

async function retrySyncPendentes() {
  // logs_sincronizacao table removed — no-op
  return { reprocessados: 0 };
}

module.exports = {
  criarTemplate,
  criarSolicitacao,
  atualizarSolicitacao,
  processarSolicitacao,
  confirmarEntrega,
  atualizarChecklist,
  concluirChecklist,
  retrySyncPendentes,
};
