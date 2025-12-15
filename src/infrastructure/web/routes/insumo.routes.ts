import { Router } from 'express';
import { InputRepository } from '../../database/repositories/insumo.repository';
import { InputService } from '../../../core/services/insumo.service';
import { InsumoController } from '../controllers/insumo.controller';

const repo = new InputRepository();
const service = new InputService(repo);
const controller = new InsumoController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', (req, res) => controller.list(req, res));
router.put('/:id', (req, res) => controller.update(req, res));
router.delete('/:id', (req, res) => controller.delete(req, res));

export default router;
