import type { Input } from '@porto-sdk/sdk';

export type { Input };
export type InputDto = Input;
export type InputCreateDto = Omit<Input, 'id'>;
