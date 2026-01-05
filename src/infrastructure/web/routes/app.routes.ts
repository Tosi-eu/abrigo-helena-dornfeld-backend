import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AppController } from '../controllers/app.controller';

const appController = new AppController();
const router = Router();

const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50,
  message: 'Too many status requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/status', statusLimiter, (req, res) =>
  appController.getStatus(req, res),
);

export default router;
