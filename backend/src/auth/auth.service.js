'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../errors');
const { query } = require('../db');
const crypto = require('crypto');
const { sendMail } = require('../utils/mailer');

async function login(email, password) {
  const result = await query(
    'SELECT user_id, email, nome, password_hash, cargo, avatar, ativo, permissoes FROM users WHERE email = $1',
    [email]
  );

  if (result.rowCount === 0) {
    throw new AppError('Credenciais invalidas', 401);
  }

  const user = result.rows[0];

  if (user.ativo === false) {
    throw new AppError('Conta desativada. Contate o administrador.', 403);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    throw new AppError('Credenciais invalidas', 401);
  }

  const token = jwt.sign(
    { 
      userId: user.user_id, 
      email: user.email, 
      nome: user.nome,
      cargo: user.cargo,
      permissoes: user.permissoes || {}
    },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );

  return {
    token,
    user: {
      userId: user.user_id,
      email: user.email,
      nome: user.nome,
      cargo: user.cargo,
      avatar: user.avatar || null,
      permissoes: user.permissoes || {}
    }
  };
}

async function register(email, password, nome) {
  if (process.env.ALLOW_REGISTRATION !== 'true') {
    throw new AppError('Cadastro desabilitado', 403);
  }

  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    throw new AppError('Email ja cadastrado', 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const insert = await query(
    'INSERT INTO users (email, password_hash, nome) VALUES ($1, $2, $3) RETURNING user_id, email, nome, cargo, permissoes',
    [email, passwordHash, nome || null]
  );

  return insert.rows[0];
}

async function getMe(userId) {
  const result = await query(
    'SELECT user_id, email, nome, cargo, avatar, ativo, permissoes FROM users WHERE user_id = $1',
    [userId]
  );

  if (result.rowCount === 0) {
    throw new AppError('Usuario nao encontrado', 404);
  }

  const user = result.rows[0];
  if (user.ativo === false) {
    throw new AppError('Conta desativada', 403);
  }

  return {
    userId: user.user_id,
    email: user.email,
    nome: user.nome,
    cargo: user.cargo,
    avatar: user.avatar || null,
    permissoes: user.permissoes || {}
  };
}

async function forgotPassword(email) {
  const userQuery = await query('SELECT user_id, nome, ativo FROM users WHERE email = $1', [email]);
  if (userQuery.rowCount === 0) {
    return { success: true };
  }
  
  const user = userQuery.rows[0];
  if (!user.ativo) {
    throw new AppError('Conta desativada. Contate o suporte.', 403);
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  
  const expiration = new Date();
  expiration.setHours(expiration.getHours() + 1);

  await query(
    'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.user_id, tokenHash, expiration]
  );

  const frontUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetLink = `${frontUrl}/redefinir-senha?token=${resetToken}`;

  await sendMail({
    to: email,
    subject: 'Restabelecimento de Acesso do Portal',
    html: `
      <h2>Olá ${user.nome || 'Operador(a)'},</h2>
      <p>Você solicitou uma nova credencial de acesso.</p>
      <p>Para prosseguir, clique no botão e crie uma nova chave de acesso (este link expira em 60 minutos):</p>
      <br>
      <a href="${resetLink}" style="padding: 12px 24px; background-color: #3b82f6; color: white; font-weight: bold; text-decoration: none; border-radius: 8px;">
         REDEFINIR MINHA CHAVE DE ACESSO
      </a>
      <br><br>
      <p style="color: gray; font-size: 12px;">Se você não solicitou, ignore esta mensagem. Sua conta atual continua segura.</p>
    `
  });

  return { success: true };
}

async function resetPassword(token, newPassword) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const resetRecord = await query(
    'SELECT id, user_id FROM password_resets WHERE token_hash = $1 AND expires_at > NOW() AND used = FALSE',
    [tokenHash]
  );

  if (resetRecord.rowCount === 0) {
    throw new AppError('O token de segurança fornecido é inválido ou já foi expirado.', 400);
  }

  const { id: resetId, user_id: userId } = resetRecord.rows[0];
  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  
  await query(
    'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
    [newPasswordHash, userId]
  );

  await query('UPDATE password_resets SET used = TRUE WHERE id = $1', [resetId]);

  return { success: true, message: 'Credenciais atualizadas com sucesso!' };
}

module.exports = {
  login,
  register,
  getMe,
  forgotPassword,
  resetPassword
};
