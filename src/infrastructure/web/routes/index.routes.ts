import { Router } from "express";

import armarioRoutes from "./armario.routes";
import medicamentoRoutes from "./medicamento.routes";
import insumoRoutes from "./insumo.routes";
import loginRoutes from "./login.routes";
import estoqueRoutes from "./estoque.routes";
import movimentacaoRoutes from "./movimentacao.routes";
import relatorioRoutes from "./relatorio.routes";
import residenteRoutes from "./residente.routes";

const router = Router();

router.use("/armarios", armarioRoutes); //check
router.use("/medicamentos", medicamentoRoutes); //check
router.use("/insumos", insumoRoutes); //check
router.use("/login", loginRoutes); //check
router.use("/estoque", estoqueRoutes); //check
router.use("/movimentacoes", movimentacaoRoutes); //check
router.use("/relatorios", relatorioRoutes); //check
router.use("/residentes", residenteRoutes); //check

export default router;
