const db = require('../../src/db');
jest.mock('../../src/db');

const service = require('../../src/movimentacoes/movimentacoes.service');
const queries = require('../../src/movimentacoes/movimentacoes.queries');

describe('Movimentacoes Service', () => {
  it('deve listar movimentacoes corretamente', async () => {
    const mockRows = [{ id: 1 }];
    // Forçar mock diretamente no objeto importado
    queries.findMovimentacoes = jest.fn().mockResolvedValue({ rows: mockRows });

    const result = await service.listar({});
    
    expect(result).toEqual(mockRows);
    expect(queries.findMovimentacoes).toHaveBeenCalled();
  });
});
