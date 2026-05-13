# Arquitetura SpaceStock 🌌

O **SpaceStock** é um ecossistema de gestão de ativos e monitoramento de rede projetado com uma estética "Deep Space" e foco em performance e confiabilidade.

## 🏗️ Core Stack
- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router) + React 19.
- **Backend**: Node.js + Express (REST API).
- **Banco de Dados**: [PostgreSQL](https://www.postgresql.org/) (Relacional).
- **Comunicação Real-time**: WebSockets via Socket.io para Dashboard e Chat.
- **Estilização**: TailwindCSS 4 + Framer Motion (Animações Premium).

## 📁 Estrutura de Diretórios

### Frontend (`/frontend`)
Arquitetura baseada em componentes e hooks customizados:
- `src/app/`: Rotas, layouts e páginas. Utiliza `(dashboard)` groups para organização.
- `src/components/`: Componentes UI seguindo o **Neumorphic & Glassmorphism Design**.
- `src/lib/`: Configurações centrais, incluindo `health.ts` (Lógica Preditiva Unificada).
- `src/contexts/`: Gerenciamento de estado global (Auth, Theme, Chat).

### Backend (`/backend`)
Arquitetura modular dirigida por domínio:
- `src/equipamentos/`: Gestão de ativos, vistorias e diagnósticos.
- `src/movimentacoes/`: Rastreabilidade completa de entrada e saída.
- `src/solicitacoes/`: Sistema de chamados técnicos e workflow.
- `db/migrations/`: Scripts SQL idempotentes para evolução do esquema.

## 🧭 Lógica de Saúde Preditiva (Unified Health Engine)
O sistema utiliza um motor de cálculo centralizado em `frontend/src/lib/health.ts`.
1.  **Baseline**: Inicia em 100% de saúde.
2.  **Fatores de Degradação**: Idade (Ciclo de vida por categoria), Tipo de Ativo, Histórico de Intervenções.
3.  **Fatores de Mitigação**: Ambiente controlado (CPD/Data Center), Manutenções Preventivas.
4.  **Consistência**: O mesmo motor alimenta o Dashboard (Seção 7) e a página de Diagnósticos.

## 🔐 Segurança e Autenticação
- **Autenticação**: Stateless via JWT (JSON Web Tokens).
- **Autorização**: Baseada em cargos (Administrador, Técnico, Usuário).
- **Auditoria**: Todas as ações críticas registram o `userId` e o nome real do executor.

## 🌐 Integração de Rede
O módulo de rede utiliza uma visualização de grafo interativo (`ReactFlow`) para representar a topologia, integrada diretamente com o inventário físico de switches e servidores.
