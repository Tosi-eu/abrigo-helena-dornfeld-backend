import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';
import { MovementRepository } from '../../database/repositories/movimentacao.repository';
import { MovementService } from '../../../core/services/movimentacao.service';
import { AuditRepository } from '../../database/repositories/audit.repository';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../../../middleware/admin.middleware';
import { cacheService } from '../../database/redis/client.redis';

const router = Router();
const loginRepo = new LoginRepository();
const loginService = new LoginService(loginRepo);
const auditRepo = new AuditRepository();
const movementRepo = new MovementRepository();
const movementService = new MovementService(movementRepo, cacheService);
const controller = new AdminController(
  loginService,
  auditRepo,
  movementService,
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
router.put('/users/:id', (req, res) => controller.updateUser(req, res));
router.delete('/users/:id', (req, res) => controller.deleteUser(req, res));
router.get('/insights', (req, res) => controller.getInsights(req, res));
router.get('/stock-history', (req, res) =>
  controller.getStockHistory(req, res),
);

export default router;
