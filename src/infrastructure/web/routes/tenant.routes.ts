import { Router } from 'express';
import multer from 'multer';
import { TenantController } from '../controllers/tenant.controller';
import { TenantInviteController } from '../controllers/tenant-invite.controller';

const router = Router();
const controller = new TenantController();
const inviteController = new TenantInviteController();

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

router.get('/config', (req, res) => controller.getConfig(req, res));
router.post('/invites', (req, res) => inviteController.create(req, res));
router.post('/contract-code', (req, res) =>
  controller.setContractCode(req, res),
);
router.put('/config', (req, res) => controller.updateConfig(req, res));
router.put('/branding', (req, res) => controller.updateBranding(req, res));
router.post('/branding/logo', logoUpload.single('file'), (req, res) =>
  controller.uploadLogo(req, res),
);

export default router;
