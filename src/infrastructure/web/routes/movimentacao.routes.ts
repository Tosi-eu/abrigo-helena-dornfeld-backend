import { Router } from "express";
import { MovementRepository } from "../../database/repositories/movimentacao.repository";
import { MovementService } from "../../../core/services/movimentacao.service";
import { MovementController } from "../controllers/movimentacao.controller";

const   router = Router();

const repo = new MovementRepository();
const service = new MovementService(repo);
const controller = new MovementController(service);

router.get("/medicamentos", controller.getMedicines.bind(controller));
router.get("/insumos", controller.getInputs.bind(controller));
router.post("/", controller.create.bind(controller));
router.get(
  "/medicamentos/ranking",
  controller.getMedicineRanking.bind(controller)
);


export default router;
