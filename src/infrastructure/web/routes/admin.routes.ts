import { Router } from 'express';
import { LoginRepository } from '../../database/repositories/login.repository';
import { LoginService } from '../../../core/services/login.service';
import { AuditRepository } from '../../database/repositories/audit.repository';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../../../middleware/admin.middleware';

const router = Router();
const loginRepo = new LoginRepository();
const loginService = new LoginService(loginRepo);
const auditRepo = new AuditRepository();
const controller = new AdminController(loginService, auditRepo);

router.use(requireAdmin);

router.get('/users', (req, res) => controller.listUsers(req, res));
router.put('/users/:id', (req, res) => controller.updateUser(req, res));
router.delete('/users/:id', (req, res) => controller.deleteUser(req, res));
router.get('/insights', (req, res) => controller.getInsights(req, res));

export default router;
