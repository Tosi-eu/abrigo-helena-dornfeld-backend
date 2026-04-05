import type { RequestHandler } from 'express';
import { MedicineStockInBodyDto } from '@domain/dto/entities.api.dto';
import { InputStockInBodyDto } from '@domain/dto/entities.api.dto';
import { bodyValidationMiddleware } from './body-validation.middleware';

const medMw = bodyValidationMiddleware(MedicineStockInBodyDto);
const insMw = bodyValidationMiddleware(InputStockInBodyDto);

export const stockEntradaBodyMiddleware: RequestHandler = (req, res, next) => {
  const b = req.body ?? {};
  const hasMed = b.medicamento_id != null && b.medicamento_id !== '';
  const hasIns = b.insumo_id != null && b.insumo_id !== '';
  if (hasMed && hasIns) {
    res.status(400).json({
      error: 'Send medicamento_id or insumo_id, not both',
    });
    return;
  }
  if (!hasMed && !hasIns) {
    res.status(400).json({
      error: 'Send medicamento_id (medicine) or insumo_id (supply)',
    });
    return;
  }
  if (hasMed) {
    void medMw(req, res, next);
    return;
  }
  void insMw(req, res, next);
};
