'use strict';

const { AppError } = require('../errors');

/**
 * errorHandler — middleware Express centralizado (4 args = error handler).
 *
 * Distingue:
 *   • AppError        → status definido pelo domínio (400/403/404/…)
 *   • Error "status"  → erros ad-hoc lançados com Object.assign(new Error(…), { status })
 *   • JWT / CORS      → 401 / 403
 *   • Postgres        → fornece mensagem genérica sem vazar detalhes internos
 *   • Outros          → 500 + log
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // CORS ou domínio não permitido
  if (err.message && err.message.includes('não permitida por CORS')) {
    return res.status(403).json({ error: err.message });
  }

  // AppError (domínio)
  if (err instanceof AppError || (err.name === 'AppError')) {
    return res.status(err.status || 400).json({ error: err.message, ...(err.code ? { code: err.code } : {}) });
  }

  // Erros com .status definido manualmente (padrão legado Object.assign)
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }

  // JWT inválido / expirado
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }

  // Erros do driver pg (não vazar detalhes do banco)
  if (err.code && typeof err.code === 'string' && err.code.match(/^[0-9A-Z]{5}$/)) {
    const pgMsg = _safePgMessage(err);
    console.error('[DB]', err.code, err.detail || err.message);
    return res.status(409).json({ error: pgMsg });
  }

  // SyntaxError no body JSON
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpo da requisição JSON inválido' });
  }

  // Payload muito grande
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload excede o limite permitido' });
  }

  // Qualquer outro erro inesperado → 500 + log completo
  console.log('--- EXCEPTION CAUGHT ---');
  console.error('[ERR]', req.method, req.path, err.stack || err);
  return res.status(500).json({ error: 'Erro interno do servidor', details: process.env.NODE_ENV === 'development' ? err.message : undefined });
}

function _safePgMessage(err) {
  switch (err.code) {
    case '23505': return 'Registro duplicado. Verifique os campos únicos e tente novamente.';
    case '23503': return 'Violação de chave estrangeira. O recurso referenciado não existe.';
    case '23502': return 'Campo obrigatório ausente no banco de dados.';
    case '23514': return 'Valor não aceito pela restrição do banco de dados.';
    case '42P01': return 'Estrutura do banco desatualizada. Contate o administrador.';
    default:       return `DB_ERROR_DEBUG: ${err.message || 'Operação failed'}`;
  }
}

module.exports = { errorHandler };
