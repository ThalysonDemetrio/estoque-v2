'use strict';

const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const service = require('./equipamentos.service');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Equipamentos
 *   description: Inventário de hardware e gestão de ativos
 */

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.listar(req.query);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/resumo', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.getResumoGeral();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/relatorios/investimentos', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.getRelatorioInvestimentos();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/setores/comparativo', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.getComparativoSetores();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/stats/tipos-por-setor', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.getTiposPorSetor();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.findByID(req.params.id);
    if (!data) return res.status(404).json({ error: 'Equipamento não encontrado' });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post('/', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    req.body.userId = req.user.userId;
    req.body.userNome = req.user.nome;
    const data = await service.criar(req.body);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    req.body.userId = req.user.userId;
    req.body.userNome = req.user.nome;
    const data = await service.atualizar(req.params.id, req.body);
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

// --- Vistorias ---

router.get('/:id/vistorias', authMiddleware, async (req, res, next) => {
  try {
    const data = await service.listarVistorias(req.params.id);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/vistorias', authMiddleware, requireRole('admin', 'gestor', 'tecnico'), async (req, res, next) => {
  try {
    const payload = {
      ...req.body,
      userId: req.user.userId,
      userNome: req.user.nome
    };
    const data = await service.salvarVistoria(req.params.id, payload);
    return res.status(201).json({ data });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
