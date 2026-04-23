import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { PrismaLoginRepository } from '@repositories/login.repository';
import { PrismaLoginLogRepository } from '@repositories/login-log.repository';
import { PrismaSystemConfigRepository } from '@repositories/system-config.repository';
import { LoginService } from '@services/login.service';
import { LoginController } from '@controllers/login.controller';
import { AppController } from '@controllers/app.controller';
import { AdminTenantsController } from '@controllers/admin-tenants.controller';
import { PrismaReportRepository } from '@repositories/relatorio.repository';
import { PrismaNotificationEventRepository } from '@repositories/notificacao.repository';
import { PrismaMovementRepository } from '@repositories/movimentacao.repository';
import { PrismaAuditRepository } from '@repositories/audit.repository';
import { PrismaTenantConfigRepository } from '@repositories/tenant-config.repository';
import { PrismaSetorRepository } from '@repositories/setor.repository';
import { TenantConfigService } from '@services/tenant-config.service';
import { ReportService } from '@services/relatorio.service';
import { NotificationEventService } from '@services/notificacao.service';
import { MovementService } from '@services/movimentacao.service';
import { AdminController } from '@controllers/admin.controller';
import { cacheService } from '@config/redis.client';
import { PrismaStockRepository } from '@repositories/estoque.repository';
import { StockService } from '@services/estoque.service';
import { DashboardService } from '@services/dashboard.service';
import { DashboardController } from '@controllers/dashboard.controller';
import { StockController } from '@controllers/estoque.controller';
import { MovementController } from '@controllers/movimentacao.controller';
import { ReportController } from '@controllers/relatorio.controller';
import { TenantController } from '@controllers/tenant.controller';
import { TenantInviteController } from '@controllers/tenant-invite.controller';
import { PrismaResidentRepository } from '@repositories/residente.repository';
import { ResidentService } from '@services/residente.service';
import { ResidentController } from '@controllers/residente.controller';
import { NotificationEventController } from '@controllers/notificacao.controller';
import { PrismaMedicineRepository } from '@repositories/medicamento.repository';
import { MedicineService } from '@services/medicamento.service';
import { MedicineController } from '@controllers/medicamento.controller';
import { priceSearchService } from '@helpers/price-service.helper';
import { PrismaInputRepository } from '@repositories/insumo.repository';
import { InputService } from '@services/insumo.service';
import { InsumoController } from '@controllers/insumo.controller';
import { PrismaDrawerRepository } from '@repositories/gaveta.repository';
import { DrawerService } from '@services/gaveta.service';
import { DrawerController } from '@controllers/gaveta.controller';
import { PrismaDrawerCategoryRepository } from '@repositories/categoria-gaveta.repository';
import { DrawerCategoryService } from '@services/categoria-gaveta.service';
import { DrawerCategoryController } from '@controllers/categoria-gaveta.controller';
import { PrismaCabinetCategoryRepository } from '@repositories/categoria-armario.repository';
import { CabinetCategoryService } from '@services/categoria-armario.service';
import { CabinetCategoryController } from '@controllers/categoria-armario.controller';
import { PrismaCabinetRepository } from '@repositories/armario.repository';
import { CabinetService } from '@services/armario.service';
import { CabinetController } from '@controllers/armario.controller';
import { LoginApiController } from '@controllers/api/login.api.controller';
import { AppApiController } from '@controllers/api/app.api.controller';
import { AdminApiController } from '@controllers/api/admin.api.controller';
import { DashboardApiController } from '@controllers/api/dashboard.api.controller';
import { EstoqueApiController } from '@controllers/api/estoque.api.controller';
import { MovimentacaoApiController } from '@controllers/api/movimentacao.api.controller';
import { RelatorioApiController } from '@controllers/api/relatorio.api.controller';
import { TenantApiController } from '@controllers/api/tenant.api.controller';
import { ResidenteApiController } from '@controllers/api/residente.api.controller';
import { NotificacaoApiController } from '@controllers/api/notificacao.api.controller';
import { MedicamentoApiController } from '@controllers/api/medicamento.api.controller';
import { InsumoApiController } from '@controllers/api/insumo.api.controller';
import { GavetaApiController } from '@controllers/api/gaveta.api.controller';
import { CategoriaGavetaApiController } from '@controllers/api/categoria-gaveta.api.controller';
import { CategoriaArmarioApiController } from '@controllers/api/categoria-armario.api.controller';
import { ArmarioApiController } from '@controllers/api/armario.api.controller';
import { SetorApiController } from '@controllers/api/setor.api.controller';
import { SetorController } from '@controllers/setor.controller';
import { TenantImportApiController } from '@controllers/api/tenant-import.api.controller';
import { TenantImportController } from '@controllers/tenant-import.controller';
import { TenantImportService } from '@services/tenant-import.service';
import {
  AdminPanelLimiterNest,
  RequireAdminNest,
  StandardProtectedMiddleware,
  TenantMiddlewareNest,
} from '@middlewares/middleware-stacks';

const loginRepo = new PrismaLoginRepository();
const loginLogRepo = new PrismaLoginLogRepository();
const systemConfigRepo = new PrismaSystemConfigRepository();
const loginService = new LoginService(loginRepo);
const loginController = new LoginController(
  loginService,
  loginLogRepo,
  systemConfigRepo,
);

const appController = new AppController();
const adminTenantsController = new AdminTenantsController();

