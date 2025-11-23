import { Router } from "express";
import { RelatorioRepository } from "../../database/repositories/relatorio.repository";
import { RelatorioService } from "../../../core/services/relatorio.service";
import { RelatorioController } from "../controllers/relatorio.controller";

const router = Router();

const repo = new RelatorioRepository();
const service = new RelatorioService(repo);
const controller = new RelatorioController(service);

router.get("/", (req, res) => controller.gerar(req, res));

export default router;
