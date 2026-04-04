import { Router } from 'express';
import { ResidentRepository } from '../../database/repositories/residente.repository';
import { ResidentService } from '../../../core/services/residente.service';
import { ResidentController } from '../controllers/residente.controller';
import {
  validatePagination,
  validateCaselaParam,
} from '../../../middleware/validation.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new ResidentRepository();
const service = new ResidentService(repo);
const controller = new ResidentController(service);

const router = Router();

router.get('/', validatePagination, requireModule('residents'), (req, res) =>
  controller.findAll(req, res),
);
router.get('/count', requireModule('residents'), (req, res) =>
  controller.getCount(req, res),
);
router.get('/:casela', validateCaselaParam, requireModule('residents'), (req, res) =>
  controller.findByCasela(req, res),
);
router.post('/', requireModule('residents'), (req, res) =>
  controller.create(req, res),
);
router.put(
  '/:casela',
  validateCaselaParam,
  requireModule('residents'),
  (req, res) => controller.update(req, res),
);
router.delete(
  '/:casela',
  validateCaselaParam,
  requireModule('residents'),
  (req, res) => controller.delete(req, res),
);

export default router;
