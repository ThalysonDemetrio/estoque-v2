# Checklist de Implementação: SpaceStock 📋

Guia passo a passo para garantir uma implementação bem-sucedida do ecossistema Stellarnet.

## 1. Preparação de Infraestrutura
- [ ] **Docker**: Garantir que o Docker Desktop (Windows) ou Engine (Linux) esteja ativo.
- [ ] **Node.js**: Validar versão `node -v` (Mínimo v18+).
- [ ] **Workspace**: Diretório unificado com `/frontend` e `/backend`.

## 2. Configuração de Banco e API
- [ ] **Backend .env**: Clonar de `.env.example` e configurar `DATABASE_URL`.
- [ ] **Postgres Up**: Executar `npm run db:up` na raiz.
- [ ] **Schema**: Executar `npm run migrate` no diretório `/backend`.
- [ ] **Admin**: Executar `npm run seed:admin` para criar as credenciais de acesso inicial.

## 3. Frontend e UI Premium
- [ ] **Build Dependências**: `npm install` no diretório `/frontend`.
- [ ] **Login Stellarnet**: Testar a animação do foguete e validade do token JWT.
- [ ] **Acesso ao Dashboard**: Verificar se o "Mapa Mental" e "Saúde Preditiva" carregam dados do banco.
- [ ] **Branding**: Validar se o logo e o favicon Stellarnet estão consistentes.

## 4. Fluxos Operacionais (Testes de Fogo)
- [ ] **Inventário**: Cadastrar um equipamento com data de compra antiga (>2 anos).
- [ ] **Predição**: Verificar se o equipamento aparece no card "Saúde do Inventário" (Seção 7).
- [ ] **Solicitações**: Criar uma solicitação e testar o fluxo de aprovação da TI.
- [ ] **Rede**: Abrir o módulo de Auditoria/Rede e conferir a topologia.

## 5. Publicação (Produção)
- [ ] **VPS**: Configurar `docker-compose.vps.yml`.
- [ ] **Domínio**: Validar SSL via Caddy (`https`).
- [ ] **Segurança**: Alterar `JWT_SECRET` e senhas padrão de administradores.

---
🚀 *Checklist concluído. Sistema pronto para operação.*