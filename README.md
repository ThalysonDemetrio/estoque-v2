# Inventário e Rede 🌌 - Ecossistema de Gestão de Ativos

O **Inventário e Rede** é uma plataforma moderna e reativa para o gerenciamento inteligente de inventário, equipamentos TI e colaboradores, facilitando a rastreabilidade de movimentações entre colaboradores e automatizando o fluxo de solicitações operacionais.

## 🌟 Visão Geral

O **Inventário e Rede** é uma plataforma robusta desenvolvida para centralizar o controle de ativos tecnológicos, facilitando a rastreabilidade de movimentações entre colaboradores e automatizando o fluxo de solicitações operacionais.

## 🛠️ Stack Tecnológica

### Backend
- **Node.js** & **Express**
- **PostgreSQL** (com migrações automáticas via Postgrator)
- **Socket.io** (Notificações em tempo real)
- **JWT** (Autenticação Segura)

### Frontend
- **Next.js 15+** (App Router)
- **React 19** & **TypeScript**
- **TailwindCSS 4** (Design Moderno & Neumórfico)
- **Framer Motion** (Animações Fluídas)

## 📂 Estrutura do Projeto

```bash
├── backend/          # API RESTful, Banco de Dados e Lógica de Negócio
├── frontend/         # Interface do Usuário (Next.js)
├── docker-compose.yml # Orquestração do Banco de Dados local
└── package.json      # Comandos de orquestração do sistema
```

## 🚀 Como Iniciar

### Pré-requisitos
- **Node.js** (v18 ou superior)
- **Docker** (para o banco de Dados)

### Execução Local (Modo Rápido)

1. **Subir o Banco de Dados:**
   ```bash
   npm run db:up
   ```

2. **Inicializar o Ambiente (Primeira vez):**
   ```bash
   npm run db:init
   ```

3. **Rodar o Sistema (Frontend + Backend):**
   ```bash
   npm run dev
   ```
   *Acesse: [http://localhost:3000](http://localhost:3000)*

## 🔐 Credenciais Padrão (Seed)

- **Usuário:** `sistemastradssistemas@gmail.com`
- **Senha:** `admin@123`

## 🛡️ Segurança & Configurações

O **Inventário e Rede** utiliza uma arquitetura de configuração dinâmica. Algumas configurações críticas (como o **PIN de Investimentos**) são armazenadas de forma segura no banco de dados (tabela `sistema_config`) e podem ser gerenciadas diretamente na aba de **Configurações** do Cockpit. 

O arquivo `.env` serve apenas como ponto de partida inicial (fallback).

---
Desenvolvido por **Space Goes Solution**