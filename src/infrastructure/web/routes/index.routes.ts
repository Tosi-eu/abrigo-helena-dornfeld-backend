import { Router } from "express";

import cabinetRoutes from "./armario.routes";
import medicineRoutes from "./medicamento.routes";
import inputRoutes from "./insumo.routes";
import loginRoutes from "./login.routes";
import stockRoutes from "./estoque.routes";
import movementRoutes from "./movimentacao.routes";
import reportRoutes from "./relatorio.routes";
import residentRoutes from "./residente.routes";
import cabinetCategoryRoutes from "./categoria-armario.routes"
import notificationRoutes from "./notification-event.routes"
    
const router = Router();

router.use("/armarios", cabinetRoutes); 
router.use("/medicamentos", medicineRoutes); 
router.use("/insumos", inputRoutes); 
router.use("/login", loginRoutes); 
router.use("/estoque", stockRoutes); 
router.use("/movimentacoes", movementRoutes); 
router.use("/relatorios", reportRoutes); 
router.use("/residentes", residentRoutes); 
router.use("/categoria-armario", cabinetCategoryRoutes); 
router.use("/notificacao", notificationRoutes); 

export default router;
