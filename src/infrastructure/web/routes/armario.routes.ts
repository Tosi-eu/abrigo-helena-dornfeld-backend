import { Router } from 'express';
import { CabinetRepository } from '../../database/repositories/armario.repository';
import { CabinetService } from '../../../core/services/armario.service';
import { CabinetController } from '../controllers/armario.controller';
import {
  validatePagination,
  validateNumeroParam,
} from '../../../middleware/validation.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new CabinetRepository();
const service = new CabinetService(repo);
const controller = new CabinetController(service);

const router = Router();

router.post('/', requireModule('cabinets'), (req, res) =>
  controller.create(req, res),
);
router.get(
  '/',
  validatePagination,
  requireModule('cabinets'),
  (req, res) => controller.getAll(req, res),
);
router.get('/count', requireModule('cabinets'), (req, res) =>
  controller.getCount(req, res),
);
router.put(
  '/:numero',
  validateNumeroParam,
  requireModule('cabinets'),
  (req, res) => controller.update(req, res),
);
router.delete(
  '/:numero',
  validateNumeroParam,
  requireModule('cabinets'),
  (req, res) => controller.delete(req, res),
);

export default router;
