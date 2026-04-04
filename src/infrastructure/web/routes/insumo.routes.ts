import { Router } from 'express';
import { InputRepository } from '../../database/repositories/insumo.repository';
import { InputService } from '../../../core/services/insumo.service';
import { InsumoController } from '../controllers/insumo.controller';

import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';
import { priceSearchService } from '../../helpers/price-service.helper';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { TenantConfigService } from '../../../core/services/tenant-config.service';

const repo = new InputRepository();
const tenantConfigService = new TenantConfigService(
  new TenantConfigRepository(),
);

const service = new InputService(repo, priceSearchService, tenantConfigService);
const controller = new InsumoController(service);

const router = Router();

router.post('/', (req, res) => controller.create(req, res));
router.get('/', validatePagination, (req, res) => controller.list(req, res));
router.put('/:id', validateIdParam, (req, res) => controller.update(req, res));
router.delete('/:id', validateIdParam, (req, res) =>
  controller.delete(req, res),
);

export default router;
