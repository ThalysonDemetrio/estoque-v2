'use strict';

/**
 * solicitacoes.routes.js
 * Router slim — só valida entrada, chama service/queries e responde JSON.
 * Toda lógica de negócio fica em solicitacoes.service.js
 */

const express = require('express');
const { authMiddleware, requireRole, requirePermission } = require('../middleware/auth');
const queries = require('./solicitacoes.queries');
const service = require('./solicitacoes.service');
const { ensureSolicitacoesChecklistSchema } = require('./solicitacoes.helpers');

const router = express.Router();

// Proteção global para abas de solicitações
router.use(authMiddleware, requirePermission('solicitacoes'));

// ─── Templates ────────────────────────────────────────────────────────────────

router.get('/checklist-templates', authMiddleware, async (req, res, next) => {
  try {
    const data = await queries.findChecklistTemplates();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.post('/checklist-templates', authMiddleware, requireRole('admin', 'gestor'), async (req, res, next) => {
  try {
    const payload = req.body || {};
    const result = await service.criarTemplate({
      nome: String(payload.nome || '').trim(),
      descricao: String(payload.descricao || '').trim() || null,
      responsavelID: String(payload.responsavelID || '').trim() || null,
      itens: Array.isArray(payload.itens)
        ? payload.itens.map((item, i) => ({
            ordem: Number(item?.ordem || i + 1),
            descricao: String(item?.descricao || '').trim(),
            tipoItem: String(item?.tipoItem || 'geral'),
          })).filter((item) => item.descricao)
        : [],
      userId: req.user?.userId || null,
    });
    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  }
});

// ─── Leituras (GET) ───────────────────────────────────────────────────────────

router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const data = await queries.findSolicitacoes({
      status: req.query.status || null,
      tipo: req.query.tipo || null,
      departamento: req.query.departamento || null,
      solicitante: req.query.solicitante || null,
      dataInicio: req.query.dataInicio || null,
      dataFim: req.query.dataFim || null,
    });
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/pendentes', authMiddleware, async (req, res, next) => {
  try {
    const data = await queries.findPendentes();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/inventario-disponivel', authMiddleware, async (req, res, next) => {
  try {
    const data = await queries.findInventarioDisponivel(req.query.tipo || null);
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

router.get('/sync/logs', authMiddleware, async (req, res, next) => {
  try {
    const data = await queries.findSyncLogs();
    return res.json({ data });
  } catch (err) {
    return next(err);
  }
});

// ─── Sync retry (antes dos :id para não colidir) ──────────────────────────────

router.post('/sync/retry-pendentes', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.retrySyncPendentes();
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

// ─── Criação ──────────────────────────────────────────────────────────────────

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.criarSolicitacao(req.body || {}, req.user?.userId || null);
    return res.status(201).json({ data: result });
  } catch (err) {
    return next(err);
  }
});

// ─── Checklist de solicitação específica ─────────────────────────────────────

router.get('/:id/checklist', authMiddleware, async (req, res, next) => {
  try {
    await ensureSolicitacoesChecklistSchema();
    const solicitacaoID = req.params.id;
    const checklist = await queries.findChecklistBySolicitacao(solicitacaoID);
    if (!checklist) return res.status(404).json({ error: 'Checklist não encontrado' });

    const itens = await queries.findChecklistItens(checklist.checklistID);
    const inventario = await queries.findInventarioParaChecklist();

    return res.json({ data: { ...checklist, itens, inventario } });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id/checklist', authMiddleware, async (req, res, next) => {
  try {
    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];
    await service.atualizarChecklist(req.params.id, itens);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/checklist/concluir', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.concluirChecklist(req.params.id, req.body || {}, req.user);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

// ─── Processamento e entrega ──────────────────────────────────────────────────

router.post('/:id/processar', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.processarSolicitacao(req.params.id, req.body || {}, req.user);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

router.post('/:id/confirmar-entrega', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.confirmarEntrega(req.params.id, req.body || {}, req.user);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await service.atualizarSolicitacao(req.params.id, req.body || {}, req.user?.userId);
    return res.json({ data: result });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
