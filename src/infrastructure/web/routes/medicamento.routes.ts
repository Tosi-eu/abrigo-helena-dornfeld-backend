import { Router } from 'express';
import { MedicineRepository } from '../../database/repositories/medicamento.repository';
import { MedicineService } from '../../../core/services/medicamento.service';
import { MedicineController } from '../controllers/medicamento.controller';

import {
  validatePagination,
  validateIdParam,
} from '../../../middleware/validation.middleware';
import { priceSearchService } from '../../helpers/price-service.helper';
import { requireModule } from '../../../middleware/module.middleware';
import { TenantConfigRepository } from '../../database/repositories/tenant-config.repository';
import { TenantConfigService } from '../../../core/services/tenant-config.service';

const repo = new MedicineRepository();
const tenantConfigService = new TenantConfigService(
  new TenantConfigRepository(),
);

const service = new MedicineService(
  repo,
  priceSearchService,
  tenantConfigService,
);
const controller = new MedicineController(service);

const router = Router();

router.post('/', requireModule('medicines'), (req, res) =>
  controller.create(req, res),
);
router.get('/', validatePagination, requireModule('medicines'), (req, res) =>
  controller.getAll(req, res),
);
router.put('/:id', validateIdParam, requireModule('medicines'), (req, res) =>
  controller.update(req, res),
);
router.delete('/:id', validateIdParam, requireModule('medicines'), (req, res) =>
  controller.delete(req, res),
);

export default router;
