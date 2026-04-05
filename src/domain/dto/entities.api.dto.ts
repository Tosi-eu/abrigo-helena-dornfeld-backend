import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { ContractCodeOrCamelConstraint } from '@validation/constraints/contract-code.constraint';
import {
  EmailNormalized,
  OptionalTrimmedString,
  TrimmedString,
} from '@decorators/trim.decorators';

/** Supplies (insumo) — create / update body */
export class InputBodyDto {
  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Luvas descartáveis' })
  nome!: string;

  @OptionalTrimmedString(255)
  @ApiPropertyOptional({ example: 'Caixa 100un' })
  descricao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 5 })
  estoque_minimo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ApiPropertyOptional({ example: 12.5, description: 'Unit price' })
  preco?: number | null;
}

/** Medicines — create / update body */
export class MedicineBodyDto {
  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Paracetamol' })
  nome!: string;

  @TrimmedString(1, 120)
  @ApiProperty({ example: '500' })
  dosagem!: string;

  @TrimmedString(1, 80)
  @ApiProperty({ example: 'mg' })
  unidade_medida!: string;

  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Analgésico' })
  principio_ativo!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 10 })
  estoque_minimo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ApiPropertyOptional({ example: 8.9 })
  preco?: number | null;
}

/** Drawer create */
export class DrawerCreateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 12 })
  numero!: number;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 3 })
  categoria_id!: number;
}

/** Drawer update (category only) */
export class DrawerUpdateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 3 })
  categoria_id!: number;
}

/** Cabinet create */
export class CabinetCreateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 5 })
  numero!: number;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 2 })
  categoria_id!: number;
}

/** Cabinet update (category only) */
export class CabinetUpdateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 2 })
  categoria_id!: number;
}

/** Category name (drawer / cabinet) */
export class CategoryNomeBodyDto {
  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Psicotrópicos' })
  nome!: string;
}

/** Resident create */
export class ResidentCreateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 101 })
  casela!: number;

  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Maria Silva' })
  nome!: string;
}

/** Resident update (casela in path) */
export class ResidentUpdateBodyDto {
  @TrimmedString(1, 255)
  @ApiProperty({ example: 'Maria Silva' })
  nome!: string;
}

/** Movement create (`tenant_id` is injected server-side) */
export class MovementCreateBodyDto {
  @IsIn(['entrada', 'saida', 'transferencia'])
  @ApiProperty({ example: 'entrada', description: 'entrada | saida | transferencia' })
  tipo!: string;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  login_id!: number;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 10, minimum: 1 })
  quantidade!: number;

  @IsIn(['farmacia', 'enfermagem'])
  @ApiProperty({
    example: 'farmacia',
    enum: ['farmacia', 'enfermagem'],
  })
  setor!: 'farmacia' | 'enfermagem';

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 1 })
  armario_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 2 })
  gaveta_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 5 })
  medicamento_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 8 })
  insumo_id?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 12 })
  casela_id?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'ISO date string or omitted (defaults to now)',
  })
  validade?: string | Date;
}

/** Notification create (`tenant_id` injected) */
export class NotificationCreateBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  medicamento_id!: number;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 2 })
  residente_id!: number;

  @IsIn(['sus', 'familia', 'farmacia', 'estoque'])
  @ApiProperty({ enum: ['sus', 'familia', 'farmacia', 'estoque'] })
  destino!: string;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '2026-06-01' })
  data_prevista!: string;

  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  criado_por!: number;

  @IsBoolean()
  @ApiProperty({ example: false })
  visto!: boolean;

  @IsIn(['medicamento', 'reposicao_estoque'])
  @ApiProperty({
    enum: ['medicamento', 'reposicao_estoque'],
  })
  tipo_evento!: string;
}

/** Notification update */
export class NotificationUpdateBodyDto {
  @IsOptional()
  @IsIn(['pending', 'sent', 'cancelled'])
  @ApiPropertyOptional({ enum: ['pending', 'sent', 'cancelled'] })
  status?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  visto?: boolean;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  data_prevista?: string;

