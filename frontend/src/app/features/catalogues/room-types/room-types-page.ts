import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { RoomType, SaveRoomTypeRequest } from '../../../core/models/room-type';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

// Admin screen for the shared room type catalogue (Single, Double, Suite...).
// Same inline-editor pattern as the hotel rooms table, so every list in the app behaves alike.
@Component({
  selector: 'app-room-types-page',
  imports: [ReactiveFormsModule, NgTemplateOutlet, DecimalPipe, TranslatePipe],
  templateUrl: './room-types-page.html',
})
export class RoomTypesPage implements OnInit {
  private readonly catalogue = inject(CatalogueService);
  private readonly snackbar = inject(SnackbarService);

  readonly roomTypes = signal<RoomType[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // null = closed, 'new' = creating, a RoomType = editing that one.
  readonly editing = signal<RoomType | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    capacity: [2, [Validators.required, Validators.min(1), Validators.max(20)]],
  });

  async ngOnInit(): Promise<void> {
    try {
      this.roomTypes.set(await this.catalogue.getRoomTypes());
    } catch (err) {
      this.error.set(describeApiError(err, 'catalogues.roomTypes.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  isEditing(type: RoomType): boolean {
    const current = this.editing();
    return current !== null && current !== 'new' && current.id === type.id;
  }

  startCreate(): void {
    this.form.reset({ name: '', description: '', capacity: 2 });
    this.formError.set(null);
    this.editing.set('new');
  }

  startEdit(type: RoomType): void {
    this.form.reset({ name: type.name, description: type.description ?? '', capacity: type.capacity });
    this.formError.set(null);
    this.editing.set(type);
  }

  // Number of hotels affected by editing the current type (0 when creating).
  editingRoomCount(): number {
    const current = this.editing();
    return current && current !== 'new' ? current.roomCount : 0;
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  showError(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  async save(): Promise<void> {
    const current = this.editing();
    if (!current) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request: SaveRoomTypeRequest = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      capacity: Number(value.capacity),
    };

    this.saving.set(true);
    this.formError.set(null);

    try {
      const saved =
        current === 'new'
          ? await this.catalogue.createRoomType(request)
          : await this.catalogue.updateRoomType(current.id, request);

      this.roomTypes.update((list) =>
        sortTypes(current === 'new' ? [...list, saved] : list.map((t) => (t.id === saved.id ? saved : t))),
      );
      this.snackbar.show(translate('catalogues.roomTypes.saved', { name: saved.name }), 'success');
      this.editing.set(null);
    } catch (err) {
      this.formError.set(describeApiError(err, 'catalogues.roomTypes.failed'));
    } finally {
      this.saving.set(false);
    }
  }
}

// Same order as the API (by capacity, then name).
function sortTypes(list: RoomType[]): RoomType[] {
  return [...list].sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name));
}
