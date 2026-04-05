import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Campos comuns de e-mail + senha. */
export class LoginEmailPasswordDto {
  @ApiPropertyOptional({
    description: 'E-mail de login (alternativa ao campo `login`)',
    example: 'user@example.com',
  })
  email?: string;

  @ApiPropertyOptional({
    description: 'Identificador de login (alternativa ao `email`)',
    example: 'user@example.com',
  })
  login?: string;

  @ApiProperty({ description: 'Senha em texto plano (HTTPS obrigatório em produção)' })
  password!: string;
}

export class RegisterAccountDto extends LoginEmailPasswordDto {
  @ApiPropertyOptional({ example: 'Maria' })
  first_name?: string;

  @ApiPropertyOptional({ example: 'Silva' })
  last_name?: string;
}

export class RegisterUserDto extends RegisterAccountDto {
  @ApiPropertyOptional({
    description: 'Código de contrato (quando o abrigo exige)',
    example: 'ABC123',
  })
  contract_code?: string;

  @ApiPropertyOptional({ description: 'Alias camelCase de contract_code' })
  contractCode?: string;
}

export class RegisterShelterDto extends RegisterAccountDto {
  @ApiProperty({ description: 'Slug único do abrigo', example: 'abrigo-norte' })
  slug!: string;

  @ApiProperty({ description: 'Nome do abrigo', example: 'Abrigo Norte' })
  name!: string;

  @ApiPropertyOptional({ description: 'Código de contrato' })
  contract_code?: string;

  @ApiPropertyOptional()
  contractCode?: string;
}

export class JoinByTokenDto extends LoginEmailPasswordDto {
  @ApiProperty({ description: 'Token do convite' })
  token!: string;

  @ApiPropertyOptional()
  first_name?: string;

  @ApiPropertyOptional()
  last_name?: string;
}

export class CreateUserInTenantDto extends RegisterAccountDto {
  @ApiPropertyOptional()
  contract_code?: string;

  @ApiPropertyOptional()
  contractCode?: string;
}

export class AuthenticateDto extends LoginEmailPasswordDto {}

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  login!: string;

  @ApiProperty({ description: 'Nova senha' })
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ description: 'Senha atual (obrigatória para qualquer alteração)' })
  currentPassword!: string;

  @ApiPropertyOptional({ description: 'Novo e-mail/login' })
  login?: string;

  @ApiPropertyOptional({ description: 'Nova senha' })
  password?: string;

  @ApiPropertyOptional()
  firstName?: string;

  @ApiPropertyOptional()
  lastName?: string;
}

export class ResolveTenantQueryDto {
  @ApiPropertyOptional({ description: 'E-mail', example: 'a@b.com' })
  email?: string;

  @ApiPropertyOptional({ description: 'Login/e-mail', example: 'a@b.com' })
  login?: string;
}
