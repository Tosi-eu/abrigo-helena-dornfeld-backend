import { Request, Response } from 'express';
import { StockService } from '../../../core/services/estoque.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { ItemType } from '../../../core/utils/utils';

export class StockController {
  constructor(private readonly service: StockService) {}

  async stockIn(req: Request, res: Response) {
    try {
      const { medicamento_id, insumo_id } = req.body;

      if (medicamento_id) {
        const result = await this.service.medicineStockIn(req.body);
        return res.json(result);
      }

      if (insumo_id) {
        const result = await this.service.inputStockIn(req.body);
        return res.json(result);
      }
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao registrar entrada');
    }
  }

  async stockOut(req: Request, res: Response) {
    try {
      const result = await this.service.stockOut(req.body);
      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao registrar saída');
    }
  }

  async list(req: Request, res: Response) {
    try {
      const { filter, type, page, limit } = req.query;

      const data = await this.service.listStock({
        filter: String(filter || ''),
        type: String(type || ''),
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      });

      return res.json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao listar estoque');
    }
  }

  async proportion(req: Request, res: Response) {
    try {
      const { setor } = req.query as { setor?: 'farmacia' | 'enfermagem' };

      if (!setor) {
        return res.status(400).json({
          error: 'Query param "setor" é obrigatório (farmacia ou enfermagem)',
        });
      }

      const data = await this.service.getProportion(setor);

      const totalGeral = Object.values(data).reduce(
        (acc, v) => acc + Number(v || 0),
        0,
      );

      const pct = (v: number) =>
        totalGeral > 0 ? Number(((v / totalGeral) * 100).toFixed(2)) : 0;

      return res.json({
        percentuais: {
          medicamentos_geral: pct(data.medicamentos_geral),
          medicamentos_individual: pct(data.medicamentos_individual),
          insumos: pct(data.insumos),
          carrinho_medicamentos: pct(data.carrinho_medicamentos),
          carrinho_insumos: pct(data.carrinho_insumos),
        },
        totais: {
          ...data,
          total_geral: totalGeral,
        },
      });
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao calcular proporção');
    }
  }

  async removeIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.removeIndividualMedicine(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao remover medicamento');
    }
  }

  async suspendIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.suspendIndividualMedicine(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao suspender medicamento',
      );
    }
  }

  async resumeIndividualMedicine(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.resumeIndividualMedicine(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao retomar medicamento');
    }
  }

  async transferMedicineSector(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;
      const { setor } = req.body as { setor: 'farmacia' | 'enfermagem' };

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!setor) {
        return res.status(400).json({ error: 'Setor é obrigatório' });
      }

      const result = await this.service.transferMedicineSector(
        Number(estoque_id),
        setor,
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao transferir medicamento',
      );
    }
  }

  async updateStockItem(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;
      const body = req.body as {
        tipo: ItemType;
        stockTipo?: string;
        quantidade?: number;
        armario_id?: number | null;
        gaveta_id?: number | null;
        validade?: string | null;
        origem?: string | null;
        setor?: string;
        lote?: string | null;
        casela_id?: number | null;
      };

      const itemTipo = body.tipo;
      const { stockTipo, ...updateData } = body;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!itemTipo) {
        return res.status(400).json({ error: 'Tipo é obrigatório' });
      }

      const processedData = {
        ...updateData,
        validade: updateData.validade
          ? new Date(updateData.validade)
          : undefined,
        tipo: stockTipo,
      };

      const result = await this.service.updateStockItem(
        Number(estoque_id),
        itemTipo === 'medicamento' ? ItemType.MEDICAMENTO : ItemType.INSUMO,
        processedData,
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao atualizar item de estoque',
      );
    }
  }

  async deleteStockItem(req: Request, res: Response) {
    try {
      const { estoque_id, tipo } = req.params as {
        estoque_id: string;
        tipo: ItemType;
      };

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!tipo || (tipo !== 'medicamento' && tipo !== 'insumo')) {
        return res.status(400).json({ error: 'Tipo inválido' });
      }

      const result = await this.service.deleteStockItem(
        Number(estoque_id),
        tipo === 'medicamento' ? ItemType.MEDICAMENTO : ItemType.INSUMO,
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao remover item de estoque',
      );
    }
  }

  async removeIndividualInput(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.removeIndividualInput(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(
        res,
        400,
        error,
        'Erro ao remover insumo individual',
      );
    }
  }

  async suspendIndividualInput(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.suspendIndividualInput(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao suspender insumo');
    }
  }

  async resumeIndividualInput(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      const result = await this.service.resumeIndividualInput(
        Number(estoque_id),
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao retomar insumo');
    }
  }

  async transferInputSector(req: Request, res: Response) {
    try {
      const { estoque_id } = req.params;
      const { setor } = req.body as { setor: 'farmacia' | 'enfermagem' };

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!setor) {
        return res.status(400).json({ error: 'Setor é obrigatório' });
      }

      const result = await this.service.transferInputSector(
        Number(estoque_id),
        setor,
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao transferir insumo');
    }
  }
}
