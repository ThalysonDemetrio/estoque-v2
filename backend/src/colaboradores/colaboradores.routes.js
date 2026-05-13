'use strict';

const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const service = require('./colaboradores.service');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Colaboradores
 *   description: Gestão de colaboradores e vínculos
 */

/**
 * @swagger
 * /api/colaboradores:
 *   get:
 *     summary: Lista todos os colaboradores
 *     tags: [Colaboradores]
 *     parameters:
 *       - in: query
 *         name: ativo
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *     responses:
 *       200:
 *         description: Lista de colaboradores
 */
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.listar(req.query);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.buscarPorID(req.params.id);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    const data = await service.criar(req.body, req.user);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    const data = await service.atualizar(req.params.id, req.body, req.user);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res, next) => {
  try {
    await service.deletar(req.params.id, req.user);
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
