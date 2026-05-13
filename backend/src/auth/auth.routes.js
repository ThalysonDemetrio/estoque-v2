const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const authService = require('./auth.service');

const router = express.Router();

// Função auxiliar para garantir que a coluna avatar existe (Lazy Migration)
async function ensureAvatarColumn() {
  try {
    await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT");
  } catch (err) {
    console.error('Erro ao garantir coluna avatar:', err.message);
  }
}

// Executar migração ao carregar as rotas
ensureAvatarColumn();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const data = await authService.login(email, password);
    return res.json({ data });
  } catch (error) {
    if (error.message === 'Credenciais invalidas') {
      return res.status(401).json({ error: error.message });
    }
    if (error.message.includes('Conta desativada')) {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, nome } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const user = await authService.register(email, password, nome);
    return res.status(201).json({
      data: {
        userId: user.user_id,
        email: user.email,
        nome: user.nome,
        cargo: user.cargo,
        permissoes: user.permissoes || {}
      }
    });
  } catch (error) {
    if (error.message === 'Cadastro desabilitado') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Email ja cadastrado') {
      return res.status(409).json({ error: error.message });
    }
    return next(error);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await authService.getMe(req.user.userId);
    return res.json({ data: user });
  } catch (error) {
    if (error.message === 'Usuario nao encontrado') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message === 'Conta desativada') {
      return res.status(403).json({ error: error.message });
    }
    return next(error);
  }
});

router.post('/validate-invest-pin', authMiddleware, async (req, res, next) => {
  try {
    const pin = String(req.body?.pin || '').trim();
    
    // 1. Tentar buscar o PIN no banco de dados
    let expectedPin;
    try {
      const dbConfig = await query("SELECT valor FROM sistema_config WHERE chave = 'investimentos_pin_hash'");
      if (dbConfig.rows.length > 0) {
        expectedPin = dbConfig.rows[0].valor;
      }
    } catch (dbErr) {
      console.warn('Tabela sistema_config não encontrada ou erro no banco. Usando fallback do .env');
    }

    // 2. Fallback para o .env se não encontrar no banco
    if (!expectedPin) {
      expectedPin = String(process.env.INVESTIMENTOS_TAB_PIN || '1234').trim();
    }

    if (!/^\d{4,8}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN deve conter entre 4 e 8 digitos' });
    }

    // Se o PIN esperado for um hash bcrypt (começa com $2a$ ou $2b$), usa bcrypt.compare
    if (expectedPin.startsWith('$2a$') || expectedPin.startsWith('$2b$')) {
      const isMatch = await bcrypt.compare(pin, expectedPin);
      if (!isMatch) {
        return res.status(401).json({ error: 'PIN invalido' });
      }
    } else {
      // Caso contrário, faz uma comparação simples de texto (fallback amigável para .env)
      if (pin !== expectedPin) {
        return res.status(401).json({ error: 'PIN invalido' });
      }
    }

    return res.json({ data: { valid: true } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/profile', authMiddleware, async (req, res, next) => {
  try {
    const { nome, avatar } = req.body || {};
    const userId = req.user.userId;

    const sets = [];
    const values = [];
    let idx = 1;

    if (nome !== undefined) {
      sets.push(`nome = $${idx++}`);
      values.push(nome);
    }
    if (avatar !== undefined) {
      sets.push(`avatar = $${idx++}`);
      values.push(avatar);
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    values.push(userId);
    const result = await query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE user_id = $${idx} 
       RETURNING user_id, email, nome, cargo, avatar, permissoes`,
      values
    );

    return res.json({ data: result.rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email e obrigatorio' });
    }
    const result = await authService.forgotPassword(email);
    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha sao obrigatorios' });
    }
    const result = await authService.resetPassword(token, newPassword);
    return res.json({ data: result });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ error: error.message });
    }
    return next(error);
  }
});

module.exports = router;
