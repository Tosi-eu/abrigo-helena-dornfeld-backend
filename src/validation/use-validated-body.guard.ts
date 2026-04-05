import type { ClassConstructor } from 'class-transformer';
import type { CanActivate, Type } from '@nestjs/common';
import type { RequestHandler } from 'express';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import {
  bodyValidationMiddleware,
  type BodyValidationOptions,
} from './body-validation.middleware';

export function UseValidatedBody<T extends object>(
  dto: ClassConstructor<T>,
  options?: BodyValidationOptions,
): Type<CanActivate> {
  return UseExpressMwGuard(bodyValidationMiddleware(dto, options));
}

export function UseExpressMiddleware(
  ...middlewares: RequestHandler[]
): Type<CanActivate> {
  return UseExpressMwGuard(...middlewares);
}
