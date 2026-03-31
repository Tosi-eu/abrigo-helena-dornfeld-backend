import { Router } from 'express';
import { DrawerCategoryRepository } from '../../database/repositories/categoria-gaveta.repository';
import { DrawerCategoryService } from '../../../core/services/categoria-gaveta.service';
import { DrawerCategoryController } from '../controllers/categoria-gaveta.controller';
import { requireModule } from '../../../middleware/module.middleware';

const repo = new DrawerCategoryRepository();
const service = new DrawerCategoryService(repo);
const controller = new DrawerCategoryController(service);

const router = Router();

router.post('/', requireModule('drawers'), (req, res) =>
  controller.create(req, res),
);
router.get('/', requireModule('drawers'), (req, res) =>
  controller.getAll(req, res),
);
router.get('/:id', requireModule('drawers'), (req, res) =>
  controller.getById(req, res),
);
router.put('/:id', requireModule('drawers'), (req, res) =>
  controller.update(req, res),
);
router.delete('/:id', requireModule('drawers'), (req, res) =>
  controller.delete(req, res),
);

export default router;
