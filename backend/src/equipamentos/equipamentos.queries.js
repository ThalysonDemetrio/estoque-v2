'use strict';

const { query } = require('../db');

/**
 * equipamentos.queries.js
 * Centralização de SQL para Equipamentos e Famílias.
 */

const selectEquipamentoClause = `
  SELECT
    e.etiqueta_id AS "etiquetaID",
    e.tipo_equipamento AS "tipoEquipamento",
    e.marca,
    e.modelo,
    e.foto_equipamento AS "fotoEquipamento",
    e.status,
    e.localizacao,
    e.propriedade,
    e.familia_id AS "familiaID",
    e.colaborador_atual_id AS "colaboradorAtualID",
    c.nome AS "colaboradorAtualNome",
    e.data_compra AS "dataCompra",
    e.custo_aquisicao AS "custoAquisicao",
    e.nota_fiscal AS "notaFiscal",
    e.local_compra AS "localCompra",
    e.link_loja AS "linkLoja",
    e.lote_tag AS "loteTag",
    e.especificacoes,
    e.created_at AS "dataCadastro",
    en.ip_address,
    en.mac_address,
    en.subnet_mask,
    en.default_gateway,
    en.dns_primary,
    en.dns_secondary,
    en.vlan_id,
    en.switch_name,
    en.switch_port,
    en.total_ports,
    en.network_notes,
    (SELECT score_calculado FROM equipment_inspections WHERE equipment_id = e.etiqueta_id ORDER BY data_vistoria DESC LIMIT 1) AS saude,
    (SELECT data_vistoria FROM equipment_inspections WHERE equipment_id = e.etiqueta_id ORDER BY data_vistoria DESC LIMIT 1) AS "dataVistoria"
  FROM equipamentos e
  LEFT JOIN equipment_network en ON en.equipment_id = e.etiqueta_id
  LEFT JOIN colaboradores c ON c.colaborador_id = e.colaborador_atual_id
`;

async function findEquipamentos(where = '', params = []) {
  const sql = `${selectEquipamentoClause} ${where} ORDER BY e.created_at DESC`;
  return query(sql, params);
}

