import { Request, Response } from 'express';

export class AppController {
  constructor() {}

  async getStatus(req: Request, res: Response) {
    return res.status(200).json({ ok: true });
  }
}
