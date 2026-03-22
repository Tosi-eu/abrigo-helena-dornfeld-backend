import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppController } from '../controllers/app.controller';
import { AdminTenantsController } from '../controllers/admin-tenants.controller';
import { requireSuperAdminApiKey } from '../../../middleware/super-admin.middleware';

const appController = new AppController();
const tenantsController = new AdminTenantsController();
const router = Router();

/** Só para /status — não compartilhar com outras rotas públicas. */
const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many status requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/** Busca de abrigos na tela de login (pode gerar várias requisições ao digitar). */
const tenantListLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 180,
  message: 'Too many tenant search requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const tenantBrandingLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 90,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/** Verificação de código de contrato (público) — limite para reduzir brute force. */
const verifyContractCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: {
    error: 'Muitas tentativas de verificação. Aguarde alguns minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Gestão de tenants: só operador do sistema (header X-API-Key = X_API_KEY no .env). Sem JWT. */
const systemTenantsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    error: 'Muitas requisições. Tente novamente em breve.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/status', statusLimiter, (req, res) =>
  appController.getStatus(req, res),
);

router.get(
  '/tenants/:slug/branding',
  tenantBrandingLimiter,
  (req, res) => appController.getTenantPublicBranding(req, res),
);

router.post(
  '/tenants/:slug/verify-contract-code',
  verifyContractCodeLimiter,
  (req, res) => appController.verifyTenantContractCode(req, res),
);

router.get('/tenants', tenantListLimiter, (req, res) =>
  appController.listTenants(req, res),
);

router.get(
  '/admin/tenants',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.listTenants(req, res),
);
router.post(
  '/admin/tenants',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.createTenant(req, res),
);
router.put(
  '/admin/tenants/by-slug/:slug/contract-code',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.setContractCodeBySlug(req, res),
);
router.put(
  '/admin/tenants/:id',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.updateTenant(req, res),
);
router.delete(
  '/admin/tenants/:id',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.deleteTenant(req, res),
);
router.get(
  '/admin/tenants/:id/config',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.getTenantConfig(req, res),
);
router.put(
  '/admin/tenants/:id/config',
  systemTenantsLimiter,
  requireSuperAdminApiKey,
  (req, res) => tenantsController.setTenantConfig(req, res),
);

export default router;
