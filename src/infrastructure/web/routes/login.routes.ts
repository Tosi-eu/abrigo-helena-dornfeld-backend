import { Router } from 'express';

import { LoginController } from '../controllers/login.controller';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';
import { authMiddleware } from '../../../middleware/auth.middleware';
import { requireAdmin, blockNonAdminWrites } from '../../../middleware/admin.middleware';

const router = Router();

const repo = new LoginRepository();
const service = new LoginService(repo);
const controller = new LoginController(service);

// User creation is allowed (e.g. from sign-up screen). New accounts are always "user" (id is auto; only first user can be id 1).
router.post('/', (req, res) => controller.create(req, res));
router.post('/authenticate', (req, res) => controller.authenticate(req, res));
// Only admin can reset another user's password
router.post('/reset-password', authMiddleware, requireAdmin, (req, res) =>
  controller.resetPassword(req, res),
);

router.use(authMiddleware);
router.use(blockNonAdminWrites);

router.get('/usuario-logado', (req, res) =>
  controller.getCurrentUser(req, res),
);

router.put('/', (req, res) => controller.update(req, res));
router.delete('/', (req, res) => controller.delete(req, res));

router.post('/logout', (req, res) => controller.logout(req, res));

export default router;
