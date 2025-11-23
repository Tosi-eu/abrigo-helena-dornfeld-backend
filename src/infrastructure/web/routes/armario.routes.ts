import { Router } from "express";
import { ArmarioRepository } from "../../database/repositories/armario.repository";
import { ArmarioService } from "../../../core/services/armario.service";
import { ArmarioController } from "../controllers/armario.controller";

const repo = new ArmarioRepository();
const service = new ArmarioService(repo);
const controller = new ArmarioController(service);

const router = Router();

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.getAll(req, res));
router.put("/:numero", (req, res) => controller.update(req, res));
router.delete("/:numero", (req, res) => controller.delete(req, res)); 
router.get("/:numero/check", (req, res) => controller.checkReferences(req, res));

export default router;



