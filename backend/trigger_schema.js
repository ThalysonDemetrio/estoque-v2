
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, './.env') });
const { ensureSolicitacoesChecklistSchema } = require('./src/solicitacoes/solicitacoes.helpers');

async function trigger() {
  try {
    console.log('Triggering schema check...');
    await ensureSolicitacoesChecklistSchema();
    console.log('Schema check completed.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

trigger();
