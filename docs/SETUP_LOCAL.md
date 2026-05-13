# Guia de Setup Local Stellarnet 💻

Siga estes passos para configurar o ambiente de desenvolvimento do Stellarnet em sua máquina local.

## 📋 Pré-requisitos
- **Node.js**: v18.x ou v20.x (Recomendado).
- **Docker Desktop**: Necessário para rodar o banco de dados PostgreSQL.
- **Gerenciador de Pacotes**: npm.

## 🚀 Passo a Passo

### 1. Instalação de Dependências
O projeto utiliza uma estrutura monorepo simplificada. Instale as dependências na raiz e nos diretórios específicos:

```bash
# Na raiz do projeto
npm install

# Instalar dependências do Backend e Frontend
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Configuração de Ambiente (.env)
Crie o arquivo de ambiente para o backend (o frontend já vem pré-configurado para apontar para o localhost:3001):

```bash
# Windows PowerShell
Copy-Item backend/.env.example backend/.env

# Linux/macOS
cp backend/.env.example backend/.env
```

### 3. Banco de Dados Local (Docker)
Inicie o container do PostgreSQL:
```bash
npm run db:up
```

Em seguida, inicialize o esquema e crie o usuário admin:
```bash
# No diretório /backend
cd backend
npm run migrate      # Aplica as tabelas (Postgrator)
npm run seed:admin   # Cria: sistemastradssistemas@gmail.com / admin@123
cd ..
```

### 4. Executando o Sistema
Para rodar o Frontend e o Backend simultaneamente:
```bash
npm run dev
```

## 🔍 URLs de Acesso
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **API Backend**: [http://localhost:3001](http://localhost:3001)

## 🛠️ Comandos Úteis (Raiz)
- `npm run db:down`: Para o banco de dados e remove os containers.
- `npm run db:clean`: Remove o banco e os volumes de dados.
- `npm run lint`: Executa a verificação de tipos e linting.

---
🚀 *Bem-vindo ao sistema de inventário inteligente Stellarnet.*
