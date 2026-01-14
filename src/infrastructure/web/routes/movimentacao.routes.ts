import { Router } from 'express';
import { MovementRepository } from '../../database/repositories/movimentacao.repository';
import { MovementService } from '../../../core/services/movimentacao.service';
import { MovementController } from '../controllers/movimentacao.controller';
import { cacheService } from '../../database/redis/client.redis';
import { validatePagination } from '../../../middleware/validation.middleware';

const router = Router();

const repo = new MovementRepository();
const service = new MovementService(repo, cacheService);
const controller = new MovementController(service);

router.get('/produtos-parados', (req, res) =>
  controller.nonMovementMedications(req, res),
);
router.get('/medicamentos', validatePagination, (req, res) =>
  controller.getMedicines(req, res),
);
router.get('/insumos', validatePagination, (req, res) =>
  controller.getInputs(req, res),
);
router.post('/', (req, res) => controller.create(req, res));
router.get('/medicamentos/ranking', validatePagination, (req, res) =>
  controller.getMedicineRanking(req, res),
);
router.get(
  '/transferencias/farmacia-enfermaria',
  validatePagination,
  (req, res) => controller.getPharmacyToNursingTransfers(req, res),
);

export default router;
