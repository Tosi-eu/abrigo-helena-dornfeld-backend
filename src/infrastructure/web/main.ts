import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import { join } from 'path';
import routes from './routes/index.routes';
import { sequelize } from '../database/sequelize';
import '../database/models/index.models';
import { setupAssociations } from '../database/models/associations.models';
import { errorHandler } from '../../middleware/error-handler.middleware';
import { sanitizeInput } from '../../middleware/sanitize.middleware';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

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
    'Origin, X-Requested-With, Content-Type, Accept, Authorization',
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 1000,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => req.method === 'OPTIONS',
});

app.use(limiter);

app.use('/api/v1', routes);

app.use(errorHandler);

async function runSeeders(): Promise<void> {
  return new Promise(resolve => {
    const sequelizeCliPath = join(
      process.cwd(),
      'node_modules',
      '.bin',
      'sequelize-cli',
    );

    console.log('🌱 Executando seeders...');

    const env = {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
    };

    const seedProcess = spawn('node', [sequelizeCliPath, 'db:seed:all'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env,
    });

    seedProcess.on('close', code => {
      if (code === 0) {
        console.log('✅ Seeders executados com sucesso!');
        resolve();
      } else {
        console.warn(
          `⚠️ Seeders finalizaram com código ${code} (pode ser normal se já foram executados)`,
        );
        resolve();
      }
    });

    seedProcess.on('error', error => {
      console.error('❌ Erro ao executar seeders:', error);
      resolve();
    });
  });
}

void (async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexão com o banco estabelecida.');

    setupAssociations();

    await sequelize.sync({ alter: false });
    console.log('✓ Tabelas sincronizadas.');

    // Executar seeders após sincronização
    await runSeeders();

    app.listen(port, () => {
      console.log(`🚀 Servidor rodando na porta ${port}`);
    });
  } catch (err: unknown) {
    console.error('Erro ao iniciar:', err);
    process.exit(1);
  }
})();
