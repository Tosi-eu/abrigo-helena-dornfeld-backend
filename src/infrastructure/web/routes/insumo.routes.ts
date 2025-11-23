import { Router } from "express";
import { InsumoRepository } from "../../database/repositories/insumo.repository";
import { InsumoService } from "../../../core/services/insumo.service";
import { InsumoController } from "../controllers/insumo.controller";

const repo = new InsumoRepository();
const service = new InsumoService(repo);
const controller = new InsumoController(service);

const router = Router();

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.getAll(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;
