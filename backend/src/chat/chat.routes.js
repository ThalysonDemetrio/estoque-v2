'use strict';

const express = require('express');
const { query } = require('../db');
const { authMiddleware, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas de chat requerem a permissao 'chat'
const chatGuard = requirePermission('chat', 'view');

const VALID_TIPOS = new Set(['movimentacao', 'solicitacao']);

let schemaReady = null;

async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS chat_mensagens (
        mensagem_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        contexto_tipo TEXT NOT NULL CHECK (contexto_tipo IN ('movimentacao', 'solicitacao')),
        contexto_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        user_nome TEXT NOT NULL,
        texto TEXT,
        arquivo_nome TEXT,
        arquivo_tipo TEXT,
        arquivo_dados TEXT,
        fixada BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_mensagens_contexto ON chat_mensagens(contexto_tipo, contexto_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_mensagens_created ON chat_mensagens(created_at DESC)`);
    await query(`
      CREATE TABLE IF NOT EXISTS chat_leituras (
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        contexto_tipo TEXT NOT NULL,
        contexto_id TEXT NOT NULL,
        ultima_leitura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, contexto_tipo, contexto_id)
      )
    `);
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });

  return schemaReady;
}

function validateTipo(req, res, next) {
  if (!VALID_TIPOS.has(req.params.tipo)) {
    return res.status(400).json({ error: 'Tipo inválido. Use: movimentacao | solicitacao' });
  }
  return next();
}

// GET /api/chat/notificacoes — total de não lidos por contexto
router.get('/notificacoes', authMiddleware, chatGuard, async (req, res, next) => {
  try {
    await ensureSchema();

    const userId = req.user.userId;

    const result = await query(
      `SELECT m.contexto_tipo AS "contextoTipo",
              m.contexto_id   AS "contextoId",
              COUNT(*)        AS total
         FROM chat_mensagens m
         LEFT JOIN chat_leituras cl
           ON cl.user_id       = $1
          AND cl.contexto_tipo = m.contexto_tipo
          AND cl.contexto_id   = m.contexto_id
        WHERE m.user_id != $1
          AND (cl.ultima_leitura IS NULL OR m.created_at > cl.ultima_leitura)
        GROUP BY m.contexto_tipo, m.contexto_id`,
      [userId]
    );

    const total = result.rows.reduce((sum, row) => sum + Number(row.total), 0);

    return res.json({ data: { total, porContexto: result.rows } });
  } catch (error) {
    return next(error);
  }
});

// GET /api/chat/conversas — lista de conversas com última mensagem e não lidos
router.get('/conversas', authMiddleware, chatGuard, async (req, res, next) => {
  try {
    await ensureSchema();

    const userId = req.user.userId;

    const result = await query(
      `SELECT m.contexto_tipo AS "contextoTipo",
              m.contexto_id   AS "contextoId",
              COUNT(DISTINCT m.mensagem_id) AS "totalMensagens",
              MAX(m.created_at) AS "ultimaMensagemAt",
              (
                SELECT texto
                  FROM chat_mensagens
                 WHERE contexto_tipo = m.contexto_tipo
                   AND contexto_id   = m.contexto_id
                 ORDER BY created_at DESC LIMIT 1
              ) AS "ultimoTexto",
              (
                SELECT user_nome
                  FROM chat_mensagens
                 WHERE contexto_tipo = m.contexto_tipo
                   AND contexto_id   = m.contexto_id
                 ORDER BY created_at DESC LIMIT 1
              ) AS "ultimoRemetente",
              COUNT(DISTINCT CASE
                WHEN m.user_id != $1
                 AND (cl.ultima_leitura IS NULL OR m.created_at > cl.ultima_leitura)
                THEN m.mensagem_id
              END) AS "naoLidos"
         FROM chat_mensagens m
         LEFT JOIN chat_leituras cl
           ON cl.user_id       = $1
          AND cl.contexto_tipo = m.contexto_tipo
          AND cl.contexto_id   = m.contexto_id
        GROUP BY m.contexto_tipo, m.contexto_id
        ORDER BY MAX(m.created_at) DESC`,
      [userId]
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

// GET /api/chat/:tipo/:id — mensagens de um contexto específico
router.get('/:tipo/:id', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();

    const { tipo, id } = req.params;
    const userId = req.user.userId;

    const mensagens = await query(
      `SELECT mensagem_id  AS "mensagemId",
              contexto_tipo AS "contextoTipo",
              contexto_id   AS "contextoId",
              user_id       AS "userId",
              user_nome     AS "userNome",
              texto,
              arquivo_nome  AS "arquivoNome",
              arquivo_tipo  AS "arquivoTipo",
              arquivo_dados AS "arquivoDados",
              fixada,
              created_at    AS "createdAt"
         FROM chat_mensagens
        WHERE contexto_tipo = $1 AND contexto_id = $2
        ORDER BY fixada DESC, created_at ASC`,
      [tipo, id]
    );

    // So registra leitura quando o contexto ja tem mensagens.
    if (mensagens.rowCount > 0) {
      await query(
        `INSERT INTO chat_leituras (user_id, contexto_tipo, contexto_id, ultima_leitura)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, contexto_tipo, contexto_id) DO UPDATE SET ultima_leitura = NOW()`,
        [userId, tipo, id]
      );
    }

    return res.json({ data: mensagens.rows });
  } catch (error) {
    return next(error);
  }
});

// POST /api/chat/:tipo/:id — enviar mensagem
router.post('/:tipo/:id', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();

    const { tipo, id } = req.params;
    const userId = req.user.userId;
    const { texto, arquivoNome, arquivoTipo, arquivoDados } = req.body || {};

    if (!texto && !arquivoDados) {
      return res.status(400).json({ error: 'Mensagem ou arquivo obrigatório' });
    }

    // Limitar tamanho do arquivo (~4MB em base64)
    if (arquivoDados && arquivoDados.length > 5_600_000) {
      return res.status(413).json({ error: 'Arquivo muito grande. Limite: 4MB.' });
    }

    const userNome = req.user.nome || 'Usuário';

    const result = await query(
      `INSERT INTO chat_mensagens
         (contexto_tipo, contexto_id, user_id, user_nome, texto, arquivo_nome, arquivo_tipo, arquivo_dados)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         mensagem_id  AS "mensagemId",
         user_id      AS "userId",
         user_nome    AS "userNome",
         texto,
         arquivo_nome AS "arquivoNome",
         arquivo_tipo AS "arquivoTipo",
         arquivo_dados AS "arquivoDados",
         created_at   AS "createdAt"`,
      [tipo, id, userId, userNome, texto || null, arquivoNome || null, arquivoTipo || null, arquivoDados || null]
    );

    // Atualizar leitura do remetente
    await query(
      `INSERT INTO chat_leituras (user_id, contexto_tipo, contexto_id, ultima_leitura)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, contexto_tipo, contexto_id) DO UPDATE SET ultima_leitura = NOW()`,
      [userId, tipo, id]
    );

    // Envia Push Notification para os outros participantes da conversa
    try {
      const participantes = await query(`SELECT DISTINCT user_id FROM chat_mensagens WHERE contexto_tipo = $1 AND contexto_id = $2 AND user_id != $3`, [tipo, id, userId]);
      if (participantes.rowCount > 0 && process.env.VAPID_PUBLIC_KEY) {
        const { sendPushToUser } = require('../utils/push');
        const payload = {
          title: `Nova mensagem de ${userNome}`,
          body: texto ? (texto.length > 50 ? texto.substring(0, 50) + '...' : texto) : 'Enviou um arquivo.',
          url: `/${tipo === 'solicitacao' ? 'solicitacoes' : 'movimentacoes'}?open=${id}`,
          icon: '/favicon.ico'
        };
        for (const row of participantes.rows) {
          sendPushToUser(row.user_id, payload).catch(e => console.error('[Push Engine Erro]', e));
        }
      }
    } catch(errPush) {
      console.error('[WebPush Dispatch Error]', errPush);
    }

    return res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

// PUT /api/chat/:tipo/:id/lido — marcar contexto como lido
router.put('/:tipo/:id/lido', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();

    const { tipo, id } = req.params;
    const userId = req.user.userId;

    await query(
      `INSERT INTO chat_leituras (user_id, contexto_tipo, contexto_id, ultima_leitura)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, contexto_tipo, contexto_id) DO UPDATE SET ultima_leitura = NOW()`,
      [userId, tipo, id]
    );

    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// PATCH /api/chat/:tipo/:id/mensagem/:msgId/pin — fixar/desfixar mensagem
router.patch('/:tipo/:id/mensagem/:msgId/pin', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();
    const { msgId } = req.params;
    const result = await query(
      `UPDATE chat_mensagens SET fixada = NOT fixada
         WHERE mensagem_id = $1
       RETURNING mensagem_id AS "mensagemId", fixada`,
      [msgId]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Mensagem não encontrada' });
    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/chat/:tipo/:id/mensagem/:msgId — deletar mensagem (próprias ou admin)
router.delete('/:tipo/:id/mensagem/:msgId', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();
    const { msgId } = req.params;
    const userId = req.user.userId;
    const isAdmin = req.user.cargo === 'admin';

    const check = await query(
      'SELECT user_id AS "userId" FROM chat_mensagens WHERE mensagem_id = $1',
      [msgId]
    );
    if (!check.rowCount) return res.status(404).json({ error: 'Mensagem não encontrada' });

    if (!isAdmin && String(check.rows[0].userId) !== String(userId)) {
      return res.status(403).json({ error: 'Sem permissão para deletar esta mensagem' });
    }

    await query('DELETE FROM chat_mensagens WHERE mensagem_id = $1', [msgId]);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

// DELETE /api/chat/:tipo/:id — deletar toda a conversa (admin only)
router.delete('/:tipo/:id', authMiddleware, chatGuard, validateTipo, async (req, res, next) => {
  try {
    await ensureSchema();
    const { tipo, id } = req.params;
    if (req.user.cargo !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem excluir conversas' });
    }
    await query('DELETE FROM chat_mensagens WHERE contexto_tipo = $1 AND contexto_id = $2', [tipo, id]);
    await query('DELETE FROM chat_leituras WHERE contexto_tipo = $1 AND contexto_id = $2', [tipo, id]);
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
