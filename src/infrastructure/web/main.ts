import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import routes from './routes/index.routes';
import { sequelize } from '../database/sequelize';
import { getRedisClient } from '../database/redis/client.redis';
import '../database/models/index.models';
import { setupAssociations } from '../database/models/associations.models';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { sanitizeInput } from '../../middleware/sanitize.middleware';
import { logger } from '../helpers/logger.helper';
import { startNotificationBootstrapJob } from './jobs/reposicao-estoque.job';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.set('trust proxy', 1);

let lastHealthCheckAt = 0;
let lastHealthHttpStatus = 503;
let lastHealthBody: Record<string, unknown> | null = null;
const healthCacheTtlMs = Number(process.env.HEALTHCHECK_CACHE_TTL_MS) || 10_000;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

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
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key',
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

app.get('/api/v1/health', async (_req, res) => {
  const now = Date.now();
  if (lastHealthBody && now - lastHealthCheckAt < healthCacheTtlMs) {
    return res.status(lastHealthHttpStatus).json(lastHealthBody);
  }

  try {
    await sequelize.authenticate();
    const redis = getRedisClient();
    const redisOk = redis ? (await redis.ping()) === 'PONG' : false;
    lastHealthHttpStatus = 200;
    lastHealthBody = {
      status: 'ok',
      database: 'connected',
      redis: redisOk ? 'connected' : 'unavailable',
    };
    lastHealthCheckAt = now;
    res.status(200).json(lastHealthBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    lastHealthHttpStatus = 503;
    lastHealthBody = {
      status: 'unhealthy',
      database: 'error',
      error: message,
    };
    lastHealthCheckAt = now;
    res.status(503).json(lastHealthBody);
  }
});

const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
  keyGenerator: req => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return ip;
  },
});

app.use(limiter);

app.use('/api/v1', routes);

app.use(errorHandler);

void (async () => {
  try {
    await sequelize.authenticate();
    logger.info('Conexão com o banco estabelecida', {
      operation: 'database',
      status: 'connected',
    });

    setupAssociations();

    await sequelize.sync({ alter: false });
    logger.info('Tabelas sincronizadas', {
      operation: 'database',
      status: 'synced',
    });

    if (process.env.ENABLE_CRON === 'true') {
      startNotificationBootstrapJob();
    }

    app.listen(port, '0.0.0.0', () => {
      logger.info('Servidor iniciado', {
        operation: 'server',
        port,
        host: '0.0.0.0',
        status: 'running',
      });
    });
  } catch (err: unknown) {
    logger.error(
      'Erro ao iniciar servidor',
      { operation: 'server' },
      err as Error,
    );
    process.exit(1);
  }
})();
