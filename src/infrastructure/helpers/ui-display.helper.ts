export const DISPLAY_CONFIG_KEYS = {
  casela: 'display_casela',
  caselaSetor: 'display_casela_setor',
  armario: 'display_armario',
  gaveta: 'display_gaveta',
} as const;

export type DisplayCaselaMode = 'numero' | 'nome';
export type DisplayCaselaSetorScope = 'farmacia' | 'enfermagem' | 'todos';
export type DisplayArmarioGavetaMode = 'numero' | 'categoria';

export type UiDisplayConfig = {
  casela: DisplayCaselaMode;
  caselaSetor: DisplayCaselaSetorScope;
  armario: DisplayArmarioGavetaMode;
  gaveta: DisplayArmarioGavetaMode;
};

export const DEFAULT_UI_DISPLAY: UiDisplayConfig = {
  casela: 'numero',
  caselaSetor: 'todos',
  armario: 'numero',
  gaveta: 'numero',
};

const CASELA_VALUES: DisplayCaselaMode[] = ['numero', 'nome'];
const CASELA_SETOR_VALUES: DisplayCaselaSetorScope[] = [
  'farmacia',
  'enfermagem',
  'todos',
];
const ARM_GAV_VALUES: DisplayArmarioGavetaMode[] = ['numero', 'categoria'];

function parseCasela(v: string | undefined | null): DisplayCaselaMode {
  const s = (v ?? '').trim().toLowerCase();
  return CASELA_VALUES.includes(s as DisplayCaselaMode)
    ? (s as DisplayCaselaMode)
    : DEFAULT_UI_DISPLAY.casela;
}

function parseArmGav(v: string | undefined | null): DisplayArmarioGavetaMode {
  const s = (v ?? '').trim().toLowerCase();
  return ARM_GAV_VALUES.includes(s as DisplayArmarioGavetaMode)
    ? (s as DisplayArmarioGavetaMode)
    : DEFAULT_UI_DISPLAY.armario;
}

function parseCaselaSetor(
  v: string | undefined | null,
): DisplayCaselaSetorScope {
  const s = (v ?? '').trim().toLowerCase();
  return CASELA_SETOR_VALUES.includes(s as DisplayCaselaSetorScope)
    ? (s as DisplayCaselaSetorScope)
    : DEFAULT_UI_DISPLAY.caselaSetor;
}

export function uiDisplayFromConfigRow(
  all: Record<string, string>,
): UiDisplayConfig {
  return {
    casela: parseCasela(all[DISPLAY_CONFIG_KEYS.casela]),
    caselaSetor: parseCaselaSetor(all[DISPLAY_CONFIG_KEYS.caselaSetor]),
    armario: parseArmGav(all[DISPLAY_CONFIG_KEYS.armario]),
    gaveta: parseArmGav(all[DISPLAY_CONFIG_KEYS.gaveta]),
  };
}

export function validateDisplayConfigPatch(
  patch: Record<string, string>,
): string | null {
  const entries = Object.entries(patch).filter(
    ([k]) =>
      k === DISPLAY_CONFIG_KEYS.casela ||
      k === DISPLAY_CONFIG_KEYS.caselaSetor ||
      k === DISPLAY_CONFIG_KEYS.armario ||
      k === DISPLAY_CONFIG_KEYS.gaveta,
  );
  for (const [key, raw] of entries) {
    const v = String(raw ?? '').trim().toLowerCase();
    if (key === DISPLAY_CONFIG_KEYS.casela) {
      if (!CASELA_VALUES.includes(v as DisplayCaselaMode)) {
        return `display_casela deve ser: ${CASELA_VALUES.join(' ou ')}`;
      }
    } else if (key === DISPLAY_CONFIG_KEYS.caselaSetor) {
      if (!CASELA_SETOR_VALUES.includes(v as DisplayCaselaSetorScope)) {
        return `display_casela_setor deve ser: ${CASELA_SETOR_VALUES.join(', ')}`;
      }
    } else if (!ARM_GAV_VALUES.includes(v as DisplayArmarioGavetaMode)) {
      return `${key} deve ser: ${ARM_GAV_VALUES.join(' ou ')}`;
    }
  }
  return null;
}
