import { Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { describeApiError } from '../../../core/http/api-error';
import { SaveHotelRequest } from '../../../core/models/hotel';
import { HotelService } from '../../../core/services/hotel.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

// One component for create and edit: the form is identical, only the save call changes.
// If `id` comes in the route it's an edit, otherwise it's a new hotel.
@Component({
  selector: 'app-hotel-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './hotel-form.html',
  styleUrl: './hotel-form.css',
})
export class HotelForm implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly hotelService = inject(HotelService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);

  // Filled from the :id route param thanks to withComponentInputBinding().
  readonly id = input<string>();

  readonly starOptions = [1, 2, 3, 4, 5];
  readonly countries = signal<string[]>([]);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  // Validators mirror the API rules (SaveHotelRequest). The API validates anyway;
  // these are here so the user gets feedback before submitting.
  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    city: ['', [Validators.required, Validators.maxLength(100)]],
    country: ['', [Validators.required, Validators.maxLength(100)]],
    address: ['', Validators.maxLength(250)],
    stars: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    email: ['', [Validators.email, Validators.maxLength(150)]],
    phone: ['', Validators.maxLength(30)],
    isActive: [true],
  });

  get isEdit(): boolean {
    return !!this.id();
  }

  async ngOnInit(): Promise<void> {
    this.hotelService.getCountries().then((list) => this.countries.set(list), () => {});

    const id = this.id();
    if (!id) return;

    try {
      const hotel = await this.hotelService.getHotel(+id);
      this.form.patchValue({
        ...hotel,
        address: hotel.address ?? '',
        email: hotel.email ?? '',
        phone: hotel.phone ?? '',
      });
    } catch {
      this.error.set('Hotel not found.');
    }
  }

  // Small helper to keep the template readable: show an error only after the user touched the field.
  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // reveal all messages at once
      return;
    }

    const value = this.form.getRawValue();
    const request: SaveHotelRequest = {
      ...value,
      stars: Number(value.stars),
      // Empty optional fields are sent as null, not "", so the DB doesn't fill up with empty strings.
      address: value.address || null,
      email: value.email || null,
      phone: value.phone || null,
    };

    this.saving.set(true);
    this.error.set(null);

    try {
      const id = this.id();
      const saved = id
        ? await this.hotelService.updateHotel(+id, request)
        : await this.hotelService.createHotel(request);

      this.snackbar.show(`Hotel "${saved.name}" ${id ? 'updated' : 'created'}.`, 'success');
      await this.router.navigate(['/hotels']);
    } catch (err) {
      this.error.set(describeApiError(err, 'The hotel could not be saved. Please try again.'));
    } finally {
      this.saving.set(false);
    }
  }
}
