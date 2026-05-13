const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const auditService = require('../audit/audit.service');

const router = express.Router();

// Todos os endpoints admin exigem autenticação + cargo admin
router.use(authMiddleware, requireRole('admin'));

const CARGOS_VALIDOS = ['admin', 'gestor', 'usuario'];

// ===========================
// LISTAR USUÁRIOS
// ===========================
router.get('/users', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id, email, nome, cargo, ativo, permissoes, created_at, updated_at
         FROM users
        ORDER BY created_at ASC`
    );

    return res.json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

// ===========================
// OBTER USUÁRIO POR ID
// ===========================
router.get('/users/:id', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT user_id, email, nome, cargo, ativo, permissoes, created_at, updated_at
         FROM users
        WHERE user_id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

// ===========================
// CRIAR USUÁRIO
// ===========================
router.post('/users', async (req, res, next) => {
  try {
    const { email, password, nome, cargo, permissoes } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    if (cargo && !CARGOS_VALIDOS.includes(cargo)) {
      return res.status(400).json({ error: 'Cargo invalido. Valores aceitos: ' + CARGOS_VALIDOS.join(', ') });
    }

    const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email ja cadastrado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userCargo = cargo || 'usuario';
    const userPermissoes = permissoes || {};

    const result = await query(
      `INSERT INTO users (email, password_hash, nome, cargo, permissoes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, email, nome, cargo, ativo, permissoes, created_at`,
      [email, passwordHash, nome || null, userCargo, JSON.stringify(userPermissoes)]
    );

    const user = result.rows[0];

    await auditService.logAction({
      entidade: 'user',
      entidade_id: user.user_id,
      acao: 'create',
      payload: { email: user.email, nome: user.nome, cargo: user.cargo },
      userId: req.user.userId,
      userNome: req.user.nome
    });

    return res.status(201).json({ data: user });
  } catch (error) {
    return next(error);
  }
});

// ===========================
// ATUALIZAR USUÁRIO
// ===========================
router.put('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { nome, cargo, ativo, permissoes, password } = req.body || {};

    // Impedir que admin desative a si mesmo
    if (userId === req.user.userId && ativo === false) {
      return res.status(400).json({ error: 'Voce nao pode desativar sua propria conta' });
    }

    // Impedir que admin remova seu próprio cargo admin
    if (userId === req.user.userId && cargo && cargo !== 'admin') {
      return res.status(400).json({ error: 'Voce nao pode remover seu proprio cargo de admin' });
    }

    if (cargo && !CARGOS_VALIDOS.includes(cargo)) {
      return res.status(400).json({ error: 'Cargo invalido. Valores aceitos: ' + CARGOS_VALIDOS.join(', ') });
    }

    // Verificar se o usuário existe
    const existing = await query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    // Construir SET dinâmico
    const sets = [];
    const values = [];
    let paramIndex = 1;

    if (nome !== undefined) {
      sets.push(`nome = $${paramIndex++}`);
      values.push(nome);
    }

    if (cargo !== undefined) {
      sets.push(`cargo = $${paramIndex++}`);
      values.push(cargo);
    }

    if (ativo !== undefined) {
      sets.push(`ativo = $${paramIndex++}`);
      values.push(ativo);
    }

    if (permissoes !== undefined) {
      sets.push(`permissoes = $${paramIndex++}`);
      values.push(JSON.stringify(permissoes));
    }

    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      sets.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    sets.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await query(
      `UPDATE users
          SET ${sets.join(', ')}
        WHERE user_id = $${paramIndex}
      RETURNING user_id, email, nome, cargo, ativo, permissoes, created_at, updated_at`,
      values
    );

    const updatedUser = result.rows[0];

    await auditService.logAction({
      entidade: 'user',
      entidade_id: updatedUser.user_id,
      acao: 'update',
      payload: { nome: updatedUser.nome, cargo: updatedUser.cargo, ativo: updatedUser.ativo },
      userId: req.user.userId,
      userNome: req.user.nome
    });

    return res.json({ data: updatedUser });
  } catch (error) {
    return next(error);
  }
});

// ===========================
// DELETAR USUÁRIO
// ===========================
router.delete('/users/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;

    // Impedir que admin delete a si mesmo
    if (userId === req.user.userId) {
      return res.status(400).json({ error: 'Voce nao pode deletar sua propria conta' });
    }

    const result = await query('DELETE FROM users WHERE user_id = $1 RETURNING user_id', [userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }

    await auditService.logAction({
      entidade: 'user',
      entidade_id: userId,
      acao: 'delete',
      userId: req.user.userId,
      userNome: req.user.nome
    });

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
