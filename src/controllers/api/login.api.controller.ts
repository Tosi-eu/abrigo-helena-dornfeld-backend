import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { LoginController } from '@controllers/login.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { authMiddleware } from '@middlewares/auth.middleware';
import {
  enforceTenantMiddleware,
  publicTenantContextMiddleware,
} from '@middlewares/tenant.middleware';
import { rlsContextMiddleware } from '@middlewares/rls.middleware';
import {
  bindPublicTenantToRlsTransaction,
  bindRequestToRlsTransaction,
} from '@middlewares/request-rls-transaction.middleware';
import { requireAdmin } from '@middlewares/admin.middleware';
import { requireModule } from '@middlewares/module.middleware';
import {
  loginSessionBlockAuditHandlers,
  loginSessionHandlers,
} from '@middlewares/middleware-stacks';
import {
  AuthenticateDto,
  CreateUserInTenantDto,
  JoinByTokenDto,
  RegisterAccountDto,
  RegisterShelterDto,
  RegisterUserDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from '@domain/dto/login.api.dto';

const skipRateLimitInTest: RequestHandler = (_req, _res, next) => next();

const loginLimiter =
  process.env.NODE_ENV === 'test'
    ? skipRateLimitInTest
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        message: {
          error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        },
        standardHeaders: true,
        legacyHeaders: false,
      });

const registerLimiter =
  process.env.NODE_ENV === 'test'
    ? skipRateLimitInTest
    : rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 2,
        message: {
          error: 'Muitas tentativas de cadastro. Tente novamente em 1 hora.',
        },
        standardHeaders: true,
        legacyHeaders: false,
      });

const registerGuard = UseExpressMwGuard(registerLimiter);
const loginLimitGuard = UseExpressMwGuard(loginLimiter);

const createLoginGuard = UseExpressMwGuard(
  registerLimiter,
  publicTenantContextMiddleware,
  bindPublicTenantToRlsTransaction,
);

const authenticateGuard = UseExpressMwGuard(
  loginLimiter,
  publicTenantContextMiddleware,
  bindPublicTenantToRlsTransaction,
);

const resetPasswordGuard = UseExpressMwGuard(
  authMiddleware,
  requireAdmin,
  enforceTenantMiddleware,
  rlsContextMiddleware,
  bindRequestToRlsTransaction,
);

const sessionGuard = UseExpressMwGuard(...loginSessionHandlers);
const sessionAuditGuard = UseExpressMwGuard(...loginSessionBlockAuditHandlers);
const profileGuard = UseExpressMwGuard(
  ...loginSessionBlockAuditHandlers,
  requireModule('profile'),
);

@ApiTags('Autenticação')
@Controller('login')
export class LoginApiController {
  constructor(private readonly controller: LoginController) {}

  @Post('register-account')
  @ApiOperation({
    summary: 'Registar conta (novo tenant provisório)',
    description:
      'E-mail + senha; opcionalmente nome e apelido. Usado no fluxo de primeiro acesso.',
  })
  @ApiBody({ type: RegisterAccountDto })
  @ApiResponse({ status: 201, description: 'Conta e tenant criados' })
  @ApiResponse({ status: 400, description: 'Validação' })
  @ApiResponse({ status: 409, description: 'E-mail já em uso' })
  @UseGuards(registerGuard)
  registerAccount(@Req() req: Request, @Res() res: Response): void {
    void this.controller.createAccount(req, res);
  }

  @Post('register-user')
  @ApiOperation({
    summary:
      'Registar utilizador (tenant provisório + código de contrato opcional)',
  })
  @ApiBody({ type: RegisterUserDto })
  @ApiResponse({ status: 201, description: 'Criado' })
  @ApiResponse({ status: 400, description: 'Validação' })
  @ApiResponse({ status: 409, description: 'Conflito' })
  @UseGuards(registerGuard)
  registerUser(@Req() req: Request, @Res() res: Response): void {
    void this.controller.registerUser(req, res);
  }

  @Post('register-shelter')
  @ApiOperation({
    summary: 'Registar abrigo (admin) com utilizador administrador',
  })
  @ApiBody({ type: RegisterShelterDto })
  @ApiResponse({ status: 201, description: 'Abrigo e admin criados' })
  @ApiResponse({ status: 400, description: 'Validação' })
  @UseGuards(registerGuard)
  registerShelter(@Req() req: Request, @Res() res: Response): void {
    void this.controller.registerShelter(req, res);
  }

  @Post('join-by-token')
  @ApiOperation({ summary: 'Completar registo com token de convite' })
  @ApiBody({ type: JoinByTokenDto })
  @ApiResponse({ status: 201, description: 'Utilizador criado no tenant' })
  @ApiResponse({ status: 400, description: 'Token ou credenciais em falta' })
  @UseGuards(registerGuard)
  joinByToken(@Req() req: Request, @Res() res: Response): void {
    void this.controller.joinByToken(req, res);
  }

