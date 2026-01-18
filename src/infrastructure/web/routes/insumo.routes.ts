import { Router } from 'express';
import { InputRepository } from '../../database/repositories/insumo.repository';
import { InputService } from '../../../core/services/insumo.service';
import { InsumoController } from '../controllers/insumo.controller';
import { cacheService } from '../../database/redis/client.redis';
import { PriceSearchService } from '../../../core/services/price-search.service';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';

const repo = new InputRepository();
const medicineRepo = new MedicineRepository();
const priceSearchService = new PriceSearchService(
  cacheService,
  medicineRepo,
  repo,
);
const service = new InputService(repo, priceSearchService);
const controller = new InsumoController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', validatePagination, (req, res) => controller.list(req, res));
router.put('/:id', validateIdParam, (req, res) => controller.update(req, res));
router.delete('/:id', validateIdParam, (req, res) =>
  controller.delete(req, res),
);

export default router;
