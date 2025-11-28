import { Router } from "express";
import { ReportRepository } from "../../database/repositories/relatorio.repository";
import { ReportService } from "../../../core/services/relatorio.service";
import { ReportController } from "../controllers/relatorio.controller";

const router = Router();

const repo = new ReportRepository();
const service = new ReportService(repo);
const controller = new ReportController(service);

router.get("/", (req, res) => controller.generate(req, res));

export default router;
