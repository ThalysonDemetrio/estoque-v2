require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/db');

async function run() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const nome = process.env.ADMIN_NOME || null;

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL e ADMIN_PASSWORD sao obrigatorios');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await pool.query(
    `INSERT INTO users (email, password_hash, nome, cargo)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       nome = EXCLUDED.nome,
       cargo = 'admin'`,
    [email, passwordHash, nome]
  );

  console.log('Usuario admin configurado com sucesso');
}

run()
  .catch((error) => {
    console.error('Erro ao criar admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
