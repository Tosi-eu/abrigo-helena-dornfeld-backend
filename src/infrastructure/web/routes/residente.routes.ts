import { Router } from "express";
import { ResidentRepository } from "../../database/repositories/residente.repository";
import { ResidentService } from "../../../core/services/residente.service";
import { ResidentController } from "../controllers/residente.controller";

const repo = new ResidentRepository();
const service = new ResidentService(repo);
const controller = new ResidentController(service);

const router = Router();

router.get("/", (req, res) => controller.findAll(req, res));
router.get("/:casela", (req, res) => controller.findByCasela(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.put("/:casela", (req, res) => controller.update(req, res));
router.delete("/:casela", (req, res) => controller.delete(req, res));

export default router;