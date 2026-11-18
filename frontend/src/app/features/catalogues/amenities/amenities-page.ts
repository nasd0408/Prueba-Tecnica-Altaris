import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Amenity } from '../../../core/models/room-type';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { Icon } from '../../../shared/icon';
import { SkeletonRows } from '../../../shared/skeleton';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

// Admin screen for the shared amenities catalogue (Wi-Fi, TV, pool access...).
@Component({
  selector: 'app-amenities-page',
  imports: [ReactiveFormsModule, NgTemplateOutlet, DecimalPipe, TranslatePipe, Icon, SkeletonRows],
  templateUrl: './amenities-page.html',
})
export class AmenitiesPage implements OnInit {
  private readonly catalogue = inject(CatalogueService);
  private readonly snackbar = inject(SnackbarService);

  readonly amenities = signal<Amenity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // null = closed, 'new' = creating, an Amenity = editing that one.
  readonly editing = signal<Amenity | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.amenities.set(await this.catalogue.getAmenities());
    } catch (err) {
      this.error.set(describeApiError(err, 'catalogues.amenities.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  isEditing(amenity: Amenity): boolean {
    const current = this.editing();
    return current !== null && current !== 'new' && current.id === amenity.id;
  }

  startCreate(): void {
    this.form.reset({ name: '' });
    this.formError.set(null);
    this.editing.set('new');
  }

  startEdit(amenity: Amenity): void {
    this.form.reset({ name: amenity.name });
    this.formError.set(null);
    this.editing.set(amenity);
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  async save(): Promise<void> {
    const current = this.editing();
    if (!current) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const request = { name: this.form.getRawValue().name.trim() };
    this.saving.set(true);
    this.formError.set(null);

    try {
      const saved =
        current === 'new'
          ? await this.catalogue.createAmenity(request)
          : await this.catalogue.updateAmenity(current.id, request);

      this.amenities.update((list) =>
        (current === 'new' ? [...list, saved] : list.map((a) => (a.id === saved.id ? saved : a))).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      this.snackbar.show(translate('catalogues.amenities.saved', { name: saved.name }), 'success');
      this.editing.set(null);
    } catch (err) {
      this.formError.set(describeApiError(err, 'catalogues.amenities.failed'));
    } finally {
      this.saving.set(false);
    }
  }
}
