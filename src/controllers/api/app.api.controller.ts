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
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { AppController } from '@controllers/app.controller';
import { AdminTenantsController } from '@controllers/admin-tenants.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
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

const publicTenantWindowMs =
  Number(process.env.PUBLIC_TENANT_RATE_WINDOW_MS) || 60_000;
const publicTenantListMax = Number(process.env.PUBLIC_TENANT_LIST_MAX) || 120;
const publicTenantBrandingMax =
  Number(process.env.PUBLIC_TENANT_BRANDING_MAX) || 120;

const statusLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: 'Too many status requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const tenantListLimiter = rateLimit({
  windowMs: publicTenantWindowMs,
  max: publicTenantListMax,
  message:
    'Muitas requisições à lista de abrigos. Tente novamente em instantes.',
  standardHeaders: true,
  legacyHeaders: false,
});

const tenantBrandingLimiter = rateLimit({
  windowMs: publicTenantWindowMs,
  max: publicTenantBrandingMax,
  message: 'Muitas requisições de branding. Tente novamente em instantes.',
  standardHeaders: true,
  legacyHeaders: false,
});

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
const tenantBrandingGuard = UseExpressMwGuard(tenantBrandingLimiter);
const verifyContractGuard = UseExpressMwGuard(verifyContractCodeLimiter);
const tenantListGuard = UseExpressMwGuard(tenantListLimiter);

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
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Health simples do serviço' })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  @UseGuards(statusGuard)
  status(@Req() req: Request, @Res() res: Response): void {
    this.appController.getStatus(req, res);
  }

  @Get('public/app-config')
  @ApiOperation({ summary: 'Configuração pública da app (ex.: logo por defeito)' })
  @ApiResponse({ status: 200, description: '{ defaultLogoUrl }' })
  @UseGuards(statusGuard)
  publicAppConfig(@Req() req: Request, @Res() res: Response): void {
    this.appController.getPublicAppConfig(req, res);
  }

  @Get('tenants/:slug/branding')
  @ApiOperation({ summary: 'Branding público do abrigo (slug)' })
  @ApiParam({ name: 'slug', example: 'meu-abrigo' })
  @ApiResponse({ status: 200, description: 'Branding ou { found: false }' })
  @UseGuards(tenantBrandingGuard)
  tenantBranding(@Req() req: Request, @Res() res: Response): void {
    this.appController.getTenantPublicBranding(req, res);
  }

  @Get('public/tenants/:slug/logo')
  @ApiOperation({ summary: 'Stream do logo do abrigo' })
  @ApiParam({ name: 'slug', example: 'meu-abrigo' })
  @ApiProduces('image/png', 'image/jpeg', 'image/webp')
  @UseGuards(tenantBrandingGuard)
  streamLogoBySlug(@Req() req: Request, @Res() res: Response): void {
    this.appController.streamTenantLogoBySlug(req, res);
  }

  @Post('tenants/:slug/verify-contract-code')
  @ApiOperation({ summary: 'Verificar código de contrato para o abrigo' })
  @ApiParam({ name: 'slug' })
  @ApiBody({ type: VerifyContractCodeDto })
  @ApiResponse({ status: 200, description: 'Resultado da verificação' })
  @UseGuards(verifyContractGuard)
  verifyContractCode(@Req() req: Request, @Res() res: Response): void {
    this.appController.verifyTenantContractCode(req, res);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Listar abrigos públicos (directório)' })
  @ApiQuery({ name: 'q', required: false, description: 'Pesquisa' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: '{ data: [...] }' })
  @UseGuards(tenantListGuard)
  listTenants(@Req() req: Request, @Res() res: Response): void {
    this.appController.listTenants(req, res);
  }

  @Get('admin/tenants')
  @ApiOperation({ summary: '[Super-admin] Listar todos os tenants' })
  @ApiSecurity('bearer')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  @UseGuards(adminTenantsChain)
  adminListTenants(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.listTenants(req, res);
  }

  @Post('admin/tenants')
  @ApiOperation({ summary: '[Super-admin] Criar tenant' })
  @ApiSecurity('bearer')
  @ApiBody({ type: AdminCreateTenantDto })
  @ApiResponse({ status: 201, description: 'Tenant criado' })
  @UseGuards(adminTenantsChain)
  adminCreateTenant(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.createTenant(req, res);
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
    this.tenantsController.setContractCodeBySlug(req, res);
  }

  @Put('admin/tenants/:id')
  @ApiOperation({ summary: '[Super-admin] Atualizar tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminUpdateTenantDto })
  @UseGuards(adminTenantsChain)
  adminUpdateTenant(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.updateTenant(req, res);
  }

  @Delete('admin/tenants/:id')
  @ApiOperation({ summary: '[Super-admin] Remover tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: '{ ok: true }' })
  @UseGuards(adminTenantsChain)
  adminDeleteTenant(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.deleteTenant(req, res);
  }

  @Get('admin/tenants/:id/config')
  @ApiOperation({ summary: '[Super-admin] Obter config de módulos do tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(adminTenantsChain)
  getTenantConfig(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.getTenantConfig(req, res);
  }

  @Put('admin/tenants/:id/config')
  @ApiOperation({ summary: '[Super-admin] Definir módulos do tenant' })
  @ApiSecurity('bearer')
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: AdminTenantModulesBodyDto })
  @UseGuards(adminTenantsChain)
  setTenantConfig(@Req() req: Request, @Res() res: Response): void {
    this.tenantsController.setTenantConfig(req, res);
  }
}
