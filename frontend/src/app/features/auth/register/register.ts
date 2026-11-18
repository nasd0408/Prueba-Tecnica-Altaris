import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';
import { fieldsMatch } from '../../../shared/validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.html',
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  // Min length mirrors the API password policy (8 chars, at least one digit and one lower case).
  // The API is still the one that decides: its messages are shown if it rejects the password.
  readonly form = inject(NonNullableFormBuilder).group(
    {
      userName: ['', [Validators.required, Validators.maxLength(64)]],
      email: ['', Validators.email],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: fieldsMatch('password', 'confirmPassword') },
  );

  constructor() {
    // Be upfront in the demo: account creation has no identity verification yet.
    inject(SnackbarService).show(translate('auth.register.mfaWarning'), 'warning');
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const { userName, email, password } = this.form.getRawValue();
      await this.auth.register(userName.trim(), email.trim() || null, password);
      // Not signing in automatically: keeps the flow simple and lets the user try the credentials once.
      await this.router.navigate(['/login'], { queryParams: { registered: 1 } });
    } catch (err) {
      this.error.set(describeApiError(err, 'auth.register.failed'));
    } finally {
      this.submitting.set(false);
    }
  }
}
