import { SectorType } from "../../core/utils/utils";

export const toSectorType = (
  setor?: unknown,
): SectorType | null | 'invalid' => {
  if (setor == null) return null;

  switch (setor) {
    case 'farmacia':
      return SectorType.FARMACIA;
    case 'enfermagem':
      return SectorType.ENFERMAGEM;
    default:
      return 'invalid';
  }
};
