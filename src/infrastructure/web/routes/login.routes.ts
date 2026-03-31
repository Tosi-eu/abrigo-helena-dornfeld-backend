import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { LoginController } from '../controllers/login.controller';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginLogRepository } from '../../database/repositories/login-log.repository';
import { SystemConfigRepository } from '../../database/repositories/system-config.repository';
import { LoginService } from '../../../core/services/login.service';
import { authMiddleware } from '../../../middleware/auth.middleware';
import {
  requireAdmin,
  blockNonAdminWrites,
} from '../../../middleware/admin.middleware';
import { auditLog } from '../../../middleware/audit.middleware';
import {
  publicTenantContextMiddleware,
  enforceTenantMiddleware,
} from '../../../middleware/tenant.middleware';
import { rlsContextMiddleware } from '../../../middleware/rls.middleware';
import {
  bindPublicTenantToRlsTransaction,
  bindRequestToRlsTransaction,
} from '../../../middleware/request-rls-transaction.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const router = Router();

const repo = new LoginRepository();
const loginLogRepo = new LoginLogRepository();
const systemConfigRepo = new SystemConfigRepository();
const service = new LoginService(repo);
const controller = new LoginController(service, loginLogRepo, systemConfigRepo);
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

router.post('/register-account', registerLimiter, (req, res) =>
  controller.createAccount(req, res),
);

router.post('/register-user', registerLimiter, (req, res) =>
  controller.registerUser(req, res),
);

router.post('/register-shelter', registerLimiter, (req, res) =>
  controller.registerShelter(req, res),
);

router.post('/join-by-token', registerLimiter, (req, res) =>
  controller.joinByToken(req, res),
);

router.post(
  '/',
  registerLimiter,
  publicTenantContextMiddleware,
  bindPublicTenantToRlsTransaction,
  (req, res) => controller.create(req, res),
);
router.get('/resolve-tenant', loginLimiter, (req, res) =>
  controller.resolveTenant(req, res),
);
router.get('/tenants-for-email', loginLimiter, (req, res) =>
  controller.tenantsForEmail(req, res),
);
router.post(
  '/authenticate',
  loginLimiter,
  publicTenantContextMiddleware,
  bindPublicTenantToRlsTransaction,
  (req, res) => controller.authenticate(req, res),
);

router.post(
  '/reset-password',
  authMiddleware,
  requireAdmin,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
  (req, res) => controller.resetPassword(req, res),
);

router.use(authMiddleware);
router.use(enforceTenantMiddleware);
router.use(rlsContextMiddleware);
router.use(bindRequestToRlsTransaction);

router.post('/logout', (req, res) => controller.logout(req, res));
router.get('/display-config', (req, res) =>
  controller.getDisplayConfig(req, res),
);

router.use(blockNonAdminWrites);
router.use(auditLog);

router.get('/usuario-logado', (req, res) =>
  controller.getCurrentUser(req, res),
);

router.put('/', requireModule('profile'), (req, res) =>
  controller.update(req, res),
);
router.delete('/', requireModule('profile'), (req, res) =>
  controller.delete(req, res),
);

export default router;
