const authService = require('../../src/auth/auth.service');
const { query } = require('../../src/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mocks
jest.mock('../../src/db', () => ({
  query: jest.fn()
}));
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('login', () => {
    it('deve logar com sucesso e retornar token e usuario', async () => {
      const mockUser = {
        user_id: '1',
        email: 'test@test.com',
        nome: 'Test',
        password_hash: 'hashed',
        cargo: 'admin',
        ativo: true,
        permissoes: {}
      };

      query.mockResolvedValue({ rowCount: 1, rows: [mockUser] });
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-token');

      const result = await authService.login('test@test.com', 'pass');

      expect(result.token).toBe('mock-token');
      expect(result.user.email).toBe('test@test.com');
      expect(query).toHaveBeenCalled();
    });

    it('deve lancar erro se o usuario nao existir', async () => {
      query.mockResolvedValue({ rowCount: 0 });

      await expect(authService.login('wrong@test.com', 'pass'))
        .rejects.toThrow('Credenciais invalidas');
    });

    it('deve lancar erro se a senha estiver incorreta', async () => {
      query.mockResolvedValue({ rowCount: 1, rows: [{ password_hash: 'h', ativo: true }] });
      bcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('test@test.com', 'wrong'))
        .rejects.toThrow('Credenciais invalidas');
    });

    it('deve lancar erro se a conta estiver desativada', async () => {
      query.mockResolvedValue({ rowCount: 1, rows: [{ ativo: false }] });

      await expect(authService.login('test@test.com', 'pass'))
        .rejects.toThrow('Conta desativada');
    });
  });

  describe('getMe', () => {
    it('deve retornar dados do usuario atual', async () => {
      const mockUser = { user_id: '1', email: 'test@test.com', ativo: true };
      query.mockResolvedValue({ rowCount: 1, rows: [mockUser] });

      const result = await authService.getMe('1');
      expect(result.email).toBe('test@test.com');
    });
  });
});
