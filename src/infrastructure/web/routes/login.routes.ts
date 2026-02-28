import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { LoginController } from '../controllers/login.controller';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';
import { authMiddleware } from '../../../middleware/auth.middleware';
import {
  requireAdmin,
  blockNonAdminWrites,
} from '../../../middleware/admin.middleware';
import { auditLog } from '../../../middleware/audit.middleware';

const router = Router();

const repo = new LoginRepository();
const service = new LoginService(repo);
const controller = new LoginController(service);
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 2,
  message: {
    error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', registerLimiter, (req, res) => controller.create(req, res));
router.post('/authenticate', loginLimiter, (req, res) =>
  controller.authenticate(req, res),
);

router.post('/reset-password', authMiddleware, requireAdmin, (req, res) =>
  controller.resetPassword(req, res),
);

router.use(authMiddleware);
router.use(blockNonAdminWrites);
router.use(auditLog);

router.get('/usuario-logado', (req, res) =>
  controller.getCurrentUser(req, res),
);

router.put('/', (req, res) => controller.update(req, res));
router.delete('/', (req, res) => controller.delete(req, res));

router.post('/logout', (req, res) => controller.logout(req, res));

export default router;
