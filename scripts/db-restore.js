#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = { env: 'dev', file: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--env' && argv[i + 1]) {
      args.env = String(argv[i + 1]).toLowerCase();
      i += 1;
      continue;
    }
    if ((token === '--file' || token === '-f') && argv[i + 1]) {
      args.file = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return args;
}

function buildComposeArgs(envMode) {
  if (envMode === 'vps') {
    return { service: 'db', args: ['-f', 'docker-compose.vps.yml'] };
  }
  return { service: 'postgres', args: [] };
}

function main() {
  const root = process.cwd();
  const { env, file } = parseArgs(process.argv);

  if (env !== 'dev' && env !== 'vps') {
    console.error('Uso: node scripts/db-restore.js --file backups/arquivo.sql [--env dev|vps]');
    process.exit(1);
  }

  if (!file) {
    console.error('Informe o arquivo com --file.');
    process.exit(1);
  }

  const restoreFile = path.resolve(root, file);
  if (!fs.existsSync(restoreFile)) {
    console.error(`Arquivo nao encontrado: ${restoreFile}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(restoreFile);
  const compose = buildComposeArgs(env);

  // Extrair user/db do DATABASE_URL do backend (fonte canônica)
  let dbUser = null;
  let dbName = null;
  const backendEnv = path.join(root, 'backend', '.env');
  if (fs.existsSync(backendEnv)) {
    const envContent = fs.readFileSync(backendEnv, 'utf8');
    const match = envContent.match(/DATABASE_URL\s*=\s*postgresql:\/\/([^:]+):[^@]+@[^/]+\/([^\s]+)/);
    if (match) {
      dbUser = match[1];
      dbName = match[2];
    }
  }

  const pgUser = dbUser || '$POSTGRES_USER';
  const pgDb = dbName || '$POSTGRES_DB';
  const cmdArgs = [
    'compose',
    ...compose.args,
    'exec',
    '-T',
    compose.service,
    'psql',
    '-v', 'ON_ERROR_STOP=1',
    '-U', pgUser,
    '-d', pgDb
  ];

  const result = spawnSync('docker', cmdArgs, {
    cwd: root,
    input: sql,
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 200
  });

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : 'Erro desconhecido';
    console.error('Falha ao restaurar backup via docker compose:');
    console.error(stderr.trim());
    process.exit(result.status || 1);
  }

  console.log(`Restore concluido com sucesso usando arquivo: ${restoreFile}`);
}

main();
