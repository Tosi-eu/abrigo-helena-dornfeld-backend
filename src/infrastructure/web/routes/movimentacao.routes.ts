import { Router } from "express";
import { MovimentacaoRepository } from "../../database/repositories/movimentacao.repository";
import { MovimentacaoService } from "../../../core/services/movimentacao.service";
import { MovimentacaoController } from "../controllers/movimentacao.controller";

const   router = Router();

const repo = new MovimentacaoRepository();
const service = new MovimentacaoService(repo);
const controller = new MovimentacaoController(service);

router.get("/medicamentos", controller.getMedicamentos.bind(controller));
router.get("/insumos", controller.getInsumos.bind(controller));
router.post("/", controller.create.bind(controller));

export default router;
