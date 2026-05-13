// Mocks devem vir ANTES de qualquer require que os utilize
jest.mock('../../src/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(() => ({
      query: jest.fn(),
      release: jest.fn()
    }))
  },
  query: jest.fn()
}));
jest.mock('../../src/equipamentos/equipamentos.queries');
jest.mock('../../src/lib/socket');
jest.mock('../../src/audit/audit.service');

const service = require('../../src/equipamentos/equipamentos.service');
const queries = require('../../src/equipamentos/equipamentos.queries');
const { pool } = require('../../src/db');

describe('Equipamentos Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listar', () => {
    it('deve retornar lista de equipamentos', async () => {
      const mockRows = [{ etiqueta_id: 'EQ-001' }];
      queries.findEquipamentos.mockResolvedValue({ rows: mockRows });

      const result = await service.listar({});

      expect(result).toEqual(mockRows);
      expect(queries.findEquipamentos).toHaveBeenCalled();
    });
  });

  describe('salvarVistoria', () => {
    it('deve calcular o score corretamente (50% para um item em alerta)', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };
      pool.connect.mockResolvedValue(mockClient);
      queries.salvarVistoria.mockResolvedValue('inspection-uuid');

      const payload = {
        itens: [{ nome: 'Tela', status: 'alerta' }],
        userId: 'user-1',
        userNome: 'Admin'
      };

      const result = await service.salvarVistoria('EQ-001', payload);

      expect(result.score).toBe(50);
      expect(queries.salvarVistoria).toHaveBeenCalledWith(mockClient, expect.objectContaining({
        score: 50
      }));
    });

    it('deve calcular score 100% se todos itens estao bons', async () => {
      const mockClient = { query: jest.fn(), release: jest.fn() };
      pool.connect.mockResolvedValue(mockClient);
      queries.salvarVistoria.mockResolvedValue('id');

      const payload = {
        itens: [{ status: 'bom' }, { status: 'bom' }],
        userId: 'u1'
      };

      const result = await service.salvarVistoria('EQ-001', payload);
      expect(result.score).toBe(100);
    });
  });

  describe('getRelatorioInvestimentos', () => {
    it('deve retornar dados do relatorio', async () => {
      const mockReport = { total_valor: 1000 };
      queries.getRelatorioInvestimentos.mockResolvedValue({ rows: [mockReport] });

      const result = await service.getRelatorioInvestimentos();

      expect(result).toEqual(mockReport);
    });
  });
});
