'use strict';

const { query } = require('../db');

/**
 * colaboradores.queries.js
 * SQL cru para o módulo de Colaboradores.
 */

const selectAllClause = `
  SELECT 
    colaborador_id AS "colaboradorID",
    nome,
    email,
    departamento,
    cargo,
    ativo,
    foto_colaborador AS "fotoColaborador",
    data_entrada AS "dataEntrada",
    data_saida AS "dataSaida"
  FROM colaboradores
`;

async function findColaboradores(where = '', params = []) {
  const sql = `${selectAllClause} ${where} ORDER BY colaborador_id`;
  return query(sql, params);
}

async function findByID(id) {
  const sql = `${selectAllClause} WHERE colaborador_id = $1`;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

async function insertColaborador(payload) {
  const sql = `
    INSERT INTO colaboradores (
      colaborador_id, nome, email, departamento, cargo, ativo,
      foto_colaborador, data_entrada, data_saida, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING colaborador_id AS "colaboradorID", nome, email, departamento, cargo, ativo,
              foto_colaborador AS "fotoColaborador", data_entrada AS "dataEntrada", data_saida AS "dataSaida"
  `;
  const res = await query(sql, [
    payload.colaboradorID, payload.nome, payload.email || null,
    payload.departamento || null, payload.cargo || null, payload.ativo !== false,
    payload.fotoColaborador || null, payload.dataEntrada || null, payload.dataSaida || null
  ]);
  return res.rows[0];
}

async function updateColaborador(id, payload) {
  const sql = `
    UPDATE colaboradores
    SET nome = $1, email = $2, departamento = $3, cargo = $4, ativo = $5,
        foto_colaborador = $6, data_entrada = $7, data_saida = $8, updated_at = NOW()
    WHERE colaborador_id = $9
    RETURNING colaborador_id AS "colaboradorID", nome, email, departamento, cargo, ativo,
              foto_colaborador AS "fotoColaborador", data_entrada AS "dataEntrada", data_saida AS "dataSaida"
  `;
  const res = await query(sql, [
    payload.nome || null, payload.email || null, payload.departamento || null,
    payload.cargo || null, payload.ativo !== false, payload.fotoColaborador || null,
    payload.dataEntrada || null, payload.dataSaida || null, id
  ]);
  return res.rows[0];
}

async function deleteColaborador(id) {
  return query('DELETE FROM colaboradores WHERE colaborador_id = $1', [id]);
}

async function releaseEquipamentos(colaboradorID) {
  // Desvincular equipamentos da empresa
  await query(
    `UPDATE equipamentos SET status = 'Disponível', colaborador_atual_id = NULL, updated_at = NOW()
     WHERE colaborador_atual_id = $1 AND propriedade = 'empresa'`,
    [colaboradorID]
  );
  // Marcar equipamentos pessoais como "Retirado"
  await query(
    `UPDATE equipamentos SET status = 'Retirado', colaborador_atual_id = proprietario_id, updated_at = NOW()
     WHERE proprietario_id = $1 AND propriedade = 'usuario'`,
    [colaboradorID]
  );
}

module.exports = {
  findColaboradores,
  findByID,
  insertColaborador,
  updateColaborador,
  deleteColaborador,
  releaseEquipamentos
};
