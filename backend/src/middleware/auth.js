const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.cargo)) {
      return res.status(403).json({ error: 'Acesso negado: permissao insuficiente' });
    }
    return next();
  };
}

/**
 * Middleware para verificar permissões específicas.
 * Admins têm acesso total automaticamente.
 * @param {string} permissionKey - Chave da permissão em req.user.permissoes
 * @param {'view'|'edit'} action - Tipo de ação (padrão: 'view')
 */
function requirePermission(permissionKey, action = 'view') {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticacao necessaria' });
    }

    // Admin sempre tem acesso
    if (req.user.cargo === 'admin') {
      return next();
    }

    const permissoes = req.user.permissoes || {};
    const p = permissoes[permissionKey];

    // Suporte a booleano simples (retrocompatibilidade)
    if (p === true && action === 'view') {
      return next();
    }

    // Suporte a objeto { view: boolean, edit: boolean }
    if (p && typeof p === 'object' && p[action] === true) {
      return next();
    }

    return res.status(403).json({ error: `Acesso negado: permissao '${action}' para '${permissionKey}' necessaria` });
  };
}

module.exports = { authMiddleware, requireRole, requirePermission };
