import { Router } from "express";
import { CabinetCategoryRepository } from "../../database/repositories/categoria-armario.repository";
import { CabinetCategoryService } from "../../../core/services/categoria-armario.service";
import { CabinetCategoryController } from "../controllers/categoria-armario.controller";

const repo = new CabinetCategoryRepository();
const service = new CabinetCategoryService(repo);
const controller = new CabinetCategoryController(service);

const router = Router();

router.post("/", (req, res) => controller.create(req, res));
router.get("/", (req, res) => controller.getAll(req, res)); 
router.get("/:id", (req, res) => controller.getById(req, res));
router.put("/:id", (req, res) => controller.update(req, res));
router.delete("/:id", (req, res) => controller.delete(req, res));

export default router;
