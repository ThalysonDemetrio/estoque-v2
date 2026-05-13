#!/bin/bash
# ==============================================================================
# SCRIPT DE ENDURECIMENTO (HARDENING) DA VPS E INSTALAÇÃO BASE - STELLARNET
# ==============================================================================
# Executar este script como ROOT em sua VPS Ubuntu/Debian nova.
# Comando de uso: chmod +x setup-vps.sh && ./setup-vps.sh

set -e

echo "=============================================="
echo " Iniciando Configuração de Segurança da VPS..."
echo "=============================================="

# 1. Atualização do Sistema
echo "-> Atualizando pacotes locais..."
apt update && apt upgrade -y

# 2. Instalação de utilitários e Docker
echo "-> Instalando Docker e Docker Compose..."
apt install -y curl ufw fail2ban apt-transport-https ca-certificates software-properties-common

if ! command -v docker &> /dev/null
then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
fi

# 3. Configuração do Firewall (UFW)
echo "-> Configurando Firewall (UFW)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP 
ufw allow 443/tcp # HTTPS
echo "y" | ufw enable

# 4. Configuração Anti-BruteForce (Fail2Ban)
echo "-> Configurando Fail2ban para proteger porta SSH..."
systemctl enable fail2ban
systemctl start fail2ban

echo "=============================================="
echo "✅ Pronto! VPS Blindada e Docker Instalado."
echo "Certifique-se de configurar e executar: docker compose -f docker-compose.vps.yml up -d --build"
echo "=============================================="
