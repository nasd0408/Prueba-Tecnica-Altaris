import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import { Amenity, RoomType, SaveAmenityRequest, SaveRoomTypeRequest } from '../models/room-type';

// Room types and amenities: small reference lists shared by all hotels.
@Injectable({ providedIn: 'root' })
export class CatalogueService {
  async getRoomTypes(): Promise<RoomType[]> {
    const { data } = await api.get<RoomType[]>('/room-types');
    return data;
  }

  async createRoomType(request: SaveRoomTypeRequest): Promise<RoomType> {
    const { data } = await api.post<RoomType>('/room-types', request);
    return data;
  }

  async updateRoomType(id: number, request: SaveRoomTypeRequest): Promise<RoomType> {
    const { data } = await api.put<RoomType>(`/room-types/${id}`, request);
    return data;
  }

  async getAmenities(): Promise<Amenity[]> {
    const { data } = await api.get<Amenity[]>('/amenities');
    return data;
  }

  async createAmenity(request: SaveAmenityRequest): Promise<Amenity> {
    const { data } = await api.post<Amenity>('/amenities', request);
    return data;
  }

  async updateAmenity(id: number, request: SaveAmenityRequest): Promise<Amenity> {
    const { data } = await api.put<Amenity>(`/amenities/${id}`, request);
    return data;
  }
}
