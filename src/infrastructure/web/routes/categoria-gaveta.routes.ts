import { Router } from 'express';
import { DrawerCategoryRepository } from '../../database/repositories/categoria-gaveta.repository';
import { DrawerCategoryService } from '../../../core/services/categoria-gaveta.service';
import { DrawerCategoryController } from '../controllers/categoria-gaveta.controller';

const repo = new DrawerCategoryRepository();
const service = new DrawerCategoryService(repo);
const controller = new DrawerCategoryController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:id', (req, res) => controller.getById(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

export default router;
