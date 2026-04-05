import type { ClassConstructor } from 'class-transformer/types/interfaces';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { RequestHandler } from 'express';
import { formatValidationErrors } from './format-validation-errors';

export type BodyValidationOptions = {
  whitelist?: boolean;
  forbidNonWhitelisted?: boolean;
};

/**
 * Express middleware: replaces `req.body` with a class-transformer instance
 * after class-validator checks (trim transforms run first).
 */
export function bodyValidationMiddleware<T extends object>(
  dto: ClassConstructor<T>,
  options?: BodyValidationOptions,
): RequestHandler {
  const whitelist = options?.whitelist ?? true;
  const forbidNonWhitelisted = options?.forbidNonWhitelisted ?? false;

  return async (req, res, next) => {
    const instance = plainToInstance(dto, req.body ?? {}, {
      enableImplicitConversion: true,
      exposeDefaultValues: true,
    });
    const errors = await validate(instance as object, {
      whitelist,
      forbidNonWhitelisted,
    });
    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: formatValidationErrors(errors),
      });
      return;
    }
    req.body = instance as unknown as typeof req.body;
    next();
  };
}
