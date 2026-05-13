'use strict';

/**
 * solicitacoes.queries.js
 * SQL puro — leitura e escrita simples sem lógica de negócio.
 * Cada função recebe os parâmetros já validados e retorna rows.
 */

const { query } = require('../db');

// ─── Solicitações ─────────────────────────────────────────────────────────────

async function findSolicitacoes({ status, tipo, departamento, solicitante, dataInicio, dataFim } = {}) {
  const params = [];
  const where = [];

  if (status) { params.push(status); where.push(`lower(s.status) = $${params.length}`); }
  if (tipo)   { params.push(tipo);   where.push(`s.tipo_solicitacao = $${params.length}`); }
  if (departamento) { params.push(`%${departamento}%`); where.push(`s.departamento ILIKE $${params.length}`); }
  if (solicitante)  { params.push(`%${solicitante}%`);  where.push(`s.solicitante_nome ILIKE $${params.length}`); }
  if (dataInicio)   { params.push(dataInicio); where.push(`s.data_criacao >= $${params.length}::date`); }
  if (dataFim)      { params.push(dataFim);   where.push(`s.data_criacao <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.solicitacao_id AS "solicitacaoID",
            s.protocolo,
            s.tipo_solicitacao AS "tipoSolicitacao",
            s.solicitante_id AS "solicitanteID",
            s.solicitante_nome AS "solicitanteNome",
            s.departamento,
            s.centro_custo AS "centroCusto",
            s.equipamento_atual_id AS "equipamentoAtualID",
            s.tipo_equipamento_solicitado AS "tipoEquipamentoSolicitado",
            s.descricao_problema AS "descricaoProblema",
            s.justificativa,
            s.urgencia,
            s.status,
            s.data_necessidade AS "dataNecessidade",
            s.data_criacao AS "dataCriacao",
            s.data_conclusao AS "dataConclusao",
            s.anexos,
            col.foto_colaborador AS "solicitanteFoto",
            p.tecnico_ti_foto AS "tecnicoTIFoto",
            p.colaborador_destino_foto AS "colaboradorDestinoFoto",
            p.processamento_id AS "processamentoID",
            p.equipamento_id AS "equipamentoAlocadoID",
            p.tecnico_ti_nome AS "tecnicoTINome",
            p.tipo_acao AS "tipoAcao",
            p.observacoes AS "observacoesTI",
            p.colaborador_destino_id AS "colaboradorDestinoID",
            p.colaborador_destino_nome AS "colaboradorDestinoNome",
            p.colaborador_destino_departamento AS "colaboradorDestinoDepartamento",
            p.confirmacao_entrega AS "confirmacaoEntrega",
            p.data_processamento AS "dataProcessamento",
            p.data_confirmacao AS "dataConfirmacao",
            ck.checklist_id AS "checklistID",
            ck.responsavel_colaborador_id AS "checklistResponsavelID",
            ck.responsavel_colaborador_nome AS "checklistResponsavelNome",
            ck.responsavel_colaborador_foto AS "checklistResponsavelFoto",
            ck.status AS "checklistStatus",
            ck.total_itens AS "checklistTotalItens",
            ck.itens_pendentes AS "checklistItensPendentes",
            ck.itens_concluidos AS "checklistItensConcluidos"
       FROM solicitacoes s
       LEFT JOIN colaboradores col ON col.colaborador_id = s.solicitante_id
       LEFT JOIN LATERAL (
          SELECT p2.*, 
                 tcol.foto_colaborador AS tecnico_ti_foto,
                 dcol.foto_colaborador AS colaborador_destino_foto
            FROM processamentos p2
            LEFT JOIN colaboradores tcol ON tcol.nome = p2.tecnico_ti_nome
            LEFT JOIN colaboradores dcol ON dcol.colaborador_id = p2.colaborador_destino_id
            WHERE p2.solicitacao_id = s.solicitacao_id
            ORDER BY p2.data_processamento DESC LIMIT 1
       ) p ON TRUE
       LEFT JOIN LATERAL (
          SELECT c.checklist_id, c.responsavel_colaborador_id, c.responsavel_colaborador_nome, c.status,
                 ccol.foto_colaborador AS responsavel_colaborador_foto,
                 COUNT(i.item_id)::int AS total_itens,
                 COUNT(i.item_id) FILTER (WHERE i.status = 'pendente')::int AS itens_pendentes,
                 COUNT(i.item_id) FILTER (WHERE i.status = 'concluido')::int AS itens_concluidos
            FROM solicitacao_checklists c
            LEFT JOIN solicitacao_checklist_itens i ON i.checklist_id = c.checklist_id
            LEFT JOIN colaboradores ccol ON ccol.colaborador_id = c.responsavel_colaborador_id
            WHERE c.solicitacao_id = s.solicitacao_id
            GROUP BY c.checklist_id, c.responsavel_colaborador_id, c.responsavel_colaborador_nome, c.status, ccol.foto_colaborador
            LIMIT 1
       ) ck ON TRUE
       ${whereClause}
       ORDER BY s.data_criacao DESC`,
    params
  );

  return result.rows;
}

async function findPendentes() {
  const result = await query(
    `SELECT solicitacao_id AS "solicitacaoID",
            protocolo,
            tipo_solicitacao AS "tipoSolicitacao",
            solicitante_nome AS "solicitanteNome",
            departamento,
            tipo_equipamento_solicitado AS "tipoEquipamentoSolicitado",
            descricao_problema AS "descricaoProblema",
            justificativa,
            urgencia,
            status,
            data_necessidade AS "dataNecessidade",
            data_criacao AS "dataCriacao",
            c.foto_colaborador AS "solicitanteFoto"
       FROM solicitacoes s
       LEFT JOIN colaboradores c ON c.colaborador_id = s.solicitante_id
      WHERE status = 'pendente'
      ORDER BY data_criacao ASC`
  );
  return result.rows;
}

async function findInventarioDisponivel(tipoEquipamento) {
  const params = [];
  let where = `WHERE lower(e.status) IN ('disponível', 'disponivel', 'em estoque')`;
  if (tipoEquipamento) {
    params.push(tipoEquipamento);
    where += ` AND e.tipo_equipamento ILIKE $${params.length}`;
  }
  const result = await query(
    `SELECT e.etiqueta_id AS "etiquetaID",
            e.tipo_equipamento AS "tipoEquipamento",
            e.marca,
            e.modelo,
            e.numero_serie AS "numeroSerie",
            e.codigo_barras AS "patrimonio",
            e.status,
            e.localizacao,
            e.especificacoes
       FROM equipamentos e
       ${where}
       ORDER BY e.tipo_equipamento, e.marca, e.modelo`,
    params
  );
  return result.rows;
}

// logs_sincronizacao removida — findSyncLogs retorna array vazio
async function findSyncLogs() {
  return [];
}

// ─── Templates ────────────────────────────────────────────────────────────────

async function findChecklistTemplates() {
  const result = await query(
    `SELECT t.template_id AS "templateID", t.nome, t.descricao,
            t.responsavel_colaborador_id AS "responsavelID",
            t.responsavel_colaborador_nome AS "responsavelNome",
            t.ativo, t.criado_em AS "criadoEm", t.atualizado_em AS "atualizadoEm",
            COALESCE(
              (SELECT json_agg(json_build_object(
                  'templateItemID', i.template_item_id,
                  'ordem', i.ordem, 'descricao', i.descricao, 'tipoItem', i.tipo_item
               ) ORDER BY i.ordem, i.criado_em)
               FROM checklist_template_itens i WHERE i.template_id = t.template_id),
              '[]'::json
            ) AS itens
       FROM checklist_templates t
      WHERE t.ativo = TRUE
      ORDER BY t.nome ASC, t.criado_em DESC`
  );
  return result.rows;
}

// ─── Checklist de solicitação ─────────────────────────────────────────────────

async function findChecklistBySolicitacao(solicitacaoID) {
  const header = await query(
    `SELECT s.solicitacao_id AS "solicitacaoID", s.protocolo,
            s.tipo_solicitacao AS "tipoSolicitacao", s.status AS "statusSolicitacao",
            c.checklist_id AS "checklistID", c.titulo, c.status AS "statusChecklist",
            c.responsavel_colaborador_id AS "responsavelID",
            c.responsavel_colaborador_nome AS "responsavelNome"
       FROM solicitacoes s
       LEFT JOIN solicitacao_checklists c ON c.solicitacao_id = s.solicitacao_id
      WHERE s.solicitacao_id = $1 LIMIT 1`,
    [solicitacaoID]
  );
  if (!header.rowCount) return null;
  return header.rows[0];
}

async function findChecklistItens(checklistID) {
  const result = await query(
    `SELECT i.item_id AS "itemID", i.ordem, i.descricao, i.tipo_item AS "tipoItem",
            i.equipamento_id AS "equipamentoID", i.status, i.observacao, i.anexos,
            i.concluido_em AS "concluidoEm",
            e.tipo_equipamento AS "equipamentoTipo", e.marca AS "equipamentoMarca",
            e.modelo AS "equipamentoModelo"
       FROM solicitacao_checklist_itens i
       LEFT JOIN equipamentos e ON e.etiqueta_id = i.equipamento_id
      WHERE i.checklist_id = $1
      ORDER BY i.ordem, i.criado_em`,
    [checklistID]
  );
  return result.rows;
}

async function findInventarioParaChecklist() {
  const result = await query(
    `SELECT etiqueta_id AS "etiquetaID", tipo_equipamento AS "tipoEquipamento",
            marca, modelo, status
       FROM equipamentos
      WHERE lower(COALESCE(status, '')) IN ('disponível', 'disponivel', 'em estoque', 'reservado')
      ORDER BY tipo_equipamento, marca, modelo, etiqueta_id`
  );
  return result.rows;
}

module.exports = {
  findSolicitacoes,
  findPendentes,
  findInventarioDisponivel,
  findSyncLogs,
  findChecklistTemplates,
  findChecklistBySolicitacao,
  findChecklistItens,
  findInventarioParaChecklist,
};
