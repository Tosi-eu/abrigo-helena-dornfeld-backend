import { Router } from 'express';
import { StockRepository } from '../../database/repositories/estoque.repository';
import { StockService } from '../../../core/services/estoque.service';
import { StockController } from '../controllers/estoque.controller';
import { cacheService } from '../../database/redis/client.redis';
import {
  validatePagination,
  validateEstoqueIdParam,
} from '../../../middleware/validation.middleware';

const repo = new StockRepository();
const service = new StockService(repo, cacheService);
const controller = new StockController(service);

const router = Router();

router.post('/entrada', (req, res) => controller.stockIn(req, res));
router.post('/saida', (req, res) => controller.stockOut(req, res));
router.get('/', validatePagination, (req, res) => controller.list(req, res));
router.get('/proporcao', (req, res) => controller.proportion(req, res));
router.patch(
  '/medicamento/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  (req, res) => controller.removeIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/suspender',
  validateEstoqueIdParam,
  (req, res) => controller.suspendIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/retomar',
  validateEstoqueIdParam,
  (req, res) => controller.resumeIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  (req, res) => controller.transferMedicineSector(req, res),
);
router.patch(
  '/insumo/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  (req, res) => controller.removeIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/suspender',
  validateEstoqueIdParam,
  (req, res) => controller.suspendIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/retomar',
  validateEstoqueIdParam,
  (req, res) => controller.resumeIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  (req, res) => controller.transferInputSector(req, res),
);
router.put('/:estoque_id', validateEstoqueIdParam, (req, res) =>
  controller.updateStockItem(req, res),
);
router.delete('/:tipo/:estoque_id', validateEstoqueIdParam, (req, res) =>
  controller.deleteStockItem(req, res),
);

export default router;
