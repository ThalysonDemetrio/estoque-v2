const express = require('express');
const { authMiddleware, requireRole } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { query } = require('../db');

const router = express.Router();

// Apenas administradores podem acessar as configurações globais por enquanto
router.use(authMiddleware, requireRole('admin'));

const CARGOS_VALIDOS = ['admin', 'gestor', 'usuario'];

const TABS_DISPONIVEIS = [
  'dashboard',
  'dashboardEquipamentos',
  'equipamentos',
  'colaboradores',
  'movimentacoes',
  'rede',
  'solicitacoes',
  'investimentos',
  'calendario',
  'configuracoes'
];

/**
 * GET /api/settings/roles-config
 * Retorna os cargos e abas disponíveis no sistema para uso no frontend
 */
router.get('/roles-config', (req, res) => {
  return res.json({
    data: {
      cargos: CARGOS_VALIDOS,
      tabs: TABS_DISPONIVEIS
    }
  });
});

/**
 * POST /api/settings/investimentos-pin
 * Atualiza o PIN de acesso à aba de investimentos no banco de dados
 */
router.post('/investimentos-pin', async (req, res, next) => {
  try {
    const { newPin } = req.body || {};
    
    if (!newPin || !/^\d{4,8}$/.test(newPin)) {
      return res.status(400).json({ error: 'O novo PIN deve conter entre 4 e 8 dígitos numéricos' });
    }

    // Garante que a tabela de configuração existe
    await query(`
      CREATE TABLE IF NOT EXISTS sistema_config (
        chave TEXT PRIMARY KEY,
        valor TEXT
      )
    `);

    // Gera o hash do novo PIN
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(newPin, salt);

    // Salva ou atualiza o PIN no banco
    await query(`
      INSERT INTO sistema_config (chave, valor)
      VALUES ('investimentos_pin_hash', $1)
      ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor
    `, [hash]);

    return res.json({ message: 'PIN de investimentos atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar PIN de investimentos:', error);
    return next(error);
  }
});

/**
 * GET /api/settings/backup-status
 * Retorna o status simplificado do sistema e banco de dados
 */
router.get('/backup-status', (req, res) => {
  res.json({
    data: {
      status: 'ok',
      database: 'postgres',
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
