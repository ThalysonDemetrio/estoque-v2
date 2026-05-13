#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { file: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if ((token === '--file' || token === '-f') && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function main() {
  const { file } = parseArgs(process.argv);
  if (!file) {
    console.error('Uso: node scripts/verify-backup.js --file backups/arquivo.sql');
    process.exit(1);
  }

  const backupFile = path.resolve(process.cwd(), file);
  if (!fs.existsSync(backupFile)) {
    console.error(`Arquivo nao encontrado: ${backupFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(backupFile, 'utf8');

  const checks = [
    { name: 'Header pg_dump', test: /PostgreSQL database dump/.test(content) },
    { name: 'Tabela solicitacoes', test: /CREATE TABLE public\.solicitacoes/.test(content) },
    { name: 'Tabela solicitacao_checklists', test: /CREATE TABLE public\.solicitacao_checklists/.test(content) },
    { name: 'Dados colaboradores', test: /COPY public\.colaboradores/.test(content) },
    { name: 'Dados equipamentos', test: /COPY public\.equipamentos/.test(content) },
    { name: 'Dados solicitacoes', test: /COPY public\.solicitacoes/.test(content) },
    { name: 'Finalizacao restore marker', test: /\\unrestrict/.test(content) }
  ];

  const missing = checks.filter((item) => !item.test);

  if (missing.length) {
    console.error('Backup invalido/incompleto. Falharam os checks:');
    missing.forEach((item) => console.error(`- ${item.name}`));
    process.exit(2);
  }

  const stat = fs.statSync(backupFile);
  console.log(`Backup valido: ${backupFile}`);
  console.log(`Tamanho: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log('Checks OK:');
  checks.forEach((item) => console.log(`- ${item.name}`));
}

main();
