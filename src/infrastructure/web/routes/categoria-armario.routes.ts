import { Router } from 'express';
import { CabinetCategoryRepository } from '../../database/repositories/categoria-armario.repository';
import { CabinetCategoryService } from '../../../core/services/categoria-armario.service';
import { CabinetCategoryController } from '../controllers/categoria-armario.controller';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new CabinetCategoryRepository();
const service = new CabinetCategoryService(repo);
const controller = new CabinetCategoryController(service);

const router = Router();

router.post('/', requireModule('cabinets'), (req, res) =>
  controller.create(req, res),
);
router.get('/', requireModule('cabinets'), (req, res) =>
  controller.getAll(req, res),
);
router.get('/:id', requireModule('cabinets'), (req, res) =>
  controller.getById(req, res),
);
router.put('/:id', requireModule('cabinets'), (req, res) =>
  controller.update(req, res),
);
router.delete('/:id', requireModule('cabinets'), (req, res) =>
  controller.delete(req, res),
);

export default router;
