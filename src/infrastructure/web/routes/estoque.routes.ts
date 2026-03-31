import { Router } from 'express';
import { StockRepository } from '../../database/repositories/estoque.repository';
import { StockService } from '../../../core/services/estoque.service';
import { StockController } from '../controllers/estoque.controller';
import { cacheService } from '../../database/redis/client.redis';
import { NotificationEventRepository } from '../../database/repositories/notificacao.repository';
import {
  validatePagination,
  validateEstoqueIdParam,
} from '../../../middleware/validation.middleware';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new StockRepository();
const notificationRepo = new NotificationEventRepository();
const service = new StockService(repo, cacheService, notificationRepo);
const controller = new StockController(service);

const router = Router();

router.post('/entrada', requireModule('stock'), (req, res) =>
  controller.stockIn(req, res),
);
router.post('/saida', requireModule('stock'), (req, res) =>
  controller.stockOut(req, res),
);
router.get('/', validatePagination, requireModule('stock'), (req, res) =>
  controller.list(req, res),
);
router.get('/filter-options', requireModule('stock'), (req, res) =>
  controller.getFilterOptions(req, res),
);
router.get('/proporcao', requireModule('stock'), (req, res) =>
  controller.proportion(req, res),
);
router.get('/medicamento/dias-para-repor', requireModule('stock'), (req, res) =>
  controller.getDaysForReplacementForNursing(req, res),
);
router.patch(
  '/medicamento/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.removeIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/suspender',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.suspendIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/retomar',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.resumeIndividualMedicine(req, res),
);
router.patch(
  '/medicamento/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.transferMedicineSector(req, res),
);
router.patch(
  '/insumo/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.removeIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/suspender',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.suspendIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/retomar',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.resumeIndividualInput(req, res),
);
router.patch(
  '/insumo/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.transferInputSector(req, res),
);
router.put(
  '/:estoque_id',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.updateStockItem(req, res),
);
router.delete(
  '/:tipo/:estoque_id',
  validateEstoqueIdParam,
  requireModule('stock'),
  (req, res) => controller.deleteStockItem(req, res),
);

export default router;
