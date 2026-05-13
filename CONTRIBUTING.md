# Guia de Contribuição (CONTRIBUTING.md)

## 🛠️ Padrões de Desenvolvimento

### Commits
Seguimos o padrão **Conventional Commits**:
- `feat:` Novas funcionalidades
- `fix:` Correção de bugs
- `docs:` Alterações em documentação
- `refactor:` Alterações de código que não fixam bug nem adicionam feature
- `style:` Formatação, ponto-e-vírgula, etc (sem alteração de lógica)

### Fluxo de Trabalho
1. Crie uma branch a partir da `main`: `feature/nome-da-feature` ou `fix/nome-do-bug`.
2. Realize suas alterações seguindo os padrões de lint (`npm run lint`).
3. Abra um Pull Request detalhando as mudanças.

### Checklist de PR
- [ ] O código passou no lint e build local.
- [ ] Novas rotas de API foram adicionadas ao `API.md`.
- [ ] Tipos TypeScript foram centralizados em `src/types/index.ts`.
- [ ] Erros de domínio usam a classe `AppError` no backend.

## 🎨 Padrões de Código
- **Backend:** Prefira a estrutura de Módulos (Service/Route/Query) como vista em `src/solicitacoes`.
- **Frontend:** Mantenha componentes de página curtos (máx 300 linhas). Extraia lógica complexa para `services` ou `hooks`.
- **Nomenclatura:** camelCase para variáveis/funções, PascalCase para Componentes/Classes, snake_case para colunas de banco (mapeado para camelCase no retorno da API).
