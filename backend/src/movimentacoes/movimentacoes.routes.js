'use strict';

const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const service = require('./movimentacoes.service');

const router = express.Router();

/**
 * movimentacoes.routes.js
 * Slim Router: Validação de entrada e encaminhamento para o Service.
 */

/**
 * @swagger
 * /api/movimentacoes:
 *   get:
 *     summary: Lista todas as movimentações com filtros
 *     tags: [Movimentações]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: equipamentoID
 *         schema:
 *           type: string
 *         description: Filtrar por etiqueta do equipamento
 *     responses:
 *       200:
 *         description: Lista de movimentações
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.listar(req.query);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/timeline', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.listar(req.query);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/relatorios/resumo', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.getResumo(req.query);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/relatorios/rastreabilidade/:equipamentoID', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.findByEquipamento(req.params.equipamentoID);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.findByID(req.params.id);
    if (!data) return res.status(404).json({ error: 'Movimentação não encontrada' });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    const data = await service.criarMovimentacao(req.body || {}, req.user);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    await service.deletar(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
