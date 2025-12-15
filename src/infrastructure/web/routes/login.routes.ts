import { Router } from 'express';

import { LoginController } from '../controllers/login.controller';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';

const router = Router();

const repo = new LoginRepository();
const service = new LoginService(repo);
const controller = new LoginController(service);

router.post('/', (req, res) => controller.create(req, res));
router.post('/authenticate', (req, res) => controller.authenticate(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

router.post('/reset-password', (req, res) =>
  controller.resetPassword(req, res),
);

export default router;
