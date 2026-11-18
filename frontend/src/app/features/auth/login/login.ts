import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { describeApiError } from '../../../core/http/api-error';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  // Messages coming from other screens (register/reset/expired session) via query params.
  readonly notice = this.params.has('registered')
    ? 'Account created. You can sign in now.'
    : this.params.has('reset')
      ? 'Password updated. Sign in with your new password.'
      : this.params.has('expired')
        ? 'Your session has expired. Please sign in again.'
        : null;

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    userName: ['', Validators.required],
    password: ['', Validators.required],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    try {
      const { userName, password } = this.form.getRawValue();
      await this.auth.login(userName.trim(), password);

      // Only follow internal paths: an absolute URL in returnUrl would be an open redirect.
      const returnUrl = this.params.get('returnUrl');
      await this.router.navigateByUrl(returnUrl?.startsWith('/') ? returnUrl : '/dashboard');
    } catch (err) {
      // The API answers with a generic message for wrong user OR wrong password on purpose:
      // it doesn't tell an attacker which of the two was wrong.
      this.error.set(describeApiError(err, 'Sign in failed. Please try again.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
