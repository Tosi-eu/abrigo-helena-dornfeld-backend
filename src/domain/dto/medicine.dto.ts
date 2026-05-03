import type { Medicine } from '@stokio/sdk';

export type { Medicine };
export type MedicineDto = Medicine;
export type MedicineCreateDto = Omit<Medicine, 'id'>;
