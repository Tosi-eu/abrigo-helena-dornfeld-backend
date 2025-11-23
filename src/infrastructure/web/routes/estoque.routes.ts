import { Router } from "express";
import { EstoqueRepository } from "../../database/repositories/estoque.repository";
import { EstoqueService } from "../../../core/services/estoque.service";
import { EstoqueController } from "../controllers/estoque.controller";

const repo = new EstoqueRepository();
const service = new EstoqueService(repo);
const controller = new EstoqueController(service);

const router = Router();

router.post("/entrada", (req, res) => controller.entrada(req, res));
router.post("/saida", (req, res) => controller.saida(req, res));
router.get("/", (req, res) => controller.listar(req, res));
router.get("/proporcao", (req, res) => controller.proporcao(req, res));

export default router;
