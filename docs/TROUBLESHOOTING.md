# 🛠️ Stellarnet: Troubleshooting (Resolução de Problemas)

## ❌ Erro de Conexão com o Banco (PostgreSQL)
**Sintoma:** O backend não inicia ou retorna erro `ECONNREFUSED`.

**Checklist:**
1.  **Docker**: Verifique se o container `estoque-db` está rodando (`docker ps`).
2.  **Configuração**: Verifique se `DATABASE_URL` no `backend/.env` aponta para `localhost` (para uso local) ou `db` (para uso via Docker Compose).
3.  **Porta**: Garanta que o Postgres local não está conflitando com a porta do Docker.

## 🌐 Dashboard não carrega dados (Erro de CORS/API)
**Sintoma:** UI visível, mas dados infinitamente carregando ou console com erro 404/CORS.

**Checklist:**
1.  **Status da API**: Acesse `http://localhost:3001/health`.
2.  **CORS**: Certifique-se de que `CORS_ORIGIN=http://localhost:3000` está no `.env` do backend.
3.  **Porta 3001**: Garanta que o backend está rodando na porta correta.

## 🔑 Login falhando (401 Unauthorized ou Erro 500)
**Checklist:**
1.  **Seed**: Se o banco estiver recém-criado, rode `npm run seed:admin` no diretório `/backend`.
2.  **JWT Secret**: Garanta que o `JWT_SECRET` é o mesmo após reiniciar o servidor.
3.  **Limpeza de Cache**: Em caso de erro de persistência, limpe o `LocalStorage` do navegador e faça login novamente.

## 📦 Erros de Build (Next.js / TypeScript)
**Sintoma:** O servidor de dev do frontend falha ao compilar.

**Solução:**
```bash
cd frontend
rm -rf .next
npm install
npm run dev
```

## 🚀 Logotipo ou Favicon não aparecem
**Checklist:**
1.  **Cache do Navegador**: Force o recarregamento com `Ctrl + F5`.
2.  **Caminho do Arquivo**: Verifique se `logo_stellarnet.png` está na pasta `frontend/public/`.

---
🔧 *Necessita suporte adicional? Consulte o manual técnico em docs/ARQUITETURA.md.*
