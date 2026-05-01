export type TenantImportRowStatus = 'created' | 'updated' | 'skipped' | 'error';

export type TenantImportSheet =
  | 'Setores'
  | 'Categorias_armario'
  | 'Categorias_gaveta'
  | 'Armarios'
  | 'Gavetas'
  | 'Medicamentos'
  | 'Insumos'
  | 'Residentes'
  | 'Estoque_medicamentos'
  | 'Estoque_insumos';

export type TenantImportRowError = {
  sheet: TenantImportSheet;
  /** 1-indexed row number in the sheet (including header row). */
  row: number;
  field?: string;
  message: string;
  raw?: Record<string, unknown>;
};

export type TenantImportEntitySummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type TenantImportRowResult = {
  sheet: TenantImportSheet;
  /** 1-indexed row number in the sheet (including header row). */
  row: number;
  status: TenantImportRowStatus;
};

export type TenantPgDumpImportSummary = {
  categoriaArmario: number;
  categoriaGaveta: number;
  armarios: number;
  gavetas: number;
  medicamentos: number;
  insumos: number;
  residentes: number;
  logins: number;
  estoqueMedicamentos: number;
  estoqueInsumos: number;
  movimentacoes: number;
  notificacoes: number;
};

export type TenantPgDumpImportResponse = {
  ok: true;
  warnings: string[];
  summary: TenantPgDumpImportSummary;
};

export type TenantImportXlsxResponse = {
  ok: true;
  summary: {
    setores: TenantImportEntitySummary;
    cabinetCategories: TenantImportEntitySummary;
    drawerCategories: TenantImportEntitySummary;
    cabinets: TenantImportEntitySummary;
    drawers: TenantImportEntitySummary;
    medicines: TenantImportEntitySummary;
    inputs: TenantImportEntitySummary;
    residents: TenantImportEntitySummary;
    medicineStock: TenantImportEntitySummary;
    inputStock: TenantImportEntitySummary;
  };
  rows: {
    setores: TenantImportRowResult[];
    cabinetCategories: TenantImportRowResult[];
    drawerCategories: TenantImportRowResult[];
    cabinets: TenantImportRowResult[];
    drawers: TenantImportRowResult[];
    medicines: TenantImportRowResult[];
    inputs: TenantImportRowResult[];
    residents: TenantImportRowResult[];
    medicineStock: TenantImportRowResult[];
    inputStock: TenantImportRowResult[];
  };
  errors: TenantImportRowError[];
};
