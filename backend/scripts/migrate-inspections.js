require('dotenv').config();
const { pool } = require('../src/db');

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS equipment_inspections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      equipment_id TEXT NOT NULL REFERENCES equipamentos(etiqueta_id) ON DELETE CASCADE,
      inspector_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
      data_vistoria TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      score_calculado INTEGER,
      notas_gerais TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS equipment_inspection_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inspection_id UUID NOT NULL REFERENCES equipment_inspections(id) ON DELETE CASCADE,
      item_nome TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('bom', 'alerta', 'critico')),
      comentario TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_inspections_eq ON equipment_inspections(equipment_id, data_vistoria DESC);
  `;

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Tabelas de vistorias criadas ou ja existentes.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Falha ao criar tabelas de vistorias:', error);
  process.exit(1);
});
