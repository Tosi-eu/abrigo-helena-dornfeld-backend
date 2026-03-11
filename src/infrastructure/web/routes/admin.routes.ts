import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginLogRepository } from '../../database/repositories/login-log.repository';
import { ReportRepository } from '../../database/repositories/relatorio.repository';
import { SystemConfigRepository } from '../../database/repositories/system-config.repository';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import { LoginService } from '../../../core/services/login.service';
import { ReportService } from '../../../core/services/relatorio.service';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { MovementRepository } from '../../database/repositories/movimentacao.repository';
import { MovementService } from '../../../core/services/movimentacao.service';
import { AuditRepository } from '../../database/repositories/audit.repository';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../../../middleware/admin.middleware';
import { cacheService } from '../../database/redis/client.redis';

const router = Router();
const loginRepo = new LoginRepository();
const loginLogRepo = new LoginLogRepository();
const reportRepo = new ReportRepository();
const systemConfigRepo = new SystemConfigRepository();
const notificationRepo = new NotificationEventRepository();
const loginService = new LoginService(loginRepo);
const reportService = new ReportService(reportRepo);
const notificationService = new NotificationEventService(notificationRepo);
const auditRepo = new AuditRepository();
const movementRepo = new MovementRepository();
const movementService = new MovementService(movementRepo, cacheService);
const controller = new AdminController(
  loginService,
  auditRepo,
  movementService,
  loginLogRepo,
  reportService,
  systemConfigRepo,
  notificationService,
);

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  message: {
    error: 'Muitas requisições no painel admin. Tente novamente em breve.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(adminLimiter);
router.use(requireAdmin);

router.get('/users', (req, res) => controller.listUsers(req, res));
router.post('/users', (req, res) => controller.createUser(req, res));
router.put('/users/:id', (req, res) => controller.updateUser(req, res));
router.delete('/users/:id', (req, res) => controller.deleteUser(req, res));
router.get('/login-log', (req, res) => controller.getLoginLog(req, res));
router.get('/insights', (req, res) => controller.getInsights(req, res));
router.get('/stock-history', (req, res) =>
  controller.getStockHistory(req, res),
);
router.get('/export', (req, res) => controller.getExport(req, res));
router.get('/metrics', (req, res) => controller.getMetrics(req, res));
router.get('/metrics/active-users', (req, res) =>
  controller.getActiveUsersThisMonth(req, res),
);
router.get('/metrics/movements', (req, res) =>
  controller.getMovementsThisMonth(req, res),
);
router.get('/health', (req, res) => controller.getHealth(req, res));
router.get('/config', (req, res) => controller.getConfig(req, res));
router.put('/config', (req, res) => controller.updateConfig(req, res));
router.get('/notifications', (req, res) => controller.getNotifications(req, res));
router.patch('/notifications/:id', (req, res) => controller.patchNotification(req, res));

export default router;
