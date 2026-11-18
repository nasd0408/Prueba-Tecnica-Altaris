import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

// Cross-field rule, so it goes on the form group and not on a single control.
// Shared by register and reset password.
export function fieldsMatch(field: string, confirmField: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const value = group.get(field)?.value;
    const confirm = group.get(confirmField)?.value;
    return value && confirm && value !== confirm ? { fieldsMismatch: true } : null;
  };
}
