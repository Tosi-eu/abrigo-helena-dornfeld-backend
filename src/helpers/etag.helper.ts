import { Request, Response } from 'express';
import { createHash } from 'crypto';

export function generateETag(data: unknown): string {
  const dataString = JSON.stringify(data);
  const hash = createHash('md5').update(dataString).digest('hex');
  return `"${hash}"`;
}

export function checkETag(req: Request, etag: string): boolean {
  const ifNoneMatch = req.headers['if-none-match'];
  if (!ifNoneMatch) {
    return false;
  }

  const etags = ifNoneMatch.split(',').map(e => e.trim());
  return etags.includes(etag) || etags.includes(etag.replace(/"/g, ''));
}

export function handleETagResponse(
  req: Request,
  res: Response,
  data: unknown,
): boolean {
  const etag = generateETag(data);

  if (checkETag(req, etag)) {
    res.status(304).end();
    return true;
  }

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  return false;
}
