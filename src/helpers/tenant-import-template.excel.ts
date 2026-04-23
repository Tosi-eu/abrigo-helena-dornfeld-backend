import ExcelJS from 'exceljs';

const SLATE_900 = 'FF0F172A';
const SLATE_600 = 'FF475569';
const SLATE_100 = 'FFF1F5F9';
const SLATE_50 = 'FFF8FAFC';
const WHITE = 'FFFFFFFF';
const BORDER = 'FFE2E8F0';
const BLUE = 'FF2563EB';
const EMERALD = 'FF059669';
const AMBER = 'FFD97706';
const VIOLET = 'FF7C3AED';
const TEAL = 'FF0D9488';
const ROSE = 'FFE11D48';
const INDIGO = 'FF4F46E5';

function thinBorder(color = BORDER): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: 'thin', color: { argb: color } };
  return { top: side, left: side, bottom: side, right: side };
}

function styleTitleCell(cell: ExcelJS.Cell, text: string, accentArgb: string) {
  cell.value = text;
  cell.font = {
    name: 'Calibri',
    size: 20,
    bold: true,
    color: { argb: SLATE_900 },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SLATE_50 },
  };
  cell.border = {
    top: { style: 'thin', color: { argb: BORDER } },
    left: { style: 'thin', color: { argb: BORDER } },
    right: { style: 'thin', color: { argb: BORDER } },
    bottom: { style: 'medium', color: { argb: accentArgb } },
  };
}

function styleHintRow(cell: ExcelJS.Cell, text: string) {
  cell.value = text;
  cell.font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: SLATE_600 },
  };
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: SLATE_100 },
  };
}

function applyHeaderRow(
  row: ExcelJS.Row,
  labels: string[],
  accentArgb: string,
) {
  row.height = 26;
  labels.forEach((label, idx) => {
    const c = row.getCell(idx + 1);
    c.value = label;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: accentArgb },
    };
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = thinBorder(accentArgb);
  });
}

function applyDataRow(
  row: ExcelJS.Row,
  values: (string | number)[],
  zebra: boolean,
) {
  row.height = 22;
  values.forEach((v, idx) => {
    const c = row.getCell(idx + 1);
    c.value = v;
    c.font = { name: 'Calibri', size: 11, color: { argb: SLATE_900 } };
    c.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: zebra ? 'FFFAFAFA' : WHITE },
    };
    c.border = thinBorder();
    c.alignment = {
      vertical: 'middle',
      horizontal: idx === 0 ? 'left' : 'center',
    };
  });
}

function bandDataArea(
  ws: ExcelJS.Worksheet,
  fromRow: number,
  lastCol: number,
  rows = 18,
) {
  for (let r = 0; r < rows; r++) {
    const row = ws.getRow(fromRow + r);
    row.height = 20;
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      if (!cell.value) cell.value = '';
      cell.border = thinBorder('FFF1F5F9');
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: r % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
    }
  }
}

function setupMedicamentos(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Medicamentos', {
    properties: { tabColor: { argb: BLUE } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [
    { width: 26 },
    { width: 22 },
    { width: 14 },
    { width: 18 },
    { width: 16 },
    { width: 12 },
  ];

  sheet.mergeCells(1, 1, 1, 6);
  styleTitleCell(sheet.getCell(1, 1), 'Medicamentos', BLUE);

  sheet.mergeCells(2, 1, 2, 6);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. A linha 4 é só um exemplo — pode apagar ou substituir. Campos obrigatórios: nome, principio_ativo, dosagem, unidade_medida.',
  );
  sheet.getRow(2).height = 36;

  sheet.mergeCells(3, 1, 3, 6);
  const tip = sheet.getCell(3, 1);
  tip.value =
    'Dica: medicamentos iguais (mesmo nome + princípio + dosagem + unidade) são atualizados em vez de duplicados.';
  tip.font = { name: 'Calibri', size: 10, color: { argb: AMBER } };
  tip.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  tip.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  tip.border = thinBorder('FFFDE68A');
  sheet.getRow(3).height = 28;

  const headers = [
    'nome',
    'principio_ativo',
    'dosagem',
    'unidade_medida',
    'estoque_minimo',
    'preco',
  ];
  applyHeaderRow(sheet.getRow(4), headers, SLATE_900);

  applyDataRow(
    sheet.getRow(5),
    ['Dipirona', 'dipirona', '500', 'mg', 0, 0],
    false,
  );

  bandDataArea(sheet, 6, 6, 20);
}

