import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export function OptionalTrimmedString(maxLength?: number) {
  const trim = Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return value;
    const t = value.trim();
    if (t === '') return undefined;
    return maxLength != null ? t.slice(0, maxLength) : t;
  });
  const len = maxLength != null ? [MaxLength(maxLength)] : [];
  return applyDecorators(trim, IsOptional(), IsString(), ...len);
}

export function TrimmedString(min = 1, maxLength?: number) {
  const trim = Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
  const bounds = [MinLength(min), ...(maxLength != null ? [MaxLength(maxLength)] : [])];
  return applyDecorators(trim, IsString(), IsNotEmpty(), ...bounds);
}

export function EmailNormalized() {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    IsEmail(),
  );
}
