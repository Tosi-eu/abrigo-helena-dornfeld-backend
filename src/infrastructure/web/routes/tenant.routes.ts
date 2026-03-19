import { Router } from 'express';
import { TenantController } from '../controllers/tenant.controller';

const router = Router();
const controller = new TenantController();

router.get('/config', (req, res) => controller.getConfig(req, res));
router.put('/config', (req, res) => controller.updateConfig(req, res));
router.put('/branding', (req, res) => controller.updateBranding(req, res));

export default router;
