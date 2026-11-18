// Mirrors the catalogue DTOs in the backend (RoomTypeDto, AmenityDto and their save requests).

export interface RoomType {
  id: number;
  name: string;
  description: string | null;
  capacity: number;
  roomCount: number; // how many hotels offer it
}

export type SaveRoomTypeRequest = Pick<RoomType, 'name' | 'description' | 'capacity'>;

export interface Amenity {
  id: number;
  name: string;
  roomCount: number;
}

export type SaveAmenityRequest = Pick<Amenity, 'name'>;