  @IsOptional()
  @IsIn(['sus', 'familia', 'farmacia', 'estoque'])
  @ApiPropertyOptional({ enum: ['sus', 'familia', 'farmacia', 'estoque'] })
  destino?: string;
}

/** Medicine stock-in (branch when `medicamento_id` is sent) */
export class MedicineStockInBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 1 })
  medicamento_id!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 1 })
  armario_id?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 2 })
  gaveta_id?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 3 })
  casela_id?: number | null;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '2027-01-15' })
  validade!: string | Date;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 20 })
  quantidade!: number;

  @TrimmedString(1, 120)
  @ApiProperty({ example: 'UBS' })
  origem!: string;

  @TrimmedString(1, 80)
  @ApiProperty({ example: 'geral' })
  tipo!: string;

  @IsOptional()
  @IsIn(['farmacia', 'enfermagem'])
  @ApiPropertyOptional({ example: 'farmacia', enum: ['farmacia', 'enfermagem'] })
  setor?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  lote?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  observacao?: string | null;
}

/** Input stock-in (branch when `insumo_id` is sent) */
export class InputStockInBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 5 })
  insumo_id!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 1 })
  armario_id?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 2 })
  gaveta_id?: number | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 3 })
  casela_id?: number | null;

  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: '2027-06-01' })
  validade!: string | Date;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 15 })
  quantidade!: number;

  @TrimmedString(1, 80)
  @ApiProperty({ example: 'geral' })
  tipo!: string;

  @IsOptional()
  @IsIn(['farmacia', 'enfermagem'])
  @ApiPropertyOptional({ example: 'farmacia', enum: ['farmacia', 'enfermagem'] })
  setor?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  lote?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  observacao?: string | null;
}

/** Stock-out */
export class StockOutBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 42 })
  estoqueId!: number;

  @IsIn(['medicamento', 'insumo'])
  @ApiProperty({ example: 'medicamento', enum: ['medicamento', 'insumo'] })
  tipo!: string;

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 2 })
  quantidade!: number;
}

/** Transfer medicine between sectors */
export class TransferMedicineSectorBodyDto {
  @IsIn(['farmacia', 'enfermagem'])
  @ApiProperty({ enum: ['farmacia', 'enfermagem'] })
  setor!: 'farmacia' | 'enfermagem';

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 5 })
  quantidade!: number;

  @IsBoolean()
  @ApiProperty({ example: true })
  bypassCasela!: boolean;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional({ example: 7 })
  casela_id?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  observacao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional({ example: 3 })
  dias_para_repor?: number | null;
}

/** Transfer input between sectors */
export class TransferInputSectorBodyDto {
  @IsIn(['farmacia', 'enfermagem'])
  @ApiProperty({ enum: ['farmacia', 'enfermagem'] })
  setor!: 'farmacia' | 'enfermagem';

  @IsInt()
  @Min(1)
  @ApiProperty({ example: 3 })
  quantidade!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @ApiPropertyOptional()
  casela_id?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  destino?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  observacao?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional()
  dias_para_repor?: number | null;
}

/** Update stock line */
export class UpdateStockItemBodyDto {
  @IsIn(['medicamento', 'insumo'])
  @ApiProperty({ enum: ['medicamento', 'insumo'] })
  tipo!: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Stock subtype / internal tipo string' })
  stockTipo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional()
  quantidade?: number;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  armario_id?: number | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  gaveta_id?: number | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  validade?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  origem?: string | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  setor?: string;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  lote?: string | null;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional()
  casela_id?: number | null;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional()
  preco?: number | null;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  observacao?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @ApiPropertyOptional()
  dias_para_repor?: number | null;
}

export class AdminPermissionsDto {
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @IsOptional()
  @IsBoolean()
  update?: boolean;

