import type { Prisma } from '@prisma/client';
import { prisma } from '@repositories/prisma';

const BIRTH_FALLBACK_ENV = 'IMPORT_BIRTH_DATE_FALLBACK';
const BIRTH_FALLBACK_SYSCONFIG_KEY = 'import_birth_date_fallback';

async function resolveBirthDateFallback(
  queryOverride?: string,
): Promise<string> {
  if (queryOverride?.trim()) return queryOverride.trim();
  const fromEnv = process.env[BIRTH_FALLBACK_ENV]?.trim();
  if (fromEnv) return fromEnv;
  const row = await prisma.systemConfig.findUnique({
    where: { key: BIRTH_FALLBACK_SYSCONFIG_KEY },
    select: { value: true },
  });
  if (row?.value?.trim()) return row.value.trim();
  return '1970-01-01';
}
import { setRlsSessionGucs } from '@repositories/rls.context';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import {
  decodePgDumpBuffer,
  hasColumn,
  parsePgDumpCopy,
  rowByColumns,
  type CopyBlock,
  type ParsedPgDump,
} from '@helpers/pg-dump-copy.parser';
import type { TenantPgDumpImportResponse } from '@domain/dto/tenant-import.dto';

export type TenantPgDumpImportParams = {
  tenantId: number;
  actorUserId: number;
  fileBuffer: Buffer;
  replaceTenantData?: boolean;
  birthDateFallback?: string;
};

