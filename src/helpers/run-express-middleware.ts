import type { NextFunction, Request, Response } from 'express';

type ExpressMw = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

/**
 * Executa um middleware estilo Express dentro de um Guard Nest (req/res são os do adapter).
 */
export async function runExpressMiddleware(
  mw: ExpressMw,
  req: Request,
  res: Response,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const next: NextFunction = (err?: unknown) => {
      if (res.headersSent) {
        resolve();
        return;
      }
      if (err !== undefined && err !== null) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      resolve();
    };
    try {
      const out = mw(req, res, next);
      if (out && typeof (out as Promise<void>).then === 'function') {
        (out as Promise<void>).then(() => undefined).catch(reject);
      }
    } catch (e) {
      reject(e);
    }
  });
}
