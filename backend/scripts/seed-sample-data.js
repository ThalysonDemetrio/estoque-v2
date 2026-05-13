const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { pool } = require('../src/db');

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Limpando dados existentes (exceto usuários)...');
    await client.query('DELETE FROM movimentacoes');
    await client.query('DELETE FROM equipment_network');
    await client.query('DELETE FROM equipamentos');
    await client.query('DELETE FROM familias_equipamentos');
    await client.query('DELETE FROM colaboradores');

    console.log('Semeando colaboradores...');
    const colaboradores = [
      ['COLAB001', 'João Silva', 'joao.silva@empresa.com', 'TI', 'Analista de Sistemas'],
      ['COLAB002', 'Maria Souza', 'maria.souza@empresa.com', 'RH', 'Coordenadora'],
      ['COLAB003', 'Pedro Oliveira', 'pedro.oliveira@empresa.com', 'Financeiro', 'Gerente'],
      ['COLAB004', 'Ana Santos', 'ana.santos@empresa.com', 'Marketing', 'Designer'],
      ['COLAB005', 'Carlos Lima', 'carlos.lima@empresa.com', 'Operações', 'Supervisor']
    ];

    for (const c of colaboradores) {
      await client.query(
        'INSERT INTO colaboradores (colaborador_id, nome, email, departamento, cargo) VALUES ($1, $2, $3, $4, $5)',
        c
      );
    }

    console.log('Semeando equipamentos...');
    const equipamentos = [
      ['LAB001', 'LAPTOP-DELL-001', 'Notebook', 'Dell', 'Latitude 5420', 'Disponível', 'Estoque'],
      ['LAB002', 'LAPTOP-DELL-002', 'Notebook', 'Dell', 'Latitude 5420', 'Em Uso', 'TI', 'COLAB001'],
      ['LAB003', 'LAPTOP-APPLE-001', 'Notebook', 'Apple', 'MacBook Pro M2', 'Em Uso', 'Marketing', 'COLAB004'],
      ['MON001', 'MONITOR-LG-001', 'Monitor', 'LG', '27UL500-W', 'Disponível', 'Estoque'],
      ['MON002', 'MONITOR-LG-002', 'Monitor', 'LG', '27UL500-W', 'Em Uso', 'Financeiro', 'COLAB003'],
      ['TEL001', 'PHONE-SAMSUNG-001', 'Smartphone', 'Samsung', 'Galaxy S23', 'Em Uso', 'Operações', 'COLAB005'],
      ['LAB004', 'LAPTOP-LENOVO-001', 'Notebook', 'Lenovo', 'ThinkPad E14', 'Manutenção', 'Laboratório TI']
    ];

    for (const e of equipamentos) {
      const [etiqueta, cod, tipo, marca, modelo, status, local, dono] = e;
      
      // Criar família
      const familyRes = await client.query(
        `INSERT INTO familias_equipamentos (tipo, marca, modelo, especificacoes, quantidade_total, descricao_completa)
         VALUES ($1, $2, $3, '{}'::jsonb, 1, $4)
         ON CONFLICT (tipo, marca, modelo, especificacoes) DO UPDATE SET quantidade_total = familias_equipamentos.quantidade_total + 1
         RETURNING id`,
        [tipo, marca, modelo, `${tipo} ${marca} ${modelo}`]
      );
      const familyId = familyRes.rows[0].id;

      await client.query(
        `INSERT INTO equipamentos (
          etiqueta_id, codigo_barras, tipo_equipamento, marca, modelo, status, localizacao, colaborador_atual_id, familia_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [etiqueta, cod, tipo, marca, modelo, status, local, dono || null, familyId]
      );

      // Sementes de rede para alguns
      if (tipo === 'Notebook') {
        await client.query(
          `INSERT INTO equipment_network (equipment_id, ip_address, mac_address) VALUES ($1, $2, $3)`,
          [etiqueta, `192.168.1.${10 + Math.floor(Math.random() * 50)}`, `00:1A:2B:3C:4D:${etiqueta.slice(-2)}`]
        );
      }
    }

    await client.query('COMMIT');
    console.log('Dados de exemplo semeados com sucesso!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('Erro ao semear dados:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
