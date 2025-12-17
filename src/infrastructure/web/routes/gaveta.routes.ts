import { Router } from 'express';
import { DrawerRepository } from '../../database/repositories/gaveta.repository';
import { DrawerService } from '../../../core/services/gaveta.service';
import { DrawerController } from '../controllers/gaveta.controller';

const repo = new DrawerRepository();
const service = new DrawerService(repo);
const controller = new DrawerController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.getAll(req, res));
router.get('/:numero', (req, res) => controller.getById(req, res));
router.put('/:numero', (req, res) => controller.update(req, res));
router.delete('/:numero', (req, res) => controller.delete(req, res));

export default router;
