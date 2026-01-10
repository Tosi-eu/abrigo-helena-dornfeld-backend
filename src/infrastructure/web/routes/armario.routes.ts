import { Router } from 'express';
import { CabinetRepository } from '../../database/repositories/armario.repository';
import { CabinetService } from '../../../core/services/armario.service';
import { CabinetController } from '../controllers/armario.controller';
import {
  validatePagination,
  validateNumeroParam,
} from '../../../middleware/validation.middleware';

const repo = new CabinetRepository();
const service = new CabinetService(repo);
const controller = new CabinetController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', validatePagination, (req, res) => controller.getAll(req, res));
router.put('/:numero', validateNumeroParam, (req, res) =>
  controller.update(req, res),
);
router.delete('/:numero', validateNumeroParam, (req, res) =>
  controller.delete(req, res),
);

export default router;
