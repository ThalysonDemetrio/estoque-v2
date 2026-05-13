const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketLib = require('./lib/socket');

const { errorHandler } = require('./middleware/errorHandler');
const authRoutes = require('./auth/auth.routes');
const colaboradoresRoutes = require('./colaboradores/colaboradores.routes');
const equipamentosRoutes = require('./equipamentos/equipamentos.routes');
const movimentacoesRoutes = require('./movimentacoes/movimentacoes.routes');
const solicitacoesRoutes = require('./solicitacoes/solicitacoes.routes');
const adminRoutes = require('./admin/admin.routes');
const networkRoutes = require('./network/network.routes').router;
const chatRoutes = require('./chat/chat.routes');
const notificationsRoutes = require('./notifications/notifications.routes');
const searchRoutes = require('./search/search.routes');
const investimentosRoutes = require('./investimentos/investimentos.routes');
const auditRoutes = require('./audit/audit.routes');
const settingsRoutes = require('./settings/settings.routes');
const swagger = require('./swagger');

const app = express();
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path}`);
  next();
});

app.disable('x-powered-by');
app.set('trust proxy', 1);

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsConfig = {
  origin(origin, callback) {
    // Permitir requests sem origin (mobile apps, curl, health checks)
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0) return callback(null, true);
    
    // Suporte para a porta 8000 que o frontend está usando
    if (origin.includes('localhost:8000') || origin.includes('127.0.0.1:8000')) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error('Origem não permitida por CORS: ' + origin));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000, // Aumentado de 500 para 2000 para evitar bloqueios falso-positivos
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 40,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.'
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsConfig));
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api-docs', swagger.serve, swagger.setup);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/colaboradores', colaboradoresRoutes);
app.use('/api/equipamentos', equipamentosRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/movimentacoes', movimentacoesRoutes);
app.use('/api/solicitacoes', solicitacoesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/investimentos', investimentosRoutes);
app.use('/api/settings', settingsRoutes);

app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
console.log(`[SYS] NODE_ENV: ${process.env.NODE_ENV}`);

const server = http.createServer(app);
socketLib.init(server);

server.listen(port, () => {
  console.log(`API e WebSockets rodando na porta ${port}`);
});

// Trigger Restart for .env
