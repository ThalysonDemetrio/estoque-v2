require('dotenv').config();

const path = require('path');
const Postgrator = require('postgrator').default || require('postgrator');
const { pool } = require('../src/db');

async function run() {
  const postgrator = new Postgrator({
    migrationPattern: path.join(__dirname, '..', 'db', 'migrations', '*'),
    driver: 'pg',
    execQuery: (query) => pool.query(query),
  });

  try {
    const result = await postgrator.migrate();
    if (result.length === 0) {
      console.log('Banco de dados ja esta na versao mais recente.');
    } else {
      console.log('Migracoes aplicadas com sucesso:', result.map(m => m.name).join(', '));
    }
  } catch (error) {
    console.error('Falha ao aplicar migracoes:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
