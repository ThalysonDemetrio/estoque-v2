#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
  const args = { env: 'dev', out: null };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--env' && argv[i + 1]) {
      args.env = String(argv[i + 1]).toLowerCase();
      i += 1;
      continue;
    }
    if (token === '--out' && argv[i + 1]) {
      args.out = argv[i + 1];
      i += 1;
      continue;
    }
  }
  return args;
}

function nowStamp() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function buildComposeArgs(envMode) {
  if (envMode === 'vps') {
    return { service: 'db', args: ['-f', 'docker-compose.vps.yml'] };
  }
  return { service: 'postgres', args: [] };
}

function main() {
  const root = process.cwd();
  const { env, out } = parseArgs(process.argv);
  if (env !== 'dev' && env !== 'vps') {
    console.error('Uso: node scripts/db-backup.js [--env dev|vps] [--out caminho.sql]');
    process.exit(1);
  }

  const backupsDir = path.join(root, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const outputFile = out
    ? path.resolve(root, out)
    : path.join(backupsDir, `estoque-backup-${env}-${nowStamp()}.sql`);

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
    'pg_dump',
    '-U', pgUser,
    '-d', pgDb,
    '--clean', '--if-exists', '--no-owner', '--no-privileges'
  ];

  const result = spawnSync('docker', cmdArgs, {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 200
  });

  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString('utf8') : 'Erro desconhecido';
    console.error('Falha ao gerar backup via docker compose:');
    console.error(stderr.trim());
    process.exit(result.status || 1);
  }

  fs.writeFileSync(outputFile, result.stdout);
  console.log(`Backup gerado com sucesso: ${outputFile}`);
}

main();
