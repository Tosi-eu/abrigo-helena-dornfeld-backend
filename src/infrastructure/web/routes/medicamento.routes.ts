import { Router } from "express";
import { MedicineRepository } from "../../database/repositories/medicamento.repository";
import { MedicineService } from "../../../core/services/medicamento.service";
import { MedicineController } from "../controllers/medicamento.controller";

const repo = new MedicineRepository();
const service = new MedicineService(repo);
const controller = new MedicineController(service);

const router = Router();

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.getAll(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;



