import { Router } from 'express';
import { NotificationEventService } from '../../../core/services/notificacao.service';
import { NotificationEventController } from '../controllers/notificacao.controller';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';

const repo = new NotificationEventRepository();
const service = new NotificationEventService(repo);
const controller = new NotificationEventController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', validatePagination, (req, res) => controller.getAll(req, res));
router.get('/:id', validateIdParam, (req, res) => controller.getById(req, res));
router.patch('/:id', validateIdParam, (req, res) =>
  controller.update(req, res),
);
router.delete('/:id', validateIdParam, (req, res) =>
  controller.delete(req, res),
);

export default router;
