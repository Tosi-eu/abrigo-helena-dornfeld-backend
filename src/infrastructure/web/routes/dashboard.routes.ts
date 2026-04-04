import { Router } from 'express';
import { StockRepository } from '../../database/repositories/estoque.repository';
import { StockService } from '../../../core/services/estoque.service';
import { MovementRepository } from '../../database/repositories/movimentacao.repository';
import { MovementService } from '../../../core/services/movimentacao.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { DashboardController } from '../controllers/dashboard.controller';
import { cacheService } from '../../database/redis/client.redis';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import { requireModule } from '../../../middleware/module.middleware';
const stockRepo = new StockRepository();
const notificationRepo = new NotificationEventRepository();
const stockService = new StockService(
  stockRepo,
  cacheService,
  notificationRepo,
);
const movementRepo = new MovementRepository();
const movementService = new MovementService(movementRepo, cacheService);
const dashboardService = new DashboardService(
  stockService,
  movementService,
  cacheService,
);
const controller = new DashboardController(dashboardService);

const router = Router();

router.get('/summary', requireModule('dashboard'), (req, res) =>
  controller.getSummary(req, res),
);

router.get('/expiring-items', requireModule('dashboard'), (req, res) =>
  controller.getExpiringItems(req, res),
);

export default router;