function setupInsumos(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Insumos', {
    properties: { tabColor: { argb: EMERALD } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 28 }, { width: 36 }, { width: 16 }, { width: 12 }];

  sheet.mergeCells(1, 1, 1, 4);
  styleTitleCell(sheet.getCell(1, 1), 'Insumos', EMERALD);

  sheet.mergeCells(2, 1, 2, 4);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. Obrigatório: nome. Os outros campos são opcionais.',
  );
  sheet.getRow(2).height = 30;

  sheet.mergeCells(3, 1, 3, 4);
  const tip = sheet.getCell(3, 1);
  tip.value =
    'Dica: insumos com o mesmo nome são atualizados (não duplicados).';
  tip.font = { name: 'Calibri', size: 10, color: { argb: EMERALD } };
  tip.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFECFDF5' },
  };
  tip.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  tip.border = thinBorder('FFA7F3D0');
  sheet.getRow(3).height = 26;

  applyHeaderRow(
    sheet.getRow(4),
    ['nome', 'descricao', 'estoque_minimo', 'preco'],
    SLATE_900,
  );
  applyDataRow(sheet.getRow(5), ['Gaze', 'Gaze estéril', 0, 0], false);
  bandDataArea(sheet, 6, 4, 20);
}

function setupResidentes(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Residentes', {
    properties: { tabColor: { argb: AMBER } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 12 }, { width: 40 }];

  sheet.mergeCells(1, 1, 1, 2);
  styleTitleCell(sheet.getCell(1, 1), 'Residentes', AMBER);

  sheet.mergeCells(2, 1, 2, 2);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. Obrigatório: casela (número inteiro) e nome. Caselas iguais atualizam o nome.',
  );
  sheet.getRow(2).height = 32;

  sheet.mergeCells(3, 1, 3, 2);
  const tip = sheet.getCell(3, 1);
  tip.value =
    'Dica: use uma casela por linha; evite linhas em branco no meio da lista.';
  tip.font = { name: 'Calibri', size: 10, color: { argb: AMBER } };
  tip.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  tip.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  tip.border = thinBorder('FFFDE68A');
  sheet.getRow(3).height = 26;

  applyHeaderRow(sheet.getRow(4), ['casela', 'nome'], SLATE_900);
  applyDataRow(sheet.getRow(5), [1, 'Fulano de Tal'], false);
  bandDataArea(sheet, 6, 2, 20);
}

function setupSetores(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Setores', {
    properties: { tabColor: { argb: VIOLET } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 22 }, { width: 28 }, { width: 22 }];

  sheet.mergeCells(1, 1, 1, 3);
  styleTitleCell(sheet.getCell(1, 1), 'Setores (opcional)', VIOLET);

  sheet.mergeCells(2, 1, 2, 3);
  styleHintRow(
    sheet.getCell(2, 1),
    'O sistema já cria farmacia e enfermagem. Use esta aba para ajustar nomes, perfil de proporção ou criar setores extra. Preencha a partir da linha 5.',
  );
  sheet.getRow(2).height = 40;

  sheet.mergeCells(3, 1, 3, 3);
  const tip = sheet.getCell(3, 1);
  tip.value =
    'chave: só letras minúsculas, números e _ (ex.: farmacia). perfil_proporcao: farmacia ou enfermagem.';
  tip.font = { name: 'Calibri', size: 10, color: { argb: VIOLET } };
  tip.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF5F3FF' },
  };
  tip.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  tip.border = thinBorder('FFC4B5FD');
  sheet.getRow(3).height = 30;

  applyHeaderRow(
    sheet.getRow(4),
    ['chave', 'nome', 'perfil_proporcao'],
    SLATE_900,
  );
  applyDataRow(sheet.getRow(5), ['farmacia', 'Farmácia', 'farmacia'], false);
  bandDataArea(sheet, 6, 3, 12);
}

function setupCategoriasArmario(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Categorias_armario', {
    properties: { tabColor: { argb: TEAL } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 36 }];

  sheet.mergeCells(1, 1, 1, 1);
  styleTitleCell(sheet.getCell(1, 1), 'Categorias de armário', TEAL);

  sheet.mergeCells(2, 1, 2, 1);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. Obrigatório: nome. Nomes já existentes são ignorados (skipped).',
  );
  sheet.getRow(2).height = 32;

  applyHeaderRow(sheet.getRow(4), ['nome'], SLATE_900);
  applyDataRow(sheet.getRow(5), ['Padrão'], false);
  bandDataArea(sheet, 6, 1, 12);
}

function setupCategoriasGaveta(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Categorias_gaveta', {
    properties: { tabColor: { argb: ROSE } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 36 }];

  sheet.mergeCells(1, 1, 1, 1);
  styleTitleCell(sheet.getCell(1, 1), 'Categorias de gaveta', ROSE);

  sheet.mergeCells(2, 1, 2, 1);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. Obrigatório: nome. Nomes já existentes são ignorados (skipped).',
  );
  sheet.getRow(2).height = 32;

  applyHeaderRow(sheet.getRow(4), ['nome'], SLATE_900);
  applyDataRow(sheet.getRow(5), ['Padrão'], false);
  bandDataArea(sheet, 6, 1, 12);
}

function setupArmarios(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Armarios', {
    properties: { tabColor: { argb: INDIGO } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 14 }, { width: 28 }];

  sheet.mergeCells(1, 1, 1, 2);
  styleTitleCell(sheet.getCell(1, 1), 'Armários', INDIGO);

  sheet.mergeCells(2, 1, 2, 2);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. num_armario: inteiro. categoria_nome deve existir na aba Categorias_armario.',
  );
  sheet.getRow(2).height = 36;

  applyHeaderRow(sheet.getRow(4), ['num_armario', 'categoria_nome'], SLATE_900);
  applyDataRow(sheet.getRow(5), [1, 'Padrão'], false);
  bandDataArea(sheet, 6, 2, 12);
}

