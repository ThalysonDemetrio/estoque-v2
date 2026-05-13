#!/bin/bash
# ==============================================================================
# SCRIPT DE BACKUP ROTATIVO DIÁRIO - STELLARNET
# ==============================================================================
# Este script tira um dump do banco postgres dentro do container e salva na pasta ~/backups
# Para rodar de forma automática, adicione ao crontab do seu root.
# Digite: crontab -e
# Insira a linha (roda todo dia 01:00 da manhã):
# 0 1 * * * /caminho/do/projeto/deploy/scripts/backup-automator.sh >> /var/log/backup_db.log 2>&1

set -e

# Configurações do seu banco e containers
CONTAINER_NAME="estoque-db"
DB_USER="estoque_user"     # Substituir se usou diferente no .env.vps
DB_NAME="estoque"          # Substituir se usou diferente no .env.vps
BACKUP_DIR="/backups"      # Caminho na VPS mapedo pelo Docker

# Formato de Data YYYY-MM-DD
DATE=$(date +"%Y-%m-%d")
FILE_NAME="backup_estoque_${DATE}.sql.gz"

echo "[$(date)] Iniciando processo de Backup Diário..."

# 1. Checar se a pasta local existe e criar
# (Na VPS, a pasta de onde o script rodar, certifique-se de referenciar o volume do docker)
HOST_BACKUP_DIR="$(pwd)/backups"
mkdir -p "$HOST_BACKUP_DIR"

# 2. Executar pg_dump dentro do container, e gzip na saída antes de salvar no host
echo "[$(date)] Criando dump de ${DB_NAME} em ${HOST_BACKUP_DIR}/${FILE_NAME}..."
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER -d $DB_NAME -F c -v | gzip > "$HOST_BACKUP_DIR/$FILE_NAME"

# 3. Remover backups na pasta local que sejam mais velhos que 7 DIAS (-mtime +7)
echo "[$(date)] Fazendo limpeza de arquivos maiores que 7 dias..."
find "$HOST_BACKUP_DIR" -type f -name "backup_estoque_*.sql.gz" -mtime +7 -exec rm {} \;
echo "[-] Limpeza concluída."

echo "[$(date)] ✅ Backup rotativo finalizado com sucesso."
