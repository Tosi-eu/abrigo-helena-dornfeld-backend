import { ArmarioService } from "../../../core/services/armario.service";
import { Request, Response } from "express";
import { RemanejamentoDTO } from "../../database/models/armario.model";
import { validateDTO } from "../../utils/utils";

export class ArmarioController {
  constructor(private readonly service: ArmarioService) {}

  async create(req: Request, res: Response) {
    try {
      const novo = await this.service.cadastrarNovo(req.body);
      return res.status(201).json(novo);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async getAll(req: Request, res: Response) {
    const armarios = await this.service.listarTodos();
    return res.json(armarios);
  }

  async getByNumero(req: Request, res: Response) {
    const numero = Number(req.params.numero);
    const armario = await this.service.buscarPorNumero(numero);

    if (!armario) {
      return res.status(404).json({ error: "Armário não encontrado" });
    }

    return res.json();
  }

  async update(req: Request, res: Response) {
    try {
      const numero = Number(req.params.numero);
      const categoria = req.body.categoria;

      const updated = await this.service.atualizar(numero, categoria);

      if (!updated) {
        return res.status(404).json({ error: "Armário não encontrado" });
      }

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  }

  async delete(req: Request, res: Response) {
    try {
      const numero = Number(req.params.numero);
      const destinos = req.body as RemanejamentoDTO | undefined;

      await this.service.removerComVerificacao(numero, destinos);

      return res.json({
        message: destinos
          ? `Armário ${numero} excluído e itens remanejados.`
          : `Armário ${numero} excluído com sucesso.`,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async deleteComRemanejamento(req: Request, res: Response) {
    try {
      const numero = Number(req.params.numero);
      const destinos = req.body;

      if (!validateDTO(destinos)) {
        return res.status(400).json({ error: "Campos inválidos no corpo da requisição" });
      }

      await this.service.removerComRemanejamento(numero, destinos as RemanejamentoDTO);

      return res.json({ message: `Armário ${numero} excluído e itens remanejados.` });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }

  async checkReferences(req: Request, res: Response) {
    try {
      const numero = Number(req.params.numero);

      const hasMedicineStock = (await this.service.countMedicamento(numero)) > 0;
      const hasInputStock = (await this.service.countInsumo(numero)) > 0;

      return res.json({ hasMedicineStock, hasInputStock });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  }
}