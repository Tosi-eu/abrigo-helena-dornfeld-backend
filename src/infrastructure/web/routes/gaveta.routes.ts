import { Router } from 'express';
import { DrawerRepository } from '../../database/repositories/gaveta.repository';
import { DrawerService } from '../../../core/services/gaveta.service';
import { DrawerController } from '../controllers/gaveta.controller';
import {
  validatePagination,
  validateNumeroParam,
} from '../../../middleware/validation.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new DrawerRepository();
const service = new DrawerService(repo);
const controller = new DrawerController(service);

const router = Router();

router.post('/', requireModule('drawers'), (req, res) =>
  controller.create(req, res),
);
router.get(
  '/',
  validatePagination,
  requireModule('drawers'),
  (req, res) => controller.getAll(req, res),
);
router.get('/count', requireModule('drawers'), (req, res) =>
  controller.getCount(req, res),
);
router.get(
  '/:numero',
  validateNumeroParam,
  requireModule('drawers'),
  (req, res) => controller.getById(req, res),
);
router.put(
  '/:numero',
  validateNumeroParam,
  requireModule('drawers'),
  (req, res) => controller.update(req, res),
);
router.delete(
  '/:numero',
  validateNumeroParam,
  requireModule('drawers'),
  (req, res) => controller.delete(req, res),
);

export default router;
