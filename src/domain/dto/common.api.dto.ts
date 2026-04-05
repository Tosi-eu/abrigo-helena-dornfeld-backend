import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, description: 'Página (≥1)' })
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    description: 'Itens por página (máx. 100)',
  })
  limit?: number;
}

export class ApiErrorDto {
  @ApiProperty({ example: 'Mensagem de erro' })
  error!: string;
}

export const JSON_BODY = {
  schema: {
    type: 'object',
    additionalProperties: true,
    description:
      'Objeto JSON; campos dependem do endpoint (ver código ou documentação funcional).',
  },
} as const;

export const STRING_MAP_BODY = {
  schema: {
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Arbitrary string keys mapped to string values',
  },
} as const;

export const NO_JSON_BODY = {
  schema: {
    type: 'object',
    properties: {},
    description: 'No request body required',
  },
} as const;