  @IsOptional()
  @IsBoolean()
  delete?: boolean;
}

/** Tenant invite */
export class TenantInviteCreateBodyDto {
  @EmailNormalized()
  @ApiProperty({
    example: 'user@example.com',
    description: 'Guest email (alias field: `to`)',
  })
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  @ApiPropertyOptional({ example: 7, description: 'Expiry in days (1–365)' })
  expires_in_days?: number;

  @IsOptional()
  @IsIn(['user', 'admin'])
  @ApiPropertyOptional({ enum: ['user', 'admin'] })
  role?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AdminPermissionsDto)
  @ApiPropertyOptional({
    description: 'Permission flags object',
    example: { read: true, create: true, update: false, delete: false },
  })
  permissions?: AdminPermissionsDto;
}

/** Set contract code */
export class TenantContractCodeBodyDto {
  @OptionalTrimmedString(255)
  @ApiPropertyOptional({ example: 'ABC123' })
  contract_code?: string;

  @OptionalTrimmedString(255)
  @ApiPropertyOptional({ description: 'CamelCase alias for contract_code' })
  contractCode?: string;

  @Allow()
  @Validate(ContractCodeOrCamelConstraint)
  _contractCodePresent?: never;
}

/** Tenant modules config (PUT /tenant/config) */
export class TenantModulesConfigBodyDto {
  @IsObject()
  @ApiProperty({
    description: 'Module flags keyed by module id',
    example: { stock: true, drawers: true, cabinets: true },
  })
  modules!: Record<string, unknown>;
}

/** Tenant branding JSON */
export class TenantBrandingBodyDto {
  @OptionalTrimmedString(160)
  @ApiPropertyOptional({ maxLength: 160 })
  brandName?: string;

  @IsOptional()
  @Matches(/^https:\/\/.+/i, { message: 'logoUrl must be an https URL' })
  @MaxLength(2048)
  @ApiPropertyOptional({ description: 'HTTPS URL to logo' })
  logoUrl?: string;
}

/** Admin create user */
export class AdminCreateUserBodyDto {
  @TrimmedString(1, 255)
  @ApiProperty()
  login!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @ApiProperty()
  password!: string;

  @OptionalTrimmedString(45)
  @ApiPropertyOptional()
  firstName?: string;

  @OptionalTrimmedString(45)
  @ApiPropertyOptional()
  lastName?: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  @ApiPropertyOptional({ enum: ['admin', 'user'] })
  role?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPermissionsDto)
  @ApiPropertyOptional()
  permissions?: AdminPermissionsDto;
}

/** Admin update user */
export class AdminUpdateUserBodyDto {
  @OptionalTrimmedString(45)
  @ApiPropertyOptional()
  firstName?: string;

  @OptionalTrimmedString(45)
  @ApiPropertyOptional()
  lastName?: string;

  @OptionalTrimmedString(255)
  @ApiPropertyOptional()
  login?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  @ApiPropertyOptional()
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'user'])
  @ApiPropertyOptional({ enum: ['admin', 'user'] })
  role?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminPermissionsDto)
  @ApiPropertyOptional()
  permissions?: AdminPermissionsDto;
}

/** Merge duplicate medicines */
export class AdminMergeMedicinesBodyDto {
  @IsInt()
  @IsPositive()
  @ApiProperty({ example: 10 })
  keepId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @ApiProperty({ type: Number, isArray: true, example: [11, 12] })
  mergeIds!: number[];
}

/** Normalize medicine units */
export class AdminNormalizeUnitsBodyDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'If true, only report changes without updating DB',
  })
  dryRun?: boolean;
}

/** Admin patch notification */
export class AdminPatchNotificationBodyDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  visto?: boolean;

  @IsOptional()
  @IsIn(['pending', 'sent', 'cancelled'])
  @ApiPropertyOptional({ enum: ['pending', 'sent', 'cancelled'] })
  status?: string;
}