import { Router } from "express";
import { MovementRepository } from "../../database/repositories/movimentacao.repository";
import { MovementService } from "../../../core/services/movimentacao.service";
import { MovementController } from "../controllers/movimentacao.controller";

const   router = Router();

const repo = new MovementRepository();
const service = new MovementService(repo);
const controller = new MovementController(service);

router.get("/produtos-parados", (req, res) => controller.nonMovementMedications(req, res));
router.get("/medicamentos", (req, res) => controller.getMedicines(req, res));
router.get("/insumos", (req, res) => controller.getInputs(req, res));
router.post("/", (req, res) => controller.create(req, res));
router.get(
  "/medicamentos/ranking",
  (req, res) => controller.getMedicineRanking(req, res)
);


export default router;
