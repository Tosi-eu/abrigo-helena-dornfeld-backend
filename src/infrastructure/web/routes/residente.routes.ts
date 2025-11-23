import { Router } from "express";

import { ResidenteRepository } from "../../database/repositories/residente.repository";
import { ResidenteService } from "../../../core/services/residente.service";
import { ResidenteController } from "../controllers/residente.controller";

const repo = new ResidenteRepository();
const service = new ResidenteService(repo);
const controller = new ResidenteController(service);

const router = Router();

router.get("/", (req, res) => controller.findAll(req, res));
router.get("/:casela", (req, res) => controller.findByCasela(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:casela", (req, res) => controller.update(req, res));
router.delete("/:casela", (req, res) => controller.delete(req, res));

export default router;