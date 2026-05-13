# Análise de Anti-Padrões — Guia Prático

Este documento registra a análise de anti-padrões realizada no sistema legado e como eles foram endereçados.

## 1. Rigidez (Rigidity)
**Sintoma**: Alterar uma funcionalidade exige mudanças em cascata em vários arquivos ou funções não relacionadas.
**O que foi feito**: Separação de controladores monolíticos em módulos coesos (Investimentos, Rede, CRUD).

## 2. Fragilidade (Fragility)
**Sintoma**: Editar uma função quebra outra funcionalidade aparentemente não relacionada.
**O que foi feito**: Adoção do padrão IIFE para encapsulamento e redução de efeitos colaterais globais.

## 3. Imobilidade (Immobility)
**Sintoma**: Código que não pode ser reutilizado em outro contexto sem trazer dependências desnecessárias.
**O que foi feito**: Centralização de utilitários e normalização de dados.

## 4. Viscosidade (Viscosity)
**Sintoma**: É mais fácil fazer um "hack" do que fazer do jeito certo.
**O que foi feito**: Padronização de estrutura de diretórios e convenções de escrita.

---

## 🚀 Resolução Final: Era Stellarnet (Março/2026)

A migração completa para o ecossistema **Stellarnet** marcou o fim definitivo dos anti-padrões descritos acima:

- **Rigidez e Fragilidade**: Resolvidas pela adoção do **Next.js 15 (App Router)** e **TypeScript**. O acoplamento global via `window` foi substituído por exportações ESM claras e injeção de dependência via React Context.
- **Imobilidade**: O sistema agora utiliza componentes React 19 altamente reutilizáveis e compartilha a lógica de saúde via `lib/health.ts`.
- **Viscosidade**: Reduzida drasticamente. Adicionar novas funcionalidades agora segue o padrão natural do Next.js, com rotas e componentes bem definidos.

**Status: RESOLVIDO 🌠**
