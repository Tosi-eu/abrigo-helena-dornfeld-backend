import type { RequestHandler } from 'express';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export const adminConfigPutBodyMiddleware: RequestHandler = (
  req,
  res,
  next,
) => {
  const b = req.body;
  if (!isPlainObject(b)) {
    res.status(400).json({ error: 'Body must be a JSON object' });
    return;
  }

  const hasDisplay = 'display' in b;
  const hasSystem = 'system' in b;

  if (hasDisplay || hasSystem) {
    if (hasDisplay && b.display != null && !isPlainObject(b.display)) {
      res.status(400).json({ error: 'display must be an object' });
      return;
    }
    if (hasDisplay && b.display != null) {
      for (const [k, v] of Object.entries(
        b.display as Record<string, unknown>,
      )) {
        if (typeof k !== 'string' || k.trim() === '') {
          res.status(400).json({ error: 'Invalid display key' });
          return;
        }
        if (v !== null && v !== undefined && typeof v !== 'string') {
          res.status(400).json({
            error: `display["${k}"] must be a string (or null)`,
          });
          return;
        }
      }
    }
    if (hasSystem && b.system != null && !isPlainObject(b.system)) {
      res.status(400).json({ error: 'system must be an object' });
      return;
    }
    for (const k of Object.keys(b)) {
      if (k === 'display' || k === 'system') continue;
      res.status(400).json({
        error: `Unexpected key "${k}" (use display / system wrappers)`,
      });
      return;
    }
    next();
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
