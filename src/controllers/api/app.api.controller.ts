import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthRequest } from '@middlewares/auth.middleware';
import type { Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { getRuntimeHttpConfig } from '@config/http/runtime-http-config';
import { AppController } from '@controllers/app.controller';
import { AdminController } from '@controllers/admin.controller';
import { AdminTenantsController } from '@controllers/admin-tenants.controller';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { optionalAuthMiddleware } from '@middlewares/auth.middleware';
import { requireSuperAdminOrApiKey } from '@middlewares/super-admin.middleware';
import { bindSuperAdminRlsTransaction } from '@middlewares/request-rls-transaction.middleware';
import {
  AdminCreateTenantDto,
  AdminTenantModulesBodyDto,
  AdminUpdateTenantDto,
  SetContractCodeBySlugDto,
  VerifyContractCodeDto,
} from '@domain/dto/app.api.dto';

const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many status requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

function buildPublicTenantListLimiter(): ReturnType<typeof rateLimit> {
  const pt = getRuntimeHttpConfig().rateLimits.publicTenant;
  return rateLimit({
    windowMs: pt.windowMs,
    max: pt.listMax,
    message:
      'Muitas requisições à lista de abrigos. Tente novamente em instantes.',
    standardHeaders: true,
    legacyHeaders: false,
  });
}

function buildPublicTenantBrandingLimiter(): ReturnType<typeof rateLimit> {
  const pt = getRuntimeHttpConfig().rateLimits.publicTenant;
  return rateLimit({
    windowMs: pt.windowMs,
    max: pt.brandingMax,
    message: 'Muitas requisições de branding. Tente novamente em instantes.',
    standardHeaders: true,
    legacyHeaders: false,
  });
}

let tenantListLimiterImpl = buildPublicTenantListLimiter();
let tenantBrandingLimiterImpl = buildPublicTenantBrandingLimiter();

const tenantListLimiterWrap: RequestHandler = (req, res, next) =>
  tenantListLimiterImpl(req, res, next);

const tenantBrandingLimiterWrap: RequestHandler = (req, res, next) =>
  tenantBrandingLimiterImpl(req, res, next);

export function rebuildPublicTenantLimitersFromConfig(): void {
  tenantListLimiterImpl = buildPublicTenantListLimiter();
  tenantBrandingLimiterImpl = buildPublicTenantBrandingLimiter();
}

const verifyContractCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: {
    error: 'Muitas tentativas de verificação. Aguarde alguns minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const systemTenantsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: {
    error: 'Muitas requisições. Tente novamente em breve.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const statusGuard = UseExpressMwGuard(statusLimiter);
const tenantBrandingGuard = UseExpressMwGuard(tenantBrandingLimiterWrap);
const verifyContractGuard = UseExpressMwGuard(verifyContractCodeLimiter);
const tenantListGuard = UseExpressMwGuard(tenantListLimiterWrap);

const adminTenantsChain = UseExpressMwGuard(
  bindSuperAdminRlsTransaction,
  systemTenantsLimiter,
  optionalAuthMiddleware,
  requireSuperAdminOrApiKey,
);

@ApiTags('App e público')
@Controller()
export class AppApiController {
  constructor(
    private readonly appController: AppController,
    private readonly tenantsController: AdminTenantsController,
    private readonly adminController: AdminController,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Health simples do serviço' })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  @UseGuards(statusGuard)
  status(@Req() req: Request, @Res() res: Response): void {
    void this.appController.getStatus(req, res);
  }

  @Get('public/app-config')
  @ApiOperation({
    summary: 'Configuração pública da app (ex.: logo por defeito)',
  })
  @ApiResponse({ status: 200, description: '{ defaultLogoUrl }' })
  @UseGuards(statusGuard)
  publicAppConfig(@Req() req: Request, @Res() res: Response): void {
    void this.appController.getPublicAppConfig(req, res);
  }

  @Get('tenants/:slug/branding')
  @ApiOperation({ summary: 'Branding público do abrigo (slug)' })
  @ApiParam({ name: 'slug', example: 'meu-abrigo' })
  @ApiResponse({ status: 200, description: 'Branding ou { found: false }' })
  @UseGuards(tenantBrandingGuard)
  tenantBranding(@Req() req: Request, @Res() res: Response): void {
    void this.appController.getTenantPublicBranding(req, res);
  }

  @Get('public/tenants/:slug/logo')
  @ApiOperation({ summary: 'Stream do logo do abrigo' })
  @ApiParam({ name: 'slug', example: 'meu-abrigo' })
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @UseGuards(tenantBrandingGuard)
  streamLogoBySlug(@Req() req: Request, @Res() res: Response): void {
    void this.appController.streamTenantLogoBySlug(req, res);
  }

  @Post('tenants/:slug/verify-contract-code')
  @ApiOperation({ summary: 'Verificar código de contrato para o abrigo' })
  @ApiParam({ name: 'slug' })
  @ApiBody({ type: VerifyContractCodeDto })
  @ApiResponse({ status: 200, description: 'Resultado da verificação' })
  @UseGuards(verifyContractGuard)
  verifyContractCode(@Req() req: Request, @Res() res: Response): void {
    void this.appController.verifyTenantContractCode(req, res);
  }

  @Post('contract-code/verify')
  @ApiOperation({
    summary:
      'Verificar código de contrato (cadastro público): valida hash, estado e e-mail reservado; não bloqueia só por existir abrigo provisório com o mesmo código',
  })
  @ApiBody({ type: VerifyContractCodeDto })
  @ApiResponse({ status: 200, description: '{ valid: boolean }' })
  @UseGuards(verifyContractGuard)
  verifyContractCodeForSignup(@Req() req: Request, @Res() res: Response): void {
    void this.appController.verifyContractCodeForSignup(req, res);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Listar abrigos públicos (directório)' })
  @ApiQuery({ name: 'q', required: false, description: 'Pesquisa' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '{ data: [...] }' })
  @UseGuards(tenantListGuard)
  listTenants(@Req() req: Request, @Res() res: Response): void {
    void this.appController.listTenants(req, res);
  }

  @Get('admin/tenants')
  @ApiOperation({ summary: '[Super-admin] Listar todos os tenants' })
  @ApiSecurity('bearer')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  @UseGuards(adminTenantsChain)
  adminListTenants(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.listTenants(req, res);
  }

  @Post('admin/tenants')
  @ApiOperation({ summary: '[Super-admin] Criar tenant' })
  @ApiSecurity('bearer')
  @ApiBody({ type: AdminCreateTenantDto })
  @ApiResponse({ status: 201, description: 'Tenant criado' })
  @UseGuards(adminTenantsChain)
  adminCreateTenant(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.createTenant(req, res);
  }

  @Put('admin/tenants/by-slug/:slug/contract-code')
  @ApiOperation({
    summary: '[Super-admin] Definir ou limpar código de contrato por slug',
  })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'slug' })
  @ApiBody({ type: SetContractCodeBySlugDto })
  @UseGuards(adminTenantsChain)
  setContractCodeBySlug(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.setContractCodeBySlug(req, res);
  }

  @Put('admin/tenants/:id')
  @ApiOperation({ summary: '[Super-admin] Atualizar tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminUpdateTenantDto })
  @UseGuards(adminTenantsChain)
  adminUpdateTenant(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.updateTenant(req, res);
  }

  @Delete('admin/tenants/:id')
  @ApiOperation({ summary: '[Super-admin] Remover tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  @UseGuards(adminTenantsChain)
  adminDeleteTenant(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.deleteTenant(req, res);
  }

  @Get('admin/tenants/:id/config')
  @ApiOperation({ summary: '[Super-admin] Obter config de módulos do tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(adminTenantsChain)
  getTenantConfig(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.getTenantConfig(req, res);
  }

  @Put('admin/tenants/:id/config')
  @ApiOperation({ summary: '[Super-admin] Definir módulos do tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminTenantModulesBodyDto })
  @UseGuards(adminTenantsChain)
  setTenantConfig(@Req() req: Request, @Res() res: Response): void {
    void this.tenantsController.setTenantConfig(req, res);
  }

  @Get('admin/infra-health')
  @ApiOperation({
    summary:
      '[Super-admin] Saúde da infraestrutura (PostgreSQL, Redis, Temporal)',
  })
  @ApiSecurity('bearer')
  @ApiResponse({ status: 200, description: 'Estado por serviço' })
  @UseGuards(adminTenantsChain)
  infraHealth(@Req() req: Request, @Res() res: Response): void {
    void this.adminController.getInfraHealth(req as AuthRequest, res);
  }

  @Get('admin/backup/status')
  @ApiOperation({ summary: '[Super-admin] Estado dos backups' })
  @ApiSecurity('bearer')
  @UseGuards(adminTenantsChain)
  backupStatus(@Req() req: Request, @Res() res: Response): void {
    void this.adminController.getBackupStatus(req as AuthRequest, res);
  }

  @Post('admin/backup/run')
  @ApiOperation({
    summary: '[Super-admin] Disparar backup agora (workflow Temporal)',
  })
  @ApiSecurity('bearer')
  @UseGuards(adminTenantsChain)
  backupRun(@Req() req: Request, @Res() res: Response): void {
    void this.adminController.runBackupNow(req as AuthRequest, res);
  }
}
