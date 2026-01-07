import { Router } from 'express';

import { LoginController } from '../controllers/login.controller';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';
import { authMiddleware } from '../../../middleware/auth.middleware';

const router = Router();

const repo = new LoginRepository();
const service = new LoginService(repo);
const controller = new LoginController(service);

router.post('/', (req, res) => controller.create(req, res));
router.post('/authenticate', (req, res) => controller.authenticate(req, res));
router.post('/reset-password', (req, res) =>
  controller.resetPassword(req, res),
);

router.use(authMiddleware);

router.put('/', (req, res) => controller.update(req, res));
router.delete('/', (req, res) => controller.delete(req, res));

router.post('/logout', (req, res) => controller.logout(req, res));

export default router;
