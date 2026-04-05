import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'contractCodeOrCamel', async: false })
export class ContractCodeOrCamelConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const o = args.object as {
      contract_code?: string;
      contractCode?: string;
    };
    const a = typeof o.contract_code === 'string' ? o.contract_code.trim() : '';
    const b = typeof o.contractCode === 'string' ? o.contractCode.trim() : '';
    return a.length > 0 || b.length > 0;
  }

  defaultMessage(): string {
    return 'Provide contract_code or contractCode (non-empty)';
  }
}
