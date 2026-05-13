'use strict';

const { query } = require('../db');

/**
 * movimentacoes.queries.js
 * Concentra todo o SQL cru do módulo de Movimentações.
 */

const selectClause = `
  SELECT
    m.movimentacao_id AS "movimentacaoID",
    m.equipamento_id AS "equipamentoID",
    m.colaborador_id AS "colaboradorID",
    e.propriedade,
    m.tipo_movimentacao AS "tipoMovimentacao",
    m.data_hora AS "dataHora",
    m.data_inicio AS "dataInicio",
    m.data_fim AS "dataFim",
    m.setor_origem AS "setorOrigem",
    m.setor_destino AS "setorDestino",
    m.responsavel,
    m.observacao,
    m.dono_anterior_id AS "donoAnteriorID",
    m.dono_anterior_nome AS "donoAnteriorNome",
    m.dono_anterior_matricula AS "donoAnteriorMatricula",
    m.dono_anterior_setor AS "donoAnteriorSetor",
    m.data_vinculo_anterior AS "dataVinculoAnterior",
    m.novo_dono_id AS "novoDonoID",
    m.novo_dono_nome AS "novoDonoNome",
    m.novo_dono_matricula AS "novoDonoMatricula",
    m.novo_dono_setor AS "novoDonoSetor",
    m.data_novo_vinculo AS "dataNovoVinculo",
    m.tecnico_responsavel_id AS "tecnicoResponsavelID",
    m.tecnico_responsavel_nome AS "tecnicoResponsavelNome",
    m.motivo,
    m.protocolo_solicitacao AS "protocoloSolicitacao",
    m.status_anterior AS "statusAnterior",
    m.status_novo AS "statusNovo",
    m.localizacao_anterior AS "localizacaoAnterior",
    m.localizacao_nova AS "localizacaoNova",
    m.descricao_detalhada AS "descricaoDetalhada",
    m.anexos,
    m.link_solicitacao AS "linkSolicitacao",
    m.assinatura_digital AS "assinaturaDigital",
    m.confirmado_usuario AS "confirmadoUsuario",
    m.equipamento_substituto_id AS "equipamentoSubstitutoID",
    e.tipo_equipamento AS "tipoEquipamento",
    e.marca,
    e.modelo,
    e.numero_serie AS "numeroSerie",
    e.codigo_barras AS "codigoBarras",
    e.foto_equipamento AS "fotoEquipamento",
    c1.foto_colaborador AS "donoAnteriorFoto",
    c2.foto_colaborador AS "novoDonoFoto",
    tec.foto_colaborador AS "tecnicoResponsavelFoto"
  FROM movimentacoes m
  JOIN equipamentos e ON e.etiqueta_id = m.equipamento_id
  LEFT JOIN colaboradores c1 ON c1.colaborador_id = m.dono_anterior_id
  LEFT JOIN colaboradores c2 ON c2.colaborador_id = m.novo_dono_id
  LEFT JOIN colaboradores tec ON tec.colaborador_id = m.tecnico_responsavel_id
`;

async function findMovimentacoes(where = '', params = []) {
  const sql = `${selectClause} ${where} ORDER BY m.data_hora DESC, m.movimentacao_id DESC`;
  return query(sql, params);
}

async function findByID(id) {
  const sql = `${selectClause} WHERE m.movimentacao_id = $1`;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function findByEquipamento(equipamentoID) {
  const sql = `${selectClause} WHERE m.equipamento_id = $1 ORDER BY m.data_hora ASC, m.movimentacao_id ASC`;
  return query(sql, [equipamentoID]);
}

async function countPorTipo(where = '', params = []) {
  const sql = `
    SELECT m.tipo_movimentacao AS "tipoMovimentacao", COUNT(*)::int AS total
    FROM movimentacoes m
    JOIN equipamentos e ON e.etiqueta_id = m.equipamento_id
    ${where}
    GROUP BY m.tipo_movimentacao
    ORDER BY total DESC
  `;
  return query(sql, params);
}

async function findTopEquipamentos(where = '', params = []) {
  const sql = `
    SELECT m.equipamento_id AS "equipamentoID",
           MAX(e.marca || ' ' || e.modelo) AS equipamento,
           COUNT(*)::int AS total
    FROM movimentacoes m
    JOIN equipamentos e ON e.etiqueta_id = m.equipamento_id
    ${where}
    GROUP BY m.equipamento_id
    ORDER BY total DESC
    LIMIT 10
  `;
  return query(sql, params);
}

async function findTempoMedio(where = '', params = []) {
  const sql = `
    SELECT m.equipamento_id AS "equipamentoID",
           ROUND(AVG(EXTRACT(EPOCH FROM (m.data_fim::timestamp - m.data_inicio::timestamp))/86400.0)::numeric, 2) AS "tempoMedioDias"
    FROM movimentacoes m
    JOIN equipamentos e ON e.etiqueta_id = m.equipamento_id
    ${where}${where ? ' AND' : ' WHERE'} m.data_fim IS NOT NULL AND m.data_inicio IS NOT NULL
    GROUP BY m.equipamento_id
    ORDER BY "tempoMedioDias" DESC
    LIMIT 10
  `;
  return query(sql, params);
}

module.exports = {
  findMovimentacoes,
  findByID,
  findByEquipamento,
  countPorTipo,
  findTopEquipamentos,
  findTempoMedio
};
