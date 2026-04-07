import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicTenantsQueryDto {
  @ApiPropertyOptional({ description: 'Texto de pesquisa' })
  q?: string;

  @ApiPropertyOptional({ description: 'Limite de resultados' })
  limit?: number;
}

export class VerifyContractCodeDto {
  @ApiProperty({ description: 'Código de contrato em texto plano' })
  contract_code!: string;

  @ApiPropertyOptional()
  contractCode?: string;
}

export class AdminCreateTenantDto {
  @ApiProperty({ example: 'meu-abrigo' })
  slug!: string;

  @ApiProperty({ example: 'Nome do abrigo' })
  name!: string;

  @ApiPropertyOptional({ description: 'Código de contrato (opcional)' })
  contract_code?: string;
}

export class AdminUpdateTenantDto {
  @ApiPropertyOptional()
  slug?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Se true, remove vínculo com código de contrato',
  })
  clear_contract_code?: boolean;

  @ApiPropertyOptional({ description: 'Novo código de contrato' })
  contract_code?: string;
}

export class SetContractCodeBySlugDto {
  @ApiPropertyOptional({ description: 'Código de contrato em texto plano' })
  contract_code?: string;

  @ApiPropertyOptional({
    description: 'Se true, remove o vínculo com código de contrato',
  })
  clear_contract_code?: boolean;

  @ApiPropertyOptional({
    description: 'Nome do tenant (usado só se o slug ainda não existir)',
  })
  name?: string;
}

export class AdminTenantModulesBodyDto {
  @ApiProperty({
    description: 'Lista de chaves de módulos ativos',
    type: 'array',
    items: { type: 'string' },
    example: ['stock', 'medicines'],
  })
  modules!: string[];
}