  @Post()
  @ApiOperation({
    summary: 'Registar novo utilizador no tenant atual (público)',
    description:
      'Requer contexto de tenant (subdomínio / header). Pode exigir código de contrato.',
  })
  @ApiBody({ type: CreateUserInTenantDto })
  @ApiResponse({ status: 201, description: 'Utilizador criado' })
  @ApiResponse({
    status: 400,
    description: 'Validação ou contrato obrigatório',
  })
  @ApiResponse({ status: 403, description: 'Código de contrato inválido' })
  @ApiResponse({ status: 409, description: 'Login já cadastrado' })
  @UseGuards(createLoginGuard)
  create(@Req() req: Request, @Res() res: Response): void {
    void this.controller.create(req, res);
  }

  @Get('resolve-tenant')
  @ApiOperation({
    summary: 'Resolver slug do tenant a partir do e-mail',
    description: 'Query: `login` ou `email`.',
  })
  @ApiQuery({ name: 'login', required: false, example: 'a@b.com' })
  @ApiQuery({ name: 'email', required: false, example: 'a@b.com' })
  @ApiResponse({
    status: 200,
    description: '{ slug } ou resposta de ambiguidade',
  })
  @ApiResponse({ status: 404, description: 'Nenhum abrigo para o e-mail' })
  @ApiResponse({
    status: 409,
    description: 'E-mail associado a vários abrigos',
  })
  @UseGuards(loginLimitGuard)
  resolveTenant(@Req() req: Request, @Res() res: Response): void {
    void this.controller.resolveTenant(req, res);
  }

  @Get('tenants-for-email')
  @ApiOperation({ summary: 'Listar abrigos associados a um e-mail' })
  @ApiQuery({ name: 'login', required: false })
  @ApiQuery({ name: 'email', required: false })
  @ApiResponse({ status: 200, description: '{ tenants: [...] }' })
  @UseGuards(loginLimitGuard)
  tenantsForEmail(@Req() req: Request, @Res() res: Response): void {
    void this.controller.tenantsForEmail(req, res);
  }

  @Post('authenticate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autenticar no tenant atual (obter JWT / sessão)' })
  @ApiBody({ type: AuthenticateDto })
  @ApiResponse({
    status: 200,
    description: '{ token, user } ou cookie de sessão conforme configuração',
  })
  @ApiResponse({ status: 401, description: 'Credenciais inválidas' })
  @UseGuards(authenticateGuard)
  authenticate(@Req() req: Request, @Res() res: Response): void {
    void this.controller.authenticate(req, res);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefinir senha (admin do tenant)' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Utilizador atualizado' })
  @ApiResponse({ status: 404, description: 'Login não encontrado' })
  @UseGuards(resetPasswordGuard)
  resetPassword(@Req() req: Request, @Res() res: Response): void {
    void this.controller.resetPassword(req, res);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Terminar sessão' })
  @ApiSecurity('bearer')
  @ApiCookieAuth('authToken')
  @ApiResponse({ status: 200, description: 'Sessão terminada' })
  @UseGuards(sessionGuard)
  logout(@Req() req: Request, @Res() res: Response): void {
    void this.controller.logout(req, res);
  }

  @Get('display-config')
  @ApiOperation({ summary: 'Configuração de UI (sistema)' })
  @ApiSecurity('bearer')
  @ApiCookieAuth('authToken')
  @UseGuards(sessionGuard)
  displayConfig(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getDisplayConfig(req, res);
  }

  @Get('usuario-logado')
  @ApiOperation({ summary: 'Dados do utilizador autenticado' })
  @ApiSecurity('bearer')
  @ApiCookieAuth('authToken')
  @ApiResponse({ status: 200, description: 'Perfil do utilizador' })
  @UseGuards(sessionAuditGuard)
  usuarioLogado(@Req() req: Request, @Res() res: Response): void {
    void this.controller.getCurrentUser(req, res);
  }

  @Put()
  @ApiOperation({
    summary: 'Atualizar perfil (email, nome, senha)',
    description: 'Exige senha atual.',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiSecurity('bearer')
  @ApiCookieAuth('authToken')
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  @ApiResponse({ status: 401, description: 'Senha atual incorreta' })
  @UseGuards(profileGuard)
  update(@Req() req: Request, @Res() res: Response): void {
    void this.controller.update(req, res);
  }

  @Delete()
  @ApiOperation({ summary: 'Eliminar a própria conta' })
  @ApiSecurity('bearer')
  @ApiCookieAuth('authToken')
  @ApiResponse({ status: 204, description: 'Removido' })
  @ApiResponse({ status: 404, description: 'Utilizador não encontrado' })
  @UseGuards(profileGuard)
  delete(@Req() req: Request, @Res() res: Response): void {
    void this.controller.delete(req, res);
  }
}
