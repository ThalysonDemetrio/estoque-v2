# Evolução da Arquitetura: De Legado para Stellarnet 🚀

Este documento registra a transição tecnológica do sistema, desde sua concepção inicial até a arquitetura moderna **Stellarnet**.

## 🏗️ O Salto Tecnológico
O sistema evoluiu de uma SPA simples (Single Page Application) para um ecossistema robusto:

### Fase 1: Legado (V1)
- **Frontend**: HTML5, CSS vanilla e JavaScript puro (DOM manipulation).
- **Backend API**: Express + PostgreSQL simples.
- **UI**: Design básico com foco funcional.

### Fase 2: Stellarnet (Atual)
- **Frontend**: [Next.js 15](https://nextjs.org/) com **App Router** e **Server Components**.
- **Backend API**: Refatorada para total paridade com o frontend moderno.
- **UI**: **Premium "Deep Space" Design**, utilizando TailwindCSS 4, Framer Motion e Glassmorphism.
- **Inteligência**: Inclusão do **Motor de Saúde Preditiva** (`lib/health.ts`).

## 📁 Camadas de Responsabilidade
- **Apresentação**: `/frontend/src/app` (Rotas e Layouts Dinâmicos).
- **Componentes**: `/frontend/src/components` (Atalhos, Gráficos Neumórficos, Painéis).
- **Lógica de Negócio**: `/backend/src/` (Auth, Equipamentos, Movimentações, Solicitações).
- **Persistência**: PostgreSQL via Docker (Porta 5432).

## 🧭 Fluxo de Dados Stellarnet
1.  **Entrada**: Autenticação Premium via Login "Foguete" (JWT).
2.  **Dashboard**: Consome APIs do Backend para exibir mapas mentais e gráficos de dispersão.
3.  **Saúde Preditiva**: O Frontend calcula em tempo real o risco técnico dos ativos baseando-se em metadados de compra e categoria.
4.  **Rastreabilidade**: Todas as solicitações passam por uma esteira de aprovação (TI) sincronizada via WebSockets.

---
🌠 *Documentando o futuro da gestão de ativos.*
