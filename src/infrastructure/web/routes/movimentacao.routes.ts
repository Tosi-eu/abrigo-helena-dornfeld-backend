import { Router } from 'express';
import { MovementRepository } from '../../database/repositories/movimentacao.repository';
import { MovementService } from '../../../core/services/movimentacao.service';
import { MovementController } from '../controllers/movimentacao.controller';
import { cacheService } from '../../database/redis/client.redis';
import { validatePagination } from '../../../middleware/validation.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const router = Router();

const repo = new MovementRepository();
const service = new MovementService(repo, cacheService);
const controller = new MovementController(service);

router.get('/produtos-parados', requireModule('movements'), (req, res) =>
  controller.nonMovementMedications(req, res),
);
router.get('/medicamentos', validatePagination, requireModule('movements'), (req, res) =>
  controller.getMedicines(req, res),
);
router.get('/insumos', validatePagination, requireModule('movements'), (req, res) =>
  controller.getInputs(req, res),
);
router.post('/', requireModule('movements'), (req, res) =>
  controller.create(req, res),
);
router.get(
  '/medicamentos/ranking',
  validatePagination,
  requireModule('movements'),
  (req, res) => controller.getMedicineRanking(req, res),
);
router.get(
  '/transferencias/farmacia-enfermaria',
  validatePagination,
  requireModule('movements'),
  (req, res) => controller.getPharmacyToNursingTransfers(req, res),
);
router.get('/consumo', requireModule('movements'), (req, res) =>
  controller.getConsumption(req, res),
);
router.get('/consumo-por-item', requireModule('movements'), (req, res) =>
  controller.getConsumptionByItem(req, res),
);

export default router;
