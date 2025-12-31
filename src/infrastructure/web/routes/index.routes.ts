import { Router } from 'express';

import cabinetRoutes from './armario.routes';
import drawerRoutes from './gaveta.routes';
import medicineRoutes from './medicamento.routes';
import inputRoutes from './insumo.routes';
import loginRoutes from './login.routes';
import stockRoutes from './estoque.routes';
import movementRoutes from './movimentacao.routes';
import reportRoutes from './relatorio.routes';
import residentRoutes from './residente.routes';
import cabinetCategoryRoutes from './categoria-armario.routes';
import drawerCategoryRoutes from './categoria-gaveta.routes';
import notificationRoutes from './notificacao.routes';
import appRoutes from './app.routes';
import { authMiddleware } from '../../../middleware/auth.middleware';

const router = Router();

router.use('/login', loginRoutes);
router.use('/', appRoutes);

router.use(authMiddleware);

router.use('/gavetas', drawerRoutes);
router.use('/armarios', cabinetRoutes);
router.use('/medicamentos', medicineRoutes);
router.use('/insumos', inputRoutes);
router.use('/estoque', stockRoutes);
router.use('/movimentacoes', movementRoutes);
router.use('/relatorios', reportRoutes);
router.use('/residentes', residentRoutes);
router.use('/categoria-armario', cabinetCategoryRoutes);
router.use('/categoria-gaveta', drawerCategoryRoutes);
router.use('/notificacao', notificationRoutes);

export default router;
