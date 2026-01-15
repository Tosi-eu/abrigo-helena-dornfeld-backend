import { Router } from 'express';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import { MedicineService } from '../../../core/services/medicamento.service';
import { MedicineController } from '../controllers/medicamento.controller';
import { cacheService } from '../../database/redis/client.redis';
import { PriceSearchService } from '../../../core/services/price-search.service';
import { InputRepository } from '../../database/repositories/insumo.repository';
import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';

const repo = new MedicineRepository();
const inputRepo = new InputRepository();
const priceSearchService = new PriceSearchService(cacheService, repo, inputRepo);
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
