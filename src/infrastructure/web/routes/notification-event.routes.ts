    import { Router } from "express";
    import { NotificationEventService } from "../../../core/services/notification-event.service";
    import { NotificationEventController } from "../controllers/notification-event.controller";
    import { NotificationEventRepository } from "../../database/repositories/notification-event.repository";

    const repo = new NotificationEventRepository();
    const service = new NotificationEventService(repo);
    const controller = new NotificationEventController(service);

    const router = Router();

    router.post("/", (req, res) => controller.create(req, res));
    router.get("/", (req, res) => controller.getAll(req, res));
    router.get("/retirar-hoje", (req, res) => controller.getToday(req, res));
    router.get("/:id", (req, res) => controller.getById(req, res));
    router.patch("/:id", (req, res) => controller.update(req, res));
    router.delete("/:id", (req, res) => controller.delete(req, res));

    export default router;