const reportRepo = new PrismaReportRepository();
const setorRepo = new PrismaSetorRepository();
const tenantConfigService = new TenantConfigService(
  new PrismaTenantConfigRepository(),
  setorRepo,
);
const notificationRepo = new PrismaNotificationEventRepository();
const reportService = new ReportService(reportRepo, cacheService);
const notificationService = new NotificationEventService(
  notificationRepo,
  tenantConfigService,
);
const auditRepo = new PrismaAuditRepository();
const movementRepo = new PrismaMovementRepository();
const movementService = new MovementService(movementRepo, cacheService);
const adminController = new AdminController(
  loginService,
  auditRepo,
  movementService,
  loginLogRepo,
  reportService,
  systemConfigRepo,
  notificationService,
);

const stockRepo = new PrismaStockRepository();
const stockService = new StockService(
  stockRepo,
  cacheService,
  notificationRepo,
);
const dashboardService = new DashboardService(
  stockService,
  movementService,
  cacheService,
  tenantConfigService,
  setorRepo,
);
const dashboardController = new DashboardController(dashboardService);
const setorController = new SetorController();

const stockController = new StockController(stockService);
const movementController = new MovementController(movementService);
const reportController = new ReportController(reportService);

const tenantController = new TenantController();
const tenantInviteController = new TenantInviteController();

const residentRepo = new PrismaResidentRepository();
const residentService = new ResidentService(residentRepo);
const residentController = new ResidentController(residentService);

const notificationEventService = new NotificationEventService(notificationRepo);
const notificationEventController = new NotificationEventController(
  notificationEventService,
);

const medicineRepo = new PrismaMedicineRepository();
const medicineService = new MedicineService(
  medicineRepo,
  priceSearchService,
  tenantConfigService,
);
const medicineController = new MedicineController(medicineService);

const inputRepo = new PrismaInputRepository();
const inputService = new InputService(
  inputRepo,
  priceSearchService,
  tenantConfigService,
);
const insumoController = new InsumoController(inputService);

const drawerRepo = new PrismaDrawerRepository();
const drawerService = new DrawerService(drawerRepo);
const drawerController = new DrawerController(drawerService);

const drawerCategoryRepo = new PrismaDrawerCategoryRepository();
const drawerCategoryService = new DrawerCategoryService(drawerCategoryRepo);
const drawerCategoryController = new DrawerCategoryController(
  drawerCategoryService,
);

const cabinetCategoryRepo = new PrismaCabinetCategoryRepository();
const cabinetCategoryService = new CabinetCategoryService(cabinetCategoryRepo);
const cabinetCategoryController = new CabinetCategoryController(
  cabinetCategoryService,
);

const cabinetRepo = new PrismaCabinetRepository();
const cabinetService = new CabinetService(cabinetRepo);
const cabinetController = new CabinetController(cabinetService);

const tenantImportService = new TenantImportService();
const tenantImportController = new TenantImportController(tenantImportService);

@Module({
  controllers: [
    LoginApiController,
    AppApiController,
    AdminApiController,
    DashboardApiController,
    EstoqueApiController,
    MovimentacaoApiController,
    RelatorioApiController,
    TenantApiController,
    ResidenteApiController,
    NotificacaoApiController,
    MedicamentoApiController,
    InsumoApiController,
    GavetaApiController,
    CategoriaGavetaApiController,
    CategoriaArmarioApiController,
    ArmarioApiController,
    SetorApiController,
    TenantImportApiController,
  ],
  providers: [
    { provide: LoginController, useValue: loginController },
    { provide: AppController, useValue: appController },
    { provide: AdminTenantsController, useValue: adminTenantsController },
    { provide: AdminController, useValue: adminController },
    { provide: DashboardController, useValue: dashboardController },
    { provide: StockController, useValue: stockController },
    { provide: MovementController, useValue: movementController },
    { provide: ReportController, useValue: reportController },
    { provide: TenantController, useValue: tenantController },
    { provide: TenantInviteController, useValue: tenantInviteController },
    { provide: ResidentController, useValue: residentController },
    {
      provide: NotificationEventController,
      useValue: notificationEventController,
    },
    { provide: MedicineController, useValue: medicineController },
    { provide: InsumoController, useValue: insumoController },
    { provide: DrawerController, useValue: drawerController },
    { provide: DrawerCategoryController, useValue: drawerCategoryController },
    { provide: CabinetCategoryController, useValue: cabinetCategoryController },
    { provide: CabinetController, useValue: cabinetController },
    { provide: SetorController, useValue: setorController },
    { provide: TenantImportController, useValue: tenantImportController },
  ],
})
export class ApiModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddlewareNest).forRoutes({
      path: '*',
      method: RequestMethod.ALL,
    });

    consumer
      .apply(StandardProtectedMiddleware)
      .forRoutes(
        TenantApiController,
        TenantImportApiController,
        AdminApiController,
        DashboardApiController,
        EstoqueApiController,
        MovimentacaoApiController,
        RelatorioApiController,
        ResidenteApiController,
        NotificacaoApiController,
        MedicamentoApiController,
        InsumoApiController,
        GavetaApiController,
        CategoriaGavetaApiController,
        CategoriaArmarioApiController,
        ArmarioApiController,
        SetorApiController,
      );

    consumer
      .apply(AdminPanelLimiterNest, RequireAdminNest)
      .forRoutes(AdminApiController);
  }
}
