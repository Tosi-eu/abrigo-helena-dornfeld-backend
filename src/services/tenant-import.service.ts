import type { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import type { MedicineStockRecord, InputStockRecord } from '@porto-sdk/sdk';
import { withRootTransaction } from '@repositories/prisma';
import { setRlsSessionGucs } from '@repositories/rls.context';
import { PrismaMedicineRepository } from '@repositories/medicamento.repository';
import { PrismaInputRepository } from '@repositories/insumo.repository';
import { PrismaResidentRepository } from '@repositories/residente.repository';
import { PrismaStockRepository } from '@repositories/estoque.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { OperationType } from '@helpers/utils';
import type {
  TenantImportSheet,
  TenantImportRowError,
  TenantImportRowResult,
  TenantImportXlsxResponse,
} from '@domain/dto/tenant-import.dto';

type ImportCounters = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

function emptyCounters(): ImportCounters {
  return { created: 0, updated: 0, skipped: 0, errors: 0 };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseExcelDate(x: unknown): Date | null {
  if (x == null || String(x).trim() === '') return null;
  if (x instanceof Date && !Number.isNaN(x.getTime())) {
    return startOfDay(x);
  }
  if (typeof x === 'number' && Number.isFinite(x)) {
    const utc = Math.round((x - 25569) * 86400 * 1000);
    const d = new Date(utc);
    if (!Number.isNaN(d.getTime())) return startOfDay(d);
  }
  const s = String(x).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return startOfDay(d);
  }
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (br) {
    const d = new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
    return startOfDay(d);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

function asString(x: unknown): string {
  return String(x ?? '').trim();
}

function asOptionalNumber(x: unknown): number | null {
  if (x == null || String(x).trim() === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function ensureRequired(
  errors: TenantImportRowError[],
  sheet: TenantImportSheet,
  row: number,
  field: string,
  value: string,
): boolean {
  if (value.trim() === '') {
    errors.push({ sheet, row, field, message: 'Campo obrigatório' });
    return false;
  }
  return true;
}

function normHeaderToken(s: string): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const OP_ALIASES: Record<string, OperationType> = {
  individual: OperationType.INDIVIDUAL,
  geral: OperationType.GERAL,
  carrinho_emergencia: OperationType.CARRINHO_EMERGENCIA,
  carrinho_psicotropicos: OperationType.CARRINHO_PSICOTROPICOS,
};

function parseOperationType(
  raw: unknown,
  fallback: OperationType,
): OperationType {
  const key = normHeaderToken(asString(raw));
  if (!key) return fallback;
  return OP_ALIASES[key] ?? fallback;
}

type ImportSheetRow = { excelRow: number; data: Record<string, unknown> };

/**
 * Localiza a linha de cabeçalho (permite linhas de título/ajuda acima) e devolve dados com número de linha Excel (1-based).
 */
function readSheetRows(
  wb: XLSX.WorkBook,
  sheet: TenantImportSheet,
  isHeader: (norm: string[]) => boolean,
): ImportSheetRow[] {
  const ws = wb.Sheets[sheet];
  if (!ws) return [];

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: '',
  });
  if (!aoa.length) return [];

  let headerIdx = -1;
  const maxScan = Math.min(aoa.length, 80);
  for (let i = 0; i < maxScan; i++) {
    const norm = (aoa[i] ?? []).map(c => normHeaderToken(String(c)));
    if (isHeader(norm)) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx < 0) {
    const fallback = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: '',
      raw: false,
    });
    return fallback.map((data, i) => ({ excelRow: i + 2, data }));
  }

  const rawHeader = (aoa[headerIdx] ?? []).map(h => String(h ?? '').trim());
  const out: ImportSheetRow[] = [];
  for (let r = headerIdx + 1; r < aoa.length; r++) {
    const line = aoa[r] ?? [];
    if (line.every(c => String(c ?? '').trim() === '')) continue;
    const data: Record<string, unknown> = {};
    for (let c = 0; c < rawHeader.length; c++) {
      const key = rawHeader[c];
      if (!key) continue;
      data[key] = line[c] ?? '';
    }
    out.push({ excelRow: r + 1, data });
  }
  return out;
}

export class TenantImportService {
  private readonly medsRepo = new PrismaMedicineRepository();
  private readonly inputRepo = new PrismaInputRepository();
  private readonly residentRepo = new PrismaResidentRepository();
  private readonly stockRepo = new PrismaStockRepository();
  private readonly setorRepo = new PrismaSetorRepository();

  async importXlsx(params: {
    tenantId: number;
    actorUserId: number;
    fileBuffer: Buffer;
  }): Promise<TenantImportXlsxResponse> {
    const { tenantId, actorUserId, fileBuffer } = params;

    const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });

    const errors: TenantImportRowError[] = [];
    const setores = emptyCounters();
    const cabinetCategories = emptyCounters();
    const drawerCategories = emptyCounters();
    const cabinets = emptyCounters();
    const drawers = emptyCounters();
    const medicines = emptyCounters();
    const inputs = emptyCounters();
    const residents = emptyCounters();
    const medicineStock = emptyCounters();
    const inputStock = emptyCounters();

    const setoresRows: TenantImportRowResult[] = [];
    const cabinetCategoriesRows: TenantImportRowResult[] = [];
    const drawerCategoriesRows: TenantImportRowResult[] = [];
    const cabinetsRows: TenantImportRowResult[] = [];
    const drawersRows: TenantImportRowResult[] = [];
    const medicineRows: TenantImportRowResult[] = [];
    const inputRows: TenantImportRowResult[] = [];
    const residentRows: TenantImportRowResult[] = [];
    const medicineStockRows: TenantImportRowResult[] = [];
    const inputStockRows: TenantImportRowResult[] = [];

    await withRootTransaction(async t => {
      await setRlsSessionGucs(t, {
        tenant_id: tenantId,
        current_user_id: actorUserId,
      });

      await this.setorRepo.ensureDefaultSetores(tenantId, t);

      await this.importSetores({
        tenantId,
        wb,
        errors,
        counters: setores,
        rowResults: setoresRows,
        tx: t,
      });
      await this.importCabinetCategories({
        tenantId,
        wb,
        errors,
        counters: cabinetCategories,
        rowResults: cabinetCategoriesRows,
        tx: t,
      });
      await this.importDrawerCategories({
        tenantId,
        wb,
        errors,
        counters: drawerCategories,
        rowResults: drawerCategoriesRows,
        tx: t,
      });
      await this.importArmarios({
        tenantId,
        wb,
        errors,
        counters: cabinets,
        rowResults: cabinetsRows,
        tx: t,
      });
      await this.importGavetas({
        tenantId,
        wb,
        errors,
        counters: drawers,
        rowResults: drawersRows,
        tx: t,
      });
      await this.importMedicines({
        tenantId,
        wb,
        errors,
        counters: medicines,
        rowResults: medicineRows,
        tx: t,
      });
      await this.importInputs({
        tenantId,
        wb,
        errors,
        counters: inputs,
        rowResults: inputRows,
        tx: t,
      });
      await this.importResidents({
        tenantId,
        wb,
        errors,
        counters: residents,
        rowResults: residentRows,
        tx: t,
      });
      await this.importMedicineStock({
        tenantId,
        wb,
        errors,
        counters: medicineStock,
        rowResults: medicineStockRows,
        tx: t,
      });
      await this.importInputStock({
        tenantId,
        wb,
        errors,
        counters: inputStock,
        rowResults: inputStockRows,
        tx: t,
      });
    });

    return {
      ok: true,
      summary: {
        setores,
        cabinetCategories,
        drawerCategories,
        cabinets,
        drawers,
        medicines,
        inputs,
        residents,
        medicineStock,
        inputStock,
      },
      rows: {
        setores: setoresRows,
        cabinetCategories: cabinetCategoriesRows,
        drawerCategories: drawerCategoriesRows,
        cabinets: cabinetsRows,
        drawers: drawersRows,
        medicines: medicineRows,
        inputs: inputRows,
        residents: residentRows,
        medicineStock: medicineStockRows,
        inputStock: inputStockRows,
      },
      errors,
    };
  }

  private async importSetores(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Setores';
    const rows = readSheetRows(
      wb,
      sheet,
      norm => norm.includes('chave') && norm.includes('nome'),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const chave = asString(r['chave'] ?? r['Chave']);
      const nome = asString(r['nome'] ?? r['Nome']);
      const perfilRaw = asString(
        r['perfil_proporcao'] ??
          r['perfil_proporção'] ??
          r['perfil'] ??
          r['Perfil'],
      ).toLowerCase();

      if (!chave && !nome) {
        continue;
      }
      const ok =
        ensureRequired(errors, sheet, excelRowNumber, 'chave', chave) &&
        ensureRequired(errors, sheet, excelRowNumber, 'nome', nome);
      if (!ok) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const proportionProfile =
        perfilRaw === 'enfermagem'
          ? ('enfermagem' as const)
          : ('farmacia' as const);

      try {
        const existing = await this.setorRepo.findByTenantAndKey(
          tenantId,
          chave,
          tx,
        );
        if (existing) {
          await (tx as any).setor.updateMany({
            where: { id: existing.id, tenant_id: tenantId },
            data: {
              nome,
              proportion_profile: proportionProfile,
              active: true,
            },
          });
          counters.updated++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
        } else {
          await this.setorRepo.createCustom({
            tenantId,
            key: chave,
            nome,
            proportionProfile,
            tx,
          });
          counters.created++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ sheet, row: excelRowNumber, message: msg });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
      }
    }
  }

  private async importCabinetCategories(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Categorias_armario';
    const rows = readSheetRows(wb, sheet, norm => norm.includes('nome'));
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;
      const nome = asString(r['nome'] ?? r['Nome']);

      if (!nome) continue;

      const dup = await tx.categoriaArmario.findFirst({
        where: { tenant_id: tenantId, nome },
        select: { id: true },
      });
      if (dup) {
        counters.skipped++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'skipped' });
        continue;
      }

      await tx.categoriaArmario.create({
        data: { nome, tenant_id: tenantId },
      });
      counters.created++;
      rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
    }
  }

  private async importDrawerCategories(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Categorias_gaveta';
    const rows = readSheetRows(wb, sheet, norm => norm.includes('nome'));
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;
      const nome = asString(r['nome'] ?? r['Nome']);

      if (!nome) continue;

      const dup = await tx.categoriaGaveta.findFirst({
        where: { tenant_id: tenantId, nome },
        select: { id: true },
      });
      if (dup) {
        counters.skipped++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'skipped' });
        continue;
      }

      await tx.categoriaGaveta.create({
        data: { nome, tenant_id: tenantId },
      });
      counters.created++;
      rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
    }
  }

  private async importArmarios(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Armarios';
    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('num_armario') &&
        (norm.includes('categoria_nome') || norm.includes('categoria')),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const num = asOptionalNumber(
        r['num_armario'] ?? r['numero'] ?? r['Num armário'],
      );
      const catNome = asString(
        r['categoria_nome'] ??
          r['categoria'] ??
          r['nome_categoria'] ??
          r['Categoria'],
      );

      if (num == null || !Number.isInteger(num) || num < 1) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'num_armario',
          message: 'Número de armário inválido',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      if (
        !ensureRequired(
          errors,
          sheet,
          excelRowNumber,
          'categoria_nome',
          catNome,
        )
      ) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const cat = await tx.categoriaArmario.findFirst({
        where: { tenant_id: tenantId, nome: catNome },
        select: { id: true },
      });
      if (!cat) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'categoria_nome',
          message: `Categoria de armário não encontrada: ${catNome}`,
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const existing = await tx.armario.findFirst({
        where: { tenant_id: tenantId, num_armario: num },
        select: { id: true, categoria_id: true },
      });

      if (!existing) {
        await tx.armario.create({
          data: {
            tenant_id: tenantId,
            num_armario: num,
            categoria_id: cat.id,
          },
        });
        counters.created++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
      } else if (existing.categoria_id !== cat.id) {
        await tx.armario.updateMany({
          where: { tenant_id: tenantId, num_armario: num },
          data: { categoria_id: cat.id },
        });
        counters.updated++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
      } else {
        counters.skipped++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'skipped' });
      }
    }
  }

  private async importGavetas(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Gavetas';
    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('num_gaveta') &&
        (norm.includes('categoria_nome') || norm.includes('categoria')),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const num = asOptionalNumber(
        r['num_gaveta'] ?? r['numero'] ?? r['Num gaveta'],
      );
      const catNome = asString(
        r['categoria_nome'] ??
          r['categoria'] ??
          r['nome_categoria'] ??
          r['Categoria'],
      );

      if (num == null || !Number.isInteger(num) || num < 1) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'num_gaveta',
          message: 'Número de gaveta inválido',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      if (
        !ensureRequired(
          errors,
          sheet,
          excelRowNumber,
          'categoria_nome',
          catNome,
        )
      ) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const cat = await tx.categoriaGaveta.findFirst({
        where: { tenant_id: tenantId, nome: catNome },
        select: { id: true },
      });
      if (!cat) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'categoria_nome',
          message: `Categoria de gaveta não encontrada: ${catNome}`,
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const existing = await tx.gaveta.findFirst({
        where: { tenant_id: tenantId, num_gaveta: num },
        select: { id: true, categoria_id: true },
      });

      if (!existing) {
        await tx.gaveta.create({
          data: {
            tenant_id: tenantId,
            num_gaveta: num,
            categoria_id: cat.id,
          },
        });
        counters.created++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
      } else if (existing.categoria_id !== cat.id) {
        await tx.gaveta.updateMany({
          where: { tenant_id: tenantId, num_gaveta: num },
          data: { categoria_id: cat.id },
        });
        counters.updated++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
      } else {
        counters.skipped++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'skipped' });
      }
    }
  }

  private async importMedicines(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, tx, rowResults } = params;
    const sheet: TenantImportSheet = 'Medicamentos';

    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('nome') &&
        norm.includes('principio_ativo') &&
        norm.includes('dosagem') &&
        (norm.includes('unidade_medida') || norm.includes('unidade')),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const nome = asString(r['nome'] ?? r['Nome']);
      const principio_ativo = asString(
        r['principio_ativo'] ?? r['Princípio ativo'] ?? r['principio ativo'],
      );
      const dosagem = asString(r['dosagem'] ?? r['Dosagem']);
      const unidade_medida = asString(
        r['unidade_medida'] ?? r['Unidade'] ?? r['unidade'],
      );
      const estoque_minimo = asOptionalNumber(
        r['estoque_minimo'] ?? r['Estoque mínimo'] ?? r['estoque minimo'],
      );
      const preco = asOptionalNumber(r['preco'] ?? r['Preço'] ?? r['preço']);

      const ok =
        ensureRequired(errors, sheet, excelRowNumber, 'nome', nome) &&
        ensureRequired(
          errors,
          sheet,
          excelRowNumber,
          'principio_ativo',
          principio_ativo,
        ) &&
        ensureRequired(errors, sheet, excelRowNumber, 'dosagem', dosagem) &&
        ensureRequired(
          errors,
          sheet,
          excelRowNumber,
          'unidade_medida',
          unidade_medida,
        );

      if (!ok) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const existing = await this.medsRepo.findByUniqueFields(
        tenantId,
        {
          nome,
          principio_ativo,
          dosagem,
          unidade_medida,
        },
        tx,
      );

      if (!existing?.id) {
        await this.medsRepo.createMedicine(
          {
            nome,
            principio_ativo,
            dosagem,
            unidade_medida,
            estoque_minimo: estoque_minimo ?? 0,
            preco: preco ?? null,
          },
          tenantId,
          tx,
        );
        counters.created++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        continue;
      }

      const updated = await this.medsRepo.updateMedicineById(
        tenantId,
        existing.id,
        {
          nome,
          principio_ativo,
          dosagem,
          unidade_medida,
          estoque_minimo: estoque_minimo ?? 0,
          preco: preco ?? null,
        },
        tx,
      );
      if (!updated) {
        params.errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Falha ao atualizar registro existente',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      counters.updated++;
      rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
    }
  }

  private async importInputs(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, tx, rowResults } = params;
    const sheet: TenantImportSheet = 'Insumos';
    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('nome') &&
        (norm.includes('descricao') ||
          norm.includes('estoque_minimo') ||
          norm.includes('preco')),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const nome = asString(r['nome'] ?? r['Nome']);
      const descricao = asString(
        r['descricao'] ?? r['Descrição'] ?? r['descricao'],
      );
      const estoque_minimo = asOptionalNumber(
        r['estoque_minimo'] ?? r['Estoque mínimo'] ?? r['estoque minimo'],
      );
      const preco = asOptionalNumber(r['preco'] ?? r['Preço'] ?? r['preço']);

      const ok = ensureRequired(errors, sheet, excelRowNumber, 'nome', nome);
      if (!ok) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const existing = await tx.insumo.findFirst({
        where: { tenant_id: tenantId, nome },
        select: { id: true },
      });

      if (!existing?.id) {
        await this.inputRepo.createInput(
          {
            nome,
            descricao: descricao || '',
            estoque_minimo: estoque_minimo ?? undefined,
            preco: preco ?? null,
          },
          tenantId,
          tx,
        );
        counters.created++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        continue;
      }

      const updated = await this.inputRepo.updateInputById(
        tenantId,
        existing.id,
        {
          nome,
          descricao: descricao || '',
          estoque_minimo: estoque_minimo ?? undefined,
          preco: preco ?? null,
        },
        tx,
      );
      if (!updated) {
        params.errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Falha ao atualizar registro existente',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      counters.updated++;
      rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
    }
  }

  private async importResidents(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, tx, rowResults } = params;
    const sheet: TenantImportSheet = 'Residentes';
    const rows = readSheetRows(
      wb,
      sheet,
      norm => norm.includes('casela') && norm.includes('nome'),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const caselaRaw =
        r['casela'] ?? r['Casela'] ?? r['num_casela'] ?? r['Número da casela'];
      const casela = asOptionalNumber(caselaRaw);
      const nome = asString(r['nome'] ?? r['Nome']);

      if (casela == null || !Number.isInteger(casela) || casela < 1) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'casela',
          message: 'Casela inválida',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      if (!ensureRequired(errors, sheet, excelRowNumber, 'nome', nome)) {
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const existing = await tx.residente.findFirst({
        where: { tenant_id: tenantId, num_casela: casela },
        select: { id: true },
      });

      if (!existing?.id) {
        await this.residentRepo.createResident(
          {
            num_casela: casela,
            nome,
            tenant_id: tenantId,
          },
          tx,
        );
        counters.created++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        continue;
      }

      const updated = await this.residentRepo.updateResidentById(
        { num_casela: casela, nome, tenant_id: tenantId },
        tx,
      );
      if (!updated) {
        params.errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Falha ao atualizar registro existente',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }
      counters.updated++;
      rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
    }
  }

  private async importMedicineStock(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Estoque_medicamentos';
    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('nome') &&
        norm.includes('principio_ativo') &&
        norm.includes('dosagem') &&
        (norm.includes('unidade_medida') || norm.includes('unidade')) &&
        norm.includes('validade') &&
        norm.includes('quantidade') &&
        norm.includes('setor'),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const nome = asString(r['nome'] ?? r['Nome']);
      const principio_ativo = asString(
        r['principio_ativo'] ?? r['Principio ativo'] ?? r['principio ativo'],
      );
      const dosagem = asString(r['dosagem'] ?? r['Dosagem']);
      const unidade_medida = asString(
        r['unidade_medida'] ?? r['Unidade'] ?? r['unidade'],
      );
      const caselaNum = asOptionalNumber(
        r['casela'] ?? r['Casela'] ?? r['num_casela'],
      );
      const armarioNum = asOptionalNumber(
        r['armario'] ?? r['num_armario'] ?? r['Armário'],
      );
      const gavetaNum = asOptionalNumber(
        r['gaveta'] ?? r['num_gaveta'] ?? r['Gaveta'],
      );
      const validade = parseExcelDate(r['validade'] ?? r['Validade']);
      const quantidade = asOptionalNumber(r['quantidade'] ?? r['Quantidade']);
      const origem = asString(r['origem'] ?? r['Origem']) || 'Importação';
      const tipoRaw = r['tipo'] ?? r['Tipo'];
      const setorKey = asString(r['setor'] ?? r['Setor']).toLowerCase();
      const lote = asString(r['lote'] ?? r['Lote']) || null;

      const med = await this.medsRepo.findByUniqueFields(
        tenantId,
        { nome, principio_ativo, dosagem, unidade_medida },
        tx,
      );

      if (!med?.id) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message:
            'Medicamento não encontrado — cadastre na aba Medicamentos antes.',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (validade == null) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'validade',
          message: 'Data inválida',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (
        quantidade == null ||
        quantidade <= 0 ||
        !Number.isInteger(quantidade)
      ) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'quantidade',
          message: 'Quantidade deve ser inteira positiva',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (!setorKey) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'setor',
          message: 'Informe a chave do setor (ex.: farmacia)',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const setorRow = await this.setorRepo.findByTenantAndKey(
        tenantId,
        setorKey,
        tx,
      );
      if (!setorRow) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'setor',
          message: `Setor não encontrado: ${setorKey}`,
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (armarioNum != null && gavetaNum != null) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Informe apenas armário ou gaveta, não os dois',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const hasLoc =
        caselaNum != null || armarioNum != null || gavetaNum != null;
      if (!hasLoc) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Informe casela (residente), armário ou gaveta',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (caselaNum != null) {
        const resOk = await tx.residente.findFirst({
          where: { tenant_id: tenantId, num_casela: caselaNum },
          select: { id: true },
        });
        if (!resOk) {
          errors.push({
            sheet,
            row: excelRowNumber,
            field: 'casela',
            message: 'Casela não cadastrada na aba Residentes',
          });
          counters.errors++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
          continue;
        }
      }

      const defaultTipo =
        caselaNum != null ? OperationType.INDIVIDUAL : OperationType.GERAL;
      const tipo = parseOperationType(tipoRaw, defaultTipo);

      const payload: MedicineStockRecord & { sector_id?: number | null } = {
        medicamento_id: med.id,
        casela_id: caselaNum ?? null,
        armario_id: armarioNum ?? null,
        gaveta_id: gavetaNum ?? null,
        validade,
        quantidade,
        origem,
        tipo,
        setor: setorRow.key,
        sector_id: setorRow.id,
        lote,
        observacao: null,
      };

      try {
        const result = await this.stockRepo.createMedicineStockIn(
          payload,
          tenantId,
          tx,
        );
        const merged = result.message.includes('somada');
        if (merged) {
          counters.updated++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
        } else {
          counters.created++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ sheet, row: excelRowNumber, message: msg });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
      }
    }
  }

  private async importInputStock(params: {
    tenantId: number;
    wb: XLSX.WorkBook;
    errors: TenantImportRowError[];
    counters: ImportCounters;
    rowResults: TenantImportRowResult[];
    tx: Prisma.TransactionClient;
  }) {
    const { tenantId, wb, errors, counters, rowResults, tx } = params;
    const sheet: TenantImportSheet = 'Estoque_insumos';
    const rows = readSheetRows(
      wb,
      sheet,
      norm =>
        norm.includes('nome') &&
        norm.includes('validade') &&
        norm.includes('quantidade') &&
        norm.includes('tipo') &&
        norm.includes('setor'),
    );
    if (rows.length === 0) return;

    for (const row of rows) {
      const excelRowNumber = row.excelRow;
      const r = row.data;

      const nome = asString(r['nome'] ?? r['Nome']);
      const caselaNum = asOptionalNumber(r['casela'] ?? r['Casela']);
      const armarioNum = asOptionalNumber(r['armario'] ?? r['num_armario']);
      const gavetaNum = asOptionalNumber(r['gaveta'] ?? r['num_gaveta']);
      const validade = parseExcelDate(r['validade'] ?? r['Validade']);
      const quantidade = asOptionalNumber(r['quantidade'] ?? r['Quantidade']);
      const tipo = parseOperationType(
        r['tipo'] ?? r['Tipo'],
        OperationType.GERAL,
      );
      const setorKey = asString(r['setor'] ?? r['Setor']).toLowerCase();
      const lote = asString(r['lote'] ?? r['Lote']) || null;

      const ins = await tx.insumo.findFirst({
        where: { tenant_id: tenantId, nome },
        select: { id: true },
      });

      if (!ins?.id) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Insumo não encontrado — cadastre na aba Insumos antes.',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (validade == null) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'validade',
          message: 'Data inválida',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (
        quantidade == null ||
        quantidade <= 0 ||
        !Number.isInteger(quantidade)
      ) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'quantidade',
          message: 'Quantidade deve ser inteira positiva',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (!setorKey) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'setor',
          message: 'Informe a chave do setor (ex.: farmacia)',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const setorRow = await this.setorRepo.findByTenantAndKey(
        tenantId,
        setorKey,
        tx,
      );
      if (!setorRow) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'setor',
          message: `Setor não encontrado: ${setorKey}`,
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (armarioNum != null && gavetaNum != null) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Informe apenas armário ou gaveta, não os dois',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      const hasLoc =
        caselaNum != null || armarioNum != null || gavetaNum != null;
      if (!hasLoc) {
        errors.push({
          sheet,
          row: excelRowNumber,
          message: 'Informe casela, armário ou gaveta',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (caselaNum != null && tipo !== OperationType.INDIVIDUAL) {
        errors.push({
          sheet,
          row: excelRowNumber,
          field: 'tipo',
          message: 'Para estoque em casela, tipo deve ser individual',
        });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
        continue;
      }

      if (caselaNum != null) {
        const resOk = await tx.residente.findFirst({
          where: { tenant_id: tenantId, num_casela: caselaNum },
          select: { id: true },
        });
        if (!resOk) {
          errors.push({
            sheet,
            row: excelRowNumber,
            field: 'casela',
            message: 'Casela não cadastrada na aba Residentes',
          });
          counters.errors++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
          continue;
        }
      }

      const payload: InputStockRecord & { sector_id?: number | null } = {
        insumo_id: ins.id,
        casela_id: caselaNum ?? null,
        armario_id: armarioNum ?? null,
        gaveta_id: gavetaNum ?? null,
        quantidade,
        validade,
        tipo,
        setor: setorRow.key,
        sector_id: setorRow.id,
        lote,
      };

      try {
        const result = await this.stockRepo.createInputStockIn(
          payload,
          tenantId,
          tx,
        );
        const merged = result.message.includes('somada');
        if (merged) {
          counters.updated++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'updated' });
        } else {
          counters.created++;
          rowResults.push({ sheet, row: excelRowNumber, status: 'created' });
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ sheet, row: excelRowNumber, message: msg });
        counters.errors++;
        rowResults.push({ sheet, row: excelRowNumber, status: 'error' });
      }
    }
  }
}
