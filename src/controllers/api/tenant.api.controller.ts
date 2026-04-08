import {
  Controller,
  Get,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { tenantLogoUpload } from '@config/upload/multer-r2.config';
import { TenantController } from '@controllers/tenant.controller';
import { TenantInviteController } from '@controllers/tenant-invite.controller';
import { TenantId } from '@decorators/tenant-id.decorator';
import { UseExpressMwGuard } from '@middlewares/express.middleware';
import { requireAdmin } from '@middlewares/admin.middleware';
import {
  TenantBrandingBodyDto,
  TenantContractCodeBodyDto,
  TenantInviteCreateBodyDto,
  TenantModulesConfigBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const requireAdminGuard = UseExpressMwGuard(requireAdmin);
const inviteBody = UseValidatedBody(TenantInviteCreateBodyDto);
const contractBody = UseValidatedBody(TenantContractCodeBodyDto);
const modulesBody = UseValidatedBody(TenantModulesConfigBodyDto);
const brandingBody = UseValidatedBody(TenantBrandingBodyDto);
const logoUploadGuard = UseExpressMwGuard(
  requireAdmin,
  tenantLogoUpload.single('file'),
);

@ApiTags('Tenant')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('tenant')
export class TenantApiController {
  constructor(
    private readonly controller: TenantController,
    private readonly inviteController: TenantInviteController,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Configuração do tenant atual (módulos, etc.)' })
  config(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.getConfig(req, res, tenantId);
  }

  @Post('invites')
  @ApiOperation({ summary: '[Admin] Criar convite para utilizador' })
  @ApiBody({ type: TenantInviteCreateBodyDto })
  @UseGuards(inviteBody, requireAdminGuard)
  invites(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.inviteController.create(req, res, tenantId);
  }

  @Post('contract-code/claim')
  @ApiOperation({
    summary:
      'Abrigo provisório (u-*): validar código existente e associar a conta ao abrigo definitivo',
  })
  @ApiBody({ type: TenantContractCodeBodyDto })
  @UseGuards(contractBody)
  claimContractCode(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.claimContractCode(req, res, tenantId);
  }

  @Post('contract-code')
  @ApiOperation({
    summary: 'Definir ou atualizar código de contrato (tenant)',
  })
  @ApiBody({ type: TenantContractCodeBodyDto })
  @UseGuards(contractBody)
  contractCode(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.setContractCode(req, res, tenantId);
  }

  @Put('config')
  @ApiOperation({ summary: '[Admin] Atualizar configuração do tenant' })
  @ApiBody({ type: TenantModulesConfigBodyDto })
  @UseGuards(modulesBody, requireAdminGuard)
  putConfig(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.updateConfig(req, res, tenantId);
  }

  @Put('branding')
  @ApiOperation({ summary: '[Admin] Atualizar branding (JSON)' })
  @ApiBody({ type: TenantBrandingBodyDto })
  @UseGuards(brandingBody, requireAdminGuard)
  branding(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.updateBranding(req, res, tenantId);
  }

  @Post('branding/logo')
  @ApiOperation({ summary: '[Admin] Upload do logo (multipart campo `file`)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseGuards(logoUploadGuard)
  uploadLogo(
    @TenantId() tenantId: number,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    void this.controller.uploadLogo(req, res, tenantId);
  }
}
