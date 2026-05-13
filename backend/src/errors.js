'use strict';

/**
 * AppError — erro de domínio com código HTTP explícito.
 * Garante que erros esperados (400/403/404) nunca gerem 500 acidentalmente.
 *
 * Uso:
 *   throw new AppError('Solicitação não encontrada', 404);
 *   throw new AppError('Campos obrigatórios ausentes', 400);
 */
class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} [status=400]
   * @param {string} [code]   — código legível pela máquina, ex: 'SOLICITACAO_NOT_FOUND'
   */
  constructor(message, status = 400, code) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (code) this.code = code;
  }
}

module.exports = { AppError };
