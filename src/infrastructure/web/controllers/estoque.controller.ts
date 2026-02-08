import { Request, Response } from 'express';
import { StockService } from '../../../core/services/estoque.service';
import { sendErrorResponse } from '../../helpers/error-response.helper';
import { handleETagResponse } from '../../helpers/etag.helper';
import { ItemType, SectorType } from '../../../core/utils/utils';
import { ValidatedRequest } from '../../../middleware/validation.middleware';
import { toSectorType } from '../../helpers/stock.helper';

export class StockController {
  constructor(private readonly service: StockService) {}

  async stockIn(req: ValidatedRequest, res: Response) {
    try {
      const { medicamento_id, insumo_id } = req.body;
      const login_id = req.user?.id;

      if (!login_id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (medicamento_id) {
        const result = await this.service.medicineStockIn(req.body, login_id);
        return res.json(result);
      }

      if (insumo_id) {
        const result = await this.service.inputStockIn(req.body, login_id);
        return res.json(result);
      }
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao registrar entrada');
    }
  }

  async stockOut(req: ValidatedRequest, res: Response) {
    try {
      const login_id = req.user?.id;

      if (!login_id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      const result = await this.service.stockOut(req.body, login_id);
      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao registrar saída');
    }
  }

  async list(req: Request, res: Response) {
    try {
      const {
        filter,
        type,
        page,
        limit,
        name,
        itemType,
        cabinet,
        drawer,
        casela,
        sector,
        lot
      } = req.query;

      const data = await this.service.listStock({
        filter: String(filter || ''),
        type: String(type || ''),
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        name: name ? String(name) : undefined,
        itemType: itemType ? String(itemType) : undefined,
        cabinet: cabinet ? String(cabinet) : undefined,
        drawer: drawer ? String(drawer) : undefined,
        casela: casela ? String(casela) : undefined,
        sector: sector ? String(sector) : undefined,
        lot: lot ? String(lot) : undefined,
      });

      if (handleETagResponse(req, res, data)) {
        return;
      }

      return res.json(data);
    } catch (error: unknown) {
      return sendErrorResponse(res, 500, error, 'Erro ao listar estoque');
    }
  }

  async proportion(req: Request, res: Response) {
    try {
      const sectorType = toSectorType(req.query.setor as string | undefined);

      if (sectorType === 'invalid') {
        return res.status(400).json({
          error: 'Setor é obrigatório e deve ser "farmacia" ou "enfermagem"',
        });
      }

      const data = await this.service.getProportion(sectorType as SectorType);

      const totalGeral = Object.values(data).reduce(
        (acc, v) => acc + Number(v || 0),
        0,
      );

      const pct = (v: number) =>
        totalGeral > 0 ? Number(((v / totalGeral) * 100).toFixed(2)) : 0;

      const responseData = {
        percentuais: {
          medicamentos_geral: pct(data.medicamentos_geral),
          medicamentos_individual: pct(data.medicamentos_individual),
          insumos_geral: pct(data.insumos_geral),
          insumos_individual: pct(data.insumos_individual),
          carrinho_emergencia_medicamentos: pct(
            data.carrinho_emergencia_medicamentos,
          ),
          carrinho_psicotropicos_medicamentos: pct(
            data.carrinho_psicotropicos_medicamentos,
          ),
          carrinho_emergencia_insumos: pct(data.carrinho_emergencia_insumos),
          carrinho_psicotropicos_insumos: pct(
            data.carrinho_psicotropicos_insumos,
          ),
        },
        totais: {
          ...data,
          total_geral: totalGeral,
        },
      };

      if (handleETagResponse(req, res, responseData)) {
        return;
      }

      return res.json(responseData);
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

  async transferMedicineSector(req: ValidatedRequest, res: Response) {
    try {
      const { estoque_id } = req.params;
      const { setor, quantidade, casela_id, observacao, bypassCasela, dias_para_repor } =
        req.body as {
          setor: 'farmacia' | 'enfermagem';
          quantidade: number;
          casela_id?: number;
          observacao?: string;
          bypassCasela: boolean;
          dias_para_repor?: number | null;
        };

      const login_id = req.user?.id;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!login_id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (!setor) {
        return res.status(400).json({ error: 'Setor é obrigatório' });
      }

      if (!quantidade || quantidade <= 0) {
        return res.status(400).json({
          error: 'Quantidade é obrigatória e deve ser maior que zero',
        });
      }

      const result = await this.service.transferMedicineSector(
        Number(estoque_id),
        setor,
        login_id,
        quantidade,
        bypassCasela,
        casela_id ?? null,
        observacao ?? null,
        dias_para_repor ?? null,
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

  async transferInputSector(req: ValidatedRequest, res: Response) {
    try {
      const { estoque_id } = req.params;
      const { setor, quantidade, casela_id, destino, observacao, dias_para_repor } =
        req.body as {
          setor: 'farmacia' | 'enfermagem';
          quantidade: number;
          casela_id?: number;
          destino?: string;
          observacao?: string;
          dias_para_repor?: number | null;
        };

      const login_id = req.user?.id;

      if (!estoque_id) {
        return res.status(400).json({ error: 'Estoque inválido' });
      }

      if (!login_id) {
        return res.status(401).json({ error: 'Usuário não autenticado' });
      }

      if (!setor) {
        return res.status(400).json({ error: 'Setor é obrigatório' });
      }

      if (!quantidade || quantidade <= 0) {
        return res.status(400).json({
          error: 'Quantidade é obrigatória e deve ser maior que zero',
        });
      }

      const result = await this.service.transferInputSector(
        Number(estoque_id),
        setor,
        quantidade,
        login_id,
        casela_id,
        destino ?? null,
        observacao ?? null,
        dias_para_repor ?? null,
      );

      return res.json(result);
    } catch (error: unknown) {
      return sendErrorResponse(res, 400, error, 'Erro ao transferir insumo');
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
        preco?: number | null;
        observacao?: string | null;
        dias_para_repor?: number | null;
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
}
