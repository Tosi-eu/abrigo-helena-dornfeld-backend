import type { RequestHandler } from 'express';

export const adminStringMapBodyMiddleware: RequestHandler = (req, res, next) => {
  const b = req.body;
  if (typeof b !== 'object' || b === null || Array.isArray(b)) {
    res.status(400).json({ error: 'Body must be a JSON object' });
    return;
  }
  for (const [k, v] of Object.entries(b)) {
    if (typeof k !== 'string' || k.trim() === '') {
      res.status(400).json({ error: 'Invalid config key' });
      return;
    }
    if (v !== null && v !== undefined && typeof v !== 'string') {
      res.status(400).json({
        error: `Value for "${k}" must be a string (or null)`,
      });
      return;
    }
  }
  next();
};
