# Guia de Deploy SpaceStock 🚀

Este guia descreve os passos para implantar o sistema SpaceStock em uma VPS utilizando Docker Compose e Caddy (Proxy Reverso).

## 📋 Pré-requisitos
- VPS Linux (Ubuntu 22.04+ recomendado).
- Docker e Docker Compose instalados.
- Domínio configurado apontando para o IP da VPS.
- Portas `80` (HTTP) e `443` (HTTPS) liberadas no firewall.

## 1. Configurar Variáveis de Ambiente
Crie o arquivo de ambiente de produção a partir do exemplo:
```bash
cp deploy/.env.vps.example deploy/.env.vps
```

Edite `deploy/.env.vps` e preencha os valores obrigatórios:
- `POSTGRES_PASSWORD`: Senha forte para o banco de dados.
- `JWT_SECRET`: Chave secreta longa para assinatura de tokens.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: Credenciais iniciais do administrador.
- `DOMAIN`: Seu domínio (ex: `stellarnet.suaempresa.com.br`).

## 2. Iniciar a Stack Stellarnet
Suba todos os serviços (Banco, Backend, Frontend) em modo background:
```bash
docker compose -f docker-compose.vps.yml up -d --build
```

## 3. Inicializar o Banco de Dados
Com os containers rodando, execute as migrações e o seed inicial:
```bash
# Executar migrações do PostgreSQL
docker compose -f docker-compose.vps.yml exec backend npm run migrate

# Criar usuário administrador padrão
docker compose -f docker-compose.vps.yml exec backend npm run seed:admin
```

## 🌐 Configuração do Proxy Reverso (Caddy)
O Stellarnet utiliza o **Caddy** para gerenciamento automático de certificados SSL (HTTPS).
O arquivo de configuração está localizado em `deploy/caddy/Caddyfile`. Certifique-se de que o domínio configurado no arquivo corresponde ao domínio da sua VPS.

## 🛠️ Manutenção e Logs
- **Ver logs**: `docker compose -f docker-compose.vps.yml logs -f`
- **Backup do banco**: O sistema mapeia os dados para o volume `postgres_data`. Recomenda-se realizar backups periódicos do diretório `./backups`.
- **Atualização**: `git pull` seguido de `docker compose -f docker-compose.vps.yml up -d --build`.

---
Sistema de Inventário Inteligente Stellarnet.
