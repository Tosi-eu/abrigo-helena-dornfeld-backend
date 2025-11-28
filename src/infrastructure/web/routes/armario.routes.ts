import { Router } from "express";
import { CabinetRepository } from "../../database/repositories/armario.repository";
import { CabinetService } from "../../../core/services/armario.service";
import { CabinetController } from "../controllers/armario.controller";

const repo = new  CabinetRepository();
const service = new CabinetService(repo);
const controller = new CabinetController(service);

const router = Router();

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.getAll(req, res));
router.put("/:numero", (req, res) => controller.update(req, res));
router.delete("/:numero", (req, res) => controller.delete(req, res)); 

export default router;



