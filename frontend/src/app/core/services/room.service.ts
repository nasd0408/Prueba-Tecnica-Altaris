import { Injectable } from '@angular/core';

import { api } from '../http/api-client';
import { Room, SaveRoomRequest } from '../models/room';

@Injectable({ providedIn: 'root' })
export class RoomService {
  // Same nesting as the API: rooms are always reached through their hotel.
  private url(hotelId: number): string {
    return `/hotels/${hotelId}/rooms`;
  }

  async getRooms(hotelId: number): Promise<Room[]> {
    const { data } = await api.get<Room[]>(this.url(hotelId));
    return data;
  }

  async createRoom(hotelId: number, request: SaveRoomRequest): Promise<Room> {
    const { data } = await api.post<Room>(this.url(hotelId), request);
    return data;
  }

  async updateRoom(hotelId: number, id: number, request: SaveRoomRequest): Promise<Room> {
    const { data } = await api.put<Room>(`${this.url(hotelId)}/${id}`, request);
    return data;
  }
}
