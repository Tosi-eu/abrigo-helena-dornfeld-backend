import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { NotificationEventController } from '@controllers/notificacao.controller';
import { UseExpressMwGuard } from '@guards/express-middleware.guard';
import { requireModule } from '@middlewares/module.middleware';
import {
  validateIdParam,
  validatePagination,
} from '@middlewares/validation.middleware';
import {
  NotificationCreateBodyDto,
  NotificationUpdateBodyDto,
} from '@domain/dto/entities.api.dto';
import { UseValidatedBody } from '@validation/use-validated-body.guard';

const notModule = UseExpressMwGuard(requireModule('notifications'));
const notPaginate = UseExpressMwGuard(
  validatePagination,
  requireModule('notifications'),
);
const notId = UseExpressMwGuard(validateIdParam, requireModule('notifications'));
const notCreateBody = UseValidatedBody(NotificationCreateBodyDto);
const notPatchBody = UseValidatedBody(NotificationUpdateBodyDto);

@ApiTags('Notificações')
@ApiSecurity('bearer')
@ApiCookieAuth('authToken')
@Controller('notificacao')
export class NotificacaoApiController {
  constructor(private readonly controller: NotificationEventController) {}

  @Post()
  @ApiOperation({ summary: 'Criar evento de notificação' })
  @ApiBody({ type: NotificationCreateBodyDto })
  @UseGuards(notCreateBody, notModule)
  create(@Req() req: Request, @Res() res: Response): void {
    this.controller.create(req, res);
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificações (paginado)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @UseGuards(notPaginate)
  getAll(@Req() req: Request, @Res() res: Response): void {
    this.controller.getAll(req, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter notificação por id' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(notId)
  getById(@Req() req: Request, @Res() res: Response): void {
    this.controller.getById(req, res);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar notificação' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: NotificationUpdateBodyDto })
  @UseGuards(notPatchBody, notId)
  patch(@Req() req: Request, @Res() res: Response): void {
    this.controller.update(req, res);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar notificação' })
  @ApiParam({ name: 'id', type: Number })
  @UseGuards(notId)
  delete(@Req() req: Request, @Res() res: Response): void {
    this.controller.delete(req, res);
  }
}
