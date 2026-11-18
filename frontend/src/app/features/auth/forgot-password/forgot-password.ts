import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { describeApiError } from '../../../core/http/api-error';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { fieldsMatch } from '../../../shared/validators';

// MVP flow: the password is changed directly, there's no code sent by email/SMS yet.
// When MFA arrives this page becomes two steps (request code -> enter code + new password)
// and the API endpoint will require the code.
@Component({
  selector: 'app-forgot-password',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group(
    {
      userName: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: fieldsMatch('newPassword', 'confirmPassword') },
  );

  constructor() {
    inject(SnackbarService).show(
      'MFA is not implemented yet: passwords are reset without identity verification.',
      'warning',
    );
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const { userName, newPassword } = this.form.getRawValue();
      await this.auth.resetPassword(userName.trim(), newPassword);
      await this.router.navigate(['/login'], { queryParams: { reset: 1 } });
    } catch (err) {
      this.error.set(describeApiError(err, 'The password could not be reset.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
