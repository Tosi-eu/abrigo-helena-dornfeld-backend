import type { Input } from '@stokio/sdk';

export type { Input };
export type InputDto = Input;
export type InputCreateDto = Omit<Input, 'id'>;
