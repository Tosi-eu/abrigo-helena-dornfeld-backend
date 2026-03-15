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
import { withRls } from '../../../middleware/rls.middleware';
import { sequelize } from '../../database/sequelize';

const repo = new StockRepository();
const notificationRepo = new NotificationEventRepository();
const service = new StockService(repo, cacheService, notificationRepo);
const controller = new StockController(service);

const router = Router();

router.post(
  '/entrada',
  withRls(sequelize, (req, res) => controller.stockIn(req, res)),
);
router.post(
  '/saida',
  withRls(sequelize, (req, res) => controller.stockOut(req, res)),
);
router.get(
  '/',
  validatePagination,
  withRls(sequelize, (req, res) => controller.list(req, res)),
);
router.get(
  '/filter-options',
  withRls(sequelize, (req, res) => controller.getFilterOptions(req, res)),
);
router.get(
  '/proporcao',
  withRls(sequelize, (req, res) => controller.proportion(req, res)),
);
router.get(
  '/medicamento/dias-para-repor',
  withRls(sequelize, (req, res) =>
    controller.getDaysForReplacementForNursing(req, res),
  ),
);
router.patch(
  '/medicamento/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) =>
    controller.removeIndividualMedicine(req, res),
  ),
);
router.patch(
  '/medicamento/:estoque_id/suspender',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) =>
    controller.suspendIndividualMedicine(req, res),
  ),
);
router.patch(
  '/medicamento/:estoque_id/retomar',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) =>
    controller.resumeIndividualMedicine(req, res),
  ),
);
router.patch(
  '/medicamento/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.transferMedicineSector(req, res)),
);
router.patch(
  '/insumo/:estoque_id/remover-individual',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.removeIndividualInput(req, res)),
);
router.patch(
  '/insumo/:estoque_id/suspender',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.suspendIndividualInput(req, res)),
);
router.patch(
  '/insumo/:estoque_id/retomar',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.resumeIndividualInput(req, res)),
);
router.patch(
  '/insumo/:estoque_id/transferir-setor',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.transferInputSector(req, res)),
);
router.put(
  '/:estoque_id',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.updateStockItem(req, res)),
);
router.delete(
  '/:tipo/:estoque_id',
  validateEstoqueIdParam,
  withRls(sequelize, (req, res) => controller.deleteStockItem(req, res)),
);

export default router;