async function findByID(id) {
  const sql = `${selectEquipamentoClause} WHERE etiqueta_id = $1`;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function findFamilias(where = '', params = []) {
  const sql = `
    SELECT
      f.id,
      f.tipo,
      f.marca,
      f.modelo,
      f.especificacoes,
      f.quantidade_total AS "quantidadeTotal",
      f.descricao_completa AS "descricaoCompleta",
      COALESCE(SUM(e.custo_aquisicao), 0)::numeric(12,2) AS "valorInvestido"
    FROM familias_equipamentos f
    LEFT JOIN equipamentos e ON e.familia_id = f.id
    ${where}
    GROUP BY f.id
    ORDER BY f.quantidade_total DESC
  `;
  return query(sql, params);
}

async function findInPessoasProprietarias() {
  const sql = `
    SELECT
        c.colaborador_id AS "colaboradorID",
        c.nome,
        COUNT(*)::int AS itens,
        SUM(COALESCE(e.quantidade, 1))::int AS "quantidadeTotal"
      FROM equipamentos e
      JOIN colaboradores c ON c.colaborador_id = e.proprietario_id
     WHERE e.propriedade = 'usuario'
     GROUP BY c.colaborador_id, c.nome
     ORDER BY c.nome
  `;
  return query(sql);
}

async function updateFamiliaCount(familiaID) {
  if (!familiaID) return;
  await query(
    `UPDATE familias_equipamentos f
        SET quantidade_total = sub.total, atualizado_em = NOW()
       FROM (SELECT familia_id, COUNT(*)::int AS total FROM equipamentos WHERE familia_id = $1 GROUP BY familia_id) sub
      WHERE f.id = sub.familia_id`,
    [familiaID]
  );
}

async function getResumoGeral() {
  const sql = `
    SELECT
      COALESCE(f.id, 0) AS "familiaID",
      COALESCE(f.descricao_completa, trim(concat_ws(' ', e.tipo_equipamento, e.marca, e.modelo))) AS "familiaDescricao",
      e.tipo_equipamento AS "tipoEquipamento",
      e.modelo,
      e.marca,
      SUM(CASE WHEN e.propriedade = 'empresa' THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS total_empresa,
      SUM(CASE WHEN e.propriedade = 'usuario' THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS total_pessoal,
      SUM(COALESCE(e.quantidade, 1))::int AS total,
      SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('em uso', 'em_uso', 'emuso', 'em uso - pessoal', 'em uso - infraestrutura', 'em uso infraestrutura', 'em_uso_infraestrutura') THEN GREATEST(COALESCE(e.quantidade_em_uso, 0), 1) ELSE COALESCE(e.quantidade_em_uso, 0) END)::int AS em_uso,
      SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('manutencao', 'manutenção') THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS em_manutencao,
      SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('disponivel', 'disponível') THEN COALESCE(e.quantidade, 1)
               WHEN lower(COALESCE(e.status, '')) IN ('em uso', 'em_uso', 'emuso', 'em uso - pessoal', 'em uso - infraestrutura', 'em uso infraestrutura', 'em_uso_infraestrutura') THEN GREATEST(COALESCE(e.quantidade, 1) - GREATEST(COALESCE(e.quantidade_em_uso, 0), 1), 0)
               ELSE 0 END)::int AS disponivel
    FROM equipamentos e
    LEFT JOIN familias_equipamentos f ON f.id = e.familia_id
    GROUP BY COALESCE(f.id, 0), COALESCE(f.descricao_completa, trim(concat_ws(' ', e.tipo_equipamento, e.marca, e.modelo))), e.tipo_equipamento, e.modelo, e.marca
    ORDER BY e.tipo_equipamento, e.marca, e.modelo
  `;
  return query(sql);
}

async function getComparativoSetores() {
  const sql = `
    WITH colaboradores_setor AS (
      SELECT departamento AS setor, COUNT(*) FILTER (WHERE ativo = true)::int AS total_colaboradores
      FROM colaboradores WHERE departamento IS NOT NULL AND trim(departamento) <> ''
      GROUP BY departamento
    ),
    equipamentos_setor AS (
      SELECT
        COALESCE(NULLIF(c.departamento, ''), 'Não Alocado') AS setor,
        SUM(COALESCE(e.quantidade, 1))::int AS total_equipamentos,
        SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('em uso','em_uso','emuso','em uso - pessoal','em uso - infraestrutura','em uso infraestrutura','em_uso_infraestrutura') THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS em_uso,
        SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('disponivel', 'disponível') THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS disponivel,
        SUM(CASE WHEN lower(COALESCE(e.status, '')) IN ('manutencao','manutenção') THEN COALESCE(e.quantidade, 1) ELSE 0 END)::int AS em_manutencao
      FROM equipamentos e
      LEFT JOIN colaboradores c ON c.colaborador_id = e.colaborador_atual_id
      GROUP BY COALESCE(NULLIF(c.departamento, ''), 'Não Alocado')
    )
    SELECT
      COALESCE(cs.setor, es.setor) AS setor,
      COALESCE(cs.total_colaboradores, 0)::int AS total_colaboradores,
      COALESCE(es.total_equipamentos, 0)::int AS total_equipamentos,
      COALESCE(es.em_uso, 0)::int AS em_uso,
      COALESCE(es.disponivel, 0)::int AS disponivel,
      COALESCE(es.em_manutencao, 0)::int AS em_manutencao
    FROM colaboradores_setor cs
    FULL JOIN equipamentos_setor es ON es.setor = cs.setor
    ORDER BY 1
  `;
  return query(sql);
}

async function getRelatorioInvestimentos() {
  const sql = `
    WITH totais AS (
      SELECT 
        COUNT(*) as total_itens,
        COUNT(CASE WHEN custo_aquisicao > 0 THEN 1 END) as itens_com_custo,
        SUM(COALESCE(custo_aquisicao, 0)) as investimento_total,
        AVG(CASE WHEN custo_aquisicao > 0 THEN custo_aquisicao END) as ticket_medio
      FROM equipamentos
    ),
    por_setor AS (
      SELECT 
        COALESCE(NULLIF(c.departamento, ''), NULLIF(e.localizacao, ''), 'Estoque') as setor,
        COUNT(*) as total_itens,
        COUNT(CASE WHEN e.custo_aquisicao > 0 THEN 1 END) as itens_com_custo,
        SUM(COALESCE(e.custo_aquisicao, 0)) as investimento_total,
        AVG(CASE WHEN e.custo_aquisicao > 0 THEN e.custo_aquisicao END) as ticket_medio
      FROM equipamentos e
      LEFT JOIN colaboradores c ON e.colaborador_atual_id = c.colaborador_id
      GROUP BY COALESCE(NULLIF(c.departamento, ''), NULLIF(e.localizacao, ''), 'Estoque')
    ),
    crescimento AS (
      SELECT 
        TO_CHAR(data_compra, 'YYYY-MM') as mes,
        SUM(custo_aquisicao) as investimento_mes
      FROM equipamentos
      WHERE data_compra IS NOT NULL
      GROUP BY TO_CHAR(data_compra, 'YYYY-MM')
      ORDER BY mes
    ),
    equipamentos_detalhe AS (
      SELECT 
        e.etiqueta_id as "etiquetaID",
        e.tipo_equipamento as "tipoEquipamento",
        e.marca,
        e.modelo,
        e.status,
        COALESCE(e.colaborador_atual_id, e.proprietario_id) as "pessoaID",
        c.nome as "pessoaNome",
        COALESCE(NULLIF(c.departamento, ''), NULLIF(e.localizacao, ''), 'Estoque') as setor,
        e.data_compra as "dataCompra",
        e.nota_fiscal as "notaFiscal",
        e.local_compra as "localCompra",
        e.link_loja as "linkLoja",
        e.custo_aquisicao as "custoAquisicao"
      FROM equipamentos e
      LEFT JOIN colaboradores c ON e.colaborador_atual_id = c.colaborador_id
    )
    SELECT 
      (SELECT row_to_json(t.*) FROM totais t) as totais,
      (SELECT json_agg(s.*) FROM por_setor s) as "porSetor",
      (SELECT json_agg(cr.*) FROM crescimento cr) as crescimento,
      (SELECT json_agg(ed.*) FROM equipamentos_detalhe ed) as equipamentos
  `;
  return query(sql);
}

async function getTiposPorSetor() {
  const sql = `
    SELECT 
      COALESCE(NULLIF(c.departamento, ''), 'Não Alocado') AS setor,
      e.tipo_equipamento AS tipo,
      COUNT(*)::int AS quantidade
    FROM equipamentos e
    LEFT JOIN colaboradores c ON c.colaborador_id = e.colaborador_atual_id
    GROUP BY COALESCE(NULLIF(c.departamento, ''), 'Não Alocado'), e.tipo_equipamento
    ORDER BY setor, quantidade DESC
  `;
  return query(sql);
}

// --- Vistorias (Inspeções) ---

async function getVistorias(equipamentoID) {
  const sql = `
    SELECT 
      vi.id,
      vi.equipment_id AS "equipmentID",
      vi.inspector_id AS "inspectorID",
      u.nome AS "inspectorNome",
      vi.data_vistoria AS "dataVistoria",
      vi.score_calculado AS "scoreCalculado",
      vi.notas_gerais AS "notasGerais",
      (
        SELECT json_agg(items)
        FROM (
          SELECT item_nome AS nome, status, comentario
          FROM equipment_inspection_items
          WHERE inspection_id = vi.id
          ORDER BY item_nome
        ) items
      ) AS itens
    FROM equipment_inspections vi
    LEFT JOIN users u ON u.user_id = vi.inspector_id
    WHERE vi.equipment_id = $1
    ORDER BY vi.data_vistoria DESC
  `;
  return query(sql, [equipamentoID]);
}

async function salvarVistoria(client, { equipmentID, inspectorID, score, notas }) {
  const sql = `
    INSERT INTO equipment_inspections (equipment_id, inspector_id, score_calculado, notas_gerais)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  const res = await client.query(sql, [equipmentID, inspectorID, score, notas]);
  return res.rows[0].id;
}

async function salvarItemVistoria(client, { inspectionID, itemNome, status, comentario }) {
  const sql = `
    INSERT INTO equipment_inspection_items (inspection_id, item_nome, status, comentario)
    VALUES ($1, $2, $3, $4)
  `;
  await client.query(sql, [inspectionID, itemNome, status, comentario]);
}

module.exports = {
  findEquipamentos,
  findByID,
  findFamilias,
  findInPessoasProprietarias,
  updateFamiliaCount,
  getResumoGeral,
  getComparativoSetores,
  getTiposPorSetor,
  getRelatorioInvestimentos,
  // Vistorias
  getVistorias,
  salvarVistoria,
  salvarItemVistoria
};