function parseTs(s: string | null): Date | null {
  if (s == null || s === '') return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateOnly(s: string | null): Date | null {
  if (s == null || s === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }
  return parseTs(s);
}

function parseIntCell(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function parseDecimal(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function collectRefsFromTable(
  blocks: ParsedPgDump,
  table: string,
  pick: (o: Record<string, string | null>) => number | null,
): Set<number> {
  const out = new Set<number>();
  const b = blocks.get(table);
  if (!b) return out;
  for (const row of b.rows) {
    const o = rowByColumns(b.columns, row);
    const n = pick(o);
    if (n != null) out.add(n);
  }
  return out;
}

function inferContiguousStart(refs: Set<number>, rowCount: number): number {
  if (rowCount === 0) return 1;
  const arr = [...refs].sort((a, b) => a - b);
  if (arr.length === 0) return 1;
  const min = arr[0];
  const max = arr[arr.length - 1];
  if (max - min + 1 !== rowCount) {
    throw new Error(
      `Mapa de IDs: esperadas ${rowCount} linhas cobrindo um intervalo contíguo de IDs; referências cobrem ${min}–${max} (${max - min + 1} valores).`,
    );
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== min + i) {
      throw new Error(
        'Mapa de IDs: referências não formam uma sequência contígua (pg_dump deve estar ordenado por PK).',
      );
    }
  }
  return min;
}

function parseJsonPermissions(
  raw: string | null,
): Prisma.InputJsonValue | undefined {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function resolveSourceTenantId(
  blocks: ParsedPgDump,
  hint?: number,
): number | null {
  let candidate: CopyBlock | undefined;
  for (const t of ['medicamento', 'insumo', 'residente', 'login']) {
    const b = blocks.get(t);
    if (b && hasColumn(b.columns, 'tenant_id')) {
      candidate = b;
      break;
    }
  }
  if (!candidate) return null;
  const distinct = new Set<number>();
  for (const row of candidate.rows) {
    const o = rowByColumns(candidate.columns, row);
    const tid = parseIntCell(o.tenant_id);
    if (tid != null) distinct.add(tid);
  }
  if (distinct.size === 0) return null;
  if (distinct.size === 1) return [...distinct][0];
  if (hint != null && distinct.has(hint)) return hint;
  throw new Error(
    'Dump contém vários tenant_id; informe qual tenant importar (parâmetro sourceTenantId).',
  );
}

function rowMatchesSourceTenant(
  o: Record<string, string | null>,
  sourceTenantId: number | null,
): boolean {
  if (sourceTenantId == null) return true;
  const tid = parseIntCell(o.tenant_id);
  if (tid == null) return true;
  return tid === sourceTenantId;
}

async function wipeTenantScopedData(
  tx: Prisma.TransactionClient,
  tenantId: number,
  preserveLoginId: number,
): Promise<void> {
  await tx.notificacao.deleteMany({ where: { tenant_id: tenantId } });
  await tx.movimentacao.deleteMany({ where: { tenant_id: tenantId } });
  await tx.estoqueMedicamento.deleteMany({ where: { tenant_id: tenantId } });
  await tx.estoqueInsumo.deleteMany({ where: { tenant_id: tenantId } });
  await tx.medicamento.deleteMany({ where: { tenant_id: tenantId } });
  await tx.insumo.deleteMany({ where: { tenant_id: tenantId } });
  await tx.gaveta.deleteMany({ where: { tenant_id: tenantId } });
  await tx.armario.deleteMany({ where: { tenant_id: tenantId } });
  await tx.residente.deleteMany({ where: { tenant_id: tenantId } });
  await tx.categoriaGaveta.deleteMany({ where: { tenant_id: tenantId } });
  await tx.categoriaArmario.deleteMany({ where: { tenant_id: tenantId } });
  await tx.login.deleteMany({
    where: { tenant_id: tenantId, id: { not: preserveLoginId } },
  });
}

export class TenantPgDumpImportService {
  private readonly setorRepo = new PrismaSetorRepository();

  async importPgDump(
    params: TenantPgDumpImportParams & { sourceTenantId?: number },
  ): Promise<TenantPgDumpImportResponse> {
    const {
      tenantId,
      actorUserId,
      fileBuffer,
      replaceTenantData,
      birthDateFallback: birthDateFallbackOverride,
      sourceTenantId: sourceTenantHint,
    } = params;

    const sql = decodePgDumpBuffer(fileBuffer);
    const blocks = parsePgDumpCopy(sql);
    const warnings: string[] = [];

    const resolvedBirth = await resolveBirthDateFallback(
      birthDateFallbackOverride,
    );
    const fbDate = parseDateOnly(resolvedBirth);
    if (!fbDate) {
      throw new Error(
        'Data de nascimento de recurso inválida no servidor (IMPORT_BIRTH_DATE_FALLBACK ou system_config import_birth_date_fallback). Use YYYY-MM-DD.',
      );
    }

    const sourceTenantId = resolveSourceTenantId(blocks, sourceTenantHint);

    return prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await setRlsSessionGucs(tx, {
          tenant_id: tenantId,
          current_user_id: actorUserId,
        });

        await this.setorRepo.ensureDefaultSetores(tenantId, tx);

        if (replaceTenantData) {
          await wipeTenantScopedData(tx, tenantId, actorUserId);
        }

        const summary = {
          categoriaArmario: 0,
          categoriaGaveta: 0,
          armarios: 0,
          gavetas: 0,
          medicamentos: 0,
          insumos: 0,
          residentes: 0,
          logins: 0,
          estoqueMedicamentos: 0,
          estoqueInsumos: 0,
          movimentacoes: 0,
          notificacoes: 0,
        };

        const mapCatArm = new Map<number, number>();
        const mapCatGav = new Map<number, number>();
        const mapMed = new Map<number, number>();
        const mapIns = new Map<number, number>();
        const mapArm = new Map<number, bigint>();
        const mapGav = new Map<number, bigint>();
        const mapLogin = new Map<number, number>();

        const mapOldResidentPkToCasela = new Map<number, number>();

        const bCatArm = blocks.get('categoria_armario');
        if (bCatArm) {
          for (const row of bCatArm.rows) {
            const o = rowByColumns(bCatArm.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldId = parseIntCell(o.id);
            const nome = o.nome?.trim();
            if (!nome) continue;
            const created = await tx.categoriaArmario.create({
              data: {
                nome,
                tenant_id: tenantId,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.categoriaArmario++;
            if (oldId != null) mapCatArm.set(oldId, created.id);
          }
        }

        const bCatGav = blocks.get('categoria_gaveta');
        if (bCatGav) {
          for (const row of bCatGav.rows) {
            const o = rowByColumns(bCatGav.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldId = parseIntCell(o.id);
            const nome = o.nome?.trim();
            if (!nome) continue;
            const created = await tx.categoriaGaveta.create({
              data: {
                nome,
                tenant_id: tenantId,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.categoriaGaveta++;
            if (oldId != null) mapCatGav.set(oldId, created.id);
          }
        }

        const bMed = blocks.get('medicamento');
        if (bMed) {
          for (const row of bMed.rows) {
            const o = rowByColumns(bMed.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldId = parseIntCell(o.id);
            const nome = o.nome?.trim();
            if (!nome) continue;
            const created = await tx.medicamento.create({
              data: {
                nome,
                dosagem: o.dosagem ?? '',
                unidade_medida: o.unidade_medida ?? '',
                principio_ativo: o.principio_ativo ?? '',
                estoque_minimo: parseIntCell(o.estoque_minimo),
                preco: parseDecimal(o.preco),
                tenant_id: tenantId,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.medicamentos++;
            if (oldId != null) mapMed.set(oldId, created.id);
          }
        }

        const bIns = blocks.get('insumo');
        if (bIns) {
          for (const row of bIns.rows) {
            const o = rowByColumns(bIns.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldId = parseIntCell(o.id);
            const nome = o.nome?.trim();
            if (!nome) continue;
            const created = await tx.insumo.create({
              data: {
                nome,
                descricao: o.descricao?.trim() || null,
                estoque_minimo: parseIntCell(o.estoque_minimo),
                preco: parseDecimal(o.preco),
                tenant_id: tenantId,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.insumos++;
            if (oldId != null) mapIns.set(oldId, created.id);
          }
        }

        const armRefs = new Set<number>();
        collectRefsFromTable(blocks, 'estoque_medicamento', o =>
          parseIntCell(o.armario_id),
        ).forEach(x => armRefs.add(x));
        collectRefsFromTable(blocks, 'movimentacao', o =>
          parseIntCell(o.armario_id),
        ).forEach(x => armRefs.add(x));
        collectRefsFromTable(blocks, 'estoque_insumo', o =>
          parseIntCell(o.armario_id),
        ).forEach(x => armRefs.add(x));

        const bArm = blocks.get('armario');
        if (bArm) {
          const armRows = bArm.rows.filter(r =>
            rowMatchesSourceTenant(
              rowByColumns(bArm.columns, r),
              sourceTenantId,
            ),
          );
          const start = inferContiguousStart(armRefs, armRows.length);
          let idx = 0;
          for (const row of armRows) {
            const o = rowByColumns(bArm.columns, row);
            const oldId = start + idx;
            idx++;
            const numArm = parseIntCell(o.num_armario);
            const oldCat = parseIntCell(o.categoria_id);
            if (numArm == null || oldCat == null) continue;
            const newCat = mapCatArm.get(oldCat);
            if (newCat == null) continue;
            const created = await tx.armario.create({
              data: {
                tenant_id: tenantId,
                num_armario: numArm,
                categoria_id: newCat,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.armarios++;
            mapArm.set(oldId, created.id);
          }
        }

        const gavRefs = new Set<number>();
        collectRefsFromTable(blocks, 'estoque_medicamento', o =>
          parseIntCell(o.gaveta_id),
        ).forEach(x => gavRefs.add(x));
        collectRefsFromTable(blocks, 'movimentacao', o =>
          parseIntCell(o.gaveta_id),
        ).forEach(x => gavRefs.add(x));
        collectRefsFromTable(blocks, 'estoque_insumo', o =>
          parseIntCell(o.gaveta_id),
        ).forEach(x => gavRefs.add(x));

        const bGav = blocks.get('gaveta');
        if (bGav) {
          const gavRows = bGav.rows.filter(r =>
            rowMatchesSourceTenant(
              rowByColumns(bGav.columns, r),
              sourceTenantId,
            ),
          );
          const start = inferContiguousStart(gavRefs, gavRows.length);
          let idx = 0;
          for (const row of gavRows) {
            const o = rowByColumns(bGav.columns, row);
            const oldId = start + idx;
            idx++;
            const numG = parseIntCell(o.num_gaveta);
            const oldCat = parseIntCell(o.categoria_id);
            if (numG == null || oldCat == null) continue;
            const newCat = mapCatGav.get(oldCat);
            if (newCat == null) continue;
            const created = await tx.gaveta.create({
              data: {
                tenant_id: tenantId,
                num_gaveta: numG,
                categoria_id: newCat,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.gavetas++;
            mapGav.set(oldId, created.id);
          }
        }

        const bRes = blocks.get('residente');
        const resHasId = bRes ? hasColumn(bRes.columns, 'id') : false;
        const resHasBirth = bRes
          ? hasColumn(bRes.columns, 'data_nascimento')
          : false;
        if (bRes) {
          for (const row of bRes.rows) {
            const o = rowByColumns(bRes.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldPk = parseIntCell(o.id);
            const casela = parseIntCell(o.num_casela);
            const nome = o.nome?.trim();
            if (casela == null || !nome) continue;

            let birth: Date | null = null;
            if (resHasBirth) {
              birth = parseDateOnly(o.data_nascimento);
              if (
                birth == null &&
                (o.data_nascimento == null || o.data_nascimento === '')
              ) {
                birth = fbDate;
              }
            } else {
              birth = fbDate;
            }

            await tx.residente.create({
              data: {
                tenant_id: tenantId,
                num_casela: casela,
                nome,
                data_nascimento: birth,
              },
            });
            summary.residentes++;
            if (resHasId && oldPk != null && casela != null) {
              mapOldResidentPkToCasela.set(oldPk, casela);
            }
          }
        }

        if (!resHasId && blocks.get('notificacao')) {
          warnings.push(
            'Residentes no dump sem coluna id: em notificações o campo residente_id do ficheiro é gravado como num_casela (sem mapa PK→casela).',
          );
        }

        const bLog = blocks.get('login');
        if (bLog) {
          for (const row of bLog.rows) {
            const o = rowByColumns(bLog.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldId = parseIntCell(o.id);
            const loginStr = o.login?.trim();
            const password = o.password?.trim();
            if (!loginStr || !password) continue;

            const refresh =
              o.refreshtoken?.trim() || o.refresh_token?.trim() || null;

            const created = await tx.login.create({
              data: {
                tenant_id: tenantId,
                login: loginStr,
                password,
                refreshToken: refresh,
                first_name: o.first_name?.trim() || null,
                last_name: o.last_name?.trim() || null,
                role: (o.role?.trim() || 'user').slice(0, 20),
                permissions: parseJsonPermissions(o.permissions) ?? undefined,
                is_super_admin: false,
                is_tenant_owner: false,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.logins++;
            if (oldId != null) mapLogin.set(oldId, created.id);
          }
        }

        const bEm = blocks.get('estoque_medicamento');
        if (bEm) {
          for (const row of bEm.rows) {
            const o = rowByColumns(bEm.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldMed = parseIntCell(o.medicamento_id);
            const newMed = oldMed != null ? mapMed.get(oldMed) : null;
            if (newMed == null) continue;

            const caselaNum = parseIntCell(o.casela_id);
            const oldArm = parseIntCell(o.armario_id);
            const oldGav = parseIntCell(o.gaveta_id);
            let armBig: bigint | null = null;
            let gavBig: bigint | null = null;
            if (oldArm != null) {
              const v = mapArm.get(oldArm);
              if (v != null) armBig = v;
            }
            if (oldGav != null) {
              const v = mapGav.get(oldGav);
              if (v != null) gavBig = v;
            }

            const setorKey = (o.setor ?? 'farmacia').trim().toLowerCase();
            const setorRow = await this.setorRepo.findByTenantAndKey(
              tenantId,
              setorKey,
              tx,
            );

            const validade = parseDateOnly(o.validade);
            const q = parseIntCell(o.quantidade);
            if (!validade || q == null) continue;

            await tx.estoqueMedicamento.create({
              data: {
                tenant_id: tenantId,
                medicamento_id: newMed,
                casela_id: caselaNum,
                armario_id: armBig != null ? Number(armBig) : null,
                gaveta_id: gavBig != null ? Number(gavBig) : null,
                validade,
                quantidade: q,
                origem: o.origem ?? 'Importação',
                tipo: o.tipo ?? 'geral',
                status: o.status ?? 'active',
                lote: o.lote?.trim() || null,
                setor: setorRow?.key ?? setorKey,
                sector_id: setorRow?.id ?? null,
                suspended_at: parseTs(o.suspended_at),
                observacao: o.observacao?.trim() || null,
                dias_para_repor: parseIntCell(o.dias_para_repor),
                ultima_reposicao: parseTs(o.ultima_reposicao),
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.estoqueMedicamentos++;
          }
        }

        const bEi = blocks.get('estoque_insumo');
        if (bEi) {
          for (const row of bEi.rows) {
            const o = rowByColumns(bEi.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldIns = parseIntCell(o.insumo_id);
            const newIns = oldIns != null ? mapIns.get(oldIns) : null;
            if (newIns == null) continue;

            const caselaNum = parseIntCell(o.casela_id);
            const oldArm = parseIntCell(o.armario_id);
            const oldGav = parseIntCell(o.gaveta_id);
            let armBig: bigint | null = null;
            let gavBig: bigint | null = null;
            if (oldArm != null) {
              const v = mapArm.get(oldArm);
              if (v != null) armBig = v;
            }
            if (oldGav != null) {
              const v = mapGav.get(oldGav);
              if (v != null) gavBig = v;
            }

            const setorKey = (o.setor ?? 'farmacia').trim().toLowerCase();
            const setorRow = await this.setorRepo.findByTenantAndKey(
              tenantId,
              setorKey,
              tx,
            );

            const validade = parseTs(o.validade);
            const q = parseIntCell(o.quantidade);
            if (!validade || q == null) continue;

            await tx.estoqueInsumo.create({
              data: {
                tenant_id: tenantId,
                insumo_id: newIns,
                casela_id: caselaNum,
                armario_id: armBig != null ? Number(armBig) : null,
                gaveta_id: gavBig != null ? Number(gavBig) : null,
                quantidade: q,
                validade,
                tipo: o.tipo ?? 'geral',
                setor: setorRow?.key ?? setorKey,
                sector_id: setorRow?.id ?? null,
                destino: o.destino?.trim() || null,
                lote: o.lote?.trim() || null,
                observacao: o.observacao?.trim() || null,
                status: o.status ?? 'active',
                suspended_at: parseTs(o.suspended_at),
                dias_para_repor: parseIntCell(o.dias_para_repor),
                ultima_reposicao: parseTs(o.ultima_reposicao),
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.estoqueInsumos++;
          }
        }

        const bMov = blocks.get('movimentacao');
        if (bMov) {
          for (const row of bMov.rows) {
            const o = rowByColumns(bMov.columns, row);
            if (!rowMatchesSourceTenant(o, sourceTenantId)) continue;
            const oldLogin = parseIntCell(o.login_id);
            const newLogin = oldLogin != null ? mapLogin.get(oldLogin) : null;
            if (newLogin == null) continue;

            const dt = parseTs(o.data);
            if (!dt) continue;

            const oldMed = parseIntCell(o.medicamento_id);
            const oldIns = parseIntCell(o.insumo_id);
            const newMed = oldMed != null ? mapMed.get(oldMed) : undefined;
            const newIns = oldIns != null ? mapIns.get(oldIns) : undefined;

            const oldArm = parseIntCell(o.armario_id);
            const oldGav = parseIntCell(o.gaveta_id);
            let armN: number | null = null;
            let gavN: number | null = null;
            if (oldArm != null) {
              const v = mapArm.get(oldArm);
              if (v != null) armN = Number(v);
            }
            if (oldGav != null) {
              const v = mapGav.get(oldGav);
              if (v != null) gavN = Number(v);
            }

            const setorKey = (o.setor ?? 'farmacia').trim().toLowerCase();
            const setorRow = await this.setorRepo.findByTenantAndKey(
              tenantId,
              setorKey,
              tx,
            );

            await tx.movimentacao.create({
              data: {
                tenant_id: tenantId,
                tipo: o.tipo ?? 'entrada',
                data: dt,
                login_id: newLogin,
                insumo_id: newIns ?? null,
                medicamento_id: newMed ?? null,
                armario_id: armN,
                gaveta_id: gavN,
                quantidade: parseIntCell(o.quantidade) ?? 0,
                casela_id: parseIntCell(o.casela_id),
                setor: setorRow?.key ?? setorKey,
                sector_id: setorRow?.id ?? null,
                destino: o.destino?.trim() || null,
                lote: o.lote?.trim() || null,
                observacao: o.observacao?.trim() || null,
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.movimentacoes++;
          }
        }

        const bNot = blocks.get('notificacao');
        if (bNot) {
          const hasTenantCol = hasColumn(bNot.columns, 'tenant_id');
          for (const row of bNot.rows) {
            const o = rowByColumns(bNot.columns, row);
            if (hasTenantCol && !rowMatchesSourceTenant(o, sourceTenantId)) {
              continue;
            }

            const oldMed = parseIntCell(o.medicamento_id);
            const newMed = oldMed != null ? mapMed.get(oldMed) : null;

            const oldRes = parseIntCell(o.residente_id);
            let resInt: number | null = null;
            if (oldRes != null) {
              if (mapOldResidentPkToCasela.has(oldRes)) {
                resInt = mapOldResidentPkToCasela.get(oldRes)!;
              } else {
                resInt = oldRes;
              }
            }

            const oldCriador = parseIntCell(o.criado_por);
            const newCriador =
              oldCriador != null ? mapLogin.get(oldCriador) : null;
            if (newCriador == null) continue;

            await tx.notificacao.create({
              data: {
                tenant_id: tenantId,
                tipo_evento: o.tipo_evento ?? 'reposicao',
                medicamento_id: newMed,
                residente_id: resInt,
                destino: o.destino ?? 'farmacia',
                data_prevista: parseDateOnly(o.data_prevista),
                criado_por: newCriador,
                status: o.status ?? 'ativo',
                visto: o.visto === 't' || o.visto === 'true',
                quantidade: parseIntCell(o.quantidade),
                dias_para_repor: parseIntCell(o.dias_para_repor),
                createdAt: parseTs(o.createdat) ?? undefined,
                updatedAt: parseTs(o.updatedat) ?? undefined,
              },
            });
            summary.notificacoes++;
          }
        }

        return { ok: true as const, warnings, summary };
      },
      { timeout: 600_000, maxWait: 60_000 },
    );
  }
}