function setupGavetas(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Gavetas', {
    properties: { tabColor: { argb: INDIGO } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [{ width: 14 }, { width: 28 }];

  sheet.mergeCells(1, 1, 1, 2);
  styleTitleCell(sheet.getCell(1, 1), 'Gavetas', INDIGO);

  sheet.mergeCells(2, 1, 2, 2);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. num_gaveta: inteiro. categoria_nome deve existir na aba Categorias_gaveta.',
  );
  sheet.getRow(2).height = 36;

  applyHeaderRow(sheet.getRow(4), ['num_gaveta', 'categoria_nome'], SLATE_900);
  applyDataRow(sheet.getRow(5), [1, 'Padrão'], false);
  bandDataArea(sheet, 6, 2, 12);
}

function setupEstoqueMedicamentos(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Estoque_medicamentos', {
    properties: { tabColor: { argb: BLUE } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [
    { width: 22 },
    { width: 18 },
    { width: 12 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 10 },
    { width: 18 },
    { width: 12 },
    { width: 12 },
  ];

  sheet.mergeCells(1, 1, 1, 13);
  styleTitleCell(
    sheet.getCell(1, 1),
    'Estoque — medicamentos (após cadastros)',
    BLUE,
  );

  sheet.mergeCells(2, 1, 2, 13);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. Informe UMA localização: casela (residente), armario OU gaveta. setor = chave (ex.: farmacia). tipo: individual|geral|carrinho_emergencia|carrinho_psicotropicos (opcional).',
  );
  sheet.getRow(2).height = 44;

  sheet.mergeCells(3, 1, 3, 13);
  const tip = sheet.getCell(3, 1);
  tip.value =
    'origem padrão: Importação. validade: AAAA-MM-DD ou DD/MM/AAAA. Linhas iguais (mesmo lote/local) somam quantidade.';
  tip.font = { name: 'Calibri', size: 10, color: { argb: AMBER } };
  tip.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFBEB' },
  };
  tip.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  tip.border = thinBorder('FFFDE68A');
  sheet.getRow(3).height = 28;

  const headers = [
    'nome',
    'principio_ativo',
    'dosagem',
    'unidade_medida',
    'casela',
    'armario',
    'gaveta',
    'validade',
    'quantidade',
    'origem',
    'tipo',
    'setor',
    'lote',
  ];
  applyHeaderRow(sheet.getRow(4), headers, SLATE_900);
  applyDataRow(
    sheet.getRow(5),
    [
      'Dipirona',
      'dipirona',
      '500',
      'mg',
      '',
      1,
      '',
      '2030-12-31',
      10,
      'Importação',
      'geral',
      'farmacia',
      '',
    ],
    false,
  );
  bandDataArea(sheet, 6, 13, 16);
}

function setupEstoqueInsumos(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet('Estoque_insumos', {
    properties: { tabColor: { argb: EMERALD } },
    views: [
      { state: 'frozen', ySplit: 4, activeCell: 'A5', showGridLines: true },
    ],
  });

  sheet.columns = [
    { width: 24 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 12 },
    { width: 14 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
  ];

  sheet.mergeCells(1, 1, 1, 10);
  styleTitleCell(sheet.getCell(1, 1), 'Estoque — insumos', EMERALD);

  sheet.mergeCells(2, 1, 2, 10);
  styleHintRow(
    sheet.getCell(2, 1),
    'Preencha a partir da linha 5. nome = nome do insumo na aba Insumos. Casela exige tipo = individual.',
  );
  sheet.getRow(2).height = 36;

  applyHeaderRow(
    sheet.getRow(4),
    [
      'nome',
      'casela',
      'armario',
      'gaveta',
      'validade',
      'quantidade',
      'tipo',
      'setor',
      'lote',
    ],
    SLATE_900,
  );
  applyDataRow(
    sheet.getRow(5),
    ['Gaze', '', 1, '', '2030-12-31', 20, 'geral', 'farmacia', ''],
    false,
  );
  bandDataArea(sheet, 6, 10, 16);
}

/**
 * Gera o buffer `.xlsx` do template de importação (mesmo ficheiro servido em GET /tenant/import/template).
 */
export async function buildTenantImportTemplateBuffer(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Stokio';
  wb.created = new Date();
  wb.modified = new Date();
  wb.title = 'Importação em massa';
  wb.description =
    'Setores, categorias, armários, gavetas, cadastros (medicamentos, insumos, residentes) e estoque inicial';

  setupSetores(wb);
  setupCategoriasArmario(wb);
  setupCategoriasGaveta(wb);
  setupArmarios(wb);
  setupGavetas(wb);
  setupMedicamentos(wb);
  setupInsumos(wb);
  setupResidentes(wb);
  setupEstoqueMedicamentos(wb);
  setupEstoqueInsumos(wb);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
