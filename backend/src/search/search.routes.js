const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=termo
// Busca global por texto em equipamentos, colaboradores, movimentações e solicitações
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ data: [] });
    }

    const like = `%${q}%`;

    const [equips, colabs, movs, sols] = await Promise.allSettled([
      // Equipamentos
      query(
        `SELECT
            e.etiqueta_id AS "etiquetaID",
            e.tipo_equipamento AS "tipoEquipamento",
            e.marca,
            e.modelo,
            e.numero_serie AS "numeroSerie",
            e.status,
            e.localizacao
          FROM equipamentos e
          WHERE
            e.etiqueta_id ILIKE $1
            OR e.tipo_equipamento ILIKE $1
            OR e.marca ILIKE $1
            OR e.modelo ILIKE $1
            OR e.numero_serie ILIKE $1
            OR e.localizacao ILIKE $1
          ORDER BY e.etiqueta_id
          LIMIT 6`,
        [like]
      ),

      // Colaboradores
      query(
        `SELECT
            colaborador_id AS "colaboradorID",
            nome,
            email,
            cargo,
            departamento
          FROM colaboradores
          WHERE
            nome ILIKE $1
            OR email ILIKE $1
            OR cargo ILIKE $1
            OR departamento ILIKE $1
            OR colaborador_id ILIKE $1
          ORDER BY nome
          LIMIT 6`,
        [like]
      ),

      // Movimentações
      query(
        `SELECT
            m.movimentacao_id AS "movimentacaoID",
            m.equipamento_id AS "equipamentoID",
            m.tipo_movimentacao AS "tipoMovimentacao",
            m.descricao,
            m.created_at AS "dataHora",
            cn.nome AS "novoDonoNome",
            ca.nome AS "donoAnteriorNome"
          FROM movimentacoes m
          LEFT JOIN colaboradores cn ON cn.colaborador_id = m.novo_responsavel_id
          LEFT JOIN colaboradores ca ON ca.colaborador_id = m.colaborador_anterior_id
          WHERE
            m.equipamento_id ILIKE $1
            OR m.descricao ILIKE $1
            OR m.tipo_movimentacao ILIKE $1
            OR cn.nome ILIKE $1
            OR ca.nome ILIKE $1
          ORDER BY m.created_at DESC
          LIMIT 6`,
        [like]
      ),

      // Solicitações
      query(
        `SELECT
            s.solicitacao_id AS "solicitacaoID",
            s.protocolo,
            s.descricao,
            s.tipo,
            s.urgencia,
            s.status,
            c.nome AS solicitante,
            c.departamento
          FROM solicitacoes s
          LEFT JOIN colaboradores c ON c.colaborador_id = s.colaborador_id
          WHERE
            s.protocolo ILIKE $1
            OR s.descricao ILIKE $1
            OR s.tipo ILIKE $1
            OR c.nome ILIKE $1
            OR c.departamento ILIKE $1
          ORDER BY s.created_at DESC
          LIMIT 6`,
        [like]
      )
    ]);

    const results = [];

    if (equips.status === 'fulfilled') {
      equips.value.rows.forEach(e => results.push({
        id: e.etiquetaID,
        tipo: 'equipamento',
        titulo: `${e.etiquetaID} — ${e.marca || ''} ${e.modelo || ''}`.trim(),
        subtitulo: `${e.tipoEquipamento || ''}${e.status ? ' · ' + e.status : ''}`.trim(),
        rota: `/equipamentos?open=${e.etiquetaID}`,
        icone: 'fa-laptop'
      }));
    }

    if (colabs.status === 'fulfilled') {
      colabs.value.rows.forEach(c => results.push({
        id: c.colaboradorID,
        tipo: 'colaborador',
        titulo: c.nome,
        subtitulo: `${c.departamento || ''}${c.cargo ? ' · ' + c.cargo : ''}`.trim(),
        rota: `/colaboradores?open=${c.colaboradorID}`,
        icone: 'fa-user'
      }));
    }

    if (movs.status === 'fulfilled') {
      movs.value.rows.forEach(m => {
        const dt = m.dataHora ? new Date(m.dataHora).toLocaleDateString('pt-BR') : '';
        results.push({
          id: m.movimentacaoID,
          tipo: 'movimentacao',
          titulo: `${m.tipoMovimentacao ? m.tipoMovimentacao.charAt(0).toUpperCase() + m.tipoMovimentacao.slice(1) : ''} — ${m.equipamentoID || ''}`,
          subtitulo: `${m.descricao || ''}${dt ? ' · ' + dt : ''}`.trim(),
          rota: '/movimentacoes',
          icone: 'fa-arrows-rotate'
        });
      });
    }

    if (sols.status === 'fulfilled') {
      sols.value.rows.forEach(s => results.push({
        id: s.solicitacaoID,
        tipo: 'solicitacao',
        titulo: `${s.protocolo || s.solicitacaoID} — ${(s.descricao || '').slice(0, 50)}`,
        subtitulo: `${s.tipo || ''}${s.urgencia ? ' · ' + s.urgencia : ''}${s.status ? ' · ' + s.status : ''}`.trim(),
        rota: '/solicitacoes',
        icone: 'fa-clipboard-list'
      }));
    }

    return res.json({ data: results, total: results.length });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
