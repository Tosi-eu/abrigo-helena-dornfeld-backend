import { Router } from 'express';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import { MedicineService } from '../../../core/services/medicamento.service';
import { MedicineController } from '../controllers/medicamento.controller';

import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';
import { priceSearchService } from '../../helpers/price-service.helper';

const repo = new MedicineRepository();

const service = new MedicineService(repo, priceSearchService);
const controller = new MedicineController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', validatePagination, (req, res) => controller.getAll(req, res));
router.put('/:id', validateIdParam, (req, res) => controller.update(req, res));
router.delete('/:id', validateIdParam, (req, res) =>
  controller.delete(req, res),
);

export default router;
