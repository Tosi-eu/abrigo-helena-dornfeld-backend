import CabinetCategoryModel from '../models/categorias-armario.model';

export async function seedCabinetCategories() {
  const count = await CabinetCategoryModel.count();
  if (count > 0) {
    return;
  }

  const defaults = [
    'Medicação geral',
    'Psicotrópicos e injeções',
    'Medicamentos doados / Fitas / Dersane / Clorexidina',
    'Lactulose / Hipratrópio / Pomadas / Domperidona / Materiais de glicemia',
  ];

  await CabinetCategoryModel.bulkCreate(defaults.map(nome => ({ nome })));

  console.log('✓ Categorias criadas.');
}
