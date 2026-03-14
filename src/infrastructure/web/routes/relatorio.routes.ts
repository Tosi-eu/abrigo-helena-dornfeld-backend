import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ReportRepository } from '../../database/repositories/relatorio.repository';
import { ReportService } from '../../../core/services/relatorio.service';
import { ReportController } from '../controllers/relatorio.controller';
import { cacheService } from '../../database/redis/client.redis';

const router = Router();

const repo = new ReportRepository();
const service = new ReportService(repo, cacheService);
const controller = new ReportController(service);

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Muitos relatórios gerados. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/', reportLimiter, (req, res) => controller.generate(req, res));

export default router;
