import { Router } from 'express';
import { StockRepository } from '../../database/repositories/estoque.repository';
import { StockService } from '../../../core/services/estoque.service';
import { StockController } from '../controllers/estoque.controller';

const repo = new StockRepository();
const service = new StockService(repo);
const controller = new StockController(service);

const router = Router();

router.post('/entrada', (req, res) => controller.stockIn(req, res));
router.post('/saida', (req, res) => controller.stockOut(req, res));
router.get('/', (req, res) => controller.list(req, res));
router.get('/proporcao', (req, res) => controller.proportion(req, res));
router.patch('/medicamento/:estoque_id/remover-individual', (req, res) =>
  controller.removeIndividualMedicine(req, res),
);
router.patch('/medicamento/:estoque_id/suspender', (req, res) =>
  controller.suspendIndividualMedicine(req, res),
);
router.patch('/medicamento/:estoqueId/retomar', (req, res) =>
  controller.resumeIndividualMedicine(req, res),
);
router.delete('/:tipo/:estoque_id', (req, res) =>
  controller.deleteStockItem(req, res),
);

export default router;
