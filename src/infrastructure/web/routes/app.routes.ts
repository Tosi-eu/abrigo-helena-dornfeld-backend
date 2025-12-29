import { Router } from 'express';
import { AppController } from '../controllers/app.controller';

const appController = new AppController();
const router = Router();

router.get('/status', (req, res) => appController.getStatus(req, res));

export default router;
