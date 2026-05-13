# SpaceStock: Primeiros 5 Minutos 🚀

Siga esta sequência exata para rodar o projeto rapidamente pela primeira vez.

## 1. Clonar (Obrigatório)
```bash
git clone <URL_DO_REPOSITORIO> && cd estoque
```

## 2. Instalar (Ambos os lados)
```bash
# Instalar dependências da raiz e backend
npm install

# Instalar dependências do frontend
cd frontend && npm install && cd ..
```

## 3. Setup do Banco (PostgreSQL)
Certifique-se de que o Docker está aberto.
```bash
# Subir o banco via Docker
npm run db:up

# Executar migrações e criar administrador (no diretório /backend)
cd backend
npm run migrate
npm run seed:admin
cd ..
```

## 4. Rodar o Sistema
```bash
# Sobe Frontend (:3000) e Backend (:3001) simultaneamente
npm run dev
```

## ✅ Validação Rápida
1.  **Frontend**: Abra [http://localhost:3000](http://localhost:3000).
2.  **Login**: Use: `sistemastradssistemas@gmail.com` / `admin@123`.
3.  **Verificação**: O dashboard deve carregar os gráficos Stellarnet imediatamente.

---
🌠 *Bem-vindo à órbita do Stellarnet.*
