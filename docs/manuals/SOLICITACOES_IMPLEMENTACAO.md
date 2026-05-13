# Módulo de Solicitações: Guia de Implementação Stellarnet 🚀

O módulo de solicitações é o coração operacional do Stellarnet, gerenciando o ciclo de vida de ativos desde o pedido até a entrega técnica.

## 🏗️ Stack e Estrutura
- **Frontend**: Componentes Next.js (`SolicitacoesService`, `SolicitacaoModal`, `SolicitacaoDetailSidebar`).
- **Backend API**: Rotas em `backend/src/solicitacoes.js`.
- **Banco**: Tabelas `solicitacoes`, `processamentos` e `historico_equipamentos`.

## 🔄 Fluxo de Trabalho (Workflow)
1.  **Criação**: O colaborador solicita um equipamento ou manutenção.
    - Tipos: `Alocação`, `Manutenção`, `Substituição`.
2.  **Análise de TI**: O administrador visualiza as solicitações pendentes.
    - Ações: `Aprovar`, `Rejeitar` (exige motivo), `Processar`.
3.  **Entrega Física**: Após o processamento técnico, o sistema exige a confirmação de entrega.
    - Ao confirmar, o inventário é atualizado automaticamente e uma movimentação de estoque é gerada.

## 🔐 Auditoria e Rastreabilidade
Cada etapa do processo registra:
- `userId`: Quem realizou a ação.
- `timestamp`: Quando ocorreu.
- `protocolo`: Número único gerado automaticamente (`AAAA-MM-XXXX`).
- `logs_sincronizacao`: Registro de integrações com sistemas legados ou auditoria externa.

## 🛠️ Manutenção do Módulo
Para expandir ou diagnosticar o módulo:
- **Endpoints Base**: `/api/solicitacoes`.
- **Scripts de Teste**: `backend/scripts/test-solicitacoes-smoke.js` (Valida o fluxo completo via CLI).

---
🌠 *Módulo de Solicitações Stellarnet: Agilidade e Controle Total.*
