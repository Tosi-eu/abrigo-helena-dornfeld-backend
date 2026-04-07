import type { Medicine } from '@porto-sdk/sdk';

export type { Medicine };
export type MedicineDto = Medicine;
export type MedicineCreateDto = Omit<Medicine, 'id'>;
