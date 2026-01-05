import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import routes from './routes/index.routes';
import { sequelize } from '../database/sequelize';
import { setupAssociations } from '../database/models/associations.models';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

// Request size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/login', authLimiter);
app.use(limiter);

// CORS configuration
if (!process.env.ALLOWED_ORIGINS) {
  throw new Error(
    'ALLOWED_ORIGINS environment variable is required. Please set it in your .env file.',
  );
}

const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin =>
  origin.trim(),
);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Set CORS headers
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }

  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.use('/api', routes);

void (async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexão com o banco estabelecida.');

    setupAssociations();

    await sequelize.sync({ alter: false });
    console.log('✓ Tabelas sincronizadas.');

    app.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
    });
  } catch (err) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
})();
