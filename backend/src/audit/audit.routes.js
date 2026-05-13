'use strict';

const express = require('express');
const router = express.Router();
const auditService = require('./audit.service');
const { audit } = require('../middleware/auth');

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: Lista logs de auditoria
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entidade
 *         schema:
 *           type: string
 *       - in: query
 *         name: acao
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de logs
 */
router.get('/', async (req, res, next) => {
  try {
    const filters = {
      entidade: req.query.entidade,
      acao: req.query.acao,
      entidade_id: req.query.entidade_id
    };
    const logs = await auditService.listar(filters);
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
