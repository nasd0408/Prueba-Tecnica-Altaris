import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { describeApiError } from '../../../core/http/api-error';
import { translate } from '../../../core/i18n/translate';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Hotel } from '../../../core/models/hotel';
import { Room, SaveRoomRequest } from '../../../core/models/room';
import { Amenity, RoomType } from '../../../core/models/room-type';
import { CatalogueService } from '../../../core/services/catalogue.service';
import { HotelService } from '../../../core/services/hotel.service';
import { RoomService } from '../../../core/services/room.service';
import { EmptyState } from '../../../shared/empty-state';
import { Icon } from '../../../shared/icon';
import { SnackbarService } from '../../../shared/snackbar/snackbar.service';

// Hotel "file": its data on the left, the rooms it sells on the right.
// Rooms are managed here (not in their own menu entry) because they only make sense
// inside a hotel - the screen follows the data model.
@Component({
  selector: 'app-hotel-detail',
  imports: [ReactiveFormsModule, RouterLink, CurrencyPipe, NgTemplateOutlet, TranslatePipe, Icon, EmptyState],
  templateUrl: './hotel-detail.html',
  styleUrl: './hotel-detail.css',
})
export class HotelDetail implements OnInit {
  private readonly hotelService = inject(HotelService);
  private readonly roomService = inject(RoomService);
  private readonly catalogueService = inject(CatalogueService);
  private readonly snackbar = inject(SnackbarService);

  // From the :id route param (withComponentInputBinding).
  readonly id = input.required<string>();
  private readonly hotelId = computed(() => Number(this.id()));

  readonly hotel = signal<Hotel | null>(null);
  readonly rooms = signal<Room[]>([]);
  readonly roomTypes = signal<RoomType[]>([]);
  readonly amenities = signal<Amenity[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Editor state: null = closed, 'new' = creating, a Room = editing that one.
  // One inline editor instead of a modal: fewer moving parts and the list stays visible.
  readonly editing = signal<Room | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  // Amenities are kept as a Set of ids in a signal rather than one FormControl per checkbox:
  // the catalogue can have any number of entries, and the API wants exactly a list of ids.
  readonly selectedAmenities = signal<Set<number>>(new Set());

  readonly form = inject(NonNullableFormBuilder).group({
    roomTypeId: [0, [Validators.required, Validators.min(1)]],
    basePrice: [0, [Validators.required, Validators.min(0)]],
  });

  // Room types this hotel doesn't sell yet. When editing, the room's own type stays selectable.
  // Mirrors the API rule "one room per room type per hotel" so the user can't pick a duplicate.
  readonly availableRoomTypes = computed(() => {
    const current = this.editing();
    const taken = new Set(this.rooms().map((r) => r.roomTypeId));
    if (current && current !== 'new') taken.delete(current.roomTypeId);
    return this.roomTypes().filter((t) => !taken.has(t.id));
  });

  readonly maxCapacity = computed(() => Math.max(0, ...this.rooms().map((r) => r.capacity)));

  async ngOnInit(): Promise<void> {
    try {
      // All four requests in parallel: none depends on another.
      const [hotel, rooms, roomTypes, amenities] = await Promise.all([
        this.hotelService.getHotel(this.hotelId()),
        this.roomService.getRooms(this.hotelId()),
        this.catalogueService.getRoomTypes(),
        this.catalogueService.getAmenities(),
      ]);
      this.hotel.set(hotel);
      this.rooms.set(rooms);
      this.roomTypes.set(roomTypes);
      this.amenities.set(amenities);
    } catch (err) {
      this.error.set(describeApiError(err, 'hotels.detail.notFound'));
    } finally {
      this.loading.set(false);
    }
  }

  stars(count: number): string {
    return '★'.repeat(count);
  }

  isEditing(room: Room): boolean {
    const current = this.editing();
    return current !== null && current !== 'new' && current.id === room.id;
  }

  startCreate(): void {
    this.form.reset({ roomTypeId: 0, basePrice: 0 });
    this.selectedAmenities.set(new Set());
    this.formError.set(null);
    this.editing.set('new');
  }

  startEdit(room: Room): void {
    this.form.reset({ roomTypeId: room.roomTypeId, basePrice: room.basePrice });
    this.selectedAmenities.set(new Set(room.amenities.map((a) => a.id)));
    this.formError.set(null);
    this.editing.set(room);
  }

  cancelEdit(): void {
    this.editing.set(null);
  }

  toggleAmenity(id: number): void {
    // New Set instead of mutating: signals compare by reference, a mutated Set wouldn't notify.
    this.selectedAmenities.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  capacityOf(roomTypeId: number): number | null {
    return this.roomTypes().find((t) => t.id === roomTypeId)?.capacity ?? null;
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
    const request: SaveRoomRequest = {
      roomTypeId: Number(value.roomTypeId),
      basePrice: Number(value.basePrice),
      amenityIds: [...this.selectedAmenities()],
    };

    this.saving.set(true);
    this.formError.set(null);

    try {
      // Update the local list with the API response instead of reloading everything:
      // one request less and the table doesn't flicker.
      if (current === 'new') {
        const created = await this.roomService.createRoom(this.hotelId(), request);
        this.rooms.update((list) => sortByPrice([...list, created]));
        this.snackbar.show(translate('hotels.detail.added', { type: created.roomTypeName }), 'success');
      } else {
        const updated = await this.roomService.updateRoom(this.hotelId(), current.id, request);
        this.rooms.update((list) => sortByPrice(list.map((r) => (r.id === updated.id ? updated : r))));
        this.snackbar.show(translate('hotels.detail.updated', { type: updated.roomTypeName }), 'success');
      }
      this.editing.set(null);
    } catch (err) {
      // 409 from the API if this hotel already sells that room type.
      this.formError.set(describeApiError(err, 'hotels.detail.saveFailed'));
    } finally {
      this.saving.set(false);
    }
  }
}

// Same order as the API returns them, so a saved row lands where a reload would put it.
function sortByPrice(list: Room[]): Room[] {
  return [...list].sort((a, b) => a.basePrice - b.basePrice || a.roomTypeName.localeCompare(b.roomTypeName));
}
